// SPEC-036 · El telón: el mapa se entinta, la aventura acaba y lo hecho sale a andar.
//
// Tres capas y una sola fila: la **capa de conocimiento** (cuatro niveles, el libro de
// pendientes y el entintado de golpe), el **cierre de la salida** (la operación a todo o
// nada que coordina los ganchos de cinco filas anteriores) y la **composición del telón**
// (la secuencia, sus dos ramas y los tres vocabularios de tono).
//
// Casi todo se afirma **cerrando salidas de verdad** sobre los mundos congelados y sobre
// mundos sintéticos, sin simulador y sin red: el núcleo corre en Node y la única entrada
// nueva —el calendario— llega doblada. Lo que sí se lee del código fuente, y solo eso, es
// que el casting no mira lo descubierto: es una afirmación sobre el código y no sobre su
// resultado.
//
// Escenarios de `docs/testing.md` que se reutilizan aquí, con su nombre literal: «El mapa
// se entinta al echar el telón», «Un día sin descubrir nada enseña el mapa igual», «El
// cierre en corto ocupa el sitio del desenlace», «Un cierre en corto no genera rumor», «Un
// paseo sin aventura tiene telón completo menos desenlace», «El rumor solo aparece si el
// desenlace era notable», «El telón no enseña la propagación», «El mapa no cambia durante
// la salida», «Volver a casa cierra la salida» y «El telón espera a que lo leas». Los
// cuatro últimos tienen ya su otra mitad implementada —el render y `salidas.js`— y aquí se
// afirma la que le toca a esta fila, con el mismo nombre, que es el precedente de
// `camara.test.mjs` y `render.test.mjs`.
//
// **RF-DIARIO-006, el hito de fin de arranque, está marcado ⚠ sin escenario en el PRD**:
// sus ocho criterios no tienen ningún escenario detrás en la batería y van todos declarados
// como hueco en `test/spec-test-map.json`. Lo mismo el cierre a todo o nada, el desenlace y
// la entrada del día, que la batería tampoco cubre.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  AREAS_QUE_TOCA_EL_CIERRE,
  IDS_DE_PIEZA,
  PIEZAS_DEL_CIERRE,
  echaElTelon,
  piezasDeSerie,
} from '../../packages/nucleo/partida/cierre-de-salida.js';
import {
  AUTORIDADES,
  ESTADOS_DEL_TELON,
  FRASES_DE_RANGO,
  TEXTOS,
  VOCABULARIO_DE_LOGRO,
  VOCABULARIO_DE_PROPAGACION,
  VOCABULARIO_DE_REPROCHE,
  componeElTelon,
  estadoDelMapa,
  exigeSinLogro,
  exigeSinReproche,
  fraseDelRango,
  hechoDeHoja,
  hojaDeHecho,
  hojaDelDia,
  infraccionesDeLogro,
  infraccionesDePropagacion,
  infraccionesDeReproche,
  loPropioEnPrimeraPersona,
} from '../../packages/nucleo/partida/telon.js';
import {
  FAMILIAS_DE_ELEMENTO,
  NIVELES_DE_CONOCIMIENTO,
  NIVEL_DE_PARTIDA,
  PALABRAS_DEL_MUNDO,
  TINTAS,
  VIAS_DE_ASCENSO,
  apuntaHaberEstado,
  apuntaLoNombradoPorUnRumor,
  ascensoPor,
  claveDeElemento,
  congelaConocimiento,
  elementosDelMundo,
  entintadoDelMundo,
  estadoDeConocimiento,
  exigeNivelDeConocimiento,
  levantaConocimiento,
  libroDePendientes,
  nivelDe,
  planDeEntintado,
  aplicaElEntintado,
  subeA,
} from '../../packages/nucleo/partida/conocimiento.js';
import { AREAS_CON_ESTADO, IDS_DE_AREA, areaDe, congelaEstado, estadoInicial, levantaEstado, textoDeEstado } from '../../packages/nucleo/partida/estado.js';
import { TIPOS_DE_HECHO, hechosDe, registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { reconstruye } from '../../packages/nucleo/partida/reconstruccion.js';
import { abreSalida, salidaAbierta } from '../../packages/nucleo/partida/salida-abierta.js';
import { acepta, resuelveBeat } from '../../packages/nucleo/partida/aventura-en-curso.js';
import { CLASES_DE_ENTRADA, apuntaLoQueSeCuenta, entradasDe, entradasDeSuceso, proyeccionPorDias } from '../../packages/nucleo/partida/diario.js';
import { saldoDe } from '../../packages/nucleo/partida/oro.js';
import { objetosDe, SIN_OBJETOS } from '../../packages/nucleo/partida/objetos.js';
import { estadoDeArranque } from '../../packages/nucleo/partida/arranque.js';
import { ESCALONES_DE_RANGO } from '../../packages/nucleo/partida/rango.js';
import { arbolDeCalzadas, declaracionDeRumor, naceSuceso } from '../../packages/nucleo/partida/rumores.js';
import { loQueSeCuentaEn, sedimenta, versionQueLlego } from '../../packages/nucleo/partida/nucleos.js';
import { PROTAGONISTAS, SIGNOS, hechosFieles } from '../../packages/nucleo/partida/deformacion.js';
import { CATALOGO, REPUESTOS, compruebaCatalogo } from '../../packages/nucleo/quests/catalogo.js';
import { TEMPLATES } from '../../packages/nucleo/quests/templates.js';
import { componeEscena } from '../../packages/nucleo/render/escena.js';
import { ESTILOS } from '../../packages/nucleo/render/estilos.js';
import { medidorNominal } from '../../packages/nucleo/render/medidor-nominal.js';
import { colocadorSimple } from '../../packages/nucleo/render/colocador-simple.js';
import { namesFor } from '../../packages/nucleo/names/index.js';
import { relojDePared } from '../dobles/reloj-de-pared.mjs';
import { LAS_DOS_SEMILLAS, LOS_CUATRO, fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import { codigoDe, mundoLineal, plantillaDe, PLANTILLA_NOTABLE, PLANTILLA_NO_NOTABLE } from './rumor-de-prueba.mjs';
import { calendarioEn, DIA } from './antes-de-salir-de-prueba.mjs';
import { SEMILLA_A, SEMILLA_B } from './celda-de-prueba.mjs';

const MAPA = 'casa';
const IDIOMA = namesFor('es');

/** El hueco de una pantalla de móvil, que es donde vive la lámina del telón. */
const TAMANO = { ancho: 390, alto: 780 };

/** Los ocho mundos de referencia: los cuatro extractos por sus dos semillas. */
const LOS_OCHO = LOS_CUATRO.flatMap((nombre) => LAS_DOS_SEMILLAS.map((s) => ({ nombre, s })));

// Generar un mundo cuesta segundos y aquí se miran muchas veces. Salen congelados de la
// tubería y ningún caso muta lo que recibe.
const MUNDOS = new Map();
async function mundoDe(nombre = 'costero', s = '1') {
  const clave = `${nombre}#${s}`;
  if (!MUNDOS.has(clave)) MUNDOS.set(clave, await generaMundo(nombre, semillaDe(nombre, s)));
  return MUNDOS.get(clave);
}

/** El mundo sintético de los casos que no necesitan aventura: tres núcleos en fila. */
const CADENA = ['Albariza', 'Dorna', 'Bermeda'];
const mundoDeLaCadena = () => mundoLineal(CADENA);

/** Una partida con su registro y una salida abierta, que es lo que el cierre exige. */
function partida({ semilla = SEMILLA_A, salida = 's1', aventura = null } = {}) {
  const estado = estadoInicial({ semilla });
  const registro = registroInicial();
  abreSalida(estado.aventuras, { salida, mapaId: MAPA, aventura });
  return { estado, registro };
}

/** El desenlace que la plantilla declara al terminar una aventura, con lo que la fila mira. */
function desenlaceEn(nucleo, { plantilla = PLANTILLA_NOTABLE, id = 'd1', oro = 11, objetos = [], mote, texto = 'Acabó como acaban estas cosas, con el hule vacío y la sospecha entera.' } = {}) {
  return {
    id,
    plantilla: plantillaDe(plantilla),
    lugar: { tipo: 'nucleo', id: nucleo },
    texto,
    oro,
    objetos,
    ...(mote === undefined ? {} : { mote }),
  };
}

/** Echa el telón con todo lo que no cambia ya puesto. */
function cierra(estado, registro, { mundo, salida = 's1', dia = DIA, paso = 5, pendientes = libroDePendientes(), lugar = CADENA[0], piezas = piezasDeSerie(), ...resto } = {}) {
  return echaElTelon({
    estado,
    registro,
    calendario: calendarioEn(dia),
    mundo,
    mapaId: MAPA,
    salida,
    paso,
    pendientes,
    lugar,
    idioma: IDIOMA,
    piezas,
    ...resto,
  });
}

/** Una aventura casteada de un mundo de referencia, recorrida hasta donde se pida. */
function recorre(estado, registro, casteada, { hastaBeat = null, dia = DIA } = {}) {
  acepta(estado.aventuras, { aventura: casteada.aventura, mapaId: MAPA, registro, dia, paso: 1 });
  const cuantos = hastaBeat ?? casteada.beats.length;
  for (const beat of casteada.beats.slice(0, cuantos)) {
    resuelveBeat(estado.aventuras, { beat, reloj: relojDePared(0), tenencia: SIN_OBJETOS });
  }
  return casteada;
}

/** La primera aventura casteada de un mundo que cumpla lo que se le pida. */
function unaCasteada(mundo, predicado = () => true) {
  const c = mundo.casting.find((x) => x.ok && predicado(x));
  assert.ok(c, 'ninguna aventura casteada del mundo cumple lo que el caso necesita');
  return c;
}

/** El código de un módulo sin sus comentarios: lo que se afirma es lo que se ejecuta. */
function sinComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** La pantalla del telón con un estado dado, o `undefined`. */
const pantalla = (telon, estado) => telon.pantallas.find((p) => p.estado === estado);

/** Un mapa con un rumor protagonizado por quien juega, ya sedimentado en un núcleo. */
function dondeTeCuentan(estado, { mundo, nucleo = 'Dorna', origen = 'Albariza', nivel = 2, protagonista = PROTAGONISTAS.JUGADORA } = {}) {
  const arbol = arbolDeCalzadas(mundo);
  const hechos = hechosFieles(
    { asunto: 'lo-que-hizo-en-el-puente', escala: { veces: 1 }, detalle: { con: 'la panadera', lugar: origen, motivo: 'una riada' } },
    { lugar: origen, protagonista },
  );
  naceSuceso({ estado: estado.rumores, nucleos: estado.nucleos, mapaId: MAPA, arbol, id: 'suyo', origen, signo: SIGNOS.BUENO, hechos });
  sedimenta(estado.nucleos, {
    mapaId: MAPA,
    nucleo,
    loQueLlego: versionQueLlego({ rumor: 'suyo', origen, nivel, signo: SIGNOS.BUENO, hechos }),
  });
  return estado;
}

// ── La secuencia del telón, que es una y tiene dos ramas ────────────────────────

describe('El telón se echa solo al cerrarse la salida', () => {
  test('La secuencia de una aventura terminada con desenlace notable es mapa, desenlace, rumor y diario', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida({ aventura: 'a1' });
    const c = recorre(estado, registro, unaCasteada(mundo));
    const libro = libroDePendientes();
    apuntaHaberEstado(libro, { familia: 'nucleo', id: nucleo });

    const r = cierra(estado, registro, {
      mundo,
      lugar: nucleo,
      pendientes: libro,
      aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      desenlace: desenlaceEn(nucleo),
      repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
    });

    assert.deepEqual(r.telon.estados, ['mapa', 'desenlace', 'rumor', 'diario']);
    assert.equal(r.aventura.comoAcabo, 'terminada');
    assert.ok(r.rumor, 'un desenlace notable no ha hecho nacer ningún rumor');
    for (const estadoDePantalla of r.telon.estados) {
      assert.ok(ESTADOS_DEL_TELON.includes(estadoDePantalla), `"${estadoDePantalla}" no está en el vocabulario cerrado del telón`);
    }
  });

  test('El rumor solo aparece si el desenlace era notable', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida({ aventura: 'a1' });
    const c = recorre(estado, registro, unaCasteada(mundo));

    const r = cierra(estado, registro, {
      mundo,
      lugar: nucleo,
      aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      desenlace: desenlaceEn(nucleo, { plantilla: PLANTILLA_NO_NOTABLE }),
      repuesto: plantillaDe(PLANTILLA_NO_NOTABLE).repuesto,
    });

    assert.equal(r.rumor, null, 'un desenlace no notable ha hecho nacer un rumor');
    assert.deepEqual(r.telon.estados, ['mapa-sin-tinta', 'desenlace', 'diario']);
    assert.equal(pantalla(r.telon, 'rumor'), undefined);
  });

  test('El cierre en corto ocupa el sitio del desenlace', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida({ aventura: 'a1' });
    const c = unaCasteada(mundo, (x) => x.beats.length > 1);
    recorre(estado, registro, c, { hastaBeat: 1 });

    const libro = libroDePendientes();
    apuntaHaberEstado(libro, { familia: 'nucleo', id: nucleo });
    const r = cierra(estado, registro, {
      mundo,
      lugar: nucleo,
      pendientes: libro,
      aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
    });

    // El mapa entintado, el cierre en corto en el sitio del desenlace, y después el diario.
    assert.deepEqual(r.telon.estados, ['mapa', 'cierre-en-corto', 'diario']);
    assert.equal(r.aventura.comoAcabo, 'a-medias');
    assert.equal(pantalla(r.telon, 'desenlace'), undefined, 'un cierre en corto ha traído desenlace');
    assert.ok(r.ascensos.length, 'volverse a mitad ha anulado lo andado');
  });

  test('Un paseo sin aventura tiene telón completo menos desenlace', () => {
    const { estado, registro } = partida();
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena() });

    assert.deepEqual(r.telon.estados, ['mapa-sin-tinta', 'diario']);
    assert.equal(r.aventura, null);
    assert.equal(r.rumor, null);
    assert.equal(r.progresion, null);
  });

  test('La primera pantalla es siempre el mapa y la última siempre la entrada del diario', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const secuencias = [];

    // 1 · Aventura terminada y desenlace notable.
    {
      const { estado, registro } = partida({ aventura: 'a1' });
      const c = recorre(estado, registro, unaCasteada(mundo));
      secuencias.push(cierra(estado, registro, {
        mundo, lugar: nucleo, aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
        desenlace: desenlaceEn(nucleo), repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
      }).telon);
    }
    // 2 · Aventura terminada y desenlace no notable.
    {
      const { estado, registro } = partida({ aventura: 'a1' });
      const c = recorre(estado, registro, unaCasteada(mundo));
      secuencias.push(cierra(estado, registro, {
        mundo, lugar: nucleo, aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
        desenlace: desenlaceEn(nucleo, { plantilla: PLANTILLA_NO_NOTABLE }), repuesto: plantillaDe(PLANTILLA_NO_NOTABLE).repuesto,
      }).telon);
    }
    // 3 · Vuelta a mitad.
    {
      const { estado, registro } = partida({ aventura: 'a1' });
      const c = unaCasteada(mundo, (x) => x.beats.length > 1);
      recorre(estado, registro, c, { hastaBeat: 1 });
      secuencias.push(cierra(estado, registro, {
        mundo, lugar: nucleo, aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
        repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
      }).telon);
    }
    // 4 · Paseo sin aventura.
    {
      const { estado, registro } = partida();
      secuencias.push(cierra(estado, registro, { mundo, lugar: nucleo }).telon);
    }

    assert.equal(secuencias.length, 4);
    for (const telon of secuencias) {
      assert.match(telon.estados[0], /^mapa/, 'la primera pantalla del telón no es el mapa');
      assert.equal(telon.estados[telon.estados.length - 1], 'diario', 'la última pantalla del telón no es la entrada del diario');
    }
  });

  test('El paseo sin aventura no es una pantalla distinta con título propio', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];

    const conAventura = (() => {
      const { estado, registro } = partida({ aventura: 'a1' });
      const c = recorre(estado, registro, unaCasteada(mundo));
      return cierra(estado, registro, {
        mundo, lugar: nucleo, aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
        desenlace: desenlaceEn(nucleo), repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
      }).telon;
    })();
    const paseo = (() => {
      const { estado, registro } = partida();
      return cierra(estado, registro, { mundo, lugar: nucleo }).telon;
    })();

    assert.equal(paseo.pantallas[0].titulo, conAventura.pantallas[0].titulo, 'el paseo tiene un título propio en su primera pantalla');
    assert.equal(paseo.pantallas[0].situacion, conAventura.pantallas[0].situacion);
    assert.equal(paseo.pantallas[0].estado, conAventura.pantallas[0].estado);
  });

  test('Una salida cerrada dos veces falla nombrándola y no ingresa el oro dos veces', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida({ aventura: 'a1' });
    const c = recorre(estado, registro, unaCasteada(mundo));
    const opciones = {
      mundo, lugar: nucleo, aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      desenlace: desenlaceEn(nucleo), repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
    };
    cierra(estado, registro, opciones);

    const saldo = saldoDe(estado.oro);
    const conocimiento = JSON.stringify(congelaConocimiento(estado.conocimiento));
    const hechos = hechosDe(registro).length;
    assert.equal(saldo, 11);

    assert.throws(
      () => cierra(estado, registro, opciones),
      (e) => e.message.includes('s1') && /no está abierta|ya se echó/.test(e.message),
      'cerrar dos veces la misma salida no ha fallado nombrándola',
    );
    assert.equal(saldoDe(estado.oro), saldo, 'el segundo cierre ha vuelto a ingresar el oro');
    assert.equal(JSON.stringify(congelaConocimiento(estado.conocimiento)), conocimiento, 'el segundo cierre ha vuelto a entintar');
    assert.equal(hechosDe(registro).length, hechos, 'el segundo cierre ha anexado hechos');
  });

  test('Volver a casa cierra la salida', () => {
    // La mitad que le toca a esta fila: el telón se echa y **no avisa de nada**. Ni el
    // cierre ni la composición conocen ninguna capa de aviso, así que no hay por dónde.
    const { estado, registro } = partida();
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena() });
    assert.equal(salidaAbierta(estado.aventuras), null, 'la salida ha quedado abierta después del telón');
    assert.ok(r.telon);

    for (const modulo of ['packages/nucleo/partida/cierre-de-salida.js', 'packages/nucleo/partida/telon.js']) {
      const texto = fuente(modulo);
      assert.doesNotMatch(texto, /from\s+'[^']*avisos/, `${modulo}: importa la capa de avisos`);
      for (const patron of [/\bnotifica\(/, /\bvibra\(/, /primerPlano/, /pushNotification/i]) {
        assert.doesNotMatch(texto, patron, `${modulo}: emite un aviso al echar el telón (${patron})`);
      }
    }
  });

  test('El telón espera a que lo leas', () => {
    // La mitad de esta fila: echar el telón **no lo marca como leído** y no toca el área
    // que guarda la vida de la salida (SPEC-030), que es la que sabe si está sin leer.
    assert.equal(AREAS_QUE_TOCA_EL_CIERRE.includes('salidas'), false, 'el cierre toca el área de la vida de la salida');
    assert.doesNotMatch(fuente('packages/nucleo/partida/cierre-de-salida.js'), /marcaElTelonComoLeido/);

    // Y el telón se compone de lo que quedó guardado, así que dos días después sale igual.
    const { estado, registro } = partida();
    const primera = cierra(estado, registro, { mundo: mundoDeLaCadena() });
    const vuelta = levantaEstado(JSON.parse(JSON.stringify(congelaEstado(estado))));
    assert.deepEqual(congelaConocimiento(vuelta.conocimiento), congelaConocimiento(estado.conocimiento));
    assert.deepEqual(
      componeElTelon({
        mapaId: MAPA, dia: DIA, ascensos: primera.ascensos, entintado: primera.entintado,
        entradaDelDiario: entradasDe(vuelta.diario)[0], nucleos: [],
      }).estados,
      primera.telon.estados,
    );
  });
});

// ── El conocimiento se cobra al telón, no en marcha ─────────────────────────────

describe('El conocimiento se cobra al telón y no en marcha', () => {
  test('El mapa no cambia durante la salida', () => {
    // La mitad de la capa de conocimiento: lo que hay a mitad de camino es una anotación
    // pendiente y no un cambio de nivel, y por eso no hay nada que pintar.
    const { estado, registro } = partida();
    const alSalir = textoDeEstado(estado);

    const libro = libroDePendientes();
    apuntaHaberEstado(libro, { familia: 'nucleo', id: 'Dorna' });
    apuntaHaberEstado(libro, { familia: 'nucleo', id: 'Bermeda' });
    assert.equal(textoDeEstado(estado), alSalir, 'apuntar un pendiente ha movido el estado a mitad de camino');
    assert.equal(nivelDe(estado.conocimiento, { mapaId: MAPA, clave: 'nucleo:Dorna' }), NIVEL_DE_PARTIDA.nucleo);

    const r = cierra(estado, registro, { mundo: mundoDeLaCadena(), pendientes: libro });
    assert.notEqual(textoDeEstado(estado), alSalir, 'el telón no ha movido nada');
    assert.equal(r.ascensos.length, 2, 'los ascensos pendientes no se han aplicado todos de una vez');
    assert.equal(nivelDe(estado.conocimiento, { mapaId: MAPA, clave: 'nucleo:Dorna' }), 'lo-conoces');
    assert.equal(nivelDe(estado.conocimiento, { mapaId: MAPA, clave: 'nucleo:Bermeda' }), 'lo-conoces');
  });

  test('El mapa se entinta al echar el telón', () => {
    const { estado, registro } = partida();
    const libro = libroDePendientes();
    apuntaHaberEstado(libro, { familia: 'nucleo', id: 'Dorna' });
    apuntaHaberEstado(libro, { familia: 'nucleo', id: 'Bermeda' });

    const r = cierra(estado, registro, { mundo: mundoDeLaCadena(), pendientes: libro });
    const mapa = r.telon.pantallas[0];

    // Los dos sitios recién entintados.
    const deHoy = r.entintado.filter((e) => e.tinta === 'de-hoy').map((e) => e.id);
    assert.deepEqual(deHoy.slice().sort(), ['Bermeda', 'Dorna']);

    // Y la lista dice a qué nivel han subido, **en palabras del mundo**.
    assert.deepEqual(mapa.ascensos.map((a) => [a.nombre, a.escalon]).sort(), [['Bermeda', 'lo conoces'], ['Dorna', 'lo conoces']]);
    for (const a of mapa.ascensos) {
      assert.ok(Object.values(PALABRAS_DEL_MUNDO).includes(a.escalon), `"${a.escalon}" no es una palabra del mundo`);
    }
    assert.equal(mapa.estado, 'mapa');
    assert.equal(mapa.titulo, TEXTOS.tituloConTinta);
  });

  test('La lista de ascensos no lleva ni un porcentaje, ni un kilómetro, ni un tiempo, ni una barra', () => {
    const { estado, registro } = partida();
    const libro = libroDePendientes();
    apuntaHaberEstado(libro, { familia: 'nucleo', id: 'Dorna' });
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena(), pendientes: libro });

    const texto = JSON.stringify(r.telon.pantallas[0].ascensos);
    for (const patron of [/%/, /\bkm\b/i, /\bmetros?\b/i, /\bminutos?\b/i, /\bhoras?\b/i, /\d/, /barra|progreso|porcentaje/i]) {
      assert.doesNotMatch(texto, patron, `la lista de ascensos enseña una cifra (${patron})`);
    }
    // Y la capa no exporta ninguna manera de contar cuánto mapa llevas descubierto.
    assert.doesNotMatch(fuente('packages/nucleo/partida/conocimiento.js'), /export function (porcentaje|cuantoDescubierto|progresoDelMapa)/);
  });

  test('Un sitio nuevo sube a lo conoces y volver a él, a lo conoces bien', () => {
    const { estado, registro } = partida();
    const primero = libroDePendientes();
    apuntaHaberEstado(primero, { familia: 'paraje', id: 'A Fonte Vella' });
    cierra(estado, registro, { mundo: mundoDeLaCadena(), pendientes: primero });
    assert.equal(nivelDe(estado.conocimiento, { mapaId: MAPA, clave: 'paraje:A Fonte Vella' }), 'lo-conoces');

    abreSalida(estado.aventuras, { salida: 's2', mapaId: MAPA });
    const segundo = libroDePendientes();
    apuntaHaberEstado(segundo, { familia: 'paraje', id: 'A Fonte Vella' });
    cierra(estado, registro, { mundo: mundoDeLaCadena(), salida: 's2', pendientes: segundo });
    assert.equal(nivelDe(estado.conocimiento, { mapaId: MAPA, clave: 'paraje:A Fonte Vella' }), 'lo-conoces-bien');

    // Y el último escalón es el último: volver otra vez no sube más.
    abreSalida(estado.aventuras, { salida: 's3', mapaId: MAPA });
    const tercero = libroDePendientes();
    apuntaHaberEstado(tercero, { familia: 'paraje', id: 'A Fonte Vella' });
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena(), salida: 's3', pendientes: tercero });
    assert.deepEqual([...r.ascensos], [], 'un sitio en el último escalón ha vuelto a subir');
    assert.equal(nivelDe(estado.conocimiento, { mapaId: MAPA, clave: 'paraje:A Fonte Vella' }), 'lo-conoces-bien');
  });

  test('Un sitio del que llega un rumor sube a lo conoces sin haber puesto un pie', () => {
    const { estado, registro } = partida();
    const libro = libroDePendientes();
    apuntaLoNombradoPorUnRumor(libro, { familia: 'servicio', id: 'Taberna do Gato Prateado' });
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena(), pendientes: libro });

    assert.equal(nivelDe(estado.conocimiento, { mapaId: MAPA, clave: 'servicio:Taberna do Gato Prateado' }), 'lo-conoces');
    assert.deepEqual(r.ascensos.map((a) => a.via), [VIAS_DE_ASCENSO.BOCA]);
    // Y la boca de otro no llega al último escalón: su historia no te la cuenta un rumor.
    assert.equal(ascensoPor('lo-conoces', VIAS_DE_ASCENSO.BOCA), null);
    assert.equal(ascensoPor('lo-conoces', VIAS_DE_ASCENSO.PIERNAS), 'lo-conoces-bien');
  });

  test('El nivel de partida de un mundo de referencia lo decide la escala', async () => {
    const vacio = estadoDeConocimiento();
    const vistas = new Set();
    for (const { nombre, s } of LOS_OCHO) {
      const mundo = await mundoDe(nombre, s);
      for (const elemento of elementosDelMundo(mundo)) {
        vistas.add(elemento.familia);
        const esperado = ['paraje', 'servicio'].includes(elemento.familia) ? 'no-lo-sabes' : 'lo-ves';
        assert.equal(
          nivelDe(vacio, { mapaId: MAPA, clave: elemento.clave }),
          esperado,
          `${nombre}#${s}: "${elemento.clave}" no nace en "${esperado}"`,
        );
      }
    }
    // Y los dos niveles de partida salen de verdad en los ocho mundos: si no, el caso
    // sería vacío. No se exigen las siete familias porque un extracto real puede no
    // traer picos —el costero no los tiene— y eso es dato de OSM, no un fallo.
    for (const familia of vistas) assert.ok(FAMILIAS_DE_ELEMENTO.includes(familia), `"${familia}" no es una familia declarada`);
    assert.ok([...vistas].some((f) => NIVEL_DE_PARTIDA[f] === 'lo-ves'), 'ningún elemento nace en «lo ves»');
    assert.ok([...vistas].some((f) => NIVEL_DE_PARTIDA[f] === 'no-lo-sabes'), 'ningún elemento nace en «no lo sabes»');
    assert.ok(vistas.size >= 5, `los ocho mundos solo traen ${vistas.size} familias de elemento`);
    // Ni un elemento guardado: el estado solo apunta lo que ha subido, y consultar el
    // nivel de los ocho mundos enteros no guarda ni uno.
    assert.deepEqual(congelaConocimiento(vacio).mapas[MAPA] ?? {}, {});
  });

  test('Un nivel de conocimiento fuera de la escalera falla nombrando el valor y los cuatro', () => {
    assert.throws(
      () => exigeNivelDeConocimiento('lo-dominas'),
      (e) => e.message.includes('lo-dominas') && NIVELES_DE_CONOCIMIENTO.every((n) => e.message.includes(n)),
    );
    const estado = estadoDeConocimiento();
    assert.throws(() => subeA(estado, { mapaId: MAPA, clave: 'nucleo:Dorna', escalon: 'casi' }), /casi/);
    assert.throws(() => levantaConocimiento({ mapas: { [MAPA]: { 'nucleo:Dorna': 'casi' } } }), /casi/);
  });

  test('El reparto del catálogo es el mismo con conocimiento y sin él', async () => {
    // RF-QUEST-002 afirmado desde el lado del que sí lo mueve: lo descubierto afecta a lo
    // que ves, nunca a lo que existe. El casting no tiene por dónde mirarlo.
    // Sin comentarios ni cadenas: estos módulos **explican** que no miran lo descubierto,
    // y una búsqueda sobre el fichero entero castigaría justo ese comentario.
    for (const modulo of ['packages/nucleo/quests/casting.js', 'packages/nucleo/quests/catalogo.js', 'packages/nucleo/quests/aventura.js']) {
      assert.doesNotMatch(codigoDe(fuente(modulo)), /conocimiento/, `${modulo}: el casting mira lo descubierto`);
    }
    const mundo = await mundoDe();
    const antes = mundo.casting.filter((c) => c.ok).map((c) => c.tpl.id);

    const { estado, registro } = partida();
    const libro = libroDePendientes();
    for (const s of mundo.settlements) apuntaHaberEstado(libro, { familia: 'nucleo', id: s.name });
    cierra(estado, registro, { mundo, lugar: mundo.settlements[0].name, pendientes: libro });

    const otraVez = await generaMundo('costero', semillaDe('costero', '1'));
    assert.deepEqual(otraVez.casting.filter((c) => c.ok).map((c) => c.tpl.id), antes, 'el reparto cambia con lo descubierto');
  });
});

// ── Las tres tintas, y ninguna leyenda ─────────────────────────────────────────

describe('Las tres tintas, y ninguna leyenda', () => {
  /** El entintado de un mundo con un elemento subido y otro subido hoy. */
  async function laminaDe(nombre = 'costero', s = '1') {
    const documento = await mundoDe(nombre, s);
    const estado = estadoDeConocimiento();
    const sabido = claveDeElemento({ familia: 'nucleo', id: documento.settlements[0].name });
    const hoy = claveDeElemento({ familia: 'paraje', id: documento.parajes[0].name });
    subeA(estado, { mapaId: MAPA, clave: sabido, escalon: 'lo-conoces' });
    subeA(estado, { mapaId: MAPA, clave: hoy, escalon: 'lo-conoces' });
    const entintado = entintadoDelMundo(estado, { mapaId: MAPA, mundo: documento, ascensos: [hoy] });
    return { documento, entintado, sabido, hoy };
  }

  const pinta = (documento, extra = {}) => componeEscena({
    documento, tamano: TAMANO, medidor: medidorNominal, colocador: colocadorSimple, ...extra,
  });

  test('Cada elemento del mapa del telón lleva una de tres tintas y ninguna otra', async () => {
    const { entintado, sabido, hoy } = await laminaDe();
    for (const marca of entintado) assert.ok(TINTAS.includes(marca.tinta), `"${marca.tinta}" no es una de las tres tintas`);
    assert.equal(TINTAS.length, 3);
    assert.equal(entintado.find((e) => e.clave === hoy).tinta, 'de-hoy', 'lo que subió hoy no lleva la tinta de hoy');
    assert.equal(entintado.find((e) => e.clave === sabido).tinta, 'asentado', 'lo sabido y no subido hoy no lleva la tinta de lo sabido');
    // Y lo que está en «lo ves» o en «no lo sabes» va a lápiz.
    assert.ok(entintado.some((e) => e.tinta === 'a-lapiz'), 'nada va a lápiz: el caso sería vacío');
    // El entintado no lleva ningún nivel dentro: el mapa enseña tres tintas, no cuatro escalones.
    for (const marca of entintado) assert.deepEqual(Object.keys(marca).sort(), ['clave', 'familia', 'id', 'tinta']);
  });

  test('La capa reservada del entintado ya no está vacía, y no mete ni un texto', async () => {
    const { documento, entintado } = await laminaDe();
    const escena = pinta(documento, { entintado, telon: true });
    const capa = escena.primitivas.filter((p) => p.capa === 'entintado');
    assert.ok(capa.length > 0, 'la capa 17 del plan de capas sigue vacía en el telón');
    assert.equal(capa.length, entintado.filter((e) => ['nucleo', 'servicio', 'paraje', 'calzada', 'costa', 'bosque', 'pico'].includes(e.familia)).length);
    assert.deepEqual(capa.filter((p) => p.tipo === 'texto'), [], 'el entintado ha metido texto: eso es una leyenda');
    // Ni una leyenda por ningún otro sitio: los rótulos son los mismos con tinta y sin ella.
    assert.deepEqual(escena.rotulos, pinta(documento).rotulos, 'entintar ha añadido o quitado rótulos');
  });

  test('Entintar no resiembra ni mueve nada', async () => {
    const { documento, entintado } = await laminaDe();
    const antes = JSON.stringify(documento);
    const enMarcha = pinta(documento);
    const telon = pinta(documento, { entintado, telon: true });

    assert.equal(JSON.stringify(documento), antes, 'pintar el telón ha tocado el documento de celda');
    assert.deepEqual(telon.primitivas.filter((p) => p.capa !== 'entintado'), enMarcha.primitivas, 'el mundo pintado con tinta no es el mismo que en marcha');
    assert.equal(telon.documentoId, enMarcha.documentoId);
  });

  test('Las tres tintas salen del estilo en los cinco, y ningún color vive en el código de dibujo', async () => {
    const { documento, entintado } = await laminaDe();
    for (const estilo of ESTILOS) {
      const escena = pinta(documento, { estilo: estilo.id, entintado, telon: true });
      const capa = escena.primitivas.filter((p) => p.capa === 'entintado');
      assert.ok(capa.length > 0, `${estilo.id}: la capa del entintado está vacía`);
      const suyas = new Set([estilo.tintas.deHoy.color, estilo.tintas.asentado.color, estilo.tintas.aLapiz.color]);
      const usados = new Set(capa.map((p) => p.pintura?.trazo));
      for (const color of usados) assert.ok(suyas.has(color), `${estilo.id}: el entintado pinta con "${color}", que no es ninguna de sus tres tintas`);
      assert.deepEqual([...usados].sort(), [...suyas].sort(), `${estilo.id}: no se usan las tres tintas del estilo`);
    }
    // Y el módulo que compone no gana ni un color por llenar la capa 17: el único que
    // tiene escrito sigue siendo el verde de la hoja de la zarza, que ya venía del
    // prototipo y está declarado en su comentario.
    const colores = [...new Set(sinComentarios(fuente('packages/nucleo/render/escena.js')).match(/#[0-9a-fA-F]{6}/g) ?? [])];
    assert.deepEqual(colores, ['#6f8a45'], `el módulo que compone la escena tiene colores escritos: ${colores.join(', ')}`);
  });

  test('El pintado del telón sin el estado de conocimiento cableado falla nombrando el estado', async () => {
    const { documento } = await laminaDe();
    assert.throws(
      () => pinta(documento, { telon: true }),
      (e) => /conocimiento/.test(e.message) && /entintad/.test(e.message),
      'el telón sin conocimiento no ha fallado nombrando el estado',
    );
    // Sin la marca del telón, la capa se queda vacía: eso es el mapa en marcha, no un fallo.
    const enMarcha = pinta(documento);
    assert.deepEqual(enMarcha.primitivas.filter((p) => p.capa === 'entintado'), []);
  });
});

// ── El día sin descubrimientos enseña el mapa igual ────────────────────────────

describe('El día sin descubrimientos enseña el mapa igual', () => {
  test('Un día sin descubrir nada enseña el mapa igual', () => {
    const { estado, registro } = partida();
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena(), porDondeSePaso: CADENA });
    const mapa = r.telon.pantallas[0];

    assert.equal(mapa.estado, 'mapa-sin-tinta');
    assert.equal(mapa.titulo, TEXTOS.tituloSinTinta);
    assert.deepEqual([...mapa.ascensos], [], 'un día sin descubrir nada trae ascensos');
    assert.deepEqual([...mapa.porDondeSePaso], CADENA, 'la lista no enseña por dónde se pasó');
    assert.equal(mapa.linea, TEXTOS.lineaSinTinta);
    // El mapa está entero, con su lámina: la pantalla no se salta.
    assert.equal(mapa.entintado.length, r.entintado.length);
    assert.ok(mapa.entintado.length > 0);
    // Y ningún texto se lo reprocha.
    for (const texto of [mapa.titulo, mapa.linea, mapa.situacion]) {
      assert.deepEqual([...infraccionesDeReproche(texto)], [], `"${texto}" reprocha`);
    }
  });

  test('El día flojo no tiene ni un elemento con la tinta de hoy y su lista está vacía', () => {
    const { estado, registro } = partida();
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena() });
    assert.deepEqual(r.entintado.filter((e) => e.tinta === 'de-hoy'), [], 'un día flojo tiene tinta de hoy');
    assert.deepEqual([...r.telon.pantallas[0].ascensos], []);
    assert.equal(estadoDelMapa([]), 'mapa-sin-tinta');
    assert.equal(estadoDelMapa([{ clave: 'nucleo:Dorna' }]), 'mapa');
  });

  test('Ningún texto del telón usa el vocabulario de reproche, y uno que lo usara falla nombrándolo', () => {
    for (const [clave, texto] of Object.entries(TEXTOS)) {
      assert.deepEqual([...infraccionesDeReproche(texto)], [], `el texto "${clave}" del telón reprocha`);
    }
    for (const escalon of Object.keys(FRASES_DE_RANGO)) {
      assert.deepEqual([...infraccionesDeReproche(FRASES_DE_RANGO[escalon]('Monfrida'))], []);
    }
    // El criterio se puede poner rojo: un título con una de esas palabras falla nombrando
    // el texto y la palabra.
    assert.ok(VOCABULARIO_DE_REPROCHE.length >= 9);
    const malo = 'Hoy has andado poco y deberías volver mañana';
    assert.throws(
      () => exigeSinReproche(malo, 'el título del día flojo'),
      (e) => e.message.includes(malo) && e.message.includes('poco') && e.message.includes('el título del día flojo'),
    );
  });

  test('El día flojo mueve el reloj del mundo igual que un día con aventura', async () => {
    // Los kilómetros mueven el mundo con aventura o sin ella, y el telón no los toca: el
    // área del motor de pasos no está entre las que el cierre puede escribir.
    assert.equal(AREAS_QUE_TOCA_EL_CIERRE.includes('pasos'), false, 'el cierre de la salida escribe el reloj del mundo');

    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const flojo = partida();
    const antes = JSON.stringify(areaDe('pasos').congela(flojo.estado.pasos));
    cierra(flojo.estado, flojo.registro, { mundo, lugar: nucleo });
    assert.equal(JSON.stringify(areaDe('pasos').congela(flojo.estado.pasos)), antes);

    const conAventura = partida({ aventura: 'a1' });
    const c = recorre(conAventura.estado, conAventura.registro, unaCasteada(mundo));
    cierra(conAventura.estado, conAventura.registro, {
      mundo, lugar: nucleo, aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      desenlace: desenlaceEn(nucleo), repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
    });
    assert.equal(JSON.stringify(areaDe('pasos').congela(conAventura.estado.pasos)), antes, 'el telón con aventura ha movido el reloj del mundo');
  });
});

// ── El desenlace: el oro como cifra, el rango como frase ───────────────────────

describe('El desenlace: el oro como cifra, el rango como frase', () => {
  async function conDesenlace({ objetos = [], oro = 11 } = {}) {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida({ aventura: 'a1' });
    const c = recorre(estado, registro, unaCasteada(mundo));
    const r = cierra(estado, registro, {
      mundo, lugar: nucleo,
      aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      desenlace: desenlaceEn(nucleo, { oro, objetos }),
      repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
    });
    return { estado, registro, mundo, nucleo, r, casteada: c };
  }

  test('El desenlace lleva el texto de su plantilla, el oro, los objetos y la frase del rango', async () => {
    const { estado, r } = await conDesenlace({ objetos: [{ id: 'La llave del molino viejo', clase: 'llave' }] });
    const p = pantalla(r.telon, 'desenlace');

    assert.equal(p.titular, TEXTOS.titularDelDesenlace);
    assert.equal(p.parrafo, 'Acabó como acaban estas cosas, con el hule vacío y la sospecha entera.');
    assert.equal(p.oro.cantidad, 11);
    assert.equal(saldoDe(estado.oro), 11, 'la bolsa no ha ingresado lo que declaró el desenlace');
    assert.deepEqual(p.objetos.map((o) => o.id), ['La llave del molino viejo']);
    assert.ok(p.rango, 'el rango se movió y no hay frase');
    assert.equal(p.rango.nucleo, r.rango[0].nucleo);
  });

  test('La única cifra de la pantalla del desenlace es la del oro', async () => {
    const { r } = await conDesenlace({ objetos: [{ id: 'La llave del molino viejo', clase: 'llave' }] });
    const p = pantalla(r.telon, 'desenlace');
    const sinOro = JSON.stringify({ ...p, oro: null });
    assert.doesNotMatch(sinOro, /\d/, 'la pantalla del desenlace enseña una cifra que no es la del oro');
    assert.equal(typeof p.oro.cantidad, 'number');
    // Ni barra, ni puntos, ni experiencia, ni nivel.
    for (const patron of [/barra/i, /puntos/i, /experiencia/i, /\bnivel\b/i, /reputaci/i]) {
      assert.doesNotMatch(JSON.stringify(p), patron, `la pantalla del desenlace tiene un medidor (${patron})`);
    }
  });

  test('Un objeto aparece con de quién viene y no como requisito de nada', async () => {
    const { estado, r } = await conDesenlace({ objetos: [{ id: 'La llave del molino viejo', clase: 'llave' }] });
    const [objeto] = pantalla(r.telon, 'desenlace').objetos;
    assert.equal(objeto.clase, 'llave');
    const guardado = objetosDe(estado.objetos).find((o) => o.id === 'La llave del molino viejo');
    assert.ok(guardado, 'el objeto del desenlace no ha llegado a la repisa');
    assert.equal(guardado.procedencia.desenlace, 'd1', 'el objeto llega sin de quién viene');
    assert.doesNotMatch(JSON.stringify(objeto), /requisito|necesitas|hace falta/i);
  });

  test('La frase del rango nombra un solo núcleo aunque el rango se haya movido en varios', () => {
    const dos = fraseDelRango([
      { nucleo: 'Zamarra', escalon: 'nombradia' },
      { nucleo: 'Albariza', escalon: 'pertenencia' },
    ]);
    // El escalón más alto manda, y a igualdad el orden canónico del mapa.
    assert.equal(dos.nucleo, 'Albariza');
    assert.equal(dos.escalon, 'pertenencia');
    assert.match(dos.texto, /^En Albariza /);
    assert.equal((dos.texto.match(/Zamarra/g) ?? []).length, 0, 'la frase nombra dos pueblos');

    const empate = fraseDelRango([
      { nucleo: 'Zamarra', escalon: 'nombradia' },
      { nucleo: 'Albariza', escalon: 'nombradia' },
    ]);
    assert.equal(empate.nucleo, 'Albariza');
    // Y no hay escalón escrito ni número en la frase.
    assert.doesNotMatch(dos.texto, /\d/);
    for (const escalon of ESCALONES_DE_RANGO) assert.doesNotMatch(dos.texto, new RegExp(escalon, 'i'));
  });

  test('Sin movimiento de rango no hay frase, y no se sustituye por una que diga que no subió', () => {
    assert.equal(fraseDelRango([]), null);
    assert.equal(fraseDelRango(), null);
    // Y forastería no es una subida: es donde nace todo el mundo.
    assert.equal(fraseDelRango([{ nucleo: 'Albariza', escalon: 'forasteria' }]), null);
    assert.doesNotMatch(JSON.stringify(TEXTOS), /no ha subido|sigue igual|todavía nadie/i);
  });

  test('El mismo desenlace compuesto dos veces es idéntico, frase de rango incluida', async () => {
    const { r, nucleo } = await conDesenlace({ objetos: [{ id: 'La llave del molino viejo', clase: 'llave' }] });
    // El rango movido en dos sitios, para que el desempate tenga trabajo que hacer.
    const rango = [{ nucleo: 'Zamarra', escalon: 'nombradia' }, ...r.rango];
    const piezas = {
      mapaId: r.mapa, dia: r.dia, ascensos: r.ascensos, entintado: r.entintado,
      aventura: { id: 'a1', titulo: 'Lo de la caja' }, desenlace: desenlaceEn(nucleo),
      progresion: r.progresion, rango, entradaDelDiario: { id: r.entrada }, nucleos: [],
    };
    const una = componeElTelon(piezas);
    const otra = componeElTelon({ ...piezas, rango: [...rango].reverse() });

    assert.ok(pantalla(una, 'desenlace').rango, 'el rango se movió y no hay frase');
    assert.deepEqual(JSON.parse(JSON.stringify(otra)), JSON.parse(JSON.stringify(una)), 'dos composiciones del mismo estado no son idénticas');
    assert.deepEqual(JSON.parse(JSON.stringify(pantalla(otra, 'desenlace').rango)), JSON.parse(JSON.stringify(pantalla(una, 'desenlace').rango)));
  });
});

// ── El cierre en corto ─────────────────────────────────────────────────────────

describe('El cierre en corto', () => {
  async function enCorto({ hastaBeat = 0, plantilla = PLANTILLA_NOTABLE } = {}) {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida({ aventura: 'a1' });
    const c = unaCasteada(mundo, (x) => x.beats.length > 1 && x.beats.some((b, i) => b.resultado?.objeto && i === 0));
    recorre(estado, registro, c, { hastaBeat });
    const libro = libroDePendientes();
    apuntaHaberEstado(libro, { familia: 'nucleo', id: nucleo });
    const r = cierra(estado, registro, {
      mundo, lugar: nucleo, pendientes: libro,
      aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      desenlace: null,
      repuesto: plantillaDe(plantilla).repuesto,
    });
    return { estado, registro, mundo, nucleo, r, casteada: c };
  }

  test('Un cierre en corto sin nada conseguido cuenta cómo acabó sin ti', async () => {
    const { r } = await enCorto({ hastaBeat: 0 });
    const p = pantalla(r.telon, 'cierre-en-corto');
    assert.equal(p.titular, TEXTOS.titularDelCierreEnCorto);
    assert.equal(p.parrafo, plantillaDe(PLANTILLA_NOTABLE).repuesto.sinTi);
    assert.equal(p.cierre, TEXTOS.cierreDelCierreEnCorto);
    assert.deepEqual([...r.aventura.conseguido], []);
  });

  test('Un cierre en corto habiendo conseguido algo cierra con lo que sí se consiguió', async () => {
    const { r } = await enCorto({ hastaBeat: 1 });
    assert.ok(r.aventura.conseguido.length, 'el caso no ha conseguido nada: sería el otro texto');
    assert.equal(pantalla(r.telon, 'cierre-en-corto').parrafo, plantillaDe(PLANTILLA_NOTABLE).repuesto.conLoConseguido);
  });

  test('Un cierre en corto con cero beats resueltos aparece igual', async () => {
    const { r } = await enCorto({ hastaBeat: 0 });
    assert.deepEqual(r.telon.estados, ['mapa', 'cierre-en-corto', 'diario']);
    assert.equal(r.aventura.resueltos, 0);
    assert.ok(pantalla(r.telon, 'cierre-en-corto').parrafo, 'con cero beats no hay texto de cierre en corto');
  });

  test('Un cierre en corto no genera rumor', async () => {
    const { estado, r } = await enCorto({ hastaBeat: 1 });
    assert.equal(r.rumor, null, 'un cierre en corto ha hecho nacer un rumor');
    assert.equal(pantalla(r.telon, 'rumor'), undefined);
    // Y no existe ninguno en ningún núcleo, ni ahora ni después de que el mundo ande.
    for (const nucleo of arbolDeCalzadas(await mundoDe()).nucleos) {
      assert.deepEqual([...loQueSeCuentaEn(estado.nucleos, { mapaId: MAPA, nucleo })], [], `se cuenta algo en "${nucleo}"`);
    }
  });

  test('Un cierre en corto no genera rumor aunque su plantilla declare el desenlace notable', async () => {
    const { r } = await enCorto({ hastaBeat: 1, plantilla: PLANTILLA_NOTABLE });
    assert.equal(declaracionDeRumor(plantillaDe(PLANTILLA_NOTABLE)).notable, true, 'la plantilla de referencia ya no declara su desenlace notable');
    assert.equal(r.rumor, null, 'manda la declaración de la plantilla sobre el cierre en corto');
    assert.deepEqual(r.telon.estados.filter((e) => e === 'rumor'), []);
  });

  test('Un cierre en corto entinta el mapa igual', async () => {
    const { r } = await enCorto({ hastaBeat: 0 });
    assert.ok(r.ascensos.length, 'volverse a mitad ha anulado lo andado');
    assert.equal(r.telon.pantallas[0].estado, 'mapa');
    assert.ok(r.entintado.some((e) => e.tinta === 'de-hoy'));
  });

  test('Las treinta plantillas traen los dos textos de repuesto, y una que no los trajera hace fallar la carga', () => {
    assert.equal(CATALOGO.length, 30);
    for (const plantilla of CATALOGO) {
      for (const cual of REPUESTOS) {
        assert.equal(typeof plantilla.repuesto?.[cual], 'string', `la plantilla "${plantilla.id}" no declara el repuesto "${cual}"`);
        assert.ok(plantilla.repuesto[cual].trim().length > 0);
      }
    }
    const coja = TEMPLATES.map((t) => (t.id === CATALOGO[0].id ? { ...t, repuesto: { sinTi: t.repuesto.sinTi } } : t));
    assert.throws(
      () => compruebaCatalogo(coja),
      (e) => e.message.includes(CATALOGO[0].id) && e.message.includes('conLoConseguido'),
      'una plantilla sin los dos repuestos no hace fallar la carga del catálogo nombrándola',
    );
  });

  test('Los sesenta textos de repuesto no usan el vocabulario de reproche', () => {
    const textos = CATALOGO.flatMap((t) => REPUESTOS.map((cual) => [`${t.id}·${cual}`, t.repuesto[cual]]));
    assert.equal(textos.length, 60);
    const malos = textos.filter(([, texto]) => infraccionesDeReproche(texto).length);
    assert.deepEqual(malos.map(([quien]) => quien), [], 'hay textos de repuesto que reprochan');
  });
});

// ── El rumor se ve salir, no llegar ────────────────────────────────────────────

describe('El rumor se ve salir, no llegar', () => {
  async function conRumor({ semilla = SEMILLA_A } = {}) {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida({ semilla, aventura: 'a1' });
    const c = recorre(estado, registro, unaCasteada(mundo));
    const r = cierra(estado, registro, {
      mundo, lugar: nucleo,
      aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      desenlace: desenlaceEn(nucleo),
      repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
    });
    return { estado, registro, mundo, nucleo, r };
  }

  test('El telón no enseña la propagación', async () => {
    const { mundo, nucleo, r } = await conRumor();
    const p = pantalla(r.telon, 'rumor');

    // Se ve que algo ha salido del núcleo…
    assert.deepEqual(p.sale, { origen: nucleo });
    assert.deepEqual(Object.keys(p.sale), ['origen'], 'lo que se entrega para pintar lleva algo más que el núcleo de origen');
    // …y no se ve a qué núcleos llegará, ni cuándo, ni con qué nivel.
    for (const clave of ['destinos', 'saltos', 'nivel', 'arbol', 'calzadas', 'cuando']) {
      assert.equal(clave in p, false, `la pantalla del rumor lleva "${clave}"`);
    }
    const otros = arbolDeCalzadas(mundo).nucleos.filter((n) => n !== nucleo);
    for (const texto of [p.titular, p.consecuencia, p.espera, p.rotulo]) {
      assert.deepEqual(
        [...infraccionesDePropagacion(texto, { origen: nucleo, nucleos: otros })],
        [],
        `"${texto}" enseña la propagación`,
      );
    }
    assert.ok(VOCABULARIO_DE_PROPAGACION.includes('nivel'));
  });

  test('El rumor recién nacido tiene nivel cero en el estado y ninguna proyección lo lleva dentro', async () => {
    const { estado, nucleo, r } = await conRumor();
    const version = loQueSeCuentaEn(estado.nucleos, { mapaId: MAPA, nucleo }).find((v) => v.rumor === r.rumor.id);
    assert.ok(version, 'el rumor no ha sedimentado en su núcleo de origen');
    assert.equal(version.nivel, 0);
    assert.doesNotMatch(JSON.stringify(pantalla(r.telon, 'rumor')), /nivel/i, 'la pantalla del rumor lleva el nivel dentro');
    assert.equal('nivel' in (r.rumor ?? {}), false);
  });

  test('El rumor nace igual con la misma semilla y el mismo mundo', async () => {
    // Bloqueante, @determinismo, RNF-DET-003.
    const uno = await conRumor();
    const otro = await conRumor();
    assert.deepEqual(otro.r.rumor, uno.r.rumor);
    assert.deepEqual(JSON.parse(JSON.stringify(otro.r.telon)), JSON.parse(JSON.stringify(uno.r.telon)));
  });
});

// ── La entrada del día ─────────────────────────────────────────────────────────

describe('La entrada del día', () => {
  test('Todo telón cierra con una entrada del diario, y el telón sin ella falla', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida();
    const r = cierra(estado, registro, { mundo, lugar: nucleo });

    const ultima = r.telon.pantallas[r.telon.pantallas.length - 1];
    assert.equal(ultima.estado, 'diario');
    assert.equal(ultima.entrada, r.entrada);
    assert.equal(entradasDe(estado.diario).length, 1);
    assert.equal(entradasDe(estado.diario)[0].clase, CLASES_DE_ENTRADA.PROPIO);
    assert.deepEqual([...ultima.acciones], [TEXTOS.verElDiarioEntero, TEXTOS.cerrar]);
    assert.throws(() => componeElTelon({ mapaId: MAPA, dia: DIA }), /entrada del diario/);
  });

  test('Lo propio va en primera persona y lo oído aparte, entrecomillado y con otra autoridad', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida({ aventura: 'a1' });
    const c = recorre(estado, registro, unaCasteada(mundo));

    // Algo oído por el camino, apuntado el mismo día.
    dondeTeCuentan(estado, { mundo, nucleo, origen: nucleo, nivel: 2 });
    apuntaLoQueSeCuenta({
      diario: estado.diario,
      versiones: loQueSeCuentaEn(estado.nucleos, { mapaId: MAPA, nucleo }),
      mapaId: MAPA, nucleo, dia: DIA, paso: 3,
    });

    const r = cierra(estado, registro, {
      mundo, lugar: nucleo,
      aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      desenlace: desenlaceEn(nucleo), repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
    });
    const p = pantalla(r.telon, 'diario');

    assert.match(p.propio.texto, /^Hoy salí/, 'lo propio no va en primera persona');
    assert.equal(p.propio.autoridad, AUTORIDADES['lo-propio']);
    assert.ok(p.oido.length, 'lo oído no ha llegado a la hoja de hoy');
    for (const oido of p.oido) {
      assert.equal(oido.autoridad, AUTORIDADES['lo-oido']);
      assert.notEqual(oido.autoridad, p.propio.autoridad, 'lo hecho y lo contado declaran la misma autoridad');
      // Y el nivel de deformación no aparece: el diario registra lo oído, no lo cierto.
      assert.equal('nivel' in oido, false);
    }
    assert.equal(loPropioEnPrimeraPersona({ titulo: null }), 'Hoy salí a andar y volví por donde vine.');
    assert.match(loPropioEnPrimeraPersona({ titulo: 'X', cierreEnCorto: true }), /se resolvió sin mí/);
  });

  test('Conviven la versión oída y la propia sin marcar ninguna como la correcta', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida();

    dondeTeCuentan(estado, { mundo, nucleo, origen: nucleo, nivel: 3 });
    apuntaLoQueSeCuenta({
      diario: estado.diario,
      versiones: loQueSeCuentaEn(estado.nucleos, { mapaId: MAPA, nucleo }),
      mapaId: MAPA, nucleo, dia: DIA, paso: 3,
    });
    cierra(estado, registro, { mundo, lugar: nucleo });

    const clases = entradasDe(estado.diario).map((e) => e.clase).sort();
    assert.deepEqual(clases, [CLASES_DE_ENTRADA.OIDO, CLASES_DE_ENTRADA.PROPIO], 'una versión ha pisado a la otra');
    for (const entrada of entradasDe(estado.diario)) {
      for (const clave of ['correcta', 'fiel', 'verdadera', 'buena']) {
        assert.equal(clave in entrada, false, `una entrada del diario se marca como "${clave}"`);
      }
    }
  });

  test('Un paseo sin nada oído ni hecho tiene entrada igual, y dice lo andado sin cifras', () => {
    const { estado, registro } = partida();
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena() });
    const p = pantalla(r.telon, 'diario');

    assert.equal(p.titulo, TEXTOS.tituloDelDiaSinAventura);
    assert.deepEqual([...p.oido], []);
    assert.ok(p.propio.texto);
    assert.doesNotMatch(p.propio.texto, /\d/, 'la entrada del día lleva una cifra');
    assert.equal(entradasDe(estado.diario).length, 1, 'un día sin hoja sería un día que no pasó');
  });

  test('La entrada del día está en el diario entero, en el día que corresponde', () => {
    const { estado, registro } = partida();
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena(), dia: 41 });
    const proyectado = proyeccionPorDias(estado.diario).filter((e) => e.dia === 41);
    assert.equal(proyectado.length, 1);
    assert.equal(proyectado[0].id, r.entrada);
    assert.equal(entradasDeSuceso(estado.diario, { suceso: 'salida:s1' }).length, 1);
  });

  test('La clase lo propio la escribe esta capa y solo esta', () => {
    // La hoja de hoy sale de `hojaDelDia` y su hecho es la inversa exacta.
    const hoja = hojaDelDia({ mapaId: MAPA, hoja: 'salida:s1', asunto: 'a1', lugar: 'Albariza', dia: DIA, paso: 4 });
    assert.equal(hoja.clase, CLASES_DE_ENTRADA.PROPIO);
    assert.equal(hoja.nivel, 0);
    const vuelta = hojaDeHecho(hechoDeHoja(hoja));
    assert.deepEqual(JSON.parse(JSON.stringify(vuelta)), JSON.parse(JSON.stringify(hoja)));
    assert.equal(hechoDeHoja(hoja).tipo, 'hoja-propia');
    assert.ok(TIPOS_DE_HECHO.includes('hoja-propia'));

    // Y nadie más escribe la clase: solo el telón la nombra al construir una entrada.
    const escriben = [
      'packages/nucleo/partida/telon.js',
      'packages/nucleo/partida/diario.js',
      'packages/nucleo/partida/reconstruccion.js',
      'packages/nucleo/partida/cierre-de-salida.js',
      'packages/nucleo/partida/npcs.js',
      'packages/nucleo/partida/rumores.js',
    ].filter((m) => /CLASES_DE_ENTRADA\.PROPIO/.test(fuente(m)));
    assert.deepEqual(escriben, ['packages/nucleo/partida/telon.js'], 'la clase «lo propio» la escribe alguien más');
  });
});

// ── El hito de fin de arranque (RF-DIARIO-006, ⚠ sin escenario) ────────────────

describe('El hito de fin de arranque', () => {
  function conHito({ nucleo = 'Dorna' } = {}) {
    const mundo = mundoDeLaCadena();
    const { estado, registro } = partida();
    dondeTeCuentan(estado, { mundo, nucleo });
    return { estado, registro, mundo, nucleo };
  }

  test('La cartela del hito aparece al llegar al núcleo donde lo que se cuenta eres tú', () => {
    const { estado, registro, mundo, nucleo } = conHito();
    const r = cierra(estado, registro, { mundo, nucleo });

    assert.equal(r.hito, true);
    assert.ok(r.telon.hito, 'no hay cartela del hito');
    assert.equal(r.telon.hito.cartela, TEXTOS.hitoCartela);
    assert.deepEqual([...r.telon.hito.entre], ['desenlace', 'diario']);
    assert.deepEqual([...r.telon.hito.acciones], [], 'la cartela pide algo');
    assert.equal(estado.arranque.abierto, false);
    assert.equal(estado.arranque.marcado, true);
    // Y deja su hecho, que es lo que hace que no vuelva.
    assert.ok(hechosDe(registro).some((h) => h.tipo === 'arranque-cerrado'), 'el hito no ha dejado hecho');
  });

  test('La cartela no vuelve a aparecer en veinte salidas más', () => {
    const { estado, registro, mundo, nucleo } = conHito();
    cierra(estado, registro, { mundo, nucleo });

    for (let i = 2; i <= 21; i++) {
      abreSalida(estado.aventuras, { salida: `s${i}`, mapaId: MAPA });
      const r = cierra(estado, registro, { mundo, nucleo, salida: `s${i}`, dia: DIA + i });
      assert.equal(r.hito, false, `la cartela ha vuelto en la salida ${i}`);
      assert.equal(r.telon.hito, null);
    }
    assert.equal(hechosDe(registro).filter((h) => h.tipo === 'arranque-cerrado').length, 1);
  });

  test('Los textos del hito no usan las palabras de la escalera de logro, y uno que las usara falla', () => {
    for (const clave of ['hitoCartela', 'hitoRemate']) {
      assert.deepEqual([...infraccionesDeLogro(TEXTOS[clave])], [], `el texto "${clave}" del hito habla como un logro`);
    }
    for (const palabra of ['tutorial', 'completado', 'nivel', 'logro', 'desbloqueado', 'enhorabuena', 'dominas', 'aprendiste']) {
      assert.ok(VOCABULARIO_DE_LOGRO.includes(palabra), `el vocabulario de logro no trae "${palabra}"`);
    }
    const malo = 'Enhorabuena: has completado el tutorial';
    assert.throws(
      () => exigeSinLogro(malo, 'la cartela del hito'),
      (e) => e.message.includes(malo) && e.message.includes('la cartela del hito'),
    );
  });

  test('La cartela dice que el mundo cambió y no que quien juega aprobó', () => {
    const texto = `${TEXTOS.hitoCartela} ${TEXTOS.hitoRemate}`;
    assert.match(texto, /cuenta|hablar/i, 'la cartela no dice que el mundo hable de ti');
    for (const patron of [/has\s+(conseguido|logrado|superado|aprobado)/i, /ya\s+sabes\s+jugar/i, /\bbien hecho\b/i]) {
      assert.doesNotMatch(texto, patron, `la cartela felicita a quien juega (${patron})`);
    }
  });

  test('Un hito que coincide con una salida cerrada en corto aparece igual', async () => {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[1];
    const { estado, registro } = partida({ aventura: 'a1' });
    dondeTeCuentan(estado, { mundo, nucleo, origen: arbolDeCalzadas(mundo).nucleos[0] });
    const c = unaCasteada(mundo, (x) => x.beats.length > 1);
    recorre(estado, registro, c, { hastaBeat: 0 });

    const r = cierra(estado, registro, {
      mundo, lugar: nucleo, nucleo,
      aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
      repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
    });

    assert.equal(r.aventura.comoAcabo, 'a-medias');
    assert.equal(r.hito, true, 'el hito no ha aparecido con un cierre en corto');
    assert.ok(r.telon.hito);
  });

  test('El arranque cerrado sigue cerrado al reconstruir la partida desde el registro', () => {
    const { estado, registro, mundo, nucleo } = conHito();
    cierra(estado, registro, { mundo, nucleo });

    const vuelta = reconstruye({ registro, semilla: estado.semilla });
    assert.equal(vuelta.estado.arranque.abierto, false);
    assert.equal(vuelta.estado.arranque.marcado, true, 'la partida reconstruida volvería a enseñar la cartela');
    assert.equal(vuelta.estado.arranque.cerradoPor, estado.arranque.cerradoPor);
  });

  test('Sin arranque cerrado no aparece ninguna cartela ni ninguna insinuación de que falte algo', () => {
    const { estado, registro } = partida();
    const r = cierra(estado, registro, { mundo: mundoDeLaCadena(), nucleo: 'Dorna' });

    assert.equal(r.hito, false);
    assert.equal(r.telon.hito, null);
    assert.equal(estado.arranque.abierto, true, 'el arranque se ha cerrado sin que nadie cuente nada tuyo');
    assert.deepEqual(estadoDeArranque().marcado, false);
    for (const patron of [/te falta/i, /todavía no/i, /pronto/i, /aún no has/i]) {
      assert.doesNotMatch(JSON.stringify(r.telon), patron, `el telón insinúa que falta algo por llegar (${patron})`);
    }
  });
});

// ── El cierre es a todo o nada ─────────────────────────────────────────────────

describe('El cierre es a todo o nada', () => {
  async function listoParaCerrar() {
    const mundo = await mundoDe();
    const nucleo = arbolDeCalzadas(mundo).nucleos[0];
    const { estado, registro } = partida({ aventura: 'a1' });
    const c = recorre(estado, registro, unaCasteada(mundo));
    const libro = libroDePendientes();
    apuntaHaberEstado(libro, { familia: 'nucleo', id: nucleo });
    return {
      estado,
      registro,
      opciones: {
        mundo, lugar: nucleo, nucleo, pendientes: libro,
        aventura: { id: c.aventura.id, titulo: c.aventura.titulo },
        desenlace: desenlaceEn(nucleo, { objetos: [{ id: 'La llave del molino viejo', clase: 'llave' }] }),
        repuesto: plantillaDe(PLANTILLA_NOTABLE).repuesto,
      },
    };
  }

  test('Con una pieza que revienta, ni el estado ni el registro han cambiado', async () => {
    const { estado, registro, opciones } = await listoParaCerrar();
    const antesEstado = textoDeEstado(estado);
    const antesRegistro = JSON.stringify(hechosDe(registro));

    assert.throws(
      () => cierra(estado, registro, { ...opciones, piezas: { ...piezasDeSerie(), diario: () => { throw new Error('la máquina de escribir se ha roto'); } } }),
      /la máquina de escribir se ha roto/,
    );

    assert.equal(textoDeEstado(estado), antesEstado, 'un cierre que falló a mitad ha movido el estado');
    assert.equal(JSON.stringify(hechosDe(registro)), antesRegistro, 'un cierre que falló a mitad ha anexado hechos');
    assert.equal(saldoDe(estado.oro), 0);
    assert.deepEqual(congelaConocimiento(estado.conocimiento), { mapas: {} });
    assert.ok(salidaAbierta(estado.aventuras), 'la salida ha quedado cerrada tras un cierre fallido');
  });

  test('Sin cada una de las seis piezas, el cierre falla nombrándola', async () => {
    assert.deepEqual([...IDS_DE_PIEZA], ['conocimiento', 'diario', 'entregas', 'npcs', 'progresion', 'rumor']);
    for (const id of IDS_DE_PIEZA) {
      const { estado, registro, opciones } = await listoParaCerrar();
      const antes = textoDeEstado(estado);
      const piezas = { ...piezasDeSerie() };
      delete piezas[id];
      assert.throws(
        () => cierra(estado, registro, { ...opciones, piezas }),
        (e) => e.message.includes(PIEZAS_DEL_CIERRE[id]),
        `el cierre sin ${PIEZAS_DEL_CIERRE[id]} no ha fallado nombrando la pieza`,
      );
      assert.equal(textoDeEstado(estado), antes, `el cierre sin ${id} ha escrito algo`);
    }
  });

  test('Sin el calendario cableado, el cierre falla nombrando la pieza y no apunta el día cero', async () => {
    const { estado, registro, opciones } = await listoParaCerrar();
    const antes = textoDeEstado(estado);
    assert.throws(
      () => echaElTelon({ estado, registro, calendario: null, mapaId: MAPA, salida: 's1', paso: 5, idioma: IDIOMA, piezas: piezasDeSerie(), ...opciones }),
      (e) => /calendario de la partida/.test(e.message),
    );
    assert.equal(textoDeEstado(estado), antes);
    assert.equal(entradasDe(estado.diario).length, 0, 'ha apuntado la hoja del día cero');
  });

  test('El cierre recibe la aventura en curso con su declaración de cómo acabó, y no un booleano', async () => {
    const { estado, registro, opciones } = await listoParaCerrar();
    assert.throws(
      () => cierra(estado, registro, { ...opciones, aventura: true }),
      (e) => /booleano/.test(e.message) && /terminada/.test(e.message),
    );
    const r = cierra(estado, registro, opciones);
    assert.equal(typeof r.aventura, 'object');
    assert.equal(r.aventura.comoAcabo, 'terminada');
    assert.ok(['terminada', 'a-medias'].includes(r.aventura.comoAcabo));
  });

  test('Los hechos de todas las áreas que tocó quedan anexados, y el estado va detrás del registro', async () => {
    const { estado, registro, opciones } = await listoParaCerrar();
    const r = cierra(estado, registro, opciones);

    const tipos = hechosDe(registro).map((h) => h.tipo);
    for (const tipo of ['conocimiento-subido', 'aventura-cerrada', 'objeto-obtenido', 'hoja-propia']) {
      assert.ok(tipos.includes(tipo), `el cierre no ha dejado el hecho "${tipo}"`);
    }
    assert.equal(r.hechos, hechosDe(registro).length - 1, 'los hechos del cierre no están todos anexados');
    // La marca de aplicación apunta al último hecho anexado: el estado va detrás.
    assert.equal(estado.aplicadoHasta, hechosDe(registro).length - 1);
  });

  test('Una partida cerrada se congela y se levanta con el conocimiento idéntico, elemento a elemento', async () => {
    const { estado, registro, opciones } = await listoParaCerrar();
    cierra(estado, registro, opciones);

    const vuelta = levantaEstado(JSON.parse(JSON.stringify(congelaEstado(estado))));
    assert.deepEqual(congelaConocimiento(vuelta.conocimiento), congelaConocimiento(estado.conocimiento));
    assert.ok(Object.keys(congelaConocimiento(estado.conocimiento).mapas[MAPA]).length, 'no se guardó ningún ascenso: el caso sería vacío');
    assert.ok(IDS_DE_AREA.includes('conocimiento'));
    assert.ok(AREAS_CON_ESTADO.includes('conocimiento'));
  });

  test('El conocimiento se reproduce desde el registro en lugar de declararse no reproducible', async () => {
    const { estado, registro, opciones } = await listoParaCerrar();
    cierra(estado, registro, opciones);

    const vuelta = reconstruye({ registro, semilla: estado.semilla });
    assert.deepEqual(congelaConocimiento(vuelta.estado.conocimiento), congelaConocimiento(estado.conocimiento));
    assert.ok(vuelta.areas.reproducidas.includes('conocimiento'), 'el conocimiento no se ha reproducido');
  });

  test('Dos partidas con la misma semilla y las mismas entradas cierran idénticas byte a byte', async () => {
    // Bloqueante, @determinismo, RNF-DET-003.
    const uno = await listoParaCerrar();
    const otro = await listoParaCerrar();
    const a = cierra(uno.estado, uno.registro, uno.opciones);
    const b = cierra(otro.estado, otro.registro, otro.opciones);

    assert.equal(textoDeEstado(otro.estado), textoDeEstado(uno.estado));
    assert.deepEqual(JSON.parse(JSON.stringify(hechosDe(otro.registro))), JSON.parse(JSON.stringify(hechosDe(uno.registro))));
    assert.deepEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(a)));

    // Y con otra semilla, el estado no es el mismo: la comparación no es vacía.
    const distinto = partida({ semilla: SEMILLA_B });
    assert.notEqual(textoDeEstado(distinto.estado), textoDeEstado(uno.estado));
  });
});

// ── La capa de conocimiento por dentro ─────────────────────────────────────────

describe('La capa de conocimiento no toca la tubería', () => {
  test('El libro de pendientes vive fuera del estado y apuntar dos veces deja una anotación', () => {
    const libro = libroDePendientes();
    apuntaHaberEstado(libro, { familia: 'nucleo', id: 'Dorna' });
    apuntaHaberEstado(libro, { familia: 'nucleo', id: 'Dorna' });
    const estado = estadoDeConocimiento();
    const plan = planDeEntintado(estado, { mapaId: MAPA, libro });
    assert.equal(plan.ascensos.length, 1, 'dar dos vueltas al mismo sitio en la misma salida es volver otro día');
    assert.deepEqual(congelaConocimiento(estado).mapas[MAPA] ?? {}, {}, 'planear el entintado ha escrito un ascenso en el estado');
    assert.deepEqual(aplicaElEntintado(estado, { mapaId: MAPA, libro }).map((a) => a.clave), ['nucleo:Dorna']);
  });

  test('El módulo no importa ninguna fase de generación y no puede resembrar nada', () => {
    const importados = [...fuente('packages/nucleo/partida/conocimiento.js').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const ruta of importados) {
      assert.doesNotMatch(ruta, /world\//, `la capa de conocimiento importa la tubería (${ruta})`);
      assert.doesNotMatch(ruta, /rng/, `la capa de conocimiento importa el azar (${ruta})`);
    }
  });

  test('Un hecho de conocimiento reproducido dos veces o en desorden deja el escalón más alto', () => {
    const estado = estadoDeConocimiento();
    subeA(estado, { mapaId: MAPA, clave: 'nucleo:Dorna', escalon: 'lo-conoces-bien' });
    subeA(estado, { mapaId: MAPA, clave: 'nucleo:Dorna', escalon: 'lo-conoces' });
    assert.equal(nivelDe(estado, { mapaId: MAPA, clave: 'nucleo:Dorna' }), 'lo-conoces-bien', 'un hecho en desorden ha bajado un nivel');
  });
});
