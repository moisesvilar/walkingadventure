// SPEC-026 · El mapa real, generado dentro del móvil: la tubería entera cableada al
// otro lado de la frontera, lo que se congela y lo que pasa cuando los datos no llegan.
//
// Todo esto se afirma **ejecutando la orquestación de la app**, no leyéndola: las dos
// entradas nuevas —el traedor de datos de OSM y el cronómetro— llegan inyectadas, así
// que doblarlas es pasar otro argumento y `node --test` recorre el levantamiento
// entero sin simulador, sin red y sin reloj del sistema. Es lo que hace que estas
// pruebas puedan ponerse rojas; la parte que de verdad necesita un dispositivo —el
// pintado en Skia y los gestos sobre la pantalla— sigue siendo @app y en esta máquina
// no hay dónde ejecutarla.
//
// Escenarios de docs/testing.md que se reutilizan aquí, con su nombre literal:
// «No hay dos nombres iguales en un mundo» y «El idioma sale de la ubicación» (de
// «Los nombres son únicos y del idioma del sitio»), «El mundo no depende de OSM
// después de generarse» y «Una salida entera se juega sin red» (de «El mundo se
// congela entero»), «Las coordenadas salen una sola vez, al generar el mapa» (@red),
// «Dos generaciones con la misma semilla dan el mismo mundo», «El orden de iteración
// no depende del orden de inserción», «No se usa ninguna fuente de azar ni de tiempo
// del sistema» y «Cambiar el tramo del jugador no redimensiona un mundo ya generado».
// Los cuatro primeros ya estaban vivos en B1 sobre el paquete; lo que esta fila añade
// es **dónde se afirman**: sobre el mundo levantado dentro del móvil, que es una
// afirmación que ninguna prueba del paquete podía hacer y que se pone roja si la app
// cablea el paquete de otra manera.
//
// Lo que no tiene escenario en la batería —el anclaje redondeado, el cableado
// ausente, la carencia declarada, la versión de formato, el minuto— va marcado como
// hueco declarado en test/spec-test-map.json.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { creaAlmacenEnMemoria } from '../../app/datos/almacen.js';
import { creaTraedorDeOsm } from '../../app/datos/traedor.js';
import { VERSION_CONSULTA, consultaDeCelda } from '../../app/datos/consulta-osm.js';
import { DEL_NUCLEO, PIEZAS_DEL_LEVANTAMIENTO, carenciasDe, creaLevantamiento } from '../../app/mapa/levantamiento.js';
import { FASES, IDS_DE_FASE, faseDeAviso } from '../../app/mapa/fases.js';
import { creaCronometro } from '../../app/mapa/cronometro.js';
import { CLAVES } from '../../packages/nucleo/partida/mapa.js';
import { generaCelda } from '../../packages/nucleo/world/celda.js';
import { celdaEnPosicion, creaRejilla } from '../../packages/nucleo/world/rejilla.js';
import { colocadorDeRotulos } from '../../packages/nucleo/render/colocador.js';
import { medidorNominal } from '../../packages/nucleo/render/medidor-nominal.js';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { consultaDeFixture, consultaQueFalla, consultaVacia, coordenadaDe } from './celda-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import {
  EN_EL_INTERIOR,
  EN_GALICIA,
  LAS_CUATRO,
  NUCLEO_DEL_LEVANTAMIENTO,
  OTRA_SEMILLA,
  SEMILLA_DE_PRUEBA,
  TAMANO,
  TRAMO_M,
  clienteDoblado,
  consultaQueNoEncaja,
  levantaFixture,
  montaLevantamiento,
  nombresDeLaCelda,
  serializado,
} from './levantamiento-de-prueba.mjs';

/** Los módulos que esta fila añade a `app/`. Es lo que se lee cuando se lee código. */
const LO_QUE_ESTA_FILA_AÑADE = [
  'app/mapa/levantamiento.js',
  'app/mapa/camara.js',
  'app/mapa/cronometro.js',
  'app/mapa/fases.js',
  'app/datos/traedor.js',
  'app/datos/consulta-osm.js',
  'app/datos/almacen.js',
  'app/pantallas/mapa.jsx',
];

// Levantar los cuatro cuesta un segundo y medio y las pruebas de solo lectura los
// comparten. Las que cuentan generaciones, consultas o escrituras montan su propio
// banco: un recuento compartido no es un recuento.
const cacheDeBancos = new Map();
async function bancoDe(nombre) {
  if (!cacheDeBancos.has(nombre)) cacheDeBancos.set(nombre, await levantaFixture(nombre));
  return cacheDeBancos.get(nombre);
}

// ════════════════════════════════════════════════════════════════════════════════
// Levantar un mapa de punta a punta, dentro del móvil
// ════════════════════════════════════════════════════════════════════════════════

describe('Levantar un mapa de punta a punta, dentro del móvil', () => {
  test('La celda se ancla a la coordenada redondeada y no a la que entró', async () => {
    const c = coordenadaDe(EN_GALICIA);
    // Dos coordenadas exactas distintas dentro del mismo anclaje: si lo que mandara
    // fuera lo que entró, saldrían dos mapas y no uno.
    const cerca = { lat: 0.0021, lon: -0.0013 };
    const otra = { lat: -0.0018, lon: 0.0009 };
    const uno = await levantaFixture(EN_GALICIA, { desplaza: cerca });
    const dos = await levantaFixture(EN_GALICIA, { desplaza: otra });

    assert.equal(uno.resultado.mapaId, dos.resultado.mapaId, 'dos coordenadas del mismo anclaje han dado mapas distintos');
    assert.equal(uno.resultado.mapaId, uno.levantamiento.identificadorDe({ lat: c.lat, lon: c.lon, tramoM: TRAMO_M }));
    assert.equal(serializado(uno.resultado.documento), serializado(dos.resultado.documento));

    // Y la coordenada exacta no viaja: no aparece en ningún documento escrito.
    const escrito = uno.almacen.volcado().map(([clave, texto]) => `${clave}\n${texto}`).join('\n');
    for (const punto of [uno.punto.lat, uno.punto.lon]) {
      assert.equal(escrito.includes(String(punto)), false, `la coordenada exacta ${punto} ha acabado escrita en la partida`);
      assert.equal(escrito.includes(punto.toFixed(4)), false, `la coordenada exacta ${punto} ha acabado escrita con cuatro decimales`);
    }
  });

  test('El mundo no depende de OSM después de generarse', async () => {
    // Se levanta con el traedor cableado y se reabre con el mismo banco: `abre` no
    // recibe el traedor, así que por ahí no hay camino hasta la red aunque se quisiera.
    const { levantamiento, almacen, resultado, consultaOsm } = await levantaFixture(EN_GALICIA);
    const consultasAlLevantar = consultaOsm.llamadas.length;
    assert.ok(consultasAlLevantar > 0, 'levantar el mapa no ha pedido nada a OSM: la prueba no está probando nada');

    const abierto = await levantamiento.abre({ id: resultado.mapaId, semilla: SEMILLA_DE_PRUEBA, tamano: TAMANO });
    const otraVez = await levantamiento.abre({ id: resultado.mapaId, semilla: SEMILLA_DE_PRUEBA, tamano: TAMANO });

    assert.equal(consultaOsm.llamadas.length, consultasAlLevantar, 'reabrir el mapa ha vuelto a pedirle datos a OSM');
    assert.equal(levantamiento.recuento().generaciones, 1, 'reabrir el mapa ha vuelto a generar');
    assert.equal(serializado(abierto.documento), serializado(otraVez.documento), 'dos aperturas han dado documentos distintos');
    assert.equal(serializado(abierto.escena), serializado(otraVez.escena), 'dos aperturas han dado láminas distintas');
    // El documento que se pinta es el congelado y la lámina sale idéntica primitiva a
    // primitiva a la del levantamiento: pintar lo leído y pintar lo generado coinciden.
    assert.equal(serializado(abierto.escena), serializado(resultado.escena));
    assert.equal(almacen.recuento().escrituras > 0, true);
  });

  test('Una salida entera se juega sin red', async () => {
    // El mapa ya está levantado y la puerta de red se corta del todo: el inspector en
    // modo estricto no deja pasar ninguna salida que no envuelva. Se pinta entero.
    const { levantamiento, resultado } = await levantaFixture('barrio-tres-calles');
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const abierto = await levantamiento.abre({ id: resultado.mapaId, semilla: SEMILLA_DE_PRUEBA, tamano: TAMANO });
      assert.equal(abierto.estado, 'pintado');
      assert.ok(abierto.escena.primitivas.length > 0, 'el mapa se ha abierto sin red y la lámina ha salido vacía');
      assert.notEqual(abierto.escena.vacia, true, 'la lámina se ha declarado vacía');
      assert.deepEqual(inspector.peticiones(), [], 'abrir un mapa ya levantado ha sacado tráfico del móvil');
    } finally {
      inspector.suelta();
    }
  });

  test('Las coordenadas salen una sola vez, al generar el mapa', async () => {
    // La única salida es la del traedor, y ocurre al levantar. Abrir, repintar con
    // otro estilo y volver a pedir el mismo mapa no añaden ni una.
    const { levantamiento, resultado, consultaOsm } = await levantaFixture('barrio-tres-calles');
    const alLevantar = consultaOsm.llamadas.length;
    await levantamiento.abre({ id: resultado.mapaId, semilla: SEMILLA_DE_PRUEBA, tamano: TAMANO });
    levantamiento.pinta({ documento: resultado.documento, camara: resultado.camara, tamano: TAMANO, estilo: 'pergamino' });
    await levantamiento.levanta({
      lat: resultado.registro.centro.lat, lon: resultado.registro.centro.lon,
      semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M, tamano: TAMANO,
    });
    assert.equal(consultaOsm.llamadas.length, alLevantar, 'algo ha vuelto a salir a OSM después de levantar el mapa');
    assert.equal(levantamiento.recuento().consultas, 1, 'el levantamiento ha consultado más de una vez');
  });

  test('Pedir el mapa otra vez en la misma coordenada no resiembra: se abre el que existe', async () => {
    const { levantamiento, resultado, coordenada } = await levantaFixture('suelo-250m');
    const otra = await levantamiento.levanta({
      lat: coordenada.lat, lon: coordenada.lon, semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M, tamano: TAMANO,
    });
    assert.equal(otra.mapaId, resultado.mapaId);
    assert.equal(otra.generada, false, 'levantar otra vez ha vuelto a marcar el mapa como generado');
    assert.equal(levantamiento.recuento().generaciones, 1, 'levantar otra vez ha resembrado el mundo');
    // Se compara la lámina y no el objeto que devuelve cada camino: levantar entrega el
    // mundo recién generado y abrir entrega el que se leyó del almacén, que es un
    // subconjunto congelado del primero. Lo que la spec afirma es que se pinta lo mismo,
    // y eso se afirma primitiva a primitiva.
    assert.equal(serializado(otra.escena), serializado(resultado.escena), 'levantar otra vez ha pintado otra lámina');
    assert.equal(otra.titulo, resultado.titulo);
    assert.equal(otra.clave, resultado.clave);
  });

  test('No hay dos nombres iguales en un mundo', async () => {
    for (const nombre of LAS_CUATRO) {
      const { resultado } = await bancoDe(nombre);
      const nombres = nombresDeLaCelda(resultado.documento);
      assert.ok(nombres.length > 0, `el mundo levantado en ${nombre} no tiene ni un nombre`);
      const repetidos = nombres.filter((n, i) => nombres.indexOf(n) !== i);
      assert.deepEqual(repetidos, [], `hay nombres repetidos en el mundo levantado en el móvil sobre ${nombre}`);
    }
  });

  test('El idioma sale de la ubicación', async () => {
    // Los dos ejemplos del esquema de la batería, comprobados sobre el mundo que
    // levanta la app: uno en Galicia y otro en el interior.
    const gallego = await bancoDe(EN_GALICIA);
    const castellano = await bancoDe(EN_EL_INTERIOR);
    assert.equal(gallego.resultado.idioma, 'gl', `${EN_GALICIA} está en Galicia y no ha salido en gallego`);
    assert.equal(castellano.resultado.idioma, 'es', `${EN_EL_INTERIOR} está en el interior y no ha salido en castellano`);
    // El idioma del índice del mapa y el del documento de la celda son el mismo: si la
    // app cableara el paquete de idioma por su cuenta, aquí divergirían.
    assert.equal(gallego.resultado.mapa.idioma, gallego.resultado.documento.locale);
    assert.equal(castellano.resultado.mapa.idioma, castellano.resultado.documento.locale);
  });

  test('El mundo levantado en el móvil y el generado en Node son idénticos byte a byte', async () => {
    for (const nombre of LAS_CUATRO) {
      const { resultado, coordenada } = await bancoDe(nombre);
      const rejilla = creaRejilla({ lat: coordenada.lat, lon: coordenada.lon, tramoM: TRAMO_M });
      const enNode = await generaCelda({
        rejilla,
        semilla: SEMILLA_DE_PRUEBA,
        mapaId: rejilla.id,
        celda: celdaEnPosicion(rejilla, coordenada.lat, coordenada.lon),
        motivo: 'pisada',
        consultaOsm: consultaDeFixture(nombre),
        tramoM: TRAMO_M,
      });
      assert.equal(serializado(resultado.registro), serializado(enNode), `el mundo de ${nombre} difiere entre el móvil y Node`);
    }
  });

  test('El generador declara en qué fase va, y las seis llegan en orden', async () => {
    const avisos = [];
    await levantaFixture(EN_GALICIA, { onFases: (estado) => avisos.push(estado) });
    assert.ok(avisos.length > 0, 'levantar el mapa no ha declarado ni una fase');
    // El último aviso es el del final, que no tiene ninguna en curso y las deja todas
    // completadas. Los demás nombran la fase en la que se entró.
    const enCurso = avisos.slice(0, -1).map((e) => e.enCurso);
    const final = avisos[avisos.length - 1];
    // Nunca retroceden: `fetch` y `coast` caen en la misma fase visible, y en un mundo
    // costero eso ocurre después de haber pasado por la máscara.
    const indices = enCurso.map((id) => IDS_DE_FASE.indexOf(id));
    assert.equal(indices.includes(-1), false, `una fase declarada no está en la lista de la pantalla: ${enCurso.join(' → ')}`);
    assert.deepEqual(indices, [...indices].sort((a, b) => a - b), `la lista de fases ha retrocedido: ${enCurso.join(' → ')}`);
    assert.equal(enCurso[0], 'datos', 'la primera fase visible no es la de los datos');
    assert.equal(enCurso[enCurso.length - 1], 'nombres', 'la última fase visible no es la del casting y la congelación');
    assert.equal(final.enCurso, null, 'al terminar sigue habiendo una fase en curso');
    assert.deepEqual([...final.completadas], [...IDS_DE_FASE], 'al terminar no han quedado las seis fases completadas');
    // Los seis literales son los de la pantalla ya dibujada, y no hay ni una cifra.
    assert.deepEqual(FASES.map((f) => f.texto), [
      'Mirando qué hay por ahí',
      'Separando la tierra del agua',
      'Repartiendo la gente',
      'Trazando las calzadas',
      'Buscando los sitios con historia',
      'Poniéndole nombre a todo',
    ]);
    for (const fase of FASES) assert.equal(/\d/.test(fase.texto), false, `la fase "${fase.texto}" lleva una cifra`);
  });

  test('Una fase del generador que la pantalla no reconoce falla nombrándola', () => {
    assert.throws(() => faseDeAviso('inventada'), /inventada/);
    assert.throws(() => faseDeAviso('inventada'), /fetch/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Cuando la red no está o los datos no llegan
// ════════════════════════════════════════════════════════════════════════════════

describe('Cuando la red no está o los datos no llegan', () => {
  test('Sin conexión no se levanta el mapa, y no queda ningún documento a medias', async () => {
    const { levantamiento, almacen } = montaLevantamiento({ consultaOsm: consultaQueFalla('no hay por dónde pedir los datos') });
    const c = coordenadaDe(EN_GALICIA);
    await assert.rejects(
      () => levantamiento.levanta({ lat: c.lat, lon: c.lon, semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M, tamano: TAMANO }),
      /no hay por dónde pedir los datos/,
    );
    // O hay documento completo o no hay documento: ni el índice, ni la celda, ni nada.
    assert.deepEqual(await almacen.lista(''), [], 'un levantamiento fallido ha dejado documentos escritos');
    assert.deepEqual(await almacen.lista(CLAVES.prefijoDeMapa('')), []);
    assert.equal(almacen.recuento().escrituras, 0);
    // Y no hay ningún mapa levantado, así que arrancar otra vez empieza de cero.
    assert.deepEqual(await levantamiento.mapasLevantados(), []);
  });

  test('El texto que se lee cuando no se puede levantar no nombra la red', () => {
    const pantalla = fuente('app/pantallas/mapa.jsx');
    const textos = pantalla.match(/export const TEXTOS = Object\.freeze\(\{[\s\S]*?\}\);/);
    assert.ok(textos, 'la pantalla del mapa no declara sus literales en un solo sitio');
    for (const prohibida of ['red', 'servidor', 'internet', 'conexión', 'Overpass', 'OSM', 'error', 'código']) {
      assert.equal(
        new RegExp(prohibida, 'i').test(textos[0]), false,
        `un literal de la pantalla del mapa nombra "${prohibida}", que no es registro sino información que nadie puede usar`,
      );
    }
    // El motivo del fallo existe, pero como marca de diagnóstico y no como texto leído.
    assert.match(pantalla, /testID="mapa-motivo"/);
  });

  test('La app cerrada a mitad de la generación no deja ningún documento a medias', async () => {
    // La consulta se cae con el levantamiento a medio camino: es lo mismo que ver el
    // proceso morir, porque el registro solo se toca cuando hay un mundo entero.
    const { levantamiento, almacen } = montaLevantamiento({ consultaOsm: consultaQueFalla('la app se ha ido') });
    const c = coordenadaDe('barrio-tres-calles');
    await assert.rejects(() => levantamiento.levanta({ lat: c.lat, lon: c.lon, semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M, tamano: TAMANO }));
    assert.deepEqual(almacen.volcado(), []);

    // Y al volver a abrir la app, levantar empieza otra vez y esta vez termina.
    const segundo = montaLevantamiento({ nombre: 'barrio-tres-calles', almacen });
    const r = await segundo.levantamiento.levanta({ lat: c.lat, lon: c.lon, semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M, tamano: TAMANO });
    assert.equal(r.estado, 'pintado');
    assert.equal(r.generada, true);
    assert.deepEqual(await segundo.levantamiento.mapasLevantados(), [r.mapaId]);
  });

  test('Una respuesta de OSM que no encaja falla nombrando lo que llegó', async () => {
    // Por el traedor de verdad, que es quien reparte: el cliente del proxy devuelve
    // algo con la forma cambiada y el reparto se niega a inventarse un mundo pobre.
    const traedor = creaTraedorDeOsm({ cliente: { async pideGeneracion() { return { elementos: [] }; } } });
    const limites = { centro: coordenadaDe(EN_GALICIA), ladoM: 1400 };
    await assert.rejects(
      () => traedor({ celda: { i: 0, j: 0 }, limites, margenM: 180 }),
      (e) => {
        assert.match(e.message, /elements/, 'el error no nombra la lista que se pidió');
        assert.match(e.message, /mundo pobre/, 'el error no dice que no se genera un mundo pobre en silencio');
        return true;
      },
    );

    // Y por la orquestación entera, para que el fallo no se coma a mitad de camino.
    const { levantamiento, almacen } = montaLevantamiento({ consultaOsm: consultaQueNoEncaja() });
    const c = coordenadaDe(EN_GALICIA);
    await assert.rejects(() => levantamiento.levanta({ lat: c.lat, lon: c.lon, semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M, tamano: TAMANO }));
    assert.deepEqual(almacen.volcado(), []);
  });

  test('Una celda que no da para un mundo jugable se declara en vez de entregarse vacía', async () => {
    // Una celda en mitad del mar es la que no trae ni una calle ni un anclaje: la
    // generación termina, el documento existe y la carencia va escrita en el resultado.
    const { levantamiento } = montaLevantamiento({ consultaOsm: consultaVacia() });
    const r = await levantamiento.levanta({ lat: 42.40, lon: -8.81, semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M, tamano: TAMANO });
    assert.equal(r.estado, 'pintado', 'la generación no ha terminado');
    assert.equal(r.jugable, false, 'una celda sin calles ni anclajes se ha declarado jugable');
    assert.ok(r.carencias.includes('sin-mundo-jugable'), `las carencias no lo declaran: ${r.carencias.join(', ')}`);
    assert.ok(r.carencias.includes('sin-viario'));
    assert.ok(r.carencias.includes('sin-parajes'));
    // Y aun así se pinta: el papel, el marco y la cartela existen. Lo que no hay es
    // un documento válido y vacío que pase por un mundo.
    assert.ok(r.escena.primitivas.length > 0);
  });

  test('Una celda sin ningún anclaje utilizable se genera con lo que hay y lo declara', async () => {
    // El barrio de tres calles tiene callejero y ni un anclaje admitido: el mundo se
    // genera entero —sus parajes nacen de los cruces del grafo— y la carencia se dice.
    const { resultado } = await bancoDe('barrio-tres-calles');
    assert.equal(resultado.jugable, true, 'un mundo con calles se ha declarado no jugable');
    assert.deepEqual(carenciasDe(resultado.registro), resultado.carencias);
    assert.ok(resultado.carencias.includes('sin-anclajes'), `la carencia no está declarada: ${resultado.carencias.join(', ')}`);
    assert.ok(resultado.documento.parajes.length > 0, 'sin anclajes no ha salido ni un paraje');
    assert.equal(resultado.documento.parajes.every((p) => p.real === null || p.real === undefined), true);
  });

  test('Un documento de una versión que el juego no entiende se dice, y no se pinta media lámina', async () => {
    const { levantamiento, almacen, resultado } = await levantaFixture('barrio-tres-calles');
    const clave = CLAVES.indice(resultado.mapaId);
    const documento = JSON.parse(await almacen.lee(clave));
    documento.version = documento.version + 998;
    await almacen.escribe(clave, JSON.stringify(documento));

    await assert.rejects(
      () => levantamiento.abre({ id: resultado.mapaId, semilla: SEMILLA_DE_PRUEBA, tamano: TAMANO }),
      (e) => {
        assert.match(e.message, /versión de formato/, 'el error no nombra la versión de formato');
        assert.match(e.message, new RegExp(String(documento.version)), 'el error no dice qué versión llegó');
        return true;
      },
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Nada degrada por falta de cableado (§6h)
// ════════════════════════════════════════════════════════════════════════════════

describe('Nada degrada por falta de cableado', () => {
  const cableadoCompleto = () => ({
    consultaOsm: consultaVacia(),
    almacen: creaAlmacenEnMemoria(),
    cronometro: creaCronometro({ ahora: () => 0 }),
    colocador: colocadorDeRotulos,
    medidor: medidorNominal,
    nucleo: NUCLEO_DEL_LEVANTAMIENTO,
  });

  test('Sin una de las cinco piezas, la orquestación no se construye y nombra la que falta', () => {
    // Son seis desde SPEC-020: el generador dejó de ser un import de la orquestación y
    // pasó a ser una pieza más, y por eso su ausencia tiene que protestar como las otras.
    assert.deepEqual([...PIEZAS_DEL_LEVANTAMIENTO], ['consultaOsm', 'almacen', 'cronometro', 'colocador', 'medidor', 'nucleo']);
    for (const pieza of PIEZAS_DEL_LEVANTAMIENTO) {
      const piezas = cableadoCompleto();
      delete piezas[pieza];
      assert.throws(
        () => creaLevantamiento(piezas),
        new RegExp(pieza),
        `el levantamiento se ha construido sin ${pieza}: la pieza que, al no estar, no protesta`,
      );
    }
  });

  test('Un almacén o un cronómetro a medias fallan al construir y no al primer mapa', () => {
    for (const operacion of ['lee', 'escribe', 'lista', 'borra']) {
      const piezas = cableadoCompleto();
      piezas.almacen = { ...piezas.almacen, [operacion]: undefined };
      assert.throws(() => creaLevantamiento(piezas), new RegExp(operacion));
    }
    for (const metodo of ['arranca', 'mide', 'para', 'medida']) {
      const piezas = cableadoCompleto();
      piezas.cronometro = { ...piezas.cronometro, [metodo]: undefined };
      assert.throws(() => creaLevantamiento(piezas), new RegExp(metodo));
    }
    // Y el generador, que desde SPEC-020 es una pieza inyectada como las otras: un
    // núcleo sin `componeEscena` que construyera reventaría al pintar, que es la misma
    // degradación silenciosa un rato más tarde.
    assert.ok(DEL_NUCLEO.length > 0);
    for (const nombre of DEL_NUCLEO) {
      const piezas = cableadoCompleto();
      piezas.nucleo = { ...NUCLEO_DEL_LEVANTAMIENTO, [nombre]: undefined };
      assert.throws(
        () => creaLevantamiento(piezas),
        new RegExp(nombre),
        `el levantamiento se ha construido con un núcleo sin "${nombre}"`,
      );
    }
  });

  test('La copia declarada de la consulta produce el mismo texto que la del servidor', async () => {
    // La app no puede importar `server/aguas-arriba/overpass.mjs` —importa node:crypto y
    // el empaquetador del móvil no lo resuelve—, así que lleva **una copia declarada**
    // del texto. Si las dos divergen, el móvil deja de acertar en la caché del proxy y
    // paga minutos contra los mirrors **sin que nada se ponga rojo**: la pieza que, al
    // no estar, no protesta. Esto es lo que la pone roja.
    const servidor = await import('../../server/aguas-arriba/overpass.mjs');
    assert.equal(VERSION_CONSULTA, servidor.VERSION_CONSULTA, 'las dos mitades declaran versiones de consulta distintas');
    assert.equal(servidor.HUELLAS_DE_VERSION[VERSION_CONSULTA], servidor.huellaDeConsulta(), 'el texto del servidor cambió sin subir la versión');

    // Sobre las cuatro celdas de referencia y sobre un caso de radio redondo, byte a
    // byte: comparar solo una celda dejaría pasar una diferencia en el formato del
    // radio o de la coordenada.
    const casos = [
      ...LAS_CUATRO.map((nombre) => ({ ...coordenadaDe(nombre), radio_m: 900, nombre })),
      { lat: 40.4168, lon: -3.7038, radio_m: 1200, nombre: 'la de la huella' },
      { lat: 0, lon: 0, radio_m: 250, nombre: 'el suelo de 250 m' },
    ];
    for (const caso of casos) {
      assert.equal(
        consultaDeCelda(caso), servidor.consultaDeCelda(caso),
        `la consulta de la app y la del servidor difieren en ${caso.nombre}: la caché del proxy dejaría de acertar`,
      );
    }
  });

  test('El traedor de datos no se construye sin el cliente del proxy', () => {
    assert.throws(() => creaTraedorDeOsm({ cliente: null }), /cliente del proxy/);
    assert.throws(() => creaTraedorDeOsm({ cliente: {} }), /cliente del proxy/);
    assert.throws(() => creaTraedorDeOsm({ cliente: clienteDoblado(), observa: 'no soy una función' }), /observador/);
  });

  test('A buildWorld le llega el grafo viario cosido y no la lista de vías en crudo', async () => {
    // La degradación que este repositorio ya ha pagado tres veces: el callejero que no
    // llegaba al grafo. Se afirma sobre el informe del grafo del mundo levantado en el
    // móvil, que es donde se ve si el cosido de SPEC-007 está vivo o es código muerto.
    for (const nombre of LAS_CUATRO) {
      const { resultado, coordenada } = await bancoDe(nombre);
      const informe = resultado.documento.grafo;
      assert.ok(informe, `el mundo de ${nombre} no trae informe de grafo`);
      assert.ok(informe.nodos > 0 && informe.aristas > 0, `el grafo de ${nombre} llegó vacío a buildWorld`);
      assert.ok(informe.cosidas > 0, `el grafo de ${nombre} no ha cosido ni un hueco: el callejero no está llegando`);
      assert.ok(Number.isFinite(informe.componentes) && informe.componentes >= 1);

      // Y los mismos números que en Node con los mismos datos.
      const rejilla = creaRejilla({ lat: coordenada.lat, lon: coordenada.lon, tramoM: TRAMO_M });
      const enNode = await generaCelda({
        rejilla, semilla: SEMILLA_DE_PRUEBA, mapaId: rejilla.id,
        celda: celdaEnPosicion(rejilla, coordenada.lat, coordenada.lon),
        motivo: 'pisada', consultaOsm: consultaDeFixture(nombre), tramoM: TRAMO_M,
      });
      assert.equal(informe.componentes, enNode.mundo.grafo.componentes, `las componentes conexas de ${nombre} difieren entre el móvil y Node`);
      assert.equal(informe.cosidas, enNode.mundo.grafo.cosidas, `las aristas cosidas de ${nombre} difieren entre el móvil y Node`);
      assert.deepEqual([...informe.metrosCosidos], [...enNode.mundo.grafo.metrosCosidos]);
    }
  });

  test('En las cuatro coordenadas de referencia hay parajes que nacen de cruces y puentes', async () => {
    for (const nombre of LAS_CUATRO) {
      const { resultado } = await bancoDe(nombre);
      const delGrafo = resultado.documento.parajes.filter((p) => p.origin === 'grafo');
      assert.ok(
        delGrafo.length > 0,
        `en ${nombre} ningún paraje nace del grafo: los cruces y los puentes no están llegando al reparto`,
      );
      assert.equal(delGrafo.every((p) => ['cruce', 'puente'].includes(p.type)), true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Determinismo dentro del dispositivo (@determinismo, RNF-DET-003, bloqueante)
// ════════════════════════════════════════════════════════════════════════════════

describe('Determinismo dentro del dispositivo', () => {
  test('Dos generaciones con la misma semilla dan el mismo mundo', async () => {
    for (const nombre of ['barrio-tres-calles', EN_GALICIA]) {
      const uno = await levantaFixture(nombre);
      const dos = await levantaFixture(nombre);
      assert.equal(serializado(uno.resultado.documento), serializado(dos.resultado.documento), `${nombre} ha salido distinto dos veces`);
      assert.equal(serializado(uno.resultado.registro), serializado(dos.resultado.registro));
      // Y lo escrito en la partida también, byte a byte.
      assert.equal(serializado(uno.almacen.volcado()), serializado(dos.almacen.volcado()));
    }
  });

  test('El orden de iteración no depende del orden de inserción', async () => {
    for (const nombre of ['barrio-tres-calles', EN_GALICIA]) {
      const derecho = await levantaFixture(nombre);
      const alReves = await levantaFixture(nombre, { consultaOsm: consultaDeFixture(nombre, { ordenInvertido: true }) });
      assert.equal(
        serializado(derecho.resultado.registro), serializado(alReves.resultado.registro),
        `los mismos datos de OSM en otro orden han dado otro mundo en ${nombre}`,
      );
    }
  });

  test('Cambiar la semilla cambia el mundo', async () => {
    const uno = await levantaFixture(EN_GALICIA);
    const otro = await levantaFixture(EN_GALICIA, { semilla: OTRA_SEMILLA });
    assert.notEqual(serializado(uno.resultado.documento), serializado(otro.resultado.documento));
    assert.notDeepEqual(nombresDeLaCelda(uno.resultado.documento), nombresDeLaCelda(otro.resultado.documento));
  });

  test('Cambiar el tramo del jugador no redimensiona un mundo ya generado', async () => {
    // Se levanta con un tramo, se recalibra y se vuelve a pedir el mapa con otro muy
    // distinto: la rejilla del mapa se **lee** del índice y no se recalcula, así que el
    // mundo ya generado no se redimensiona ni se resiembra.
    const { levantamiento, resultado, coordenada, almacen } = await levantaFixture(EN_GALICIA, { tramoM: 700 });
    const antes = serializado(almacen.volcado());

    for (const tramoM of [400, 1200, 2000]) {
      const otra = await levantamiento.levanta({
        lat: coordenada.lat, lon: coordenada.lon, semilla: SEMILLA_DE_PRUEBA, tramoM, tamano: TAMANO,
      });
      assert.equal(otra.mapaId, resultado.mapaId, `con tramo ${tramoM} ha salido otro mapa`);
      assert.equal(otra.generada, false, `con tramo ${tramoM} el mundo se ha vuelto a generar`);
      assert.equal(otra.registro.ladoM, resultado.registro.ladoM, `con tramo ${tramoM} la celda ha cambiado de tamaño`);
      assert.equal(otra.registro.radioInscritoM, resultado.registro.radioInscritoM);
      assert.equal(serializado(otra.escena), serializado(resultado.escena), `con tramo ${tramoM} se ha pintado otra lámina`);
    }
    assert.equal(levantamiento.recuento().generaciones, 1, 'recalibrar el tramo ha resembrado el mundo');
    assert.equal(serializado(almacen.volcado()), antes, 'recalibrar el tramo ha tocado la partida guardada');
  });

  test('No se usa ninguna fuente de azar ni de tiempo del sistema', () => {
    // Sobre el código que **esta fila** añade a la app. El cronómetro es la excepción
    // declarada y por eso el reloj le llega inyectado: no lo lee, lo recibe.
    for (const ruta of LO_QUE_ESTA_FILA_AÑADE) {
      const codigo = fuente(ruta).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      assert.equal(/Math\.random/.test(codigo), false, `${ruta} usa Math.random dentro del móvil`);
      assert.equal(/Date\.now/.test(codigo), false, `${ruta} lee el reloj del sistema`);
      assert.equal(/new Date\(/.test(codigo), false, `${ruta} construye una fecha del sistema`);
      assert.equal(/performance\.now/.test(codigo), false, `${ruta} lee el reloj de rendimiento del sistema`);
      assert.equal(/hrtime/.test(codigo), false, `${ruta} lee el reloj monótono del sistema`);
    }

    // El punto de montaje es la única excepción, y está acotada: es donde el reloj de
    // verdad entra en la app, y entra **como argumento del cronómetro**. Una sola
    // aparición y en esa línea; en cualquier otro sitio sería el reloj colándose en la
    // generación por la puerta de atrás.
    const montaje = fuente('app/pantallas/mapa-montado.jsx').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(/Math\.random/.test(montaje), false, 'el punto de montaje del mapa usa Math.random');
    const relojes = montaje.match(/Date\.now\(\)/g) ?? [];
    assert.equal(relojes.length, 1, `el punto de montaje lee el reloj del sistema ${relojes.length} veces y solo puede una`);
    assert.match(montaje, /creaCronometro\(\{\s*ahora:\s*\(\)\s*=>\s*Date\.now\(\)\s*\}\)/, 'el reloj del sistema entra por algún sitio que no es el cronómetro');
  });

  test('El cronómetro no arranca sin el reloj inyectado', () => {
    assert.throws(() => creaCronometro(), /reloj inyectado/);
    assert.throws(() => creaCronometro({ ahora: 0 }), /reloj inyectado/);
    assert.throws(() => creaCronometro({ ahora: () => 'ya mismo' }).arranca(), /instante en milisegundos/);
  });
});
