// SPEC-029 · El momento en marcha: el mapa que no se mira, el zócalo de una sola línea, la
// oferta del desvío que se acepta girando y la declaración del camino que la ruta evitó.
//
// **Casi todo lo que hay que afirmar aquí son ausencias**, y una ausencia solo se puede
// poner roja contra una enumeración de lo que sí hay: sin simulador, «ni un control
// tocable» comprobado a ojo es un criterio que se cumple siempre y no mide nada
// (`pipeline/decisiones-orquestador.md` §6o). Por eso lo que se prueba es la **composición
// del momento como dato**, con sus vocabularios cerrados —elementos, tocables, clases de
// zócalo, campos del estado, capacidades que no existen—: añadir un botón, una cifra o una
// cuenta del trazado obliga a ampliar una de esas listas, que es donde se quiere que salte.
//
// Tres cosas que este fichero afirma y que no se ven en ninguna pantalla:
//
// - **La lista de tocables sale vacía por contrato**, con aventura y sin ella, con avisos y
//   sin ellos, con seguidor que responde y con seguidor que no.
// - **Ningún texto del momento lleva una cifra**, ni siquiera dentro de una frase: se pasan
//   todos por el mismo cribado del filtro de aptitud, y una guía con un número falla donde
//   nace y no en la pantalla de alguien.
// - **No existe la cuenta que habría que llevar para reprochar**: el estado de la salida no
//   tiene campo donde guardarla y no hay función que compare lo andado con el trazado.
//
// Los tres canales nuevos —seguidor, vibrador y notificador— entran inyectados y se doblan
// en `test/dobles/seguidor.mjs` y `test/dobles/canales-de-aviso.mjs`. Los mundos son los de
// `entrega-de-prueba.mjs`, escritos a mano porque lo que importa es qué sitios hay y no qué
// escenas admiten; y el grafo del camino evitado es sintético, porque ningún fixture trae
// una escalera con un rodeo de longitud elegida.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: la posición llega clasificada,
// el beat llega como dato de dos valores y no hay ninguna semilla que sembrar.
//
// Los casos que salen de `docs/testing.md` llevan su nombre literal; los demás van marcados
// como hueco de la batería en `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  ANTETITULOS,
  CAMPOS_DEL_ESTADO_EN_MARCHA,
  CAMPOS_QUE_EL_ESTADO_NO_TIENE,
  CAPACIDADES_QUE_NO_EXISTEN,
  CLASES_DE_ZOCALO,
  DESTINOS_DE_ABRIR,
  DE_QUE_DEPENDE_LA_LLEGADA,
  ELEMENTOS_DEL_MOMENTO,
  ELEMENTOS_QUE_NO_EXISTEN,
  GESTOS_DEL_MOMENTO,
  ORIENTACION,
  PRIORIDAD_DE_ZOCALO,
  PUERTAS_DE_ENTRADA,
  RAZONES_DE_CAMINO,
  TOCABLES_DEL_MOMENTO,
  atraviesaTerritorioNuevo,
  camposDelEstadoEnMarcha,
  componeEnMarcha,
  componeGuia,
  componeNoticia,
  daPorTransitable,
  declaraCaminoEvitado,
  eligeZocalo,
  exigeSeguidor,
  irsePorOtroLado,
  noGirar,
  ofreceDesvio,
  queEnsenaAbrirLaApp,
  revisaTextoDelMomento,
  sitiosRotulados,
  textosDelMomento,
  validaLlegada,
} from '../../packages/nucleo/partida/en-marcha.js';
import { CLASIFICACIONES } from '../../packages/nucleo/partida/ritmo.js';
import { MOTIVOS, MOTIVOS_POR_CRITERIO, MOTIVO_DE_SUPOSICION } from '../../packages/nucleo/world/aptitud.js';
import { SUPOSICIONES, construyeGrafo } from '../../packages/nucleo/world/grafo.js';
import { trazaLazo } from '../../packages/nucleo/partida/filtro.js';
import { abreSalida, cierraLaSalida, estadoDeSalidaAbierta, haySalidaAbierta } from '../../packages/nucleo/partida/salida-abierta.js';
import { creaEmisorDeAvisos } from '../../packages/nucleo/partida/avisos.js';
import { MAPA, mundoDeSitios } from './entrega-de-prueba.mjs';
import { notificadorQueRegistra, vibradorAusente, vibradorQueRegistra } from '../dobles/canales-de-aviso.mjs';
import {
  seguidorEnVehiculo,
  seguidorGuionizado,
  seguidorParado,
  seguidorQueClasificaMal,
  seguidorQueDejaDeResponder,
  seguidorSinCablear,
  seguidorSinPunto,
} from '../dobles/seguidor.mjs';

/** El mundo de referencia de este momento: cuatro parajes y un núcleo, escritos a mano. */
const MUNDO = mundoDeSitios();
const FONTE = 'A Fonte Vella';
const CRUCEIRO = 'O Cruceiro Branco';
const VILABOA = 'Vilaboa';

/** La calzada y el destino de la guía de referencia. Ninguno lleva cifra. */
const CALZADA = 'o Camiño do Sal';
const DESTINO = 'Monfrida';

/** La guía de referencia, compuesta. */
const guia = () => componeGuia({ calzada: CALZADA, destino: DESTINO });

/** El momento compuesto con lo que casi todas estas pruebas comparten. */
function momento(extra = {}) {
  return componeEnMarcha({
    seguidor: seguidorGuionizado(),
    vibrador: vibradorQueRegistra(),
    mundo: MUNDO,
    guia: guia(),
    ...extra,
  });
}

/** El registro de una salida abierta con su aventura aceptada. */
function conSalidaAbierta({ aventura = 'aventura-1' } = {}) {
  const estado = estadoDeSalidaAbierta();
  abreSalida(estado, { salida: 'salida-1', mapaId: MAPA, aventura });
  return estado;
}

const ASFALTO = { highway: 'residential', surface: 'asphalt' };
const ESCALERA = { highway: 'steps' };
const via = (nodes, puntos, extra = {}) => ({ pts: puntos.map(([x, y]) => ({ x, y })), nodes, ...extra });

/**
 * El grafo del camino evitado: una escalera recta entre los dos extremos y un rodeo
 * asfaltado. Con el criterio de escalones puesto, el lazo rodea y **declara** el tramo que
 * evitó, que es el dato que esta fila pinta.
 */
function grafoConEscalera() {
  return construyeGrafo([
    via([1, 2], [[0, 0], [300, 0]], { name: 'A Escaleira Vella', filtrables: ESCALERA }),
    via([1, 10, 2], [[0, 0], [150, 60], [300, 0]], { name: 'Rúa do Río', filtrables: ASFALTO }),
  ]);
}

/** La declaración que `filtro.js` deja, tomada de un lazo de verdad y no escrita a mano. */
function declaracionDelLazo() {
  const lazo = trazaLazo({
    grafo: grafoConEscalera(),
    puntos: [{ x: 0, y: 0 }, { x: 300, y: 0 }],
    criterios: ['escalones'],
    tramo: 2000,
    cerrado: false,
  });
  assert.equal(lazo.declaraciones.caminos.length, 1, 'el lazo sintético no ha declarado el camino evitado');
  return { lazo, declaracion: lazo.declaraciones.caminos[0] };
}

/** El texto de un fichero del repositorio, para las afirmaciones que se hacen leyendo. */
function fuenteDe(ruta) {
  return readFileSync(fileURLToPath(new URL(`../../${ruta}`, import.meta.url)), 'utf8');
}

/**
 * El código de un fichero **sin sus comentarios**.
 *
 * Hace falta porque en este repositorio los comentarios nombran justo lo que no se hace
 * —«ni un `Pressable`», «no se importa»—, y una búsqueda a secas se pondría roja por la
 * prosa que explica la ausencia en vez de por la ausencia rota.
 */
function codigoDe(ruta) {
  return fuenteDe(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('//'))
    .join('\n');
}

// ── Si miras: el mapa en marcha ─────────────────────────────────────────────────

describe('En marcha no hay nada que tocar', () => {
  test('La pantalla del mapa no tiene ni un control', () => {
    // El criterio más importante del momento, y una igualdad y no una inspección: la
    // lista sale vacía por contrato, y meter un control obliga a escribirlo aquí.
    assert.deepEqual(TOCABLES_DEL_MOMENTO.slice(), []);

    const conTodo = momento({
      salidas: conSalidaAbierta(),
      trazado: { sitios: [FONTE, CRUCEIRO] },
      marcasDeAviso: [{ sitio: VILABOA, tipo: 'noticia' }],
      noticia: componeNoticia({ sitio: VILABOA }),
    });
    const pelado = componeEnMarcha({ seguidor: seguidorGuionizado(), vibrador: vibradorQueRegistra(), mundo: MUNDO });
    const sinSeguidor = momento({ seguidor: seguidorQueDejaDeResponder({ cuantas: 0 }) });

    for (const [que, m] of [['con todo puesto', conTodo], ['sin aventura', pelado], ['sin posición', sinSeguidor]]) {
      assert.deepEqual(m.tocables, [], `el momento ${que} trae algún elemento tocable`);
    }

    // Acercar y arrastrar siguen aquí, y no son controles: no hay nada que pulsar por
    // error y nada que se pueda aceptar con ellos.
    assert.deepEqual(conTodo.gestos, ['acercar', 'arrastrar']);
    assert.deepEqual(GESTOS_DEL_MOMENTO.slice(), ['acercar', 'arrastrar']);

    // Y la pantalla no importa ni un Pressable: no está escondido ni desactivado, no se
    // importa. Se mira el código sin comentarios, porque los comentarios nombran a
    // propósito lo que no se hace.
    const pantalla = codigoDe('app/pantallas/en-marcha.jsx');
    for (const tocable of ['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'Button', 'onPress', 'accessibilityRole="button"']) {
      assert.equal(pantalla.includes(tocable), false, `la pantalla en marcha usa ${tocable}`);
    }
  });

  test('No se enseña ninguna cifra de esfuerzo', () => {
    // Las dos mitades: ni aparece ninguna cifra en lo que el momento compone, ni el
    // vocabulario tiene forma de expresar un kilómetro, un ritmo o una racha.
    for (const prohibido of ['kilometros', 'ritmo', 'pasos', 'calorias', 'tiempo', 'porcentaje-de-aventura', 'racha', 'logros', 'cuenta-de-dias']) {
      assert.ok(ELEMENTOS_QUE_NO_EXISTEN.includes(prohibido), `"${prohibido}" no está declarado como elemento que no existe`);
      assert.equal(ELEMENTOS_DEL_MOMENTO.includes(prohibido), false, `"${prohibido}" está en los elementos del momento`);
    }
    for (const id of ELEMENTOS_DEL_MOMENTO) {
      assert.equal(ELEMENTOS_QUE_NO_EXISTEN.includes(id), false, `"${id}" está en las dos listas y entonces no separan nada`);
    }

    const conTodo = momento({
      trazado: { sitios: [FONTE] },
      marcasDeAviso: [{ sitio: VILABOA, tipo: 'noticia', texto: `En ${VILABOA} hay algo que contar` }],
    });
    const textos = textosDelMomento(conTodo);
    assert.ok(textos.length > 0, 'el momento no compone ningún texto y el cribado no prueba nada');
    for (const texto of textos) {
      assert.equal(/\d/.test(texto), false, `"${texto}" lleva una cifra en dígitos`);
      // Y el cribado completo, que además caza las cifras escritas con letra.
      assert.doesNotThrow(() => revisaTextoDelMomento(texto, 'un texto del momento'));
    }
    assert.equal(/\d/.test(JSON.stringify({ ...conTodo, marcaPosicion: null })), false, 'el momento compuesto lleva una cifra fuera de la marca de posición');
  });

  test('Una guía con una cifra dentro falla donde nace y no llega a ninguna pantalla', () => {
    // El cribado se hace al componer y no al pintar: un texto con un número dentro tiene
    // que fallar donde nace, y no en la pantalla de alguien que anda.
    assert.throws(() => componeGuia({ calzada: 'la N-550', destino: DESTINO }), /cifra/);
    assert.throws(() => componeGuia({ calzada: CALZADA, destino: 'Monfrida, a 800 metros' }), /cifra/);
    assert.throws(
      () => momento({ marcasDeAviso: [{ sitio: VILABOA, texto: 'En Vilaboa hay 3 cosas que contar' }] }),
      /cifra/,
      'una marca de aviso con una cifra ha llegado a componerse',
    );
  });

  test('Los elementos del momento son exactamente los declarados y ninguno más', () => {
    // Sin marcas y sin zócalo distinto de la guía: la lámina, la marca y las dos líneas.
    assert.deepEqual(momento().elementos, ['lamina', 'marca-posicion', 'guia', 'zocalo']);

    // Con marcas de aviso, la lista crece por el único sitio por el que puede crecer.
    const conMarcas = momento({ marcasDeAviso: [{ sitio: VILABOA, tipo: 'noticia' }] });
    assert.deepEqual(conMarcas.elementos, ['lamina', 'marca-posicion', 'marcas-de-aviso', 'guia', 'zocalo']);

    for (const m of [momento(), conMarcas]) {
      for (const id of m.elementos) assert.ok(ELEMENTOS_DEL_MOMENTO.includes(id), `"${id}" no está en el vocabulario cerrado de elementos`);
    }
    assert.deepEqual(ELEMENTOS_DEL_MOMENTO.slice(), ['lamina', 'marca-posicion', 'marcas-de-aviso', 'guia', 'zocalo']);
  });

  test('El norte está siempre arriba', () => {
    // Es un mapa dibujado y no un navegador: la cámara no rota, y da igual hacia dónde
    // se ande. Se comprueba con las cuatro clasificaciones, incluido el vehículo.
    assert.equal(ORIENTACION, 'norte-arriba');
    for (const clasificacion of CLASIFICACIONES) {
      const seguidor = clasificacion === 'vehiculo'
        ? seguidorEnVehiculo()
        : seguidorGuionizado([{ clasificacion, x: 0, y: -500, sitio: null }]);
      const m = momento({ seguidor });
      assert.equal(m.orientacion, 'norte-arriba', `andando como "${clasificacion}" el norte deja de estar arriba`);
      assert.equal(m.lamina.orientacion, 'norte-arriba');
      assert.equal(m.lamina.rota, false, 'la lámina rota');
    }
  });

  test('El mapa no cambia durante la salida', () => {
    // Lo único que se mueve es la marca. Se compone dos veces desde el mismo mundo con
    // la posición avanzada y se compara todo lo demás: si algo más cambiase, mirar
    // aportaría algo nuevo y el momento dejaría de ser el que está diseñado para no mirarse.
    const seguidor = seguidorGuionizado();
    const alSalir = componeEnMarcha({ seguidor, vibrador: vibradorQueRegistra(), mundo: MUNDO, guia: guia() });
    const aMitad = componeEnMarcha({ seguidor, vibrador: vibradorQueRegistra(), mundo: MUNDO, guia: guia() });

    assert.notDeepEqual(alSalir.marcaPosicion.punto, aMitad.marcaPosicion.punto, 'la marca no se ha movido y la prueba no compara nada');
    const sinLaMarca = (m) => JSON.stringify({ ...m, marcaPosicion: { ...m.marcaPosicion, punto: null } });
    assert.equal(sinLaMarca(alSalir), sinLaMarca(aMitad), 'ha cambiado algo del mapa además de la marca');
    assert.equal(aMitad.cambiaDuranteLaSalida, false);
  });

  test('La marca de posición es del propio mapa y no un punto de sistema', () => {
    // Estás dentro del mundo, no encima de él: el punto azul del sistema rompería la
    // ficción justo en el momento en que el mapa es lo único que se ve.
    const m = momento({ acentoDelMapa: '#c62828' });
    assert.equal(m.marcaPosicion.delMapa, true);
    assert.equal(m.marcaPosicion.deSistema, false);
    assert.equal(m.marcaPosicion.color, '#c62828');
    assert.deepEqual(m.marcaPosicion.punto, { x: 0, y: 0 });
    assert.equal(m.marcaPosicion.clasificacion, 'andando');
    assert.equal(m.marcaPosicion.seguidorResponde, true);
  });

  test('La guía nombra la calzada y el sitio, y no da ninguna indicación de giro ni de metros', () => {
    const compuesta = guia();
    assert.equal(compuesta.clase, 'guia');
    assert.equal(compuesta.antetitulo, 'Vas por');
    assert.equal(compuesta.texto, `${CALZADA}, hacia ${DESTINO}`);
    assert.equal(compuesta.calzada, CALZADA);
    assert.equal(compuesta.destino, DESTINO);
    // Las dos ausencias, declaradas: es la mitad del criterio.
    assert.equal(compuesta.giro, null);
    assert.equal(compuesta.metros, null);
    for (const palabra of ['gira', 'girar', 'derecha', 'izquierda', 'metros', 'continúa']) {
      assert.equal(new RegExp(palabra, 'i').test(compuesta.texto), false, `la guía dice "${palabra}"`);
    }
    // Sin calzada o sin destino no hay guía: media guía es peor que ninguna.
    assert.throws(() => componeGuia({ calzada: null, destino: DESTINO }), /calzada/);
    assert.throws(() => componeGuia({ calzada: CALZADA, destino: '' }), /sitio/);
  });

  test('Atravesar territorio nuevo no vibra, no felicita y no dibuja nada en vivo', () => {
    // Se registra en silencio y se cobra al echar el telón (fila 36). El háptico de
    // descubrimiento se descartó: habría metido un canal de aviso más en el único
    // momento que se diseñó callado.
    const nuevo = atraviesaTerritorioNuevo();
    assert.equal(nuevo.vibra, false);
    assert.equal(nuevo.felicita, false);
    assert.equal(nuevo.dibujaEnVivo, false);
    assert.deepEqual(nuevo.textos, []);
    assert.equal(nuevo.seRegistraEnSilencio, true);
    assert.equal(nuevo.seCobraAlEcharElTelon, true);
  });

  test('Los sitios a los que la aventura manda van rotulados aunque no se hayan pisado', () => {
    const m = momento({ trazado: { sitios: [FONTE, CRUCEIRO] } });
    assert.deepEqual(m.rotulados, [
      { nombre: FONTE, tipo: 'paraje', encargado: true, pisado: false },
      { nombre: CRUCEIRO, tipo: 'paraje', encargado: true, pisado: false },
    ]);
    // Sin aventura aceptada no hay ninguno: se rotulan por estar en el lazo y no por un
    // nivel de conocimiento que esta fila calcule.
    assert.deepEqual(momento().rotulados, []);
    // Y un sitio que el mundo no tiene falla: un rótulo sobre un sitio que no está sería
    // un nombre inventado.
    assert.throws(() => sitiosRotulados({ mundo: MUNDO, trazado: { sitios: ['O Que No Existe'] } }), /no existe en el mundo/);
  });

  test('Una salida sin aventura aceptada se ve igual, con la marca de posición y sin guía', () => {
    // El estado vacío del momento: la lámina y la marca, y ni una línea de zócalo.
    const pelado = componeEnMarcha({ seguidor: seguidorGuionizado(), vibrador: vibradorQueRegistra(), mundo: MUNDO });
    assert.deepEqual(pelado.elementos, ['lamina', 'marca-posicion']);
    assert.equal(pelado.guia, null);
    assert.equal(pelado.zocalo, null, 'sin nada que decir el zócalo sigue ahí');
    assert.deepEqual(pelado.marcasDeAviso, []);
    assert.deepEqual(pelado.rotulados, []);
    assert.ok(pelado.marcaPosicion.punto, 'sin aventura tampoco se pinta la marca de posición');
    assert.deepEqual(pelado.tocables, []);
    assert.deepEqual(textosDelMomento(pelado), []);
  });

  test('No hay barra de pestañas, cabecera, pie, control de zoom, botón de centrar ni leyenda', () => {
    for (const control of ['barra-de-pestanas', 'cabecera', 'pie', 'control-de-zoom', 'boton-de-centrar', 'leyenda', 'boton-de-aceptar', 'boton-de-descartar', 'boton-de-pausar']) {
      assert.ok(ELEMENTOS_QUE_NO_EXISTEN.includes(control), `"${control}" no está declarado como elemento que no existe`);
      assert.equal(ELEMENTOS_DEL_MOMENTO.includes(control), false);
    }
    // Y la lámina va a sangre: sin cabecera ni pie que la recorten.
    assert.equal(momento().lamina.aSangre, true);
  });

  test('Un elemento que el vocabulario no declara falla enumerando los que hay y los que no puede haber', () => {
    // La comprobación se hace sobre la lista compuesta, así que este caso vale como
    // guardia del guardia: si el vocabulario dejara de comprobarse, esto se pondría rojo.
    const inventado = 'panel-de-esfuerzo';
    assert.equal(ELEMENTOS_DEL_MOMENTO.includes(inventado), false);
    assert.throws(
      () => {
        const elementos = [...ELEMENTOS_DEL_MOMENTO, inventado];
        for (const id of elementos) {
          if (!ELEMENTOS_DEL_MOMENTO.includes(id)) {
            throw new Error(
              `"${id}" no es un elemento del momento en marcha: los que hay son ${ELEMENTOS_DEL_MOMENTO.join(', ')}. ` +
              `Y estos no existen a propósito: ${ELEMENTOS_QUE_NO_EXISTEN.join(', ')}`,
            );
          }
        }
      },
      (e) => ELEMENTOS_DEL_MOMENTO.every((id) => e.message.includes(id)) && ELEMENTOS_QUE_NO_EXISTEN.every((id) => e.message.includes(id)),
    );
    // Las listas están congeladas: no se puede ampliar el vocabulario en caliente.
    assert.throws(() => { ELEMENTOS_DEL_MOMENTO.push(inventado); }, TypeError);
    assert.throws(() => { TOCABLES_DEL_MOMENTO.push('boton'); }, TypeError);
  });
});

// ── El zócalo ───────────────────────────────────────────────────────────────────

describe('El zócalo tiene un solo contenido a la vez', () => {
  test('Las clases de zócalo son cuatro y la prioridad las ordena', () => {
    assert.deepEqual(CLASES_DE_ZOCALO.slice(), ['guia', 'noticia', 'desvio', 'camino-evitado']);
    assert.deepEqual(PRIORIDAD_DE_ZOCALO.slice(), ['camino-evitado', 'desvio', 'noticia', 'guia']);
    assert.deepEqual(PRIORIDAD_DE_ZOCALO.slice().sort(), CLASES_DE_ZOCALO.slice().sort(), 'la prioridad y las clases no cubren lo mismo');
  });

  test('Con los cuatro contenidos disponibles gana el camino evitado, y bajando por la lista gana el siguiente', () => {
    // El orden sale de qué caduca antes: el camino evitado y el desvío ocurren en un
    // punto concreto del camino, la noticia sedimenta y la guía está siempre.
    const caminoEvitado = declaraCaminoEvitado({ nombre: 'A Escaleira Vella', motivo: MOTIVOS_POR_CRITERIO.escalones });
    const desvio = ofreceDesvio({ ramal: 'a Corredoira do Muíño', paraje: 'O Fuso da Vella' });
    const noticia = componeNoticia({ sitio: VILABOA });
    const laGuia = guia();

    assert.equal(eligeZocalo({ caminoEvitado, desvio, noticia, guia: laGuia }).clase, 'camino-evitado');
    assert.equal(eligeZocalo({ desvio, noticia, guia: laGuia }).clase, 'desvio');
    assert.equal(eligeZocalo({ noticia, guia: laGuia }).clase, 'noticia');
    assert.equal(eligeZocalo({ guia: laGuia }).clase, 'guia');
    assert.equal(eligeZocalo({}), null, 'sin nada que decir el zócalo no es null');

    // No se apilan: lo que sale es uno y solo uno.
    const m = momento({ caminoEvitado, desvio, noticia });
    assert.equal(m.zocalo.clase, 'camino-evitado');
    assert.equal(Array.isArray(m.zocalo), false, 'el zócalo ha salido como lista: se han apilado dos');
  });

  test('Un zócalo declarado con una clase que no es la de su hueco falla nombrando el vocabulario', () => {
    const noticia = componeNoticia({ sitio: VILABOA });
    assert.throws(
      () => eligeZocalo({ desvio: noticia }),
      (e) => CLASES_DE_ZOCALO.every((c) => e.message.includes(c)),
      'un zócalo en el hueco equivocado no ha fallado enumerando las clases',
    );
  });

  test('El zócalo de una noticia dice que hay algo y dónde, y el contenido se oye llegando', () => {
    const noticia = componeNoticia({ sitio: VILABOA });
    assert.equal(noticia.clase, 'noticia');
    assert.equal(noticia.texto, `En ${VILABOA} hay algo que contar`);
    assert.equal(noticia.antetitulo, 'Lo sabrás al llegar');
    assert.ok(noticia.texto.includes(VILABOA), 'la noticia no dice dónde');
    assert.equal(noticia.sitio, VILABOA);
    assert.equal(ANTETITULOS.noticia, 'Lo sabrás al llegar');
    // No es un adelanto y no hay nada que atender: ni acción, ni llamada a tocar.
    assert.equal(/toca|pulsa|ver más/i.test(`${noticia.antetitulo} ${noticia.texto}`), false);
    assert.throws(() => componeNoticia({ sitio: null }), /sitio/);
  });
});

// ── Abrir la app enseña el estado ───────────────────────────────────────────────

describe('Quien decide qué hay es el estado y no la puerta', () => {
  test('Andando, abrir la app por el icono enseña el mapa', () => {
    assert.equal(queEnsenaAbrirLaApp({ clasificacion: 'andando', enGeofence: false, puerta: 'icono' }).destino, DESTINOS_DE_ABRIR.MAPA);
    // Andando dentro de un geofence también: la escena es de pararse, no de pasar.
    assert.equal(queEnsenaAbrirLaApp({ clasificacion: 'andando', enGeofence: true, puerta: 'icono' }).destino, DESTINOS_DE_ABRIR.MAPA);
  });

  test('Parado dentro de un geofence, abrir la app enseña la escena', () => {
    // La clasificación sale del seguidor, que la entrega ya hecha: el núcleo no deduce
    // que alguien está parado del tiempo ni de la distancia entre dos lecturas.
    const seguidor = seguidorParado({ sitio: FONTE });
    const m = componeEnMarcha({ seguidor, vibrador: vibradorQueRegistra(), mundo: MUNDO, guia: guia() });
    assert.equal(m.marcaPosicion.clasificacion, 'parada');

    assert.equal(queEnsenaAbrirLaApp({ clasificacion: m.marcaPosicion.clasificacion, enGeofence: true, puerta: 'icono' }).destino, DESTINOS_DE_ABRIR.ESCENA);
    // Parado fuera de un geofence no hay escena a la que llegar.
    assert.equal(queEnsenaAbrirLaApp({ clasificacion: 'parada', enGeofence: false, puerta: 'icono' }).destino, DESTINOS_DE_ABRIR.MAPA);
  });

  test('Las tres puertas dan lo mismo: ninguna tiene comportamiento propio', () => {
    // Una sola función, para que el aviso, el rótulo y el icono no puedan divergir.
    assert.deepEqual(PUERTAS_DE_ENTRADA.slice(), ['icono', 'aviso', 'rotulo-del-sistema']);
    for (const [clasificacion, enGeofence] of [['andando', false], ['andando', true], ['parada', true], ['parada', false], ['ambiguo', true]]) {
      const destinos = PUERTAS_DE_ENTRADA.map((puerta) => queEnsenaAbrirLaApp({ clasificacion, enGeofence, puerta }).destino);
      assert.equal(new Set(destinos).size, 1, `las tres puertas divergen con clasificación "${clasificacion}" y geofence ${enGeofence}: ${destinos.join(', ')}`);
    }
    // Y lo único que cambia entre ellas es de cuál se vino, que no decide nada.
    const sinLaPuerta = (p) => JSON.stringify({ ...queEnsenaAbrirLaApp({ clasificacion: 'parada', enGeofence: true, puerta: p }), puerta: null });
    assert.equal(sinLaPuerta('icono'), sinLaPuerta('aviso'));
    assert.equal(sinLaPuerta('icono'), sinLaPuerta('rotulo-del-sistema'));
  });

  test('Abrir el mapa desde un aviso trae la marca del encuentro puesta y nada más ha cambiado', () => {
    const conMarca = queEnsenaAbrirLaApp({ clasificacion: 'andando', enGeofence: false, puerta: 'aviso', marca: FONTE });
    const sinMarca = queEnsenaAbrirLaApp({ clasificacion: 'andando', enGeofence: false, puerta: 'aviso' });
    assert.equal(conMarca.marca, FONTE);
    assert.equal(sinMarca.marca, null);
    assert.equal(JSON.stringify({ ...conMarca, marca: null }), JSON.stringify(sinMarca), 'entrar con marca ha cambiado algo más que la marca');
  });

  test('Una puerta o una clasificación que no están declaradas fallan enumerando las que valen', () => {
    assert.throws(
      () => queEnsenaAbrirLaApp({ clasificacion: 'andando', enGeofence: false, puerta: 'widget' }),
      (e) => PUERTAS_DE_ENTRADA.every((p) => e.message.includes(p)),
    );
    assert.throws(
      () => queEnsenaAbrirLaApp({ clasificacion: 'corriendo', enGeofence: false }),
      (e) => CLASIFICACIONES.every((c) => e.message.includes(c)),
    );
    assert.throws(() => queEnsenaAbrirLaApp({ clasificacion: 'andando', enGeofence: 'si' }), /dos valores/);
  });
});

// ── Irse por otro lado no existe ────────────────────────────────────────────────

describe('El juego no lleva la cuenta del trazado', () => {
  test('Ir por otra calle no se entera nadie: ni texto, ni marca que parpadee, ni recálculo', () => {
    const irse = irsePorOtroLado();
    assert.equal(irse.seEntera, false);
    assert.deepEqual(irse.textos, [], 'algún texto menciona la desviación');
    assert.equal(irse.recalcula, false);
    assert.equal(irse.marcaQueParpadea, false);
    assert.deepEqual(irse.validaPor, ['geofence-del-sitio']);
  });

  test('El estado de una salida en marcha no tiene ningún campo de recorrido, desviación ni adherencia', () => {
    // El criterio se escribe sobre el esquema y no sobre una pantalla: es la única forma
    // de que «no hay reproche» siga siendo cierto el día que alguien añada un panel.
    const estado = conSalidaAbierta();
    const campos = camposDelEstadoEnMarcha(estado);
    assert.deepEqual(campos.slice(), CAMPOS_DEL_ESTADO_EN_MARCHA.slice().sort(), 'el estado de la salida abierta tiene campos que el vocabulario no declara');
    for (const prohibido of CAMPOS_QUE_EL_ESTADO_NO_TIENE) {
      assert.equal(campos.includes(prohibido), false, `el estado de la salida tiene el campo "${prohibido}": ahí es donde se guardaría la cuenta con la que reprochar`);
    }
    assert.deepEqual(CAMPOS_QUE_EL_ESTADO_NO_TIENE.slice(), ['recorrido', 'desviacion', 'adherencia', 'trazadoAndado', 'historicoDePosiciones']);
    // Sin salida abierta no hay campos que enumerar, y tampoco es un error.
    assert.deepEqual(camposDelEstadoEnMarcha(estadoDeSalidaAbierta()), []);
  });

  test('No existe ninguna función que compare lo andado con el trazado ni que recalcule la ruta en marcha', () => {
    assert.deepEqual(CAPACIDADES_QUE_NO_EXISTEN.slice(), ['comparar-lo-andado-con-el-trazado', 'recalcular-la-ruta-en-marcha']);
    // Y las dos mitades: ni el módulo las exporta, ni las nombra fuera de la declaración.
    const fuente = codigoDe('packages/nucleo/partida/en-marcha.js');
    for (const nombre of ['function recalcula', 'function comparaLoAndado', 'function adherencia', 'function desviacion']) {
      assert.equal(fuente.includes(nombre), false, `en-marcha.js declara ${nombre}`);
    }
  });

  test('Pasar cerca de un beat camino del supermercado valida igual, y la llegada nunca depende del trazado', () => {
    // Es un regalo y no una anomalía: la ruta dibujada es una sugerencia, no un contrato.
    assert.deepEqual(DE_QUE_DEPENDE_LA_LLEGADA.slice(), ['geofence-del-sitio']);
    assert.equal(validaLlegada({ clasificacion: 'andando', enGeofence: true }), true);
    // En la duda se valida, y el vehículo se aparta: eso es de SPEC-004 y aquí se consume.
    assert.equal(validaLlegada({ clasificacion: 'ambiguo', enGeofence: true }), true);
    assert.equal(validaLlegada({ clasificacion: 'vehiculo', enGeofence: true }), false);
    assert.equal(validaLlegada({ clasificacion: 'andando', enGeofence: false }), false);
    assert.throws(() => validaLlegada({ clasificacion: 'andando', enGeofence: null }), /dos valores/);
  });

  test('Una salida abierta sigue abierta días después: el juego no la da por muerta por su cuenta', () => {
    // No hay reloj en esta capa, así que «días después» es «después de cualquier número
    // de lecturas de posición»: si hubiera caducidad, tendría que estar aquí.
    const estado = conSalidaAbierta();
    const seguidor = seguidorGuionizado();
    for (let k = 0; k < 200; k++) componeEnMarcha({ seguidor, vibrador: vibradorQueRegistra(), mundo: MUNDO, salidas: estado, guia: guia() });
    assert.equal(haySalidaAbierta(estado), true, 'la salida se ha cerrado sola');
    assert.equal(componeEnMarcha({ seguidor, vibrador: vibradorQueRegistra(), mundo: MUNDO, salidas: estado }).aventura, 'aventura-1');
    // Solo se cierra por volver o a mano, y las dos son la misma puerta en otro sitio.
    assert.equal(cierraLaSalida(estado, { via: 'dejarlo-aqui' }).cierreEnCorto, true);
    assert.equal(haySalidaAbierta(estado), false);
  });
});

// ── El desvío se acepta con las piernas ─────────────────────────────────────────

describe('El desvío se acepta girando', () => {
  test('La oferta del desvío nombra el ramal y el paraje, y dice el coste con una frase', () => {
    const oferta = ofreceDesvio({ ramal: 'a Corredoira do Muíño', paraje: 'O Fuso da Vella' });
    assert.equal(oferta.clase, 'desvio');
    assert.ok(oferta.antetitulo.includes('a Corredoira do Muíño'), 'la oferta no nombra el ramal');
    assert.ok(oferta.texto.includes('O Fuso da Vella'), 'la oferta no nombra el paraje');
    assert.equal(oferta.ramal, 'a Corredoira do Muíño');
    assert.equal(oferta.paraje, 'O Fuso da Vella');
    // El coste se dice con el dibujo y con la frase, nunca con metros ni con minutos:
    // «+800 m» haría las dos cosas y rompería la regla.
    assert.deepEqual(oferta.coste, { conElDibujo: true, conLaFrase: true, enMetros: null, enMinutos: null });
    assert.equal(/\d/.test(`${oferta.antetitulo} ${oferta.texto}`), false, 'la oferta lleva una cifra');
    for (const palabra of ['metros', 'minutos', 'km']) {
      assert.equal(new RegExp(palabra, 'i').test(`${oferta.antetitulo} ${oferta.texto}`), false, `la oferta dice "${palabra}"`);
    }
  });

  test('La oferta del desvío no tiene ninguna acción de aceptar ni de descartar', () => {
    const oferta = ofreceDesvio({ ramal: 'a Corredoira do Muíño', paraje: 'O Fuso da Vella' });
    assert.deepEqual(oferta.acciones, [], 'la oferta trae acciones: se acepta girando, y un botón la convertiría en una decisión de menú');
    for (const prohibida of ['aceptar', 'descartar', 'rechazar', 'onPress']) {
      assert.equal(Object.keys(oferta).includes(prohibida), false, `la oferta declara "${prohibida}"`);
    }
  });

  test('Un ramal sin nombre falla nombrando el ramal, y no se ofrece un desvío anónimo', () => {
    for (const sinNombre of [null, undefined, '', 0]) {
      assert.throws(
        () => ofreceDesvio({ ramal: sinNombre, paraje: 'O Fuso da Vella' }),
        (e) => /ramal/.test(e.message) && /anónimo/.test(e.message),
        `un ramal ${JSON.stringify(sinNombre)} no ha fallado nombrando el ramal`,
      );
    }
    assert.throws(() => ofreceDesvio({ ramal: 'a Corredoira do Muíño', paraje: null }), /paraje/);
  });

  test('No girar no cambia nada, no se anota y el paraje sigue ahí para otro día', () => {
    const oferta = ofreceDesvio({ ramal: 'a Corredoira do Muíño', paraje: 'O Fuso da Vella' });
    const seguido = noGirar(oferta);
    assert.equal(seguido.consecuencia, null);
    assert.deepEqual(seguido.textos, [], 'algún texto menciona que no se giró');
    assert.equal(seguido.sigueDisponible, true);
    // Anotarlo sería el primer paso de un reproche.
    assert.equal(seguido.seAnota, false);
    assert.throws(() => noGirar(componeNoticia({ sitio: VILABOA })), /oferta de desvío/);
  });

  test('El desvío está fuera del lazo y el micro-encuentro está en el camino: son cosas distintas', () => {
    // El micro-encuentro cuesta cero porque cae en el trazado; el desvío cuesta piernas
    // porque no. Confundirlos sería cobrar dos veces lo mismo o no cobrar ninguna.
    const oferta = ofreceDesvio({ ramal: 'a Corredoira do Muíño', paraje: 'O Fuso da Vella' });
    assert.equal(oferta.fueraDelLazo, true);
  });
});

// ── El camino evitado se declara ────────────────────────────────────────────────

describe('El camino evitado se declara, y el filtro evita y no borra', () => {
  test('El camino evitado se declara con nombre propio', () => {
    // Se parte del dato que deja `filtro.js` sobre un lazo de verdad y no de una
    // declaración escrita a mano: lo que esta fila entrega es el pintado de ese dato.
    const { lazo, declaracion } = declaracionDelLazo();
    assert.equal(declaracion.nombre, 'A Escaleira Vella');
    assert.equal(declaracion.motivo, MOTIVOS_POR_CRITERIO.escalones);
    assert.ok(MOTIVOS.includes(declaracion.motivo));

    const zocalo = declaraCaminoEvitado(declaracion);
    assert.equal(zocalo.clase, 'camino-evitado');
    assert.equal(zocalo.antetitulo, 'Por qué das esta vuelta');
    assert.ok(zocalo.texto.includes('A Escaleira Vella'), 'la declaración no nombra el camino evitado');
    assert.ok(zocalo.texto.includes(RAZONES_DE_CAMINO[MOTIVOS_POR_CRITERIO.escalones]), 'la declaración no dice por qué');
    assert.equal(zocalo.evitado, true);

    // Y la palabra no aparece en ningún texto: ni etiquetas, ni iconos, ni modo.
    assert.equal(/accesibilidad/i.test(JSON.stringify({ lazo, zocalo })), false, 'la palabra «accesibilidad» ha salido en algún texto');
    assert.deepEqual(zocalo.iconos, []);
    assert.deepEqual(zocalo.etiquetas, []);
  });

  test('La declaración habla en lenguaje del mundo y sin ninguna cifra, con una razón por criterio', () => {
    // Una razón por criterio de `world/aptitud.js`, para que un criterio nuevo no se
    // quede sin frase y salga una declaración a medias.
    for (const motivo of Object.values(MOTIVOS_POR_CRITERIO)) {
      const zocalo = declaraCaminoEvitado({ nombre: 'A Escaleira Vella', motivo });
      assert.ok(zocalo.texto.length > 0);
      assert.equal(/\d/.test(zocalo.texto), false, `la razón de "${motivo}" lleva una cifra`);
      assert.doesNotThrow(() => revisaTextoDelMomento(zocalo.texto, `la declaración de "${motivo}"`));
      for (const palabra of ['accesibilidad', 'filtro', 'criterio', 'perfil', 'ajuste']) {
        assert.equal(new RegExp(palabra, 'i').test(zocalo.texto), false, `la declaración de "${motivo}" dice "${palabra}"`);
      }
    }
    // Un motivo sin razón declarada falla enumerando las que hay.
    assert.throws(
      () => declaraCaminoEvitado({ nombre: 'A Escaleira Vella', motivo: 'niebla' }),
      (e) => Object.keys(RAZONES_DE_CAMINO).every((m) => e.message.includes(m)),
    );
  });

  test('Un camino difícil sin nombre propio falla, y no se declara anónimo', () => {
    for (const sinNombre of [null, undefined, '']) {
      assert.throws(
        () => declaraCaminoEvitado({ nombre: sinNombre, motivo: MOTIVOS_POR_CRITERIO.escalones }),
        (e) => /nombre/.test(e.message) && /anónima/.test(e.message),
        `un camino con nombre ${JSON.stringify(sinNombre)} no ha fallado`,
      );
    }
  });

  test('El camino evitado sigue existiendo y dibujado: el filtro evita, no borra', () => {
    const { lazo, declaracion } = declaracionDelLazo();
    assert.equal(declaraCaminoEvitado(declaracion).sigueDibujado, true);
    // Y el grafo conserva la escalera: lo que cambia es por dónde te mandan.
    const grafo = grafoConEscalera();
    assert.ok(grafo.nodeIds.length > 0);
    assert.equal(JSON.stringify(lazo.recorrido).includes('undefined'), false);
    const nombres = [];
    for (const id of grafo.nodeIds) for (const a of grafo.adj.get(id) ?? []) if (a.nombre) nombres.push(a.nombre);
    assert.ok(nombres.includes('A Escaleira Vella'), 'la escalera ha desaparecido del grafo: el filtro ha borrado en vez de evitar');
  });

  test('Lo que nos inventamos no se promete como transitable', () => {
    // Lo cosido une trozos sueltos del callejero con aristas que no existen en OSM y el
    // trazado de respaldo dibuja rectas por donde no hay camino: son suposiciones
    // nuestras, no calles, y no se dan ni por transitables ni por intransitables.
    assert.equal(daPorTransitable({ suposicion: SUPOSICIONES.NINGUNA }), true);
    assert.equal(daPorTransitable({}), true);
    for (const suposicion of [SUPOSICIONES.COSIDA, SUPOSICIONES.FALLBACK]) {
      assert.equal(daPorTransitable({ suposicion }), false, `una arista "${suposicion}" se da por transitable`);
      assert.throws(
        () => declaraCaminoEvitado({ nombre: 'A Costura', motivo: MOTIVOS_POR_CRITERIO.escalones, suposicion }),
        /suposición nuestra/,
        `una arista "${suposicion}" se ha declarado como camino evitado`,
      );
    }
    assert.throws(() => declaraCaminoEvitado({ nombre: 'A Costura', motivo: MOTIVO_DE_SUPOSICION }), /suposición nuestra/);
  });

  test('Una ruta que no pudo rodear se declara igual, con su nombre y su motivo', () => {
    // Se avisa, no se oculta: lo que cambia entre evitar y atravesar es la frase.
    const atravesado = declaraCaminoEvitado({ nombre: 'A Escaleira Vella', motivo: MOTIVOS_POR_CRITERIO.escalones, evitado: false });
    assert.equal(atravesado.evitado, false);
    assert.equal(atravesado.antetitulo, 'Por dónde pasa el camino');
    assert.ok(atravesado.texto.includes('A Escaleira Vella'));
    assert.ok(atravesado.texto.includes('no hay otro camino'), 'la declaración del atravesado no dice que no hay otro camino');
    assert.notEqual(atravesado.texto, declaraCaminoEvitado({ nombre: 'A Escaleira Vella', motivo: MOTIVOS_POR_CRITERIO.escalones }).texto);
  });
});

// ── Nada degrada por falta de cableado ──────────────────────────────────────────

describe('Un canal sin cablear es una avería y no un estado', () => {
  test('El momento en marcha sin seguidor de posición cableado falla nombrando la pieza que falta', () => {
    // Enseñar un mapa con la marca quieta sería la pieza que, al no estar, no protesta.
    for (const sinCablear of [null, undefined, {}, seguidorSinCablear()]) {
      assert.throws(
        () => componeEnMarcha({ seguidor: sinCablear, vibrador: vibradorQueRegistra(), mundo: MUNDO }),
        (e) => /seguidor de posición/.test(e.message) && /marca quieta/.test(e.message),
        `un seguidor ${JSON.stringify(sinCablear)} no ha hecho fallar la construcción`,
      );
    }
    assert.throws(() => exigeSeguidor(null), /seguidor de posición/);
  });

  test('El momento en marcha sin vibrador cableado falla nombrando la pieza que falta', () => {
    for (const sinCablear of [null, undefined, {}, vibradorAusente()]) {
      assert.throws(
        () => componeEnMarcha({ seguidor: seguidorGuionizado(), vibrador: sinCablear, mundo: MUNDO }),
        (e) => /vibrador/.test(e.message) && /una sola capa/.test(e.message),
        `un vibrador ${JSON.stringify(sinCablear)} no ha hecho fallar la construcción`,
      );
    }
  });

  test('El seguidor que deja de responder deja el mapa como estaba y no lo cuenta como avería del mundo', () => {
    // `null` no es un error: es un túnel, o una plaza con edificios altos. La marca se
    // queda donde estaba y ninguna línea de zócalo lo menciona.
    const seguidor = seguidorQueDejaDeResponder({ cuantas: 1 });
    const conPosicion = componeEnMarcha({ seguidor, vibrador: vibradorQueRegistra(), mundo: MUNDO, guia: guia() });
    const sinPosicion = componeEnMarcha({ seguidor, vibrador: vibradorQueRegistra(), mundo: MUNDO, guia: guia() });

    assert.deepEqual(conPosicion.marcaPosicion.punto, { x: 0, y: 0 });
    assert.equal(sinPosicion.marcaPosicion.punto, null, 'sin posición se ha inventado un punto');
    assert.equal(sinPosicion.marcaPosicion.seguidorResponde, false);
    assert.equal(sinPosicion.marcaPosicion.clasificacion, null);
    // Se preguntó de verdad: sin el recuento «se quedó como estaba» sería fe.
    assert.equal(seguidor.lecturas(), 2);
    // Y todo lo demás sigue igual: ningún texto lo cuenta.
    assert.equal(JSON.stringify(sinPosicion.zocalo), JSON.stringify(conPosicion.zocalo));
    assert.deepEqual(sinPosicion.elementos, conPosicion.elementos);
    for (const texto of textosDelMomento(sinPosicion)) {
      assert.equal(/(gps|señal|ubicación|error|avería)/i.test(texto), false, `"${texto}" cuenta la falta de señal como avería del mundo`);
    }
  });

  test('Un seguidor que entrega una clasificación de fuera del enumerado o una posición sin punto falla', () => {
    // La traza llega clasificada desde SPEC-004 y el núcleo no la calcula: una
    // clasificación inventada tiene que verse, no promediarse.
    assert.throws(
      () => componeEnMarcha({ seguidor: seguidorQueClasificaMal(), vibrador: vibradorQueRegistra(), mundo: MUNDO }),
      (e) => CLASIFICACIONES.every((c) => e.message.includes(c)),
    );
    assert.throws(
      () => componeEnMarcha({ seguidor: seguidorSinPunto(), vibrador: vibradorQueRegistra(), mundo: MUNDO }),
      /sin punto en el que pintar/,
    );
  });

  test('El trazado que llega sin la lista de sitios falla, y no se calcula con un umbral de distancia', () => {
    // La pertenencia es por lista: un umbral se sube en cuanto un mundo no dé sitios y
    // deja de significar nada.
    for (const trazado of [{}, { sitios: null }, { sitios: 'A Fonte Vella' }]) {
      assert.throws(
        () => componeEnMarcha({ seguidor: seguidorGuionizado(), vibrador: vibradorQueRegistra(), mundo: MUNDO, trazado }),
        (e) => /lista de sitios/.test(e.message) && /umbral de distancia/.test(e.message),
      );
    }
    const fuente = codigoDe('packages/nucleo/partida/en-marcha.js');
    for (const umbral of ['RADIO', 'METROS_DE_CERCANIA', 'distanciaA(']) {
      assert.equal(fuente.includes(umbral), false, `en-marcha.js usa ${umbral} para decidir la pertenencia`);
    }
  });

  test('El momento sin mundo congelado falla en vez de componer un mapa vacío', () => {
    for (const mundo of [null, undefined, 'costero']) {
      assert.throws(() => componeEnMarcha({ seguidor: seguidorGuionizado(), vibrador: vibradorQueRegistra(), mundo }), /mundo congelado/);
    }
  });

  test('Una marca de aviso sin sitio falla: una marca sin sitio no se puede poner en ninguna parte', () => {
    assert.throws(() => momento({ marcasDeAviso: [{ tipo: 'noticia' }] }), /sitio de una marca de aviso/);
  });
});

// ── Determinismo y privacidad ───────────────────────────────────────────────────

describe('El momento en marcha es determinista y no guarda rastro', () => {
  test('El mismo recorrido simulado dos veces da la misma secuencia de avisos', () => {
    // El recorrido entero, con el momento compuesto en cada paso y los avisos saliendo
    // por el emisor: es la comprobación de punta a punta de esta fila.
    const recorre = () => {
      const seguidor = seguidorGuionizado();
      const vibrador = vibradorQueRegistra();
      const notificador = notificadorQueRegistra();
      const emisor = creaEmisorDeAvisos({ vibrador, notificador, sitios: [VILABOA, FONTE, CRUCEIRO] });
      const momentos = [];
      const guion = [
        { tipo: 'noticia', texto: `En ${VILABOA} hay algo que contar`, beatEnCurso: false },
        { tipo: 'oportunidad', texto: `Alguien espera en ${FONTE}`, beatEnCurso: true },
        { tipo: 'noticia', texto: `En ${CRUCEIRO} hay algo que contar`, beatEnCurso: false },
      ];
      for (const aviso of guion) {
        emisor.emite(aviso);
        momentos.push(componeEnMarcha({ seguidor, vibrador, mundo: MUNDO, guia: guia() }));
      }
      emisor.terminaElBeat();
      return { avisos: emisor.emitidos(), toques: vibrador.toques(), notificadas: notificador.notificadas(), momentos };
    };

    // Serialización completa: comparar campo a campo dejaría pasar una regresión.
    assert.equal(JSON.stringify(recorre()), JSON.stringify(recorre()), 'dos recorridos idénticos han dado resultados distintos');
  });

  test('El código de esta fila no usa Math.random ni Date.now', () => {
    const ficheros = [
      'packages/nucleo/partida/en-marcha.js',
      'packages/nucleo/partida/avisos.js',
      'app/pantallas/en-marcha.jsx',
      'app/marcha/seguidor.js',
      'app/plataforma/vibrador.js',
      'app/plataforma/notificador.js',
    ];
    for (const ruta of ficheros) {
      const fuente = codigoDe(ruta);
      for (const prohibido of ['Math.random', 'Date.now', 'new Date(']) {
        assert.equal(fuente.includes(prohibido), false, `${ruta} usa ${prohibido}`);
      }
    }
  });

  test('De una salida entera no queda ningún histórico de posiciones', () => {
    // RF-PRIV-002: la posición se usa para pintar la marca, para validar geofences y
    // para medir el ritmo, y ninguna de las tres la guarda.
    const estado = conSalidaAbierta();
    const seguidor = seguidorGuionizado();
    for (let k = 0; k < 50; k++) componeEnMarcha({ seguidor, vibrador: vibradorQueRegistra(), mundo: MUNDO, salidas: estado, guia: guia() });

    const guardado = JSON.stringify(estado);
    for (const rastro of ['x', 'y', 'lat', 'lon', 'posicion', 'traza', 'historico', 'recorrido']) {
      assert.equal(guardado.includes(rastro), false, `el registro de la salida guarda "${rastro}"`);
    }
    assert.deepEqual(Object.keys(estado.abierta).slice().sort(), CAMPOS_DEL_ESTADO_EN_MARCHA.slice().sort());

    // Y el seguidor tampoco acumula: entrega la posición de turno y nada más.
    const fuente = codigoDe('app/marcha/seguidor.js');
    assert.equal(/\.push\(/.test(fuente), false, 'el seguidor acumula posiciones en una lista');
  });
});
