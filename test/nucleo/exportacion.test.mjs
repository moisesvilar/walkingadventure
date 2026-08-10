// SPEC-039 · Exportar e importar la partida: el manifiesto canónico, la lista de
// partes, la completitud del contenedor y la sustitución al importar.
//
// Casi todo lo de aquí es del **paquete**, y es deliberado: el núcleo entrega la lista
// de partes en orden canónico y valida lo que le devuelvan, así que «un fichero es una
// partida» es una validación de datos y se puede afirmar sin escribir ni un fichero.
//
// El contenedor —la cabecera, el empaquetado— vive en `app/datos/empaquetador.js`, y
// desde que recibe el nombre del manifiesto por la puerta **sí se alcanza**. Entra en
// tres criterios y solo en tres, que son los que hablan del fichero y no de la lista de
// partes: las dos exportaciones idénticas, el tamaño medido y las marcas de reloj en las
// entradas del contenedor. Lo demás que el contenedor hace —desempaquetar, el fichero
// truncado, guardar y abrir una copia— vive en `copia.test.mjs`.
//
// Nada toca la red ni el reloj: los mundos son sintéticos y la partida de prueba la
// monta `copia-de-prueba.mjs`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLASES_DE_PARTE,
  CLAVE_DE_IMPORTACION_EN_CURSO,
  CLAVE_DE_PROCEDENCIA,
  CODIFICACIONES,
  EXTENSION_DE_PARTIDA,
  NOMBRE_DEL_MANIFIESTO,
  PREFIJOS_DE_LA_PARTIDA,
  PROCEDENCIAS,
  bytesDeParte,
  compruebaCompletitud,
  componeExportacion,
  documentoDeProcedencia,
  exigeSinImportacionAMedias,
  importaPartida,
  manifiestoDe,
  medidaPorClaseDeParte,
  nombreDeFichero,
  ordenDePartes,
  parteDeDocumento,
  partesDeLaPartida,
  procedenciaDe,
  validaManifiesto,
  validaPartes,
} from '../../packages/nucleo/partida/exportacion.js';
import { CLASES, VERSION_FORMATO, VERSION_GENERADOR, lee, texto as textoCanonico } from '../../packages/nucleo/partida/formato.js';
import { CLAVES, cargaMapa } from '../../packages/nucleo/partida/mapa.js';
import { CLAVES_DE_PARTIDA } from '../../packages/nucleo/partida/reconstruccion.js';
import { cargaPartida } from '../../packages/nucleo/partida/reconstruccion.js';
import { entradasDe } from '../../packages/nucleo/partida/diario.js';
import { creaAlmacenDeBinarios } from '../../app/recursos/almacen-de-binarios.js';
import { CABECERA, creaEmpaquetador } from '../../app/datos/empaquetador.js';
import { PRESUPUESTO_DE_ESTADO_BYTES, PRESUPUESTO_DE_REGISTRO_BYTES, medidaDeLaPartida } from '../../packages/nucleo/partida/compactacion.js';
import {
  ANCLAJE_DE_CASA,
  ANCLAJE_DE_VACACIONES,
  BYTES_DE_ILUSTRACION,
  DIAS_DE_LA_PARTIDA_LARGA,
  NUCLEO_DEL_CONTENEDOR,
  SEMILLA_A,
  TEXTO_DEL_NARRADOR,
  almacenEnMemoria,
  conSalidasHastaElDia,
  mapaGuardado,
  partidaCompleta,
  volcado,
} from './copia-de-prueba.mjs';

/** La exportación de una partida ya montada. */
const exporta = ({ almacen, binarios }) => componeExportacion({ almacen, binarios });

/** El contenedor, armado como lo arma la app: con el nombre del manifiesto inyectado. */
const { empaqueta } = creaEmpaquetador(NUCLEO_DEL_CONTENEDOR);

/** Las partes sin el manifiesto, que es lo que se vuelve a manifestar al manipular una. */
const sinManifiesto = (partes) => partes.filter((p) => p.nombre !== NOMBRE_DEL_MANIFIESTO);

/**
 * Rehace el manifiesto de una lista de partes manipulada.
 *
 * Hace falta porque tocar una parte cambia su longitud, y comprobar la completitud
 * contra el manifiesto viejo diría «incompleto» cuando lo que se está probando es otra
 * cosa. Así cada prueba rompe **una** cosa y no dos.
 */
function refresca(partes, recuentos) {
  const cuerpo = sinManifiesto(partes).slice().sort(ordenDePartes);
  const manifiesto = manifiestoDe(cuerpo, recuentos);
  const cabecera = parteDeDocumento(NOMBRE_DEL_MANIFIESTO, textoCanonico(manifiesto));
  cabecera.clase = CLASES_DE_PARTE.MANIFIESTO;
  return { manifiesto, partes: [cabecera, ...cuerpo] };
}

/** Una copia manipulable de una parte de documento. */
const conDocumento = (parte, cambia) => {
  const doc = JSON.parse(parte.contenido);
  cambia(doc);
  return { ...parte, contenido: JSON.stringify(doc) };
};

describe('Exportar la partida', () => {
  test('El fichero exportado trae los dos mapas, el estado, el registro y los recursos', async () => {
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);
    const nombres = partes.map((p) => p.nombre);

    for (const mapa of [partida.casa, partida.vacaciones]) {
      assert.ok(nombres.includes(CLAVES.indice(mapa.id)), `falta el índice del mapa ${mapa.id}`);
      assert.ok(nombres.includes(CLAVES.celda(mapa.id, '0,0')), `falta la celda del mapa ${mapa.id}`);
    }
    assert.ok(nombres.includes(CLAVES_DE_PARTIDA.estado), 'falta el estado');
    assert.ok(nombres.includes(CLAVES_DE_PARTIDA.registro), 'falta el registro de hechos');
    assert.ok(nombres.includes(partida.referencia), 'falta el recurso binario residente');
    assert.equal(manifiesto.recuentos.mapas, 2, 'el manifiesto no declara los dos mapas');
    assert.equal(manifiesto.recuentos.recursos, 1);
    assert.equal(manifiesto.recuentos.documentos, 6);
  });

  test('El manifiesto declara la versión de formato de la constante única y la lista completa de partes', async () => {
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);

    assert.equal(manifiesto.version, VERSION_FORMATO, 'la versión no sale de la constante única de SPEC-009');
    assert.equal(manifiesto.generador, VERSION_GENERADOR, 'no declara con qué versión de reglas se escribió');
    assert.equal(manifiesto.clase, CLASES.MANIFIESTO);
    assert.equal(manifiesto.extension, EXTENSION_DE_PARTIDA);
    assert.deepEqual(
      manifiesto.partes.map((p) => p.nombre),
      sinManifiesto(partes).map((p) => p.nombre),
      'el manifiesto y las partes no cuentan lo mismo',
    );
    for (const declarada of manifiesto.partes) {
      const parte = partes.find((p) => p.nombre === declarada.nombre);
      assert.equal(declarada.longitud, parte.contenido.length, `la longitud declarada de "${declarada.nombre}" no es la del contenido ya codificado`);
      assert.ok([CODIFICACIONES.TEXTO, CODIFICACIONES.BASE64].includes(declarada.codificacion));
    }
    assert.equal(partes[0].nombre, NOMBRE_DEL_MANIFIESTO, 'el manifiesto no es la primera parte');
    assert.equal(partes[0].clase, CLASES_DE_PARTE.MANIFIESTO);
  });

  test('El fichero trae exactamente las partes que su manifiesto declara, ni una más ni una menos', async () => {
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);
    assert.equal(compruebaCompletitud(manifiesto, partes), manifiesto, 'una exportación recién hecha no se declara completa');

    const falta = partes.filter((p) => p.nombre !== CLAVES_DE_PARTIDA.registro);
    assert.throws(() => compruebaCompletitud(manifiesto, falta), new RegExp(CLAVES_DE_PARTIDA.registro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    const sobra = [...partes, parteDeDocumento('partida/colada.json', '{}')];
    assert.throws(() => compruebaCompletitud(manifiesto, sobra), /colada\.json.*no declara/s);
  });

  test('Exportar dos veces la misma partida da el mismo fichero byte a byte', async () => {
    const partida = await partidaCompleta();
    const primera = await exporta(partida);
    const segunda = await exporta(partida);
    // Serialización completa y no campo a campo: es lo único que afirma «byte a byte».
    assert.equal(JSON.stringify(segunda.partes), JSON.stringify(primera.partes), 'las dos exportaciones difieren');
    assert.equal(textoCanonico(segunda.manifiesto), textoCanonico(primera.manifiesto));
    assert.equal(
      medidaPorClaseDeParte(segunda.partes).total,
      medidaPorClaseDeParte(primera.partes).total,
      'las dos exportaciones no miden lo mismo',
    );

    // Y **el fichero**, que es de lo que habla el criterio: dos listas de partes iguales
    // podrían empaquetarse distinto si el contenedor pusiera una fecha o comprimiera, que
    // son las dos cosas que la spec le prohíbe. Sin esto, «byte a byte» se afirmaba sobre
    // lo que produce el núcleo y no sobre lo que sale del móvil.
    const fichero = empaqueta(primera.partes);
    assert.equal(empaqueta(segunda.partes), fichero, 'las dos exportaciones producen contenedores distintos');
    assert.equal(fichero.startsWith(`${CABECERA}\n`), true, 'el fichero no empieza por la cabecera que lo identifica');
    // Y una partida montada de cero por segunda vez da el mismo fichero: lo que se
    // afirma no es que exportar sea estable dentro de un proceso, sino que dos móviles
    // con la misma partida producen el mismo fichero.
    const otraVez = await partidaCompleta();
    assert.equal(empaqueta((await exporta(otraVez)).partes), fichero, 'la misma partida montada dos veces no da el mismo fichero');
  });

  test('El fichero exportado no lleva ninguna marca del reloj real', async () => {
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);

    // Ni en el manifiesto: sus campos son una lista cerrada y ninguno es una fecha.
    assert.deepEqual(Object.keys(manifiesto).sort(), ['clase', 'extension', 'generador', 'partes', 'recuentos', 'version']);
    for (const entrada of manifiesto.partes) {
      assert.deepEqual(Object.keys(entrada).sort(), ['clase', 'codificacion', 'longitud', 'nombre'], 'una entrada del contenedor declara algo más que su nombre, su clase, su codificación y su longitud');
    }
    // Ni en el cuerpo: ni fechas ISO, ni epochs, ni campos con nombre de reloj.
    const todo = partes.map((p) => p.contenido).join('');
    assert.doesNotMatch(todo, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'hay una fecha ISO dentro del fichero');
    for (const nombre of ['"creado"', '"modificado"', '"fecha"', '"timestamp"', '"instante"', '"hora"']) {
      assert.equal(todo.includes(nombre), false, `el fichero lleva el campo ${nombre}, que es una marca del reloj real`);
    }

    // **Ni en las entradas del contenedor**, que es la mitad del criterio que hasta
    // ahora no se podía tocar. Un contenedor estándar pone la fecha de cada entrada él
    // solo; este describe cada parte con cuatro campos y ninguno es un reloj.
    const cabecera = empaqueta(partes).split('\n\n')[0].split('\n');
    assert.equal(cabecera[0], CABECERA);
    assert.equal(cabecera[1], String(partes.length), 'la cabecera no dice cuántas partes trae');
    for (const linea of cabecera.slice(2)) {
      const campos = linea.split('\t');
      assert.equal(campos.length, 4, `una entrada del contenedor describe ${campos.length} campos: "${linea}"`);
      assert.doesNotMatch(linea, /\d{4}-\d{2}-\d{2}/, `la entrada "${campos[0]}" del contenedor lleva una fecha`);
      assert.match(campos[3], /^\d+$/, `la entrada "${campos[0]}" no declara su longitud como número`);
    }
  });

  test('Los textos del narrador cacheados van dentro y el manifiesto declara que van', async () => {
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);

    assert.equal(manifiesto.recuentos.textosDelNarrador, 1, 'el manifiesto no declara los textos del narrador');
    const celda = partes.find((p) => p.nombre === CLAVES.celda(partida.casa.id, '0,0'));
    assert.ok(celda.contenido.includes(TEXTO_DEL_NARRADOR), 'el texto del narrador no viaja dentro del fichero');
  });

  test('Una partida recién creada sin ningún mapa se exporta igual y no es un error', async () => {
    const almacen = almacenEnMemoria();
    const { manifiesto, partes } = await componeExportacion({ almacen });

    assert.equal(partes.length, 1, 'una partida vacía tiene que producir su manifiesto y nada más');
    assert.equal(partes[0].nombre, NOMBRE_DEL_MANIFIESTO);
    assert.deepEqual(manifiesto.partes, []);
    assert.deepEqual({ ...manifiesto.recuentos }, { documentos: 0, recursos: 0, textosDelNarrador: 0, mapas: 0 });
    assert.equal(validaManifiesto(manifiesto), manifiesto, 'el manifiesto de una partida vacía no se valida');
  });

  test('Una partida sin ningún recurso binario se exporta igual y el manifiesto declara cero recursos', async () => {
    const almacen = almacenEnMemoria();
    await mapaGuardado({ almacen, arranque: ANCLAJE_DE_CASA });
    const { manifiesto, partes } = await componeExportacion({ almacen, binarios: creaAlmacenDeBinarios() });

    assert.equal(manifiesto.recuentos.recursos, 0);
    assert.equal(partes.filter((p) => p.clase === CLASES_DE_PARTE.RECURSO).length, 0);
    assert.equal(manifiesto.recuentos.mapas, 1);
  });

  test('Exportar no toca la partida: ni el estado, ni el registro, ni ningún documento', async () => {
    const partida = await partidaCompleta();
    const antes = await volcado(partida.almacen);
    partida.almacen.registro.length = 0;

    await exporta(partida);

    assert.deepEqual(partida.almacen.operaciones('escribe'), [], 'exportar ha escrito en la partida');
    assert.deepEqual(partida.almacen.operaciones('borra'), [], 'exportar ha borrado algo de la partida');
    assert.equal(JSON.stringify(await volcado(partida.almacen)), JSON.stringify(antes), 'la partida no es idéntica byte a byte después de exportar');
  });

  test('El tamaño del fichero queda declarado fase a fase por tipo de parte', async () => {
    const partida = await partidaCompleta();
    const { partes } = await exporta(partida);
    const medida = medidaPorClaseDeParte(partes);

    assert.equal(medida.manifiesto + medida.documento + medida.recurso, medida.total, 'la medida por clase no suma el total');
    for (const clase of ['manifiesto', 'documento', 'recurso']) {
      assert.ok(medida[clase] > 0, `la clase de parte "${clase}" no se está midiendo`);
    }
    // El instrumento con el que se decidiría la poda: los documentos son la mayoría y
    // se puede decir cuánto, que es lo que pedía el criterio de tamaño.
    assert.ok(medida.documento > medida.manifiesto, 'los documentos no dominan el fichero: la medida no está midiendo la partida');

    // Y **el fichero entero**, contenedor incluido, que es lo que ocupa en el móvil: la
    // medida por clase cuenta los contenidos y el contenedor añade su cabecera. Los dos
    // números se declaran, y la diferencia entre ellos es exactamente esa cabecera.
    const fichero = empaqueta(partes);
    const cabecera = fichero.indexOf('\n\n') + 2;
    assert.equal(fichero.length, cabecera + medida.total, 'el fichero mide algo distinto de su cabecera más sus partes: el contenedor está añadiendo o perdiendo bytes');
    assert.equal(fichero.length, 24057, `la partida de dos mapas y una salida ocupa ${fichero.length} B y estaba declarada en 24 057 B: el tamaño del fichero ha cambiado y hay que revisarlo, no actualizar el número a ciegas`);
  });

  test('El fichero de una partida de mil días queda medido entero y cabe en el presupuesto de SPEC-016', async () => {
    // La partida que pide el criterio de tamaño, montada de verdad: dos mapas y mil
    // días de salidas, tres hechos por salida. El presupuesto no se cita de memoria —se
    // compara contra las constantes de SPEC-016— y el fichero se mide empaquetado, que
    // es el número que de verdad viaja por mensajería.
    const partida = await conSalidasHastaElDia(await partidaCompleta(), DIAS_DE_LA_PARTIDA_LARGA);
    const { partes } = await exporta(partida);
    const medida = medidaPorClaseDeParte(partes);
    const fichero = empaqueta(partes);

    const dentro = medidaDeLaPartida(partida);
    assert.equal(dentro.hechos, 3 * DIAS_DE_LA_PARTIDA_LARGA, 'la partida larga no tiene los hechos de mil salidas');
    assert.equal(dentro.pasaElPresupuesto, false, `una partida de ${DIAS_DE_LA_PARTIDA_LARGA} días ya pasa del presupuesto de SPEC-016: toca compactar antes de lo previsto`);
    assert.ok(dentro.registro < PRESUPUESTO_DE_REGISTRO_BYTES, `el registro de mil días mide ${dentro.registro} B y el presupuesto es ${PRESUPUESTO_DE_REGISTRO_BYTES} B`);
    assert.ok(dentro.estado < PRESUPUESTO_DE_ESTADO_BYTES, `el estado de mil días mide ${dentro.estado} B y el presupuesto es ${PRESUPUESTO_DE_ESTADO_BYTES} B`);

    // El tamaño declarado, fase a fase y entero. El registro es lo que crece con los
    // días, así que los documentos dominan todavía más que en una partida corta: es el
    // dato con el que se decidiría podar, y por eso se dice y no se estima.
    assert.equal(fichero.length, 718638, `la partida de mil días ocupa ${fichero.length} B y estaba declarada en 718 638 B: el tamaño del fichero ha cambiado y hay que revisarlo`);
    assert.ok(medida.documento / medida.total > 0.99, 'los documentos han dejado de ser casi todo el fichero de una partida larga');
    assert.ok(fichero.length < 1024 * 1024, `el fichero de una partida de mil días pasa del mega: ${fichero.length} B`);
  });

  test('El fichero exportado no contiene ningún histórico de posiciones ni coordenada de la jugadora', async () => {
    const partida = await partidaCompleta();
    const { partes } = await exporta(partida);
    const todo = partes.map((p) => p.contenido).join('');

    for (const rastro of ['"traza"', '"recorrido"', '"historico"', '"posiciones"', '"camino"', '"gps"', '"sensor"', '"velocidad"']) {
      assert.equal(todo.includes(rastro), false, `el fichero exportado lleva ${rastro}`);
    }
    // Y la guarda del formato pasa sobre el estado y el registro, que es donde cabría.
    const { manifiesto } = await exporta(partida);
    assert.equal(validaPartes(manifiesto, partes).length, 6, 'no se han validado los seis documentos del fichero');
  });

  test('Del mundo sale el anclaje redondeado de cada mapa y ninguna coordenada más precisa', async () => {
    const partida = await partidaCompleta();
    const { partes } = await exporta(partida);
    const todo = partes.map((p) => p.contenido).join('');

    assert.ok(todo.includes(partida.casa.id), 'el anclaje redondeado del mapa de casa no está en el fichero');
    assert.ok(todo.includes(partida.vacaciones.id), 'el anclaje redondeado del otro mapa no está en el fichero');
    for (const exacta of [ANCLAJE_DE_CASA, ANCLAJE_DE_VACACIONES]) {
      assert.equal(todo.includes(String(exacta.lat)), false, `la coordenada exacta ${exacta.lat} desde la que se levantó un mapa está dentro del fichero`);
      assert.equal(todo.includes(String(exacta.lon)), false, `la coordenada exacta ${exacta.lon} desde la que se levantó un mapa está dentro del fichero`);
    }
  });

  test('El nombre del fichero sale del título del mundo y no lleva fecha ni nada de quien juega', () => {
    assert.equal(nombreDeFichero('Reinos de Vaeloria'), `reinos-de-vaeloria${EXTENSION_DE_PARTIDA}`);
    assert.equal(nombreDeFichero('Ría de Ourille'), `ria-de-ourille${EXTENSION_DE_PARTIDA}`);
    assert.equal(nombreDeFichero(null), `partida${EXTENSION_DE_PARTIDA}`);
    assert.doesNotMatch(nombreDeFichero('Reinos de Vaeloria'), /\d{4}|\d{2}-\d{2}/, 'el nombre del fichero lleva una fecha');
  });

  test('Las claves de trabajo de una operación a medias no entran en el fichero', async () => {
    const partida = await partidaCompleta();
    await partida.almacen.escribe(CLAVE_DE_IMPORTACION_EN_CURSO, textoCanonico(documentoDeProcedencia({ de: PROCEDENCIAS.IMPORTADA })));
    const { partes } = await exporta(partida);

    assert.equal(partes.some((p) => p.nombre === CLAVE_DE_IMPORTACION_EN_CURSO), false, 'una marca de importación a medias ha entrado en el fichero exportado');
    // Y la lista de prefijos es una sola: la que decide qué se exporta y qué se respalda.
    assert.deepEqual([...PREFIJOS_DE_LA_PARTIDA], ['arranque/', 'camara/', 'mapa/', 'partida/']);
  });

  test('Sin almacén inyectado no se puede componer ninguna exportación', async () => {
    await assert.rejects(() => partesDeLaPartida({}), /almac[eé]n/i);
    await assert.rejects(() => componeExportacion({}), /almac[eé]n/i);
  });
});

describe('Empezar de nuevo borra y no reinicia', () => {
  test('La copia guardada se puede volver a abrir', async () => {
    // El escenario entero de la batería, que es el que esta fila existe para hacer
    // verdad: se guarda una copia, se borra la partida, se importa el fichero, y
    // vuelven el mundo, el personaje, el diario y los rangos.
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);

    const otro = almacenEnMemoria();
    const binarios = creaAlmacenDeBinarios();
    const resumen = await importaPartida({ manifiesto, partes, almacen: otro, binarios });

    assert.equal(resumen.mapas, 2, 'no han vuelto los dos mapas');
    assert.equal(resumen.estado && resumen.registro, true, 'no han vuelto el estado y el registro');

    // El mundo.
    const mapa = await cargaMapa({ almacen: otro, id: partida.casa.id, semilla: partida.semilla });
    assert.equal(mapa.id, partida.casa.id);
    assert.deepEqual(mapa.celdas.map((c) => c.clave), ['0,0']);

    // El personaje, el diario y los rangos.
    const abierta = await cargaPartida({ almacen: otro, semilla: partida.semilla });
    assert.equal(abierta.estado.personaje.nombre, 'Sabela');
    assert.equal(abierta.estado.personaje.oficio, 'botica');
    assert.equal(entradasDe(abierta.estado.diario).length, entradasDe(partida.estado.diario).length, 'el diario no ha vuelto entero');
    assert.equal(
      JSON.stringify(abierta.estado.nucleos),
      JSON.stringify(partida.estado.nucleos),
      'los rangos no han vuelto idénticos',
    );

    // Y el binario residente, que sin él el mundo se abre con los huecos declarados.
    assert.equal(binarios.tiene(partida.referencia), true, 'el recurso binario residente no ha vuelto');
    assert.deepEqual([...binarios.lee(partida.referencia)], [...BYTES_DE_ILUSTRACION]);
  });
});

describe('Importar la partida', () => {
  test('Los documentos, el estado y el registro importados son idénticos byte a byte a los originales', async () => {
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);
    const otro = almacenEnMemoria();
    await importaPartida({ manifiesto, partes, almacen: otro, binarios: creaAlmacenDeBinarios() });

    const original = await volcado(partida.almacen);
    const importado = (await volcado(otro)).filter(([clave]) => clave !== CLAVE_DE_PROCEDENCIA);
    assert.equal(JSON.stringify(importado), JSON.stringify(original), 'la partida importada no es la misma byte a byte');
  });

  test('La partida importada declara que vino de una importación', async () => {
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);
    const otro = almacenEnMemoria();

    assert.equal((await procedenciaDe({ almacen: otro })).de, PROCEDENCIAS.PROPIA, 'una partida sin nada escrito no se declara propia');
    await importaPartida({ manifiesto, partes, almacen: otro, binarios: creaAlmacenDeBinarios() });
    const procedencia = await procedenciaDe({ almacen: otro });
    assert.equal(procedencia.de, PROCEDENCIAS.IMPORTADA);
    assert.equal(procedencia.clase, CLASES.PROCEDENCIA);
  });

  test('Un manifiesto que declara una parte que el fichero no trae falla nombrando la parte', async () => {
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);
    const mutiladas = partes.filter((p) => p.nombre !== CLAVES.celda(partida.casa.id, '0,0'));
    const otro = almacenEnMemoria();

    await assert.rejects(
      () => importaPartida({ manifiesto, partes: mutiladas, almacen: otro, binarios: creaAlmacenDeBinarios() }),
      /celda\/0,0\.json.*no la trae/s,
    );
    assert.deepEqual(await otro.lista(''), [], 'una importación que falla ha abierto una partida a medias');
  });

  test('Un fichero cuyo manifiesto no declara versión no se abre', async () => {
    const partida = await partidaCompleta();
    const { manifiesto } = await exporta(partida);
    const { version, ...sinVersion } = manifiesto;
    assert.equal(version, VERSION_FORMATO);
    assert.throws(() => validaManifiesto(sinVersion), /versi[oó]n/i);
  });

  test('Un fichero que no es una partida falla diciendo que no lo es, sin intentar interpretarlo', async () => {
    assert.throws(() => validaManifiesto(null), /no es una partida/);
    assert.throws(() => validaManifiesto('WALKINGADVENTURE'), /no es una partida/);
    assert.throws(() => validaManifiesto([1, 2, 3]), /no es una partida/);
    assert.throws(() => validaManifiesto({ version: 1, clase: CLASES.ESTADO }), /no es una partida.*manifiesto/s);
  });

  test('Un fichero de una versión de formato mayor que la del juego declara las dos versiones', async () => {
    const partida = await partidaCompleta();
    const { manifiesto } = await exporta(partida);
    const delFuturo = { ...manifiesto, version: VERSION_FORMATO + 7 };

    assert.throws(() => validaManifiesto(delFuturo), (e) => {
      assert.match(e.message, new RegExp(String(VERSION_FORMATO + 7)), 'el error no declara la versión que trae el fichero');
      assert.match(e.message, new RegExp(`\\b${VERSION_FORMATO}\\b`), 'el error no declara la versión que se esperaba');
      return true;
    });
  });

  test('Una importación que falla a mitad deja la marca puesta y la partida no se abre', async () => {
    const partida = await partidaCompleta();
    const { manifiesto, partes } = await exporta(partida);
    const otro = almacenEnMemoria();

    // Sin dónde guardar los binarios, la importación no llega a escribir nada.
    await assert.rejects(() => importaPartida({ manifiesto, partes, almacen: otro, binarios: null }), /recursos binarios/);
    assert.deepEqual(await otro.lista(''), [], 'ha quedado media partida escrita');

    // Y si el proceso muere después de marcar, la marca es lo que impide abrir.
    await otro.escribe(CLAVE_DE_IMPORTACION_EN_CURSO, textoCanonico(documentoDeProcedencia({ de: PROCEDENCIAS.IMPORTADA })));
    await assert.rejects(() => exigeSinImportacionAMedias({ almacen: otro }), /importaci[oó]n a medio escribir/);
  });

  test('Importar sustituye la partida actual y no deja dos ni ninguna manera de elegir', async () => {
    // La destinataria tiene un mapa con dos celdas —tres claves de mapa— y la copia
    // trae un mapa con una —dos claves—. Después de importar hay exactamente las de la
    // copia: ni las tres de antes, ni cinco, ni un selector entre dos partidas.
    const destino = almacenEnMemoria();
    const suyo = await mapaGuardado({ almacen: destino, arranque: ANCLAJE_DE_VACACIONES });
    await destino.escribe(CLAVES.celda(suyo.id, '1,0'), await destino.lee(CLAVES.celda(suyo.id, '0,0')));
    assert.equal((await destino.lista('mapa/')).length, 3, 'la partida de destino no tiene tres claves de mapa');

    const origen = almacenEnMemoria();
    const mio = await mapaGuardado({ almacen: origen, arranque: ANCLAJE_DE_CASA });
    const { manifiesto, partes } = await componeExportacion({ almacen: origen });

    await importaPartida({ manifiesto, partes, almacen: destino });
    const claves = await destino.lista('mapa/');
    assert.equal(claves.length, 2, 'importar no ha sustituido: quedan claves de las dos partidas');
    assert.deepEqual(claves, [CLAVES.celda(mio.id, '0,0'), CLAVES.indice(mio.id)]);
    assert.equal(claves.some((c) => c.includes(suyo.id)), false, 'la partida anterior sigue ahí y habría que elegir entre dos');
  });

  test('El fichero de otra persona abre su partida entera, que es lo que significa compartir mundo', async () => {
    const suya = await partidaCompleta();
    suya.estado.personaje.nombre = 'Xoana';
    await suya.almacen.escribe(CLAVES_DE_PARTIDA.estado, (await import('../../packages/nucleo/partida/estado.js')).textoDeEstado(suya.estado));
    const { manifiesto, partes } = await exporta(suya);

    const mia = await partidaCompleta();
    await importaPartida({ manifiesto, partes, almacen: mia.almacen, binarios: mia.binarios });

    const abierta = await cargaPartida({ almacen: mia.almacen, semilla: suya.semilla });
    assert.equal(abierta.estado.personaje.nombre, 'Xoana', 'no se ha abierto el personaje de quien compartió el mundo');
    assert.ok((await mia.almacen.lista('mapa/')).includes(CLAVES.indice(suya.casa.id)), 'no ha venido su mundo');
  });

  test('Los documentos de un fichero se validan contra el esquema cerrado antes de sustituir nada', async () => {
    const partida = await partidaCompleta();
    const { partes } = await exporta(partida);
    const tocadas = partes.map((p) => (p.nombre === CLAVES_DE_PARTIDA.estado ? conDocumento(p, (doc) => { doc.inventado = true; }) : p));
    const rehecho = refresca(tocadas, { documentos: 6, recursos: 1, textosDelNarrador: 1, mapas: 2 });

    const otro = almacenEnMemoria();
    await assert.rejects(
      () => importaPartida({ manifiesto: rehecho.manifiesto, partes: rehecho.partes, almacen: otro, binarios: creaAlmacenDeBinarios() }),
      /inventado/,
    );
    assert.deepEqual(await otro.lista(''), [], 'se ha escrito algo antes de validar');
  });

  test('Sin almacén inyectado no se puede importar nada', async () => {
    await assert.rejects(() => importaPartida({ manifiesto: {}, partes: [] }), /almac[eé]n/i);
    await assert.rejects(() => exigeSinImportacionAMedias({}), /almac[eé]n/i);
    await assert.rejects(() => procedenciaDe({}), /almac[eé]n/i);
  });

  test('Los recursos binarios vuelven por su referencia entera y no reprefijados', async () => {
    const partida = await partidaCompleta();
    const { partes } = await exporta(partida);
    const recurso = partes.find((p) => p.clase === CLASES_DE_PARTE.RECURSO);

    assert.equal(recurso.nombre, partida.referencia);
    assert.equal(recurso.codificacion, CODIFICACIONES.BASE64, 'el binario no viaja en base64 y el contenedor dejaría de ser texto');
    assert.deepEqual([...bytesDeParte(recurso)], [...BYTES_DE_ILUSTRACION]);
    assert.equal(recurso.nombre.startsWith('local/recursos/local/'), false, 'la referencia se ha vuelto a prefijar');
  });
});

describe('Del móvil no sale nada del jugador', () => {
  test('El rastro de ubicación no se guarda nunca', async () => {
    // Aquí se afirma sobre **el fichero exportado**, que es donde de verdad podría
    // escaparse: un fichero al que alguien le añade a mano una posición de quien juega
    // se rechaza nombrando el campo, en vez de entrar y quedarse dentro para siempre.
    const partida = await partidaCompleta();
    const { partes } = await exporta(partida);

    const conPosicion = partes.map((p) => (p.nombre === CLAVES_DE_PARTIDA.estado ? conDocumento(p, (doc) => { doc.lat = 42.4071; }) : p));
    const rehecho = refresca(conPosicion, { documentos: 6, recursos: 1, textosDelNarrador: 1, mapas: 2 });
    const otro = almacenEnMemoria();

    await assert.rejects(
      () => importaPartida({ manifiesto: rehecho.manifiesto, partes: rehecho.partes, almacen: otro, binarios: creaAlmacenDeBinarios() }),
      /lat/,
      'un campo con una posición de quien juega ha entrado en la partida',
    );
    assert.deepEqual(await otro.lista(''), [], 'se ha escrito algo pese al rechazo');

    // Y el registro de hechos del fichero pasa la guarda de privacidad tal cual sale.
    const registro = lee(partes.find((p) => p.nombre === CLAVES_DE_PARTIDA.registro).contenido, 'el registro del fichero');
    assert.equal(registro.clase, CLASES.REGISTRO);
  });
});
