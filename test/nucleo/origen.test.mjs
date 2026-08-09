// SPEC-024 · El origen de los datos de OSM: la sonda que dice si un Overpass sirve de
// verdad, la cobertura del extracto, la cadena de respaldo y la caché por texto de
// consulta.
//
// La pieza entera existe por un fallo documentado que costó siete horas: un contenedor en
// `Up` respondiendo **200 con una página de error XML**, el proxy descartándola y cayendo
// a los mirrors públicos, y todo «funcionando» solo que lentísimo. Por eso casi ninguna
// prueba de aquí mira si algo está en pie: miran qué contesta, y separan las **dos causas
// de síntoma idéntico** —importar horas, o cambiar un permiso— por el único dato que las
// separa, que es el mensaje literal del XML. Un doble que devolviera «error» genérico
// dejaría verde una sonda incapaz de distinguirlas.
//
// Sin red y sin reloj real: el transporte llega inyectado, el tiempo lo cobra el doble
// sobre el reloj de `test/dobles/reloj.mjs`, y el plazo agotado se simula lanzando el
// aborto en vez de esperando. `docs/testing.md` **no tiene ni una línea** sobre esta
// pieza —RF-INFRA-003 es uno de los quince huecos marcados ⚠ en el PRD—, así que los
// casos llevan el nombre de los siete escenarios que la spec propone para pegar tal cual,
// y van declarados como hueco en `test/spec-test-map.json`. Los dos que sí existen en la
// batería, «Las coordenadas salen una sola vez, al generar el mapa» y «El proxy no
// identifica a nadie», se implementan con su nombre literal.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargaConfig, cargaConfigDeOrigen, PARAMETROS_ORIGEN } from '../../server/config.mjs';
import { ESLABONES_MEDIDOS, creaMetrica } from '../../server/metrica.mjs';
import { creaAlmacenEnMemoria } from '../../server/superficie.mjs';
import {
  CODIGOS_DE_COLA,
  CONSULTA_CANARIO,
  MOTIVOS,
  MOTIVOS_DE_FALLO,
  clasificaRespuesta,
  creaSonda,
} from '../../server/aguas-arriba/sonda-overpass.mjs';
import { COBERTURAS, creaCobertura } from '../../server/aguas-arriba/cobertura.mjs';
import {
  ETIQUETAS_DE_ESLABON,
  HUELLAS_DE_VERSION,
  VERSION_CONSULTA,
  celdaDeConsulta,
  claveDeConsulta,
  compruebaVersionDeConsulta,
  consultaDeCelda,
  creaAlmacenDeConsultasEnMemoria,
  creaClienteDeOverpass,
  huellaDeConsulta,
} from '../../server/aguas-arriba/overpass.mjs';

import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { mundoCongelado, mundosCongelados } from '../dobles/mundo-congelado.mjs';
import { creaReloj } from '../dobles/reloj.mjs';
import {
  CELDA_QUE_GOBIERNA,
  MODOS,
  MOTIVO_ESPERADO,
  XML_PERMISO_DENEGADO,
  XML_SIN_BASE_DE_DATOS,
  celdasArquetipo,
  creaCadenaDoblada,
  creaCronometroDeDatos,
  creaOverpassDoblado,
  creaSondaDoblada,
  cuerpoConElementos,
  percentilDe,
} from '../dobles/overpass.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const PROPIO = 'http://overpass-propio.local/api/interpreter';
const MIRRORS = [
  'https://mirror-uno.example/api/interpreter',
  'https://mirror-dos.example/api/interpreter',
  'https://mirror-tres.example/api/interpreter',
];

/** El entorno mínimo del origen: los dos obligatorios y la cadena de respaldo doblada. */
const ENTORNO_ORIGEN = Object.freeze({
  OVERPASS_PROPIO: PROPIO,
  CONSULTA_VERSION: VERSION_CONSULTA,
  RESPALDO: MIRRORS.join(','),
});

const origenDe = (extra = {}) => cargaConfigDeOrigen({ ...ENTORNO_ORIGEN, ...extra });

/** Las celdas que la cobertura de España cubre y las que no. Radio de una celda real. */
const MADRID = { lat: 40.4168, lon: -3.7038, radio_m: 1200 };
const LISBOA = { lat: 38.7223, lon: -9.1393, radio_m: 1200 };
const PARIS = { lat: 48.8566, lon: 2.3522, radio_m: 1200 };

const qlDe = (celda) => consultaDeCelda(celda);

/**
 * El origen entero montado en memoria: la cadena doblada, la cobertura declarada, la
 * sonda —doblada o de verdad, según lo que mire la prueba— y el cliente.
 */
function montaOrigen({
  modoPropio = 'sirve',
  modosRespaldo = ['cola', 'cola', 'cola'],
  listo = true,
  entorno = {},
  reloj = creaReloj(),
  almacen = creaAlmacenDeConsultasEnMemoria(),
  transporte = null,
  anota = () => {},
} = {}) {
  const config = origenDe(entorno);
  const cadena = creaCadenaDoblada({ propio: PROPIO, respaldo: [...config.RESPALDO], modoPropio, modosRespaldo, reloj });
  const cobertura = creaCobertura({
    cobertura: config.COBERTURA, extracto: config.EXTRACTO, mirror: config.EXTRACTO_MIRROR, fecha: config.EXTRACTO_FECHA,
  });
  const sonda = creaSondaDoblada(listo);
  const cliente = creaClienteDeOverpass({
    fetch: transporte ?? ((url, o) => cadena.fetch(url, o)),
    config, sonda, cobertura, reloj, almacen, anota,
  });
  return { cliente, cadena, config, cobertura, sonda, reloj, almacen };
}

/** Una métrica de verdad sobre almacén en memoria, para el recuento por eslabón. */
function montaMetrica(reloj = creaReloj()) {
  return creaMetrica({
    config: cargaConfig({ TOPE_DIARIO_GASTO: '1000' }),
    reloj,
    almacen: creaAlmacenEnMemoria('metrica-del-dia'),
  });
}

describe('La sonda: qué cuenta como «sirve de verdad»', () => {
  test('La sonda pregunta consultando, y no mirando el contenedor, el proceso ni el puerto', async () => {
    const doble = creaOverpassDoblado({ url: PROPIO, modo: 'sirve', elementos: 9 });
    const sonda = creaSonda({ fetch: doble.fetch, url: PROPIO, config: origenDe() });

    const r = await sonda.pasa();
    assert.equal(r.sirve, true);
    assert.equal(r.elementos, 9);
    // Una consulta real, con el canario declarado dentro del cuerpo. No hay otra fuente
    // de verdad: `docker ps` dice `Up` en los dos fallos conocidos.
    assert.equal(doble.llamadas(), 1);
    assert.equal(doble.peticiones()[0].metodo, 'POST');
    assert.equal(doble.consultas()[0], CONSULTA_CANARIO);
  });

  test('Un contenedor levantado que no sirve datos no cuenta como listo', async () => {
    const config = origenDe();
    const doble = creaOverpassDoblado({ url: PROPIO, modo: 'sin-base-de-datos' });
    const sonda = creaSonda({ fetch: doble.fetch, url: PROPIO, config });

    // El volumen está vacío: el contenedor responde, y lo que responde no son datos.
    const r = await sonda.revisa();
    assert.equal(r.sirve, false);
    assert.equal(r.motivo, 'sin-base-de-datos');
    assert.equal(sonda.estaListo(), false);

    // Y ninguna generación se encamina hacia él: el propio ni siquiera entra en la cadena.
    const { cliente, cadena } = montaOrigen({ listo: false, modosRespaldo: ['sirve', 'cola', 'cola'] });
    const contenido = await cliente.pide({ consulta: { ql: qlDe(MADRID) } });
    assert.ok(contenido.elements.length > 0);
    assert.equal(cadena.propio.llamadas(), 0, 'el propio recibió tráfico sin estar listo');
  });

  test('La página de error no se toma por datos', async () => {
    // Las dos llegan con **200**, que es lo que las hace peligrosas.
    for (const [modo, esperado] of [['sin-base-de-datos', 'sin-base-de-datos'], ['base-de-datos-inalcanzable', 'base-de-datos-inalcanzable']]) {
      const doble = creaOverpassDoblado({ url: PROPIO, modo });
      const sonda = creaSonda({ fetch: doble.fetch, url: PROPIO, config: origenDe() });
      const r = await sonda.pasa();
      assert.equal(r.sirve, false, modo);
      assert.equal(r.motivo, esperado, modo);
      // El diagnóstico cita el mensaje literal del XML: es lo único que separa las dos.
      assert.match(r.mensaje, /osm3s_osm_base/, modo);
    }

    // Y el mismo criterio vale para un mirror: la sonda es una sola y clasifica a todos.
    const { cliente, cadena } = montaOrigen({
      modoPropio: 'sin-base-de-datos', modosRespaldo: ['base-de-datos-inalcanzable', 'sirve', 'cola'],
    });
    const contenido = await cliente.pide({ consulta: { ql: qlDe(MADRID) } });
    assert.ok(contenido.elements.length > 0);
    assert.equal(cadena.respaldo[0].llamadas(), 1, 'el mirror con página de error no se descartó');
    assert.equal(cadena.respaldo[1].llamadas(), 1);
  });

  test('Un XML que dice No such file es «sin base de datos», y el arreglo es importar', () => {
    const r = clasificaRespuesta({ texto: XML_SIN_BASE_DE_DATOS, http: 200, minimo: 5 });
    assert.equal(r.sirve, false);
    assert.equal(r.motivo, 'sin-base-de-datos');
    assert.match(r.mensaje, /No such file or directory/);
    assert.match(r.arreglo, /importar/i);
    // Lo que **no** puede decir: reiniciar. Reiniciar no importa nada, y esa confusión es
    // la que cuesta una noche.
    assert.match(r.arreglo, /NO reiniciar/i);
  });

  test('Un XML que dice Permission denied es «base de datos inalcanzable», y el arreglo es el permiso', () => {
    const r = clasificaRespuesta({ texto: XML_PERMISO_DENEGADO, http: 200, minimo: 5 });
    assert.equal(r.sirve, false);
    assert.equal(r.motivo, 'base-de-datos-inalcanzable');
    assert.match(r.mensaje, /Permission denied/);
    assert.match(r.arreglo, /chmod 755 \/db/);
    // Los datos ya están: volver a importar son horas tiradas.
    assert.match(r.arreglo, /NO volver a importar/i);
    assert.notEqual(MOTIVOS['sin-base-de-datos'].arreglo, MOTIVOS['base-de-datos-inalcanzable'].arreglo);
  });

  test('El canario exige un número mínimo de elementos y no se conforma con la palabra elements', async () => {
    const config = origenDe();
    assert.ok(config.SONDA_MINIMO >= 1, 'con el mínimo en cero la sonda vuelve a ser un grep');

    // Una lista vacía pasa un `grep "elements"` y no pasa la sonda: es exactamente lo que
    // devuelve una base de datos sin importar, o una zona fuera del extracto.
    const vacia = '{"version":0.6,"elements":[]}';
    assert.ok(vacia.includes('elements'), 'el grep de antes daba verde con esto');
    assert.equal(clasificaRespuesta({ texto: vacia, http: 200, minimo: config.SONDA_MINIMO }).motivo, 'sin-base-de-datos');

    // Algunos, pero menos de los declarados: importación a medias, y el arreglo es esperar.
    const aMedias = clasificaRespuesta({ texto: cuerpoConElementos(config.SONDA_MINIMO - 1), http: 200, minimo: config.SONDA_MINIMO });
    assert.equal(aMedias.motivo, 'importacion-en-curso');
    assert.match(aMedias.arreglo, /esperar/i);

    // Y con el mínimo declarado cumplido, sirve.
    const doble = creaOverpassDoblado({ url: PROPIO, modo: 'sirve', elementos: config.SONDA_MINIMO });
    const sonda = creaSonda({ fetch: doble.fetch, url: PROPIO, config });
    assert.equal((await sonda.pasa()).sirve, true);
  });

  test('Una celda de campo abierto sin un solo POI se acepta como dato legítimo', async () => {
    // El mínimo de una consulta de celda es **cero**, al revés que el del canario: un
    // descampado sin nada no es un Overpass roto.
    const vacia = clasificaRespuesta({ texto: '{"elements":[]}', http: 200, minimo: 0 });
    assert.equal(vacia.sirve, true);
    assert.equal(vacia.elementos, 0);

    // Y por la cadena entera: el vacío del propio se confirma contra el respaldo, y
    // confirmado se sirve como dato.
    const { cliente, cadena } = montaOrigen({
      modoPropio: { modo: 'sirve', elementos: 0 }, modosRespaldo: [{ modo: 'sirve', elementos: 0 }, 'cola', 'cola'],
    });
    const contenido = await cliente.pide({ consulta: { ql: qlDe(MADRID) } });
    assert.deepEqual(contenido, { elements: [] });
    assert.equal(cadena.propio.llamadas(), 1);
    assert.equal(cadena.respaldo[0].llamadas(), 1, 'el vacío del propio se dio por bueno sin confirmarlo');
  });

  test('Los motivos de fallo son un conjunto cerrado y cada uno nombra su arreglo', () => {
    assert.deepEqual(MOTIVOS_DE_FALLO, [
      'sin-base-de-datos', 'base-de-datos-inalcanzable', 'importacion-en-curso', 'plazo-agotado', 'respuesta-ilegible',
    ]);
    for (const motivo of MOTIVOS_DE_FALLO) {
      assert.ok(MOTIVOS[motivo].que.length > 10, motivo);
      assert.ok(MOTIVOS[motivo].arreglo.length > 10, `${motivo} no nombra su arreglo`);
    }
    // Nada fuera de la lista: un motivo suelto deja la distinción en manos de quien esté
    // mirando a las tres de la mañana.
    for (const modo of MODOS) {
      if (modo === 'sirve') continue;
      assert.ok(MOTIVOS_DE_FALLO.includes(MOTIVO_ESPERADO[modo]), modo);
    }
  });

  test('Los seis finales que un Overpass sabe dar caen cada uno en su motivo', async () => {
    const config = origenDe();
    for (const modo of MODOS) {
      const doble = creaOverpassDoblado({ url: PROPIO, modo, elementos: config.SONDA_MINIMO });
      const sonda = creaSonda({ fetch: doble.fetch, url: PROPIO, config });
      const r = await sonda.pasa();
      if (modo === 'sirve') {
        assert.equal(r.sirve, true, modo);
        continue;
      }
      assert.equal(r.sirve, false, modo);
      assert.equal(r.motivo, MOTIVO_ESPERADO[modo], modo);
    }
    // 429, 503 y 504 son «ahora no» y no «roto»: se pasa al siguiente sin reintentar.
    assert.deepEqual([...CODIGOS_DE_COLA], [429, 503, 504]);
  });

  test('El periodo y el plazo de la sonda están declarados en la configuración', async () => {
    const config = origenDe();
    assert.equal(config.SONDA_PERIODO, 60 * 1000, 'detecta la caída dentro de una generación, no de una tarde');
    assert.equal(config.SONDA_PLAZO, config.PLAZO_ESLABON, 'una sonda que espera más que una consulta no mide lo que hace falta');
    assert.equal(config.SONDA_PARA_LISTO, 2);
    assert.equal(config.SONDA_MINIMO, 5);

    const doble = creaOverpassDoblado({ url: PROPIO, modo: 'sirve' });
    const sonda = creaSonda({ fetch: doble.fetch, url: PROPIO, config });
    await sonda.revisa();
    const estado = sonda.estado();
    for (const campo of ['periodo', 'plazo', 'paraListo', 'minimo']) {
      assert.ok(Number.isFinite(estado[campo]), `el estado de la sonda no declara ${campo}`);
    }
    // Su coste es despreciable frente al tráfico real: una consulta por periodo.
    assert.equal(doble.llamadas(), 1);
  });
});

describe('Prontitud: arrancar, importar y no mentir mientras tanto', () => {
  test('Mientras importa, la sonda dice que no está listo durante toda la importación', async () => {
    const config = origenDe();
    let importando = true;
    const doble = creaOverpassDoblado({ url: PROPIO, modo: 'sin-base-de-datos' });
    const sonda = creaSonda({ fetch: doble.fetch, url: PROPIO, config, importando: () => importando });

    for (let i = 0; i < 5; i++) {
      const r = await sonda.revisa();
      assert.equal(r.sirve, false);
      // Por fuera, «importando» y «no hay base de datos» dan el mismo XML: lo que los
      // separa es el hecho de la máquina, que se inyecta en vez de adivinarse.
      assert.equal(r.motivo, 'importacion-en-curso');
      assert.equal(sonda.estaListo(), false);
    }
    // Y sin que nadie tenga que mirar los registros: el estado lo dice.
    assert.equal(sonda.estado().listo, false);

    importando = false;
    doble.cambiaA('sirve', { elementos: config.SONDA_MINIMO });
    await sonda.revisa();
    assert.equal(sonda.estaListo(), false, 'una sola verde no basta');
    await sonda.revisa();
    assert.equal(sonda.estaListo(), true);
  });

  test('Pasa a listo con el número declarado de sondas en verde, y no antes', async () => {
    const config = origenDe({ SONDA_PARA_LISTO: '3' });
    const doble = creaOverpassDoblado({ url: PROPIO, modo: 'sirve', elementos: config.SONDA_MINIMO });
    const sonda = creaSonda({ fetch: doble.fetch, url: PROPIO, config });

    await sonda.revisa(); assert.equal(sonda.estaListo(), false);
    await sonda.revisa(); assert.equal(sonda.estaListo(), false);
    await sonda.revisa(); assert.equal(sonda.estaListo(), true);

    // Una roja lo tira a la primera: el vaivén se evita al subir, no al bajar.
    doble.cambiaA('base-de-datos-inalcanzable');
    await sonda.revisa();
    assert.equal(sonda.estaListo(), false);
    assert.equal(sonda.estado().verdesSeguidas, 0);
  });

  test('El servicio que deja de servir a mitad del día deja de recibir tráfico y el respaldo lo absorbe', async () => {
    const config = origenDe();
    const cadena = creaCadenaDoblada({ propio: PROPIO, respaldo: [...config.RESPALDO], modoPropio: 'sirve', modosRespaldo: ['sirve', 'cola', 'cola'] });
    const sonda = creaSonda({ fetch: (u, o) => cadena.fetch(u, o), url: PROPIO, config });
    const cliente = creaClienteDeOverpass({
      fetch: (u, o) => cadena.fetch(u, o), config, sonda, reloj: creaReloj(),
      cobertura: creaCobertura({ cobertura: config.COBERTURA }),
    });

    await sonda.revisa(); await sonda.revisa();
    assert.equal(sonda.estaListo(), true);
    await cliente.pide({ consulta: { ql: qlDe(MADRID) } });
    assert.equal(cadena.propio.llamadas(), 3, 'dos sondas y una generación');
    assert.equal(cadena.respaldo[0].llamadas(), 0);

    // Se cae a mitad del día. La sonda lo ve en su periodo, no en toda una tarde.
    cadena.propio.cambiaA('sin-base-de-datos');
    await sonda.revisa();
    assert.equal(sonda.estaListo(), false);

    const contenido = await cliente.pide({ consulta: { ql: qlDe({ ...MADRID, lat: 40.42 }) } });
    assert.ok(contenido.elements.length > 0, 'la generación se quedó colgada');
    assert.equal(cadena.respaldo[0].llamadas(), 1, 'el respaldo no absorbió la caída');
  });

  test('El proxy no arranca sin el destino del Overpass propio ni sin la versión de la consulta', () => {
    const obligatorios = PARAMETROS_ORIGEN.filter((p) => p.obligatorio).map((p) => p.nombre);
    assert.deepEqual(obligatorios, ['OVERPASS_PROPIO', 'CONSULTA_VERSION']);

    // Sin nada: nombra los dos de una vez, no uno por arranque.
    assert.throws(() => cargaConfigDeOrigen({}), (e) => {
      assert.match(e.message, /no arranca/);
      assert.match(e.message, /OVERPASS_PROPIO/);
      assert.match(e.message, /CONSULTA_VERSION/);
      return true;
    });
    // Con uno solo, nombra el que falta. Caer a los mirrors en silencio es el fallo que
    // costó siete horas: que se note es media pieza.
    assert.throws(() => cargaConfigDeOrigen({ CONSULTA_VERSION: VERSION_CONSULTA }), /OVERPASS_PROPIO/);
    assert.throws(() => cargaConfigDeOrigen({ OVERPASS_PROPIO: PROPIO }), /CONSULTA_VERSION/);
    assert.ok(origenDe().OVERPASS_PROPIO);
  });

  test('El texto de la consulta cambiado sin subir su versión impide arrancar', () => {
    // La versión y el texto tienen que casar, y son dos comprobaciones distintas.
    assert.equal(HUELLAS_DE_VERSION[VERSION_CONSULTA], huellaDeConsulta(), 'el texto cambió sin subir la versión');
    assert.equal(compruebaVersionDeConsulta(origenDe()), true);

    assert.throws(() => compruebaVersionDeConsulta({ CONSULTA_VERSION: '0' }), (e) => {
      assert.match(e.message, /no arranca/);
      // El coste va escrito en el propio error: repoblar la caché entera.
      assert.match(e.message, /caché entera/);
      return true;
    });
    // Y montar el cliente lo comprueba: no hay forma de servir con la versión mentida.
    assert.throws(
      () => creaClienteDeOverpass({
        fetch: async () => ({ ok: true, status: 200, text: async () => '{"elements":[]}' }),
        config: origenDe({ CONSULTA_VERSION: '99' }),
        sonda: creaSondaDoblada(true),
        cobertura: creaCobertura({}),
      }),
      /CONSULTA_VERSION declara "99"/,
    );
  });

  test('Un plazo de eslabón que no cabe en el presupuesto de datos impide arrancar', () => {
    // Un solo eslabón comiéndose el tramo entero deja el minuto en manos del azar.
    assert.throws(() => cargaConfigDeOrigen({ ...ENTORNO_ORIGEN, PLAZO_ESLABON: '30000' }), /PLAZO_ESLABON/);
    assert.throws(() => cargaConfigDeOrigen({ ...ENTORNO_ORIGEN, SONDA_MINIMO: '0' }), /grep de "elements"/);
    assert.throws(() => cargaConfigDeOrigen({ ...ENTORNO_ORIGEN, SONDA_PARA_LISTO: '0' }), /SONDA_PARA_LISTO/);
  });
});

describe('El presupuesto del minuto: qué se mide y en qué condiciones', () => {
  test('El tramo de datos cabe bajo la espera máxima de aguas arriba y ningún eslabón se lo come entero', () => {
    const origen = origenDe();
    const proxy = cargaConfig({ TOPE_DIARIO_GASTO: '1000' });
    assert.equal(origen.PRESUPUESTO_DATOS, 20 * 1000, 'el tramo de datos del reparto del minuto');
    assert.ok(origen.PRESUPUESTO_DATOS <= proxy.ESPERA_MAXIMA_AGUAS_ARRIBA, 'el tramo de datos no cabe bajo SPEC-023');
    assert.equal(origen.PLAZO_ESLABON, 8 * 1000);
    assert.ok(origen.PLAZO_ESLABON < origen.PRESUPUESTO_DATOS);
    assert.equal(origen.PERCENTIL_MEDIDA, 95, 'una media esconde la cola que estropea un onboarding');
    assert.equal(origen.PASADAS_MEDIDA, 20);
  });

  test('Una celda entera son terreno, POIs y callejero pedidos como un solo lote', async () => {
    // Tres esperas de ocho segundos encadenadas se comen el presupuesto entero.
    const ql = qlDe(MADRID);
    for (const trozo of ['natural"="coastline', 'landuse"="forest', 'amenity"="place_of_worship', 'highway"~"^(residential', 'kerb']) {
      assert.ok(ql.includes(trozo), `el lote no trae ${trozo}`);
    }
    const { cliente, cadena } = montaOrigen({ modoPropio: 'sirve' });
    await cliente.pide({ consulta: { ql } });
    assert.equal(cadena.propio.llamadas(), 1, 'una celda tiene que viajar como un solo lote');
  });

  test('Una consulta que se pasa del plazo se corta y se pasa al siguiente sin reintentar', async () => {
    const { cliente, cadena } = montaOrigen({ modoPropio: 'plazo-agotado', modosRespaldo: ['sirve', 'cola', 'cola'] });
    const contenido = await cliente.pide({ consulta: { ql: qlDe(MADRID) } });

    assert.ok(contenido.elements.length > 0);
    assert.equal(cadena.propio.llamadas(), 1, 'reintentó contra el mismo eslabón');
    assert.equal(cadena.respaldo[0].llamadas(), 1);
  });

  test('Agotado el presupuesto de datos, no se contacta ni un eslabón más', async () => {
    // Cada eslabón se gasta su plazo entero y falla. El reloj es el inyectado: aquí no
    // espera nadie de verdad.
    const reloj = creaReloj();
    const config = origenDe();
    const lento = { modo: 'cola', tarda: config.PLAZO_ESLABON };
    const { cliente, cadena } = montaOrigen({
      reloj, modoPropio: lento, modosRespaldo: [lento, lento, lento],
    });

    await assert.rejects(() => cliente.pide({ consulta: { ql: qlDe(MADRID) } }), (e) => {
      assert.equal(e.name, 'FalloDeAguasArriba');
      assert.equal(e.tipo, 'plazo-agotado');
      return true;
    });
    const llamadas = Object.values(cadena.llamadasPorDestino()).reduce((a, b) => a + b, 0);
    assert.ok(llamadas < 4, `se contactaron ${llamadas} eslabones con el presupuesto agotado`);
    assert.ok(llamadas >= 2, 'el presupuesto tiene que dar para más de un eslabón');
  });

  test('La caché caliente hace despreciable el tramo de datos, y la medición nunca se apoya en ella', async () => {
    const { cliente, cadena } = montaOrigen({ modoPropio: 'sirve' });
    const ql = qlDe(MADRID);
    const primera = await cliente.pide({ consulta: { ql } });
    const segunda = await cliente.pide({ consulta: { ql } });

    assert.deepEqual(segunda, primera);
    assert.equal(cadena.propio.llamadas(), 1, 'la caché caliente volvió a salir aguas arriba');

    // Y el cronómetro no se apoya nunca en ese caso: cada pasada estrena consulta.
    const reloj = creaReloj();
    const cadenaFria = creaCadenaDoblada({ propio: PROPIO, modoPropio: { modo: 'sirve', tarda: 1200 }, reloj });
    const cronometro = creaCronometroDeDatos({
      fetch: cadenaFria.fetch, reloj, url: PROPIO, celdas: [{ nombre: CELDA_QUE_GOBIERNA, ...MADRID }], pasadas: 20,
    });
    const informe = await cronometro.mide();
    assert.equal(informe.celdas[0].consultasDistintas, 20, 'dos pasadas compartieron consulta: eso mide la caché');
    assert.equal(informe.cache, 'fría en todas las pasadas');
  });

  test('El cronómetro consigue la caché fría desplazando la celda un metro por pasada', () => {
    const reloj = creaReloj();
    const cronometro = creaCronometroDeDatos({
      fetch: async () => ({ ok: true, status: 200, text: async () => cuerpoConElementos(3) }),
      reloj, url: PROPIO, celdas: [{ nombre: CELDA_QUE_GOBIERNA, ...MADRID }],
    });

    const cero = celdaDeConsulta(cronometro.consultaDePasada({ nombre: 'x', ...MADRID }, 0));
    const uno = celdaDeConsulta(cronometro.consultaDePasada({ nombre: 'x', ...MADRID }, 1));
    // Un metro son 1e-5 grados: cambia la consulta, no lo que se mide. Y hace falta,
    // porque comentar el texto cambia **nuestra** clave y no la que ve Overpass, que
    // rechaza la repetida con `duplicate_query` y contesta una página de error en 300 ms.
    assert.equal(uno.radio_m, cero.radio_m, 'el radio no puede cambiar entre pasadas');
    assert.equal(uno.lon, cero.lon);
    assert.ok(Math.abs(uno.lat - cero.lat - 1e-5) < 1e-9, 'el desplazamiento no es de un metro');
    assert.notEqual(claveDeConsulta(cronometro.consultaDePasada({ nombre: 'x', ...MADRID }, 0)),
      claveDeConsulta(cronometro.consultaDePasada({ nombre: 'x', ...MADRID }, 1)));
  });

  test('El cronómetro da el mismo número dos veces y lo gobierna la celda urbana densa', async () => {
    const celdas = celdasArquetipo();
    assert.equal(celdas.length, 4, 'las cuatro celdas arquetipo del andamiaje');
    assert.equal(celdas[0].nombre, CELDA_QUE_GOBIERNA);

    const corre = async () => {
      const reloj = creaReloj();
      // Cada celda con su coste declarado: la densa es la que más pide, y es la que decide.
      const cadena = creaCadenaDoblada({ propio: PROPIO, modoPropio: { modo: 'sirve', tarda: 1663 }, reloj });
      return creaCronometroDeDatos({
        fetch: cadena.fetch, reloj, url: PROPIO, celdas, pasadas: 20, percentil: 95, presupuesto: 20000,
      }).mide();
    };

    const a = await corre();
    const b = await corre();
    assert.deepEqual(a, b, 'dos ejecuciones del cronómetro dieron números distintos');
    assert.equal(a.gobierna, CELDA_QUE_GOBIERNA, 'no manda la media de las cuatro');
    assert.equal(a.percentil, 95);
    assert.equal(a.celdas[0].p95, 1663);
    assert.equal(a.veredicto, 'cabe');

    // Y un p95 por encima del presupuesto no cabe, dígalo la media lo que diga.
    const reloj = creaReloj();
    const lenta = creaCadenaDoblada({ propio: PROPIO, modoPropio: { modo: 'sirve', tarda: 21000 }, reloj });
    const fuera = await creaCronometroDeDatos({
      fetch: lenta.fetch, reloj, url: PROPIO, celdas, pasadas: 3, presupuesto: 20000,
    }).mide();
    assert.equal(fuera.veredicto, 'no cabe');
  });

  test('El percentil declarado es el del más cercano y no la media', () => {
    const valores = [100, 100, 100, 100, 100, 100, 100, 100, 100, 9000];
    assert.equal(percentilDe(valores, 95), 9000, 'la media escondería la cola');
    assert.equal(percentilDe(valores, 50), 100);
    assert.equal(percentilDe([], 95), null, 'sin medidas no hay percentil, y no es un cero');
  });

  test('Dos generaciones simultáneas de celdas distintas no se estorban', async () => {
    const config = origenDe();
    assert.ok(Number.isFinite(config.CONSULTAS_EN_VUELO), 'el número admitido en vuelo tiene que estar declarado');

    const { cliente, cadena } = montaOrigen({ modoPropio: 'sirve' });
    const [a, b] = await Promise.all([
      cliente.pide({ consulta: { ql: qlDe(MADRID) } }),
      cliente.pide({ consulta: { ql: qlDe({ ...MADRID, lat: 40.5 }) } }),
    ]);
    assert.ok(a.elements.length > 0);
    assert.ok(b.elements.length > 0);
    assert.equal(cadena.propio.llamadas(), 2, 'dos celdas distintas son dos consultas');

    // Y con el cupo a uno ninguna se rechaza: la que no cabe espera turno.
    const estrecho = montaOrigen({ modoPropio: 'sirve', entorno: { CONSULTAS_EN_VUELO: '1' } });
    const dos = await Promise.all([
      estrecho.cliente.pide({ consulta: { ql: qlDe(MADRID) } }),
      estrecho.cliente.pide({ consulta: { ql: qlDe({ ...MADRID, lat: 40.6 }) } }),
    ]);
    assert.equal(dos.length, 2);
    assert.equal(estrecho.cadena.propio.llamadas(), 2);
  });
});

describe('La cadena de respaldo, y lo que pasa cuando no hay nada', () => {
  test('Con el Overpass del proyecto sirviendo, la consulta no sale hacia ningún mirror', async () => {
    const inspector = creaInspectorDeRed();
    const { cliente, cadena } = montaOrigen({ modoPropio: 'sirve' });
    const conInspector = montaOrigen({ modoPropio: 'sirve', transporte: inspector.envuelve((u, o) => cadena.fetch(u, o)) });

    await conInspector.cliente.pide({ consulta: { ql: qlDe(MADRID) } });
    assert.equal(cliente.declaraCadena().respaldo.length, 3, 'los tres mirrors siguen declarados como respaldo');
    for (const mirror of MIRRORS) assert.equal(inspector.contiene(mirror), false, `salió tráfico hacia ${mirror}`);
    assert.equal(inspector.peticiones().length, 1);
    assert.equal(inspector.peticiones()[0].destino, PROPIO);
  });

  test('Sin el Overpass del proyecto, el mapa se levanta igual', async () => {
    const conPropio = montaOrigen({ modoPropio: 'sirve' });
    const esperado = await conPropio.cliente.pide({ consulta: { ql: qlDe(MADRID) } });

    const { cliente, cadena } = montaOrigen({ modoPropio: 'sin-base-de-datos', modosRespaldo: ['sirve', 'cola', 'cola'] });
    const contenido = await cliente.pide({ consulta: { ql: qlDe(MADRID) } });
    assert.equal(contenido.elements.length, esperado.elements.length, 'el mapa no se levantó con los mismos datos');
    assert.equal(cadena.respaldo[0].llamadas(), 1);
  });

  test('Un mirror que responde 429, 503 o 504 se descarta y se pasa al siguiente sin reintentar', async () => {
    for (const codigo of CODIGOS_DE_COLA) {
      const { cliente, cadena } = montaOrigen({
        listo: false,
        modosRespaldo: [{ modo: 'cola', http: codigo }, { modo: 'cola', http: codigo }, 'sirve'],
      });
      const contenido = await cliente.pide({ consulta: { ql: qlDe(MADRID) } });
      assert.ok(contenido.elements.length > 0, String(codigo));
      assert.deepEqual(cadena.respaldo.map((m) => m.llamadas()), [1, 1, 1], `reintentó con ${codigo}`);
    }
  });

  test('Sin ningún origen de datos no se levanta un mundo a medias', async () => {
    const almacen = creaAlmacenDeConsultasEnMemoria();
    const { cliente } = montaOrigen({
      almacen, modoPropio: 'sin-base-de-datos', modosRespaldo: ['cola', 'plazo-agotado', 'json-truncado'],
    });

    await assert.rejects(() => cliente.pide({ consulta: { ql: qlDe(MADRID) } }), (e) => {
      assert.equal(e.name, 'FalloDeAguasArriba');
      assert.equal(e.ruta, 'generacion');
      return true;
    });
    // Aquí no aplica la degradación silenciosa: no hay mapa que levantar, así que no se
    // congela nada. Un mundo generado sobre una respuesta vacía sería un juego roto.
    assert.equal(almacen.tamano(), 0, 'quedó guardado algo de una celda que no se pudo levantar');
  });

  test('Una generación fallida no dice qué servidor falló ni por dónde pasó', async () => {
    const { cliente } = montaOrigen({ modoPropio: 'sin-base-de-datos', modosRespaldo: ['cola', 'cola', 'cola'] });
    const zona = '40.4168';
    await assert.rejects(() => cliente.pide({ consulta: { ql: qlDe(MADRID) } }), (e) => {
      const texto = `${e.message} ${JSON.stringify(e.ruta)} ${JSON.stringify(e.tipo)}`;
      assert.ok(!texto.includes(zona), 'el fallo lleva una coordenada dentro');
      for (const url of [PROPIO, ...MIRRORS]) assert.ok(!texto.includes(url), 'el fallo nombra un servidor');
      // Lo que sí lleva: la ruta y el tipo de fallo, del catálogo cerrado.
      assert.equal(e.ruta, 'generacion');
      assert.ok(['caido', 'plazo-agotado'].includes(e.tipo));
      return true;
    });
  });

  test('El recuento del día dice qué eslabón sirvió cada generación, y nada más', async () => {
    const reloj = creaReloj();
    const metrica = montaMetrica(reloj);
    assert.deepEqual([...ESLABONES_MEDIDOS], [...ETIQUETAS_DE_ESLABON]);

    // El propio no sirve y el primer mirror tampoco: sirve el segundo, tres veces.
    const { cliente } = montaOrigen({
      listo: false, modosRespaldo: ['cola', 'sirve', 'cola'],
      anota: (eslabon) => metrica.cuentaEslabon(eslabon),
    });
    for (const lat of [40.40, 40.41, 40.42]) await cliente.pide({ consulta: { ql: qlDe({ ...MADRID, lat }) } });

    const dia = await metrica.delDia();
    assert.deepEqual(dia.eslabones, { propio: 0, 'respaldo-1': 0, 'respaldo-2': 3, 'respaldo-3': 0, ninguno: 0 });

    // Y la cadena agotada también se cuenta: ese mapa no se levantó.
    const agotada = montaOrigen({
      listo: false, modosRespaldo: ['cola', 'cola', 'cola'],
      anota: (eslabon) => metrica.cuentaEslabon(eslabon),
    });
    await assert.rejects(() => agotada.cliente.pide({ consulta: { ql: qlDe({ ...MADRID, lat: 40.43 }) } }));
    assert.equal((await metrica.delDia()).eslabones.ninguno, 1);
  });

  test('La cadena declarada dice el orden del respaldo, sus plazos y la procedencia del extracto', () => {
    const { cliente } = montaOrigen();
    const declarada = cliente.declaraCadena();
    assert.equal(declarada.propio, PROPIO);
    assert.deepEqual(declarada.respaldo, MIRRORS, 'el respaldo tiene que recorrerse en el orden declarado');
    assert.equal(declarada.presupuestoDatos, 20000);
    assert.equal(declarada.plazoEslabon, 8000);
    assert.equal(declarada.consultaVersion, VERSION_CONSULTA);
    // Un número sin extracto, mirror y fecha no es comparable con el siguiente.
    for (const campo of ['extracto', 'mirror', 'fecha', 'cobertura', 'actualizacionPorDiffs']) {
      assert.ok(declarada[campo] !== undefined, `la cadena declarada no dice ${campo}`);
    }
    assert.equal(declarada.actualizacionPorDiffs, false, 'el extracto no se actualiza por diffs');
  });
});

describe('La cobertura del extracto, que es el error que no se ve', () => {
  test('Una celda fuera del extracto no da un mundo vacío', async () => {
    const cobertura = creaCobertura({});
    assert.equal(cobertura.cubre(MADRID), true);
    // Un extracto de España responde a Lisboa con un 200 perfectamente válido y cero
    // elementos: se comprueba **antes** de preguntar, o se genera un mundo sin nada
    // anclado y se presenta como legítimo.
    assert.equal(cobertura.cubre(LISBOA), false);
    assert.equal(cobertura.cubre(PARIS), false);

    for (const fuera of [LISBOA, PARIS]) {
      const { cliente, cadena } = montaOrigen({ modoPropio: 'sirve', modosRespaldo: ['sirve', 'cola', 'cola'] });
      const contenido = await cliente.pide({ consulta: { ql: qlDe(fuera) } });
      assert.equal(cadena.propio.llamadas(), 0, 'se preguntó al extracto por una celda que no cubre');
      assert.equal(cadena.respaldo[0].llamadas(), 1, 'el respaldo sí tiene el planeta');
      assert.ok(contenido.elements.length > 0);
    }
  });

  test('Una celda dentro de la cobertura se consulta al Overpass del proyecto y no sale hacia ningún mirror', async () => {
    const { cliente, cadena } = montaOrigen({ modoPropio: 'sirve', modosRespaldo: ['sirve', 'sirve', 'sirve'] });
    await cliente.pide({ consulta: { ql: qlDe(MADRID) } });
    assert.equal(cadena.propio.llamadas(), 1);
    assert.deepEqual(cadena.respaldo.map((m) => m.llamadas()), [0, 0, 0]);
  });

  test('Media celda dentro de la cobertura no cuenta como cubierta', () => {
    const cobertura = creaCobertura({});
    // Un mundo con la mitad de sus anclajes es indistinguible de un mundo pobre.
    assert.equal(cobertura.cubre({ lat: 41.85, lon: -8.87, radio_m: 100 }), true);
    assert.equal(cobertura.cubre({ lat: 43.899, lon: -8.87, radio_m: 1200 }), false, 'la celda se sale por el norte');
    assert.equal(cobertura.cubre({ lat: 40.0, lon: -7.105, radio_m: 1200 }), false, 'la celda se sale por la raya');
    // Sin coordenada no hay cobertura que comprobar, y ante la duda nunca al extracto.
    assert.equal(cobertura.cubre(null), false);
    assert.equal(cobertura.cubre({ lat: NaN, lon: 0 }), false);
    assert.equal(celdaDeConsulta('[out:json];out;'), null);
  });

  test('La cobertura del extracto es un dato explícito y consultable, no el nombre de un fichero', () => {
    const declarada = creaCobertura({ extracto: 'spain-latest', mirror: 'https://mirror.example/spain.pbf', fecha: '2026-08-01' }).declara();
    assert.equal(declarada.cobertura, 'espana');
    assert.ok(declarada.bandas.length >= 1);
    assert.equal(declarada.extracto, 'spain-latest');
    assert.equal(declarada.mirror, 'https://mirror.example/spain.pbf');
    assert.equal(declarada.fecha, '2026-08-01');
    assert.ok(declarada.descripcion.length > 10);
    assert.deepEqual(Object.keys(COBERTURAS).sort(), ['espana', 'planeta']);
    // Una cobertura sin declarar no arranca: deducirla del nombre del fichero es cómo se
    // acaba generando Lisboa contra un extracto de España.
    assert.throws(() => creaCobertura({ cobertura: 'portugal' }), /no arranca/);
  });

  test('Una respuesta vacía del propio se confirma contra el respaldo antes de darla por buena', async () => {
    // Cerca del borde, «vacío» y «fuera del extracto» se parecen demasiado: la cobertura
    // es un recorte grueso y esta es la segunda red.
    const { cliente, cadena } = montaOrigen({
      modoPropio: { modo: 'sirve', elementos: 0 }, modosRespaldo: [{ modo: 'sirve', elementos: 7 }, 'cola', 'cola'],
    });
    const contenido = await cliente.pide({ consulta: { ql: qlDe(MADRID) } });
    assert.equal(contenido.elements.length, 7, 'el vacío del propio se sirvió sin confirmar');
    assert.equal(cadena.respaldo[0].llamadas(), 1);
  });
});

describe('La caché permanente, y el texto de la consulta que la invalida entera', () => {
  test('La clave de la caché sale del texto literal de la consulta y de nada más', () => {
    const ql = qlDe(MADRID);
    assert.equal(claveDeConsulta(ql), claveDeConsulta(ql));
    assert.equal(claveDeConsulta(ql).length, 64, 'la clave es el resumen del texto');
    // Ni la hora, ni quién llama, ni la celda aparte: el texto y nada más.
    assert.notEqual(claveDeConsulta(ql), claveDeConsulta(`${ql} `));
    assert.notEqual(claveDeConsulta(ql), claveDeConsulta(qlDe({ ...MADRID, lat: 40.4169 })));
  });

  test('Un cambio de una sola letra en el texto de la consulta invalida la caché entera', async () => {
    const { cliente, cadena } = montaOrigen({ modoPropio: 'sirve' });
    const ql = qlDe(MADRID);
    await cliente.pide({ consulta: { ql } });
    await cliente.pide({ consulta: { ql } });
    assert.equal(cadena.propio.llamadas(), 1);

    // Una letra: no hay acierto y la petición sale hacia arriba. Es el precio conocido, no
    // una avería, y por eso el texto lleva versión declarada.
    await cliente.pide({ consulta: { ql: `${ql}\n` } });
    assert.equal(cadena.propio.llamadas(), 2);
  });

  test('Ninguna entrada de la caché de consultas caduca por el paso del tiempo', async () => {
    const reloj = creaReloj();
    const { cliente, cadena } = montaOrigen({ modoPropio: 'sirve', reloj });
    const ql = qlDe(MADRID);
    await cliente.pide({ consulta: { ql } });

    // Los datos de OSM cambian despacio: la caché es permanente por diseño.
    reloj.avanza(365 * 24 * 60 * 60 * 1000);
    await cliente.pide({ consulta: { ql } });
    assert.equal(cadena.propio.llamadas(), 1, 'una entrada caducó por el paso del tiempo');
  });

  test('Una respuesta que no es JSON completo no se cachea y no se sirve', async () => {
    const almacen = creaAlmacenDeConsultasEnMemoria();
    const { cliente, cadena } = montaOrigen({
      almacen, modoPropio: 'json-truncado', modosRespaldo: ['json-truncado', 'json-truncado', 'json-truncado'],
    });
    await assert.rejects(() => cliente.pide({ consulta: { ql: qlDe(MADRID) } }), /generacion/);
    assert.equal(almacen.tamano(), 0, 'se cacheó un cuerpo que llegó a medias');
    assert.equal(cadena.propio.llamadas(), 1);

    // Y clasificado como ilegible, que es lo que impide servirlo.
    assert.equal(clasificaRespuesta({ texto: '{"elements":[{"id"', http: 200 }).motivo, 'respuesta-ilegible');
  });

  test('Dos generaciones simultáneas de la misma celda hacen una sola consulta aguas arriba', async () => {
    const { cliente, cadena } = montaOrigen({ modoPropio: 'sirve' });
    const ql = qlDe(MADRID);
    const [a, b] = await Promise.all([cliente.pide({ consulta: { ql } }), cliente.pide({ consulta: { ql } })]);
    assert.deepEqual(a, b);
    assert.equal(cadena.propio.llamadas(), 1, 'la coalescencia no evitó la segunda consulta');
  });

  test('Cada fixture de OSM guarda la consulta literal con la que se capturó', () => {
    // Es lo que hace posible cruzar un cambio de versión con lo que producción pide: sin
    // la consulta literal en el manifiesto, un fixture deja de representar a producción y
    // no hay forma de verlo.
    for (const nombre of mundosCongelados()) {
      const { manifiesto } = mundoCongelado(nombre);
      assert.ok(manifiesto.consultas, `${nombre} no guarda sus consultas`);
      for (const parte of ['geo', 'pois', 'callejero']) {
        assert.match(manifiesto.consultas[parte], /around:/, `${nombre}/${parte}`);
        assert.ok(manifiesto.consultas[parte].includes(`around:${manifiesto.radio_m},${manifiesto.coordenada.lat},${manifiesto.coordenada.lon}`),
          `${nombre}/${parte} no cita la celda de su manifiesto`);
      }
    }
    // Y el texto de producción es un artefacto con versión, comparable con ellas.
    assert.equal(typeof VERSION_CONSULTA, 'string');
    assert.match(qlDe(MADRID), /around:1200,40\.4168,-3\.7038/);
  });
});

describe('Lo que el Overpass del proyecto no escribe', () => {
  test('Las coordenadas salen una sola vez, al generar el mapa', async () => {
    const zona = '40.4168';
    const inspector = creaInspectorDeRed();
    const reloj = creaReloj();
    const metrica = montaMetrica(reloj);
    const almacen = creaAlmacenDeConsultasEnMemoria();
    const { cadena } = montaOrigen({ modoPropio: 'sirve' });
    const { cliente } = montaOrigen({
      almacen, reloj, transporte: inspector.envuelve((u, o) => cadena.fetch(u, o)),
      anota: (eslabon) => metrica.cuentaEslabon(eslabon),
    });

    // Tres generaciones de la misma celda: la coordenada sale **una vez**, con la
    // consulta, y las otras dos las sirve la caché.
    for (let i = 0; i < 3; i++) await cliente.pide({ consulta: { ql: qlDe(MADRID) } });
    const conCoordenada = inspector.peticiones().filter((p) => JSON.stringify(p).includes(zona));
    assert.equal(conCoordenada.length, 1, 'la coordenada salió más de una vez');
    assert.equal(inspector.peticiones().length, 1);

    // Y no queda escrita en ningún sitio: la clave es el resumen del texto, el valor son
    // los elementos, y la métrica del día es un recuento.
    const escrito = JSON.stringify(await Promise.all([metrica.delDia()]));
    assert.ok(!escrito.includes(zona), 'la coordenada quedó escrita en la métrica');
    assert.equal(almacen.tamano(), 1);
    assert.ok(!claveDeConsulta(qlDe(MADRID)).includes(zona));
  });

  test('El proxy no identifica a nadie', async () => {
    const reloj = creaReloj();
    const metrica = montaMetrica(reloj);
    const { cliente } = montaOrigen({
      listo: false, modosRespaldo: ['sirve', 'cola', 'cola'], anota: (e) => metrica.cuentaEslabon(e),
    });
    await cliente.pide({ consulta: { ql: qlDe(MADRID) } });

    const dia = JSON.stringify(await metrica.delDia());
    // Ni quién llamó, ni desde dónde, ni qué zona: el recuento por eslabón es cuántas,
    // nunca dónde.
    for (const rastro of ['40.4', '-3.7', 'http', 'ip', 'agent', 'jugador', 'usuario', 'sesion']) {
      assert.ok(!dia.toLowerCase().includes(rastro.toLowerCase()), `la métrica del día contiene «${rastro}»`);
    }
    assert.deepEqual(Object.keys(JSON.parse(dia).eslabones), [...ESLABONES_MEDIDOS]);
  });

  test('Un día sin una sola generación tiene el recuento por eslabón a cero y no le falta ninguno', async () => {
    const metrica = montaMetrica();
    const vacio = await metrica.delDia();
    for (const eslabon of ESLABONES_MEDIDOS) assert.equal(vacio.eslabones[eslabon], 0, eslabon);
    assert.deepEqual(Object.keys(vacio.eslabones), [...ESLABONES_MEDIDOS]);
    // Un eslabón inventado no se cuenta: el catálogo es cerrado.
    await assert.rejects(() => metrica.cuentaEslabon('otro'), /no declarado/);
  });

  test('El registro de accesos está apagado y la configuración lo declara a propósito', () => {
    // La consulta que llega a esa máquina lleva las coordenadas del jugador dentro del
    // cuerpo: un access_log ordinario las escribiría con fecha y con IP, y desmentiría el
    // escenario bloqueante sin que ninguna línea de código pareciera culpable.
    const nginx = readFileSync(join(RAIZ, 'deploy', 'overpass', 'nginx-sin-registro.conf'), 'utf8');
    assert.match(nginx, /^\s*access_log\s+off;/m);
    assert.ok(!/^\s*access_log\s+(?!off)/m.test(nginx), 'hay un access_log encendido');

    const compose = readFileSync(join(RAIZ, 'deploy', 'overpass', 'docker-compose.yml'), 'utf8');
    assert.match(compose, /nginx-sin-registro\.conf:\/etc\/nginx\/conf\.d\//, 'el fragmento no va montado: se pierde al recrear');
    assert.ok(!/^\s*ports:/m.test(compose), 'el puerto no se publica al mundo: solo el proxy habla con esto');
    assert.ok(!/OVERPASS_DIFF_URL/.test(compose), 'sin actualización por diffs, a propósito');

    // Y el runbook separa las dos causas de síntoma idéntico con sus dos arreglos.
    const runbook = readFileSync(join(RAIZ, 'deploy', 'overpass', 'RUNBOOK.md'), 'utf8');
    assert.match(runbook, /No such file or directory/);
    assert.match(runbook, /Permission denied/);
    assert.match(runbook, /chmod 755 \/db/);
  });
});
