// SPEC-042 · El zurrón (A2P2): si hay algo que contar, qué se cuenta, cómo se redacta en
//            una sola llamada y el vaciado que ocurre al leerlo.
//
// Casi todo lo de esta fila se afirma aquí y no en `test/app/`, y no es una comodidad: es
// el reparto que la propia spec eligió. Si hay zurrón o no, cuántas entradas trae, su
// orden, el tope de cinco, la caída a plantilla, que la llamada sea **una y no cinco** y
// que la reserva se vacíe con su hecho y entera son propiedades de datos, y una propiedad
// de datos que solo se pudiera leer en un simulador no se pondría roja nunca. Lo único que
// necesita dispositivo —que el permiso se pida en contexto y que el interruptor refleje una
// revocación hecha desde fuera— vive en `test/app/zurron.yaml`.
//
// Los casos con nombre de escenario son los de `docs/testing.md`, literales: «El zurrón
// solo aparece si hay reserva que vaciar», «Sin cobertura, la preparación dice lo mismo»,
// «Sin red, la aventura funciona entera» y «Sedimentar no se reprocha». El resto va marcado
// como hueco de la batería en `test/spec-test-map.json`, porque la propia spec declara en
// su sección de huecos que el zurrón cerrado a medias y la reserva con pasos y sin nada que
// contar no tienen escenario — y son justo los dos casos que deciden si lo único que el
// mundo hizo en ausencia de quien juega se pierde en silencio.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema: el mundo sale de los fixtures
// congelados, el narrador es un doble que cuenta sus llamadas y la espera se inyecta.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCIONES,
  CAMPOS_DE_SITIO,
  CLAVES_SIN_ZURRON,
  MOMENTO,
  MOTIVOS_SIN_ZURRON,
  PANTALLA,
  PLANTILLAS_DE_ENTRADA,
  TESTIDS,
  TIPOS_NARRABLES,
  TOPE_DE_ENTRADAS,
  abreElZurron,
  claveDeEntrada,
  componeElZurron,
  decideElZurron,
  entradaDelPaso,
  entradasDeLaReserva,
  esNarrable,
  esqueletoDelZurron,
  sitioDelEfecto,
  textoDePlantilla,
  vaciaElZurron,
} from '../../packages/nucleo/partida/zurron.js';
import { TOPE_DE_RESERVA, kilometrosDeFondo, tamanoDeLaReserva } from '../../packages/nucleo/partida/kilometros.js';
import { creaMotorDePasos, estadoDeMapa, estadoDePasos } from '../../packages/nucleo/partida/pasos.js';
import { TIPOS_DE_EFECTO } from '../../packages/nucleo/partida/efectos.js';
import { anexa, hechosDe, registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { FALLBACK_DEL_ZURRON } from '../../packages/nucleo/quests/narrador.js';
import { PANTALLAS, guionDePantalla, textoDelGuion } from '../../packages/nucleo/partida/guion-de-antes-de-salir.js';
import { REGISTROS, cifrasDeTexto } from '../../packages/nucleo/partida/guion-de-arranque.js';
import { infraccionesDeReproche } from '../../packages/nucleo/quests/escena.js';
import { creaZurron, DEL_NUCLEO } from '../../app/salida/zurron.js';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';

const MAPA = '42.40,-8.81';

/** La espera inyectada que **nunca vence**: gana siempre la llamada y no hay reloj de por medio. */
const NUNCA_VENCE = () => ({ promesa: new Promise(() => {}), cancela: () => {} });

let MUNDO = null;
async function mundoDePrueba() {
  if (!MUNDO) MUNDO = await generaMundo('costero', semillaDe('costero', '1'));
  return MUNDO;
}

/** Un paso ya ejecutado, de los que la reserva guarda: número y lo que produjo. */
const paso = (n, efectos) => ({ n, efectos });

/** Los cinco pasos de una reserva llena, cada uno con algo que contar y en su propio sitio. */
const RESERVA_LLENA = [
  paso(11, [{ tipo: 'rumor', nucleo: 'Monfrida', asunto: 'una barca que volvió sola' }]),
  paso(12, [{ tipo: 'oportunidad', asunto: 'un tejado por rematar', lugar: 'A Fonte' }]),
  paso(13, [{ tipo: 'razon-para-volver', lugar: 'O Cruceiro' }]),
  paso(14, [{ tipo: 'rumor', nucleo: 'Vilanova', asunto: 'una feria adelantada' }]),
  paso(15, [{ tipo: 'oportunidad', asunto: 'unas redes sin remendar', lugar: 'Monfrida' }]),
];

/** Un narrador que cuenta sus llamadas y responde a todos los huecos que se le piden. */
function narradorEspia({ responde = null, falla = false } = {}) {
  const peticiones = [];
  return {
    peticiones: () => peticiones,
    llamadas: () => peticiones.length,
    llamada: async (peticion) => {
      peticiones.push(peticion);
      if (falla) throw new Error('el proxy no responde');
      const claves = (peticion.huecos ?? peticion.sobre?.huecos ?? []).map((h) => h.clave);
      const textos = {};
      for (const clave of claves) {
        const texto = responde ? responde(clave) : `Por los caminos se cuenta lo de ${clave}, sin prisa y sin queja.`;
        if (texto !== null) textos[clave] = texto;
      }
      return { textos };
    },
  };
}

/** Un motor de pasos con un productor que siembra un rumor por paso, como el de SPEC-011. */
function motorDe({ estado = estadoDePasos(), mapaId = MAPA } = {}) {
  return creaMotorDePasos({
    semilla: SEMILLA_A,
    mapaId,
    estado,
    productores: [{
      id: 'rumores',
      produce: (n) => [{ tipo: 'rumor', nucleo: `Monfrida`, asunto: `lo del paso ${n}` }],
    }],
  });
}

/** Un motor cuyos pasos **no producen nada narrable**: el caso de la reserva vacía de noticias. */
function motorMudo({ estado = estadoDePasos(), mapaId = MAPA } = {}) {
  return creaMotorDePasos({ semilla: SEMILLA_A, mapaId, estado, productores: [] });
}

/** El código de un módulo sin sus comentarios: varias afirmaciones de esta fila son negativas. */
function codigoDe(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

// ── Si hay zurrón y si no, por qué ──────────────────────────────────────────────

describe('Si hay zurrón y, si no, por qué', () => {
  test('El zurrón solo aparece si hay reserva que vaciar', async () => {
    // La mitad que faltaba: SPEC-018 sostenía «sin reserva no se llama a nadie» y la
    // portada sostenía la puerta; lo que decide de verdad si la pantalla existe es esto.
    const apagado = decideElZurron({ modoDeFondo: false, reserva: RESERVA_LLENA });
    assert.equal(apagado.hay, false);
    assert.equal(apagado.motivo, MOTIVOS_SIN_ZURRON.MODO_APAGADO);
    assert.deepEqual([...apagado.entradas], []);
    assert.equal(apagado.vaciar, false, 'con el modo apagado la reserva se queda como estaba, sin borrarse ni ejecutarse');

    const vacia = decideElZurron({ modoDeFondo: true, reserva: [] });
    assert.equal(vacia.hay, false);
    assert.equal(vacia.motivo, MOTIVOS_SIN_ZURRON.RESERVA_VACIA);
    assert.equal(vacia.vaciar, false, 'una reserva vacía no tiene nada que vaciar');

    // Y de origen, sin decir nada: el modo viene apagado, así que la pantalla no existe.
    assert.equal(decideElZurron().hay, false);
    assert.equal(decideElZurron().motivo, MOTIVOS_SIN_ZURRON.MODO_APAGADO);

    // Las dos condiciones a la vez, y entonces sí.
    const hay = decideElZurron({ modoDeFondo: true, reserva: RESERVA_LLENA });
    assert.equal(hay.hay, true);
    assert.equal(hay.motivo, null);
    assert.equal(hay.entradas.length, 5);

    // Y no se llama a nadie en ninguno de los dos casos en que no hay pantalla.
    const mundo = await mundoDePrueba();
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      for (const caso of [{ modoDeFondo: false, reserva: RESERVA_LLENA }, { modoDeFondo: true, reserva: [] }]) {
        const espia = narradorEspia();
        const abierto = await abreElZurron({ mundo, ...caso, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: espia.llamada });
        assert.equal(abierto.hay, false);
        assert.equal(abierto.zurron, null, 'no hay pantalla es distinto de una pantalla vacía');
        assert.equal(abierto.llamo, false);
        assert.equal(espia.llamadas(), 0, 'se ha llamado al modelo sin nada que contar');
      }
      assert.deepEqual(inspector.peticiones(), [], 'sin zurrón ha salido tráfico del móvil');
    } finally {
      inspector.suelta();
    }
  });

  test('Una reserva con pasos que no produjeron nada se vacía sin pantalla y sin llamada', async () => {
    // La decisión más discutible de la fila, y la que menos escenario tiene: un paso
    // *puede* crear un rumor, no siempre lo hace, y cinco pasos vacíos no son una pantalla.
    const reserva = [paso(1, []), paso(2, [{ tipo: 'rumor', asunto: 'algo sin sitio que nombrar' }])];
    const decision = decideElZurron({ modoDeFondo: true, reserva });
    assert.equal(decision.hay, false);
    assert.equal(decision.motivo, MOTIVOS_SIN_ZURRON.NADA_QUE_CONTAR);
    assert.equal(decision.vaciar, true, 'sin vaciar, el tope de cinco quedaría bloqueado para siempre');

    const mundo = await mundoDePrueba();
    const espia = narradorEspia();
    const abierto = await abreElZurron({ mundo, modoDeFondo: true, reserva, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: espia.llamada });
    assert.equal(abierto.hay, false);
    assert.equal(abierto.vaciar, true);
    assert.equal(espia.llamadas(), 0, 'una pantalla que dice que no pasó nada es peor que ninguna, y además gasta una llamada');

    // Y componerla es un error que dice por qué, en vez de devolver una pantalla vacía.
    assert.throws(() => componeElZurron({ decision }), /no pasó nada/);
    assert.throws(() => componeElZurron({ decision: null }), /no llegó ninguna decisión/);
  });

  test('Los motivos de que no haya zurrón son tres y están enumerados', () => {
    assert.deepEqual([...CLAVES_SIN_ZURRON], ['modo-apagado', 'reserva-vacia', 'nada-que-contar']);
    // Enumerarlos es lo que separa «no aparece porque no hay nada» de «no aparece porque
    // nadie lo cableó», que es la forma de fallo que este repo ya ha pagado.
    for (const clave of CLAVES_SIN_ZURRON) assert.equal(typeof clave, 'string');
  });

  test('El núcleo recibe si el modo está activo como dato de la partida', () => {
    // «Lo recibe como dato de la partida y no consulta ninguna capa de la plataforma» se
    // mecaniza por los dos lados: un valor que no sea booleano falla nombrándolo, y el
    // módulo no importa nada de la plataforma ni sabe qué es un permiso.
    for (const mal of [null, undefined, 'sí', 1, {}]) {
      if (mal === undefined) continue;
      assert.throws(() => decideElZurron({ modoDeFondo: mal, reserva: [] }), /modo de pasos de fondo/);
    }
    const codigo = codigoDe('packages/nucleo/partida/zurron.js');
    for (const prohibido of ['permiso', 'salud', 'HealthKit', 'navigator', 'process.env']) {
      assert.equal(codigo.includes(prohibido), false, `el zurrón del núcleo nombra "${prohibido}"`);
    }
    for (const linea of fuente('packages/nucleo/partida/zurron.js').split('\n')) {
      const m = linea.match(/^import .* from '([^']+)'/);
      if (m) assert.ok(m[1].startsWith('..') || m[1].startsWith('./'), `el zurrón importa "${m[1]}", que no es del paquete`);
    }
  });
});

// ── De la reserva a las entradas ────────────────────────────────────────────────

describe('De la reserva a las entradas', () => {
  test('Las entradas salen en el orden en que se ejecutaron sus pasos', () => {
    const entradas = entradasDeLaReserva(RESERVA_LLENA);
    assert.deepEqual(entradas.map((e) => e.paso), [11, 12, 13, 14, 15]);
    // Y el orden es el de la reserva, no el de los tipos ni el de los sitios: una reserva
    // que llegó en otro orden se cuenta en ese otro orden.
    const alReves = entradasDeLaReserva([...RESERVA_LLENA].reverse());
    assert.deepEqual(alReves.map((e) => e.paso), [15, 14, 13, 12, 11]);
  });

  test('El zurrón trae como mucho cinco entradas, y el número sale del tope de la reserva', () => {
    assert.equal(TOPE_DE_ENTRADAS, TOPE_DE_RESERVA, 'el tope del zurrón no puede tener número propio');
    assert.equal(TOPE_DE_ENTRADAS, 5);
    assert.equal(entradasDeLaReserva(RESERVA_LLENA).length, 5);

    // Una reserva por encima del tope significa que alguien la llenó sin pasar por el
    // motor, y eso se dice en lugar de recortarla en silencio.
    assert.throws(() => entradasDeLaReserva([...RESERVA_LLENA, paso(16, [])]), /tope es 5/);
    assert.throws(() => entradasDeLaReserva('la reserva'), /lista de pasos sin narrar/);
    assert.throws(() => entradaDelPaso({ efectos: [] }), /paso ejecutado/);
  });

  test('Una entrada por paso, y no una por efecto', () => {
    // Con una entrada por efecto, cinco pasos podrían dar quince y el resumen dejaría de
    // caber. Lo que no cabe no se pierde: sigue sedimentado en su núcleo.
    const conTres = paso(7, [
      { tipo: 'rumor', nucleo: 'Monfrida', asunto: 'la primera' },
      { tipo: 'oportunidad', asunto: 'la segunda', lugar: 'A Fonte' },
      { tipo: 'razon-para-volver', lugar: 'O Cruceiro' },
    ]);
    const entradas = entradasDeLaReserva([conTres]);
    assert.equal(entradas.length, 1);
    assert.equal(entradas[0].sitio, 'Monfrida', 'la entrada sale del primero en el orden en que el motor los produjo');
  });

  test('Un efecto que no nombra ningún sitio no produce entrada', () => {
    // La entrada dice dónde ocurrió y qué ocurrió; una sin dónde no es una entrada a
    // medias, es otra cosa. Y el sitio se busca por los campos declarados, en orden.
    assert.deepEqual([...CAMPOS_DE_SITIO], ['nucleo', 'lugar', 'origen']);
    assert.equal(sitioDelEfecto({ tipo: 'rumor', asunto: 'sin sitio' }), null);
    assert.equal(sitioDelEfecto({ tipo: 'oportunidad', lugar: 'A Fonte', origen: 'Vilanova' }), 'A Fonte');
    assert.equal(esNarrable({ tipo: 'rumor', asunto: 'sin sitio' }), false);
    assert.equal(esNarrable({ tipo: 'invento', nucleo: 'Monfrida' }), false);
    assert.equal(entradaDelPaso(paso(3, [{ tipo: 'rumor', asunto: 'sin sitio' }])), null);
  });

  test('Cada entrada trae el texto de la plantilla que la generó', () => {
    // Es lo que hace que el zurrón se lea igual sin envoltorio redactado: lo único nuevo
    // es el marco, y las entradas vienen prestadas.
    assert.deepEqual([...TIPOS_NARRABLES], ['oportunidad', 'razon-para-volver', 'rumor']);
    for (const tipo of TIPOS_NARRABLES) {
      assert.ok(PLANTILLAS_DE_ENTRADA[tipo].con.includes('{asunto}'));
      assert.ok(PLANTILLAS_DE_ENTRADA[tipo].sin.trim().length > 0);
    }
    assert.equal(textoDePlantilla({ tipo: 'rumor', nucleo: 'Monfrida', asunto: 'una barca que volvió sola' }), 'Se habla de una barca que volvió sola.');
    // La variante sin asunto es un caso legítimo y no un hueco: `razon-para-volver` no lo exige.
    assert.equal(textoDePlantilla({ tipo: 'razon-para-volver', lugar: 'O Cruceiro' }), 'Quedó algo a medias.');
    // Y el sitio va aparte, en su rótulo: repetirlo en el cuerpo lo diría dos veces.
    for (const entrada of entradasDeLaReserva(RESERVA_LLENA)) {
      assert.equal(entrada.fallback.includes(entrada.sitio), false, `el texto de la entrada del paso ${entrada.paso} repite el sitio`);
      assert.equal(entrada.rotulo, `En ${entrada.sitio}`);
    }
  });

  test('Lo que viaja al narrador de cada entrada es inerte', () => {
    // Ni el nivel de deformación, ni el signo, ni el número del paso: el tipo abstracto,
    // el sitio y el asunto, que es lo que SPEC-018 declara inerte.
    const entrada = entradaDelPaso(paso(9, [{ tipo: 'rumor', nucleo: 'Monfrida', asunto: 'una barca', nivel: 3, signo: 'malo' }]));
    assert.deepEqual(Object.keys(entrada.hechos).sort(), ['asunto', 'sitio', 'tipo']);
    assert.equal(JSON.stringify(entrada.hechos).includes('9'), false, 'el número del paso viaja al narrador');
    assert.equal(JSON.stringify(entrada.hechos).includes('malo'), false, 'el signo viaja al narrador');
  });
});

// ── Cómo se redacta: una sola llamada agrupada ──────────────────────────────────

describe('La única llamada agrupada del zurrón', () => {
  test('El envoltorio y las cinco entradas se piden en una sola llamada', async () => {
    const mundo = await mundoDePrueba();
    const espia = narradorEspia();
    const abierto = await abreElZurron({
      mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: espia.llamada,
    });

    assert.equal(espia.llamadas(), 1, 'la llamada del zurrón es una y no una por entrada');
    assert.equal(abierto.llamo, true);
    // Y en esa única petición van los seis huecos: el envoltorio y las cinco entradas.
    const claves = espia.peticiones()[0].huecos.map((h) => h.clave);
    assert.deepEqual(claves, ['zurron', ...RESERVA_LLENA.map((_, i) => claveDeEntrada(i))]);
    assert.equal(claves.length, 6);
    assert.equal(claveDeEntrada(0), 'zurron:entrada:1');
  });

  test('El envoltorio que no se pudo redactar cae a plantilla y el resumen se lee igual', async () => {
    // Fallback **por entrada**: que un hueco no vuelva no arrastra a los demás.
    const mundo = await mundoDePrueba();
    const espia = narradorEspia({ responde: (clave) => (clave === 'zurron' ? null : 'Por el camino se cuenta que la feria se adelantó este año.') });
    const abierto = await abreElZurron({
      mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: espia.llamada,
    });

    assert.equal(abierto.zurron.envoltorio.origen, 'plantilla');
    assert.equal(abierto.zurron.envoltorio.texto, FALLBACK_DEL_ZURRON);
    for (const entrada of abierto.zurron.entradas) {
      assert.equal(entrada.origen, 'llm', `la entrada del paso ${entrada.paso} no adoptó el texto redactado`);
    }
  });

  test('Sin red, la aventura funciona entera', async () => {
    // Aplicado al zurrón: la llamada se cae entera y la pantalla aparece igual, con el
    // envoltorio de plantilla y las entradas de plantilla.
    const mundo = await mundoDePrueba();
    const espia = narradorEspia({ falla: true });
    const abierto = await abreElZurron({
      mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: espia.llamada,
    });

    assert.equal(abierto.hay, true, 'sin cobertura el zurrón tiene que aparecer igual');
    assert.equal(abierto.zurron.envoltorio.texto, FALLBACK_DEL_ZURRON);
    assert.equal(abierto.zurron.envoltorio.origen, 'plantilla');
    assert.equal(abierto.zurron.entradas.length, 5);
    for (const entrada of abierto.zurron.entradas) assert.equal(entrada.origen, 'plantilla');
  });

  test('Sin cobertura, la preparación dice lo mismo', async () => {
    // En lo que toca al zurrón: sin narrador y con narrador caído dice exactamente lo
    // mismo, y **ninguna pantalla menciona la red**.
    const mundo = await mundoDePrueba();
    const sinNada = await abreElZurron({ mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE });
    const caido = await abreElZurron({
      mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: narradorEspia({ falla: true }).llamada,
    });
    assert.equal(JSON.stringify(sinNada.zurron), JSON.stringify(caido.zurron), 'sin llamada y con la llamada caída el zurrón no dice lo mismo');

    const dicho = [
      sinNada.zurron.rotulo,
      sinNada.zurron.envoltorio.texto,
      sinNada.zurron.cierre,
      sinNada.zurron.accion.texto,
      ...sinNada.zurron.entradas.flatMap((e) => [e.rotulo, e.texto]),
    ].join(' ');
    for (const patron of [/cobertura/i, /conexión/i, /red\b/i, /internet/i, /reintent/i, /error/i, /sin datos/i]) {
      assert.equal(patron.test(dicho), false, `el zurrón menciona la red: ${patron}`);
    }
  });
});

// ── Lo que la pantalla dice y lo que no ─────────────────────────────────────────

describe('Lo que el zurrón dice y lo que no', () => {
  let compuesto = null;
  const del = async () => {
    if (!compuesto) {
      const mundo = await mundoDePrueba();
      compuesto = (await abreElZurron({ mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE })).zurron;
    }
    return compuesto;
  };

  test('El zurrón no enseña ninguna cifra', async () => {
    const zurron = await del();
    const textos = [zurron.rotulo, zurron.envoltorio.texto, zurron.cierre, zurron.accion.texto, ...zurron.entradas.flatMap((e) => [e.rotulo, e.texto])];
    for (const texto of textos) {
      assert.deepEqual(cifrasDeTexto(texto), [], `el zurrón enseña una cifra: «${texto}»`);
    }
    // Ni un indicador de cuántas entradas quedan: el número del paso viaja como dato y no
    // sale a pantalla, que es lo que lo hace localizable sin pintar nada.
    assert.equal(JSON.stringify(textos).includes(String(zurron.entradas[0].paso)), false);
  });

  test('Sedimentar no se reprocha', async () => {
    // Ninguna entrada reprocha nada ni dice lo que quien juega se ha perdido: el mundo
    // hizo lo suyo, tú no estabas y no pasa nada.
    const zurron = await del();
    for (const texto of [zurron.rotulo, zurron.envoltorio.texto, zurron.cierre, ...zurron.entradas.map((e) => e.texto)]) {
      assert.deepEqual(infraccionesDeReproche(texto), [], `el zurrón reprocha: «${texto}»`);
    }
    for (const tipo of TIPOS_NARRABLES) {
      for (const cual of ['con', 'sin']) {
        assert.deepEqual(infraccionesDeReproche(PLANTILLAS_DE_ENTRADA[tipo][cual]), []);
      }
    }
  });

  test('El zurrón tiene una sola acción, la que lo cierra', async () => {
    const zurron = await del();
    assert.deepEqual([...ACCIONES], ['zurron-seguir']);
    assert.equal(zurron.accion.id, 'zurron-seguir');
    assert.equal(zurron.accion.testid, TESTIDS.seguir);
    assert.equal(zurron.accion.texto, 'Seguir');
    // Con cinco entradas como mucho, un botón de saltar solo serviría para que nadie lo lea.
    assert.equal(ACCIONES.length, 1);
  });

  test('Ninguna entrada del zurrón se puede tocar', async () => {
    const zurron = await del();
    for (const entrada of zurron.entradas) {
      assert.equal(entrada.tocable, false, `la entrada del paso ${entrada.paso} es tocable`);
      assert.equal(entrada.testid, TESTIDS.entrada);
    }
  });

  test('El zurrón habla en la voz del mundo y se monta en su momento', async () => {
    const zurron = await del();
    assert.equal(zurron.registro, REGISTROS.MUNDO, 'aquí no habla la aplicación');
    assert.equal(zurron.momento, MOMENTO);
    assert.equal(zurron.momento, 'antes-de-salir');
    assert.equal(zurron.testid, TESTIDS.zurron);
    assert.equal(TESTIDS.zurron, 'zurron');
    // Y su guion pasa por la misma revisión que el de las otras cuatro pantallas.
    assert.ok(PANTALLAS.includes(PANTALLA));
    assert.ok(guionDePantalla(PANTALLA).length > 0);
    assert.equal(textoDelGuion(PANTALLA, 'rotulo'), 'Mientras no estabas');
  });

  test('Al zurrón solo se llega al abrir la salida', async () => {
    // No hay ninguna función que devuelva un zurrón ya leído, y esa ausencia es la
    // decisión: un zurrón consultable sería el panel del estado del mundo que el design
    // system descarta, y convertiría lo que se oye llegando a los sitios en una bandeja.
    const modulo = await import('../../packages/nucleo/partida/zurron.js');
    for (const nombre of Object.keys(modulo)) {
      assert.equal(/consulta|historial|ultimo|ultimoZurron|leidos|archivo/i.test(nombre), false, `el zurrón exporta "${nombre}", que suena a poder volver a mirarlo`);
    }
    const codigo = codigoDe('packages/nucleo/partida/zurron.js');
    for (const puerta of ['ajustes', 'diario', 'repisa']) {
      assert.equal(codigo.includes(puerta), false, `el zurrón se puede alcanzar desde "${puerta}"`);
    }
  });
});

// ── El determinismo de la composición ───────────────────────────────────────────

describe('El determinismo del zurrón', () => {
  test('La misma reserva compone el mismo zurrón dos veces', async () => {
    const mundo = await mundoDePrueba();
    const uno = await abreElZurron({ mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: narradorEspia().llamada });
    const dos = await abreElZurron({ mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: narradorEspia().llamada });
    assert.equal(JSON.stringify(uno.zurron), JSON.stringify(dos.zurron));
  });

  test('Con narrador y sin él las entradas son las mismas y solo cambia la piel', async () => {
    const mundo = await mundoDePrueba();
    const con = await abreElZurron({ mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: narradorEspia().llamada });
    const sin = await abreElZurron({ mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE });

    assert.equal(
      JSON.stringify(esqueletoDelZurron(con.zurron)),
      JSON.stringify(esqueletoDelZurron(sin.zurron)),
      'el esqueleto del zurrón cambia según haya narrador o no',
    );
    // Y la piel sí cambia, que es lo que hace que la comparación anterior signifique algo.
    assert.notEqual(con.zurron.envoltorio.texto, sin.zurron.envoltorio.texto);
    assert.equal(sin.zurron.envoltorio.origen, 'plantilla');
    assert.equal(con.zurron.envoltorio.origen, 'llm');
  });

  test('En el código que esta fila añade no aparece Math.random ni Date.now', () => {
    // El lector de salud queda fuera **a propósito y se afirma aparte**: es el único sitio
    // donde hay reloj real, y por eso vive en `app/` y no cruza la frontera.
    for (const ruta of ['packages/nucleo/partida/zurron.js', 'app/salida/zurron.js', 'app/salida/pasos-de-fondo.js']) {
      const codigo = codigoDe(ruta);
      for (const prohibido of ['Math.random', 'Date.now', 'new Date']) {
        assert.equal(codigo.includes(prohibido), false, `${ruta} usa ${prohibido}`);
      }
    }
  });
});

// ── El vaciado, que ocurre al confirmar ─────────────────────────────────────────

describe('El vaciado del zurrón', () => {
  /** Un motor con la reserva llena de verdad, dada por el motor y no escrita a mano. */
  function conReserva({ pasos = 5, mudo = false } = {}) {
    const estado = estadoDePasos();
    const motor = mudo ? motorMudo({ estado }) : motorDe({ estado });
    kilometrosDeFondo({ motor, metros: pasos * 2000, activos: true, tramo: 2000 });
    return { estado, motor, registro: registroInicial() };
  }

  test('Un zurrón confirmado deja la reserva vacía', () => {
    const { motor, registro } = conReserva();
    assert.equal(tamanoDeLaReserva(motor), 5);

    const resultado = vaciaElZurron({ motor, registro, dia: 12, narrados: 5 });
    assert.equal(resultado.yaEstaba, false);
    assert.equal(resultado.vaciados.length, 5);
    assert.equal(tamanoDeLaReserva(motor), 0);
    assert.equal(resultado.hecho.tipo, 'reserva-vaciada');
    assert.deepEqual(resultado.hecho.carga, { narrados: 5, primerPaso: 1, ultimoPaso: 5 });
    assert.equal(resultado.hecho.dia, 12);
    assert.equal(resultado.hecho.paso, 5, 'el momento del hecho es el último paso de la reserva y nunca una marca del reloj real');
    assert.equal(resultado.hecho.mapa, MAPA);
  });

  test('El vaciado se escribe con el hecho que lo registra, entero o nada', () => {
    // El orden es la atomicidad entera: el hecho se valida y se escribe primero, así que
    // un hecho mal formado deja la reserva intacta y el zurrón vuelve a salir. Al revés,
    // un fallo al registrar habría perdido lo único que el mundo hizo sin nadie mirando.
    const { motor, registro } = conReserva();
    assert.throws(() => vaciaElZurron({ motor, registro, dia: 'el martes', narrados: 5 }), /dia/);
    assert.equal(tamanoDeLaReserva(motor), 5, 'el hecho falló y la reserva se vació igual');
    assert.deepEqual(hechosDe(registro), [], 'se anexó un hecho de un vaciado que no ocurrió');

    // Y el hecho queda en el registro exactamente una vez, junto a lo que ya hubiera.
    anexa(registro, [{ tipo: 'sitio-pisado', mapa: MAPA, dia: 1, paso: 1, carga: { sitio: 'Monfrida' } }]);
    vaciaElZurron({ motor, registro, dia: 3, narrados: 5 });
    assert.deepEqual(hechosDe(registro).map((h) => h.tipo), ['sitio-pisado', 'reserva-vaciada']);
  });

  test('El zurrón enseñado y no confirmado vuelve con las mismas entradas', async () => {
    // Cerrar la app entre la composición y el «Seguir» no puede perder en silencio lo
    // único que el mundo hizo mientras nadie miraba (§6h).
    const mundo = await mundoDePrueba();
    const { motor } = conReserva();
    const reserva = motor.registro().reserva;

    const primera = await abreElZurron({ mundo, modoDeFondo: true, reserva, presupuestoMs: 5000, espera: NUNCA_VENCE });
    assert.equal(primera.hay, true);
    // La app se cierra aquí: no se confirma nada.
    assert.equal(tamanoDeLaReserva(motor), 5, 'componer el zurrón ha vaciado la reserva');

    const segunda = await abreElZurron({ mundo, modoDeFondo: true, reserva: motor.registro().reserva, presupuestoMs: 5000, espera: NUNCA_VENCE });
    assert.equal(JSON.stringify(segunda.zurron), JSON.stringify(primera.zurron), 'el zurrón no vuelve con las mismas entradas');
  });

  test('Confirmar dos veces el mismo zurrón no anexa dos hechos', () => {
    const { motor, registro } = conReserva();
    const primera = vaciaElZurron({ motor, registro, dia: 4, narrados: 5 });
    assert.equal(primera.yaEstaba, false);

    const segunda = vaciaElZurron({ motor, registro, dia: 4, narrados: 5 });
    assert.equal(segunda.yaEstaba, true, 'volver tras un vaciado ya escrito no se declara');
    assert.equal(segunda.hecho, null);
    assert.deepEqual([...segunda.vaciados], []);
    assert.equal(hechosDe(registro).filter((h) => h.tipo === 'reserva-vaciada').length, 1);
  });

  test('Una reserva que no produjo nada narrable se vacía igual, con cero narrados', () => {
    const { motor, registro } = conReserva({ mudo: true });
    assert.equal(tamanoDeLaReserva(motor), 5, 'los pasos ya se ejecutaron aunque no produjeran nada');
    assert.equal(decideElZurron({ modoDeFondo: true, reserva: motor.registro().reserva }).hay, false);

    const resultado = vaciaElZurron({ motor, registro, dia: 7, narrados: 0 });
    assert.equal(resultado.yaEstaba, false);
    assert.equal(resultado.hecho.carga.narrados, 0);
    assert.equal(tamanoDeLaReserva(motor), 0);
  });

  test('El vaciado declara como mucho tantas entradas narradas como pasos hay', () => {
    const { motor, registro } = conReserva();
    assert.throws(() => vaciaElZurron({ motor, registro, dia: 1, narrados: 6 }), /se narran como mucho/);
    assert.throws(() => vaciaElZurron({ motor, registro, dia: 1, narrados: -1 }), /se narran como mucho/);
    assert.throws(() => vaciaElZurron({ motor: null, registro, dia: 1 }), /motor de pasos del mapa activo/);
    assert.equal(tamanoDeLaReserva(motor), 5);
  });

  test('Una reserva vaciada no recupera nada de lo descartado', () => {
    // Los pasos que se ejecutan después salen solo de los kilómetros nuevos: si volviera
    // lo descartado, «tres meses equivale a tres días» sería falso por la puerta de atrás.
    const { estado, motor, registro } = conReserva({ pasos: 12 });
    assert.equal(tamanoDeLaReserva(motor), 5);
    vaciaElZurron({ motor, registro, dia: 1, narrados: 5 });

    const nuevos = kilometrosDeFondo({ motor, metros: 2 * 2000, activos: true, tramo: 2000 });
    assert.deepEqual(nuevos.pasos.map((p) => p.n), [6, 7]);
    assert.equal(estadoDeMapa(estado, MAPA).restoFondoM, 0, 'los kilómetros descartados han dejado deuda apuntada');
  });

  test('Un paso solo añade', () => {
    // Frontera que esta fila consume: lo que el zurrón cuenta salió de pasos que solo
    // añaden, así que ninguna entrada puede contar que algo se retiró o caducó.
    const { motor } = conReserva();
    for (const p of motor.registro().reserva) {
      for (const efecto of p.efectos) {
        assert.ok(TIPOS_DE_EFECTO[efecto.tipo], `el paso ${p.n} produjo un efecto fuera del catálogo`);
        assert.equal(TIPOS_DE_EFECTO[efecto.tipo].anade, true);
      }
    }
    const entradas = entradasDeLaReserva(motor.registro().reserva);
    for (const entrada of entradas) {
      assert.ok(TIPOS_NARRABLES.includes(entrada.tipo));
      assert.equal(/quita|retira|caduca|pierdes|se acabó/i.test(entrada.fallback), false, `la entrada del paso ${entrada.paso} cuenta algo que quita`);
    }
  });

  test('Los pasos de la reserva llevan el mismo número correlativo del mismo contador', () => {
    // Los ejecutados desde el fondo son de la misma naturaleza que los de una salida
    // activa: misma forma, mismo contador, sin marca de dónde vinieron.
    const { motor } = conReserva();
    assert.deepEqual(motor.registro().reserva.map((p) => p.n), [1, 2, 3, 4, 5]);
    assert.equal(motor.contador(), 5);
    for (const p of motor.registro().reserva) {
      assert.deepEqual(Object.keys(p).sort(), ['efectos', 'n'], 'un paso de la reserva lleva algo que no lleva uno de salida');
    }
  });
});

// ── El cableado de la app ───────────────────────────────────────────────────────

describe('El zurrón cableado en la app', () => {
  const nucleoDelZurron = {
    abreElZurron, vaciaElZurron, TESTIDS, ACCIONES, TOPE_DE_ENTRADAS, MOTIVOS_SIN_ZURRON,
  };

  test('La orquestación del zurrón no arranca sin sus piezas', () => {
    // «Nadie lo cableó» y «hoy no hay cobertura» no pueden dar el mismo resultado.
    assert.deepEqual([...DEL_NUCLEO], ['abreElZurron', 'vaciaElZurron', 'TESTIDS', 'ACCIONES', 'TOPE_DE_ENTRADAS', 'MOTIVOS_SIN_ZURRON']);
    assert.throws(() => creaZurron({ nucleo: null, presupuestoMs: 5000 }), /sin el núcleo/);
    assert.throws(() => creaZurron({ nucleo: { abreElZurron }, presupuestoMs: 5000 }), /le falta "vaciaElZurron"/);
    assert.throws(() => creaZurron({ nucleo: nucleoDelZurron, presupuestoMs: 5000 }), /si de verdad no hay narrador/);
    assert.throws(() => creaZurron({ nucleo: nucleoDelZurron, sinNarrador: true }), /presupuesto de espera/);
    assert.ok(creaZurron({ nucleo: nucleoDelZurron, sinNarrador: true, presupuestoMs: 5000 }));
  });

  test('La llamada del zurrón ocurre al abrir la salida y nunca durante la caminata', async () => {
    // Es la única excepción declarada de `quests.md` decisión 3, y lo que la mantiene
    // dentro de su espíritu es el momento: pedirla en marcha es un error, no una espera.
    const mundo = await mundoDePrueba();
    const espia = narradorEspia();
    const zurron = creaZurron({ nucleo: nucleoDelZurron, llamada: espia.llamada, presupuestoMs: 5000 });

    const abierto = await zurron.abre({ mundo, modoDeFondo: true, reserva: RESERVA_LLENA });
    assert.equal(abierto.hay, true);
    assert.equal(espia.llamadas(), 1);

    await assert.rejects(() => zurron.abre({ mundo, modoDeFondo: true, reserva: RESERVA_LLENA, momento: 'en-marcha' }), /nunca mientras se anda/);
    assert.equal(espia.llamadas(), 1, 'se ha pedido una redacción en marcha');
  });

  test('Confirmar «Seguir» pasa por el mismo vaciado del núcleo', () => {
    const estado = estadoDePasos();
    const motor = motorDe({ estado });
    kilometrosDeFondo({ motor, metros: 3 * 2000, activos: true, tramo: 2000 });
    const registro = registroInicial();
    const zurron = creaZurron({ nucleo: nucleoDelZurron, sinNarrador: true, presupuestoMs: 5000 });

    const resultado = zurron.confirma({ motor, registro, dia: 2, narrados: 3 });
    assert.equal(resultado.hecho.tipo, 'reserva-vaciada');
    assert.equal(tamanoDeLaReserva(motor), 0);
    assert.equal(zurron.testids, TESTIDS, 'la app inventa localizadores en vez de consumir los del núcleo');
  });
});

// ── A2P1 → A2P2 → A2P3, montado de verdad (SPEC-046) ───────────────────────────
//
// Las tres conductas que `SPEC-043-iter-1` derogó al retirar el cableado y que la fila 46
// recupera. Lo que necesita dispositivo —ver las tres pantallas encadenadas— es
// `test/app/zurron.yaml`; lo que se puede afirmar aquí es **quién decide qué**, que es donde
// estaba el defecto: dos sitios opinando sobre si hay zurrón.
//
// Se lee y no se carga: `antes-de-salir.jsx` es JSX y lo compila Metro, no Node. Va marcado
// como hueco de batería con esa salvedad escrita, en lugar de fingir que se ejecuta.

describe('El zurrón se recorre entre la portada y lo que hay hoy', () => {
  const PANTALLA = () => fuente('app/pantallas/antes-de-salir.jsx');
  const MONTADO = () => fuente('app/pantallas/antes-de-salir-montado.jsx');

  test('Con reserva sin vaciar se abre el zurrón y no la lista', () => {
    // El destino lo trae la portada resuelto y **aquí se obedece**, no se vuelve a decidir:
    // es lo que impide que dos sitios distintos opinen sobre si hay zurrón. Lo que sí se
    // decide es qué hacer con lo que el núcleo devuelva.
    const texto = PANTALLA();
    assert.match(texto, /accion\.destino !== 'zurron'/, 'la pantalla vuelve a decidir si hay zurrón en lugar de obedecer el destino que trae la portada');
    assert.match(texto, /setPantalla\('zurron'\)/, 'no hay ningún camino que lleve a A2P2');
    assert.match(texto, /if \(abierto\?\.hay\)/, 'la pantalla no distingue «hay zurrón» de «hay que vaciar sin enseñar nada»');
    // Y el zurrón es una pantalla más de esta máquina, entre la portada y la lista.
    assert.match(texto, /PANTALLAS = Object\.freeze\(\['portada', 'zurron', 'lista', 'ficha', 'preparacion'\]\)/, 'A2P2 no está entre la portada y la lista en la máquina del momento');
    // La reserva se lee **de lo que llega ahora**: vaciarla sustituye el array entero, así
    // que una referencia tomada antes traería los cinco pasos ya vaciados.
    assert.match(MONTADO(), /reserva: zurron\?\.reserva \?\? \[\]/, 'el zurrón se compone con una reserva guardada en lugar de la que llega');
  });

  test('Seguir lleva del zurrón a lo que hay hoy', () => {
    const texto = PANTALLA();
    const enElZurron = texto.slice(texto.indexOf("if (pantalla === 'zurron')"), texto.indexOf("if (pantalla === 'lista')"));
    assert.match(enElZurron, /alSeguirDelZurron/, '«Seguir» no confirma el vaciado');
    assert.match(enElZurron, /abreLaLista\(\)/, '«Seguir» no lleva a lo que hay hoy');
    // Y lo hace en ese orden: **el vaciado primero y la lista después**. Al revés, cerrar la
    // app entre las dos dejaría el zurrón enseñado y sin vaciar sin poder distinguirlo.
    assert.ok(
      enElZurron.indexOf('alSeguirDelZurron') < enElZurron.indexOf('abreLaLista()'),
      'la lista se abre antes de confirmar el vaciado',
    );
    // Una sola acción, y ninguna manera de saltarlo: la pantalla no recibe ninguna otra.
    const zurron = fuente('app/pantallas/zurron.jsx');
    assert.equal((zurron.match(/onPress=/g) ?? []).length, 1, 'A2P2 tiene más de una acción, y el zurrón se lee una vez y se va');
  });

  test('El zurrón no aparece por segunda vez', () => {
    // La reserva **se relee del motor cada vez que la portada se recompone**, y esa es la
    // pieza entera: `vaciaReserva` sustituye el array, así que una referencia tomada antes
    // seguiría diciendo que hay cinco pasos y el zurrón se ofrecería recién vaciado.
    const raiz = fuente('app/App.js');
    assert.match(raiz, /reserva: elFondo\?\.motor \? elFondo\.motor\.registro\(\)\.reserva : \[\]/, 'la raíz guarda la reserva en lugar de releerla del motor');
    assert.match(raiz, /pasoDeFondo/, 'no hay nada que fuerce a recomponer la portada tras vaciar: el núcleo muta el área en sitio y React no se entera solo');
    assert.match(raiz, /alZurronVaciado=\{\(\) => \{/, 'confirmar el zurrón no avisa a la raíz, así que ni se congela ni se repinta');

    // Y el vaciado se escribe de verdad: el hecho primero y la reserva después. Eso ya se
    // afirma ejecutándolo más arriba; lo que aquí se ata es que la app pase por ahí.
    assert.match(MONTADO(), /montaje\.zurron\.confirma\(/, 'la app no confirma el zurrón por el vaciado del núcleo');
  });

  test('Al zurrón no se llega desde ninguna otra pantalla', () => {
    // Una ausencia, y por eso se mide sobre los imports y no sobre una pantalla concreta: un
    // zurrón consultable sería el panel del estado del mundo que el design system descarta.
    const importan = ['diario', 'repisa', 'ajustes', 'consulta-montado', 'portada', 'lo-que-hay-hoy', 'sitios-marcados']
      .filter((p) => /from '\.\/zurron\.jsx'/.test(fuente(`app/pantallas/${p}.jsx`)));
    assert.deepEqual(importan, [], `estas pantallas importan el zurrón y no deberían: ${importan.join(', ')}`);
    // La única que lo monta es la máquina del momento «antes de salir».
    assert.match(PANTALLA(), /from '\.\/zurron\.jsx'/, 'nadie importa el zurrón: volvería a ser una pantalla huérfana');
  });

  test('El zurrón se cablea con la misma llamada y el mismo presupuesto que la preparación', () => {
    // Hueco de batería. SPEC-042 lo decidió así y esta fila lo consuma: dos montajes serían
    // dos sitios donde declarar «sin narrador», que es como acaban discrepando.
    const montado = MONTADO();
    assert.match(montado, /presupuestoMs: PRESUPUESTO_PREPARACION_MS/, 'el zurrón tiene un presupuesto propio en lugar del de la preparación');
    assert.match(montado, /sinNarrador: !llamada/, 'el zurrón declara «sin narrador» de otra manera que la preparación');

    // Y las piezas se exigen **solo cuando hay zurrón que enseñar**: sin mapa levantado lo
    // que se ve es el ofrecimiento de A2P0, que no necesita ninguna. Con reserva sin vaciar
    // sí, y entonces la que falte se dice por su nombre.
    assert.match(montado, /if \(hayQueVaciar\)/, 'las piezas del zurrón se exigen siempre, y sin mapa levantado eso rompería A2P0');
    assert.match(montado, /el zurrón se monta sin el motor de pasos del mapa activo/, 'la pieza que falta no se dice por su nombre');
    assert.match(montado, /el zurrón se monta sin el registro de hechos de la partida/, 'la pieza que falta no se dice por su nombre');
  });
});

// ── Lo que sale del móvil por causa del zurrón (SPEC-046) ───────────────────────

describe('Del zurrón no sale nada del móvil', () => {
  test('Del zurrón no sale nada del móvil', async () => {
    // Bloqueante (`@privacidad`). Se afirma con el **inspector en modo estricto** y no
    // leyendo el código: una prueba de privacidad que no mira el tráfico está fingiendo, y
    // esta es la afirmación más difícil del proyecto porque es una negativa.
    //
    // Lo único que sale por causa del zurrón son los huecos inertes de la llamada agrupada
    // que SPEC-018 ya declara. Ni el nombre real de ningún sitio, ni la reserva, ni cuánto
    // se ha andado, ni el número del paso.
    const mundo = await mundoDePrueba();
    const espia = narradorEspia();
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const abierto = await abreElZurron({
        mundo, modoDeFondo: true, reserva: RESERVA_LLENA, presupuestoMs: 5000, espera: NUNCA_VENCE, llamada: espia.llamada,
      });
      assert.equal(abierto.hay, true);

      // Nada por la frontera de red: la única salida es la llamada inyectada, que es la que
      // el proxy ciego atiende y la que SPEC-018 gobierna.
      assert.deepEqual(inspector.peticiones(), [], 'el zurrón ha abierto una salida a red por su cuenta');

      // Y en lo que la llamada lleva no hay ni un dato vivo. Se serializa la petición entera
      // y se busca sobre ella: mirar campo a campo dejaría pasar lo que viaje anidado.
      const texto = JSON.stringify(espia.peticiones());

      // El nombre real de ningún sitio: los que viajan son los del mundo de fantasía —el
      // `sitio` de cada entrada— y nunca el anclaje del que salieron, que es el dato vivo.
      const reales = mundo.settlements.map((s) => s.anchor?.name).filter(Boolean);
      assert.ok(reales.length > 0, 'el mundo de prueba no tiene ningún anclaje real, y este caso no distinguiría nada');
      for (const real of reales) {
        assert.equal(texto.includes(real), false, `el nombre real "${real}" sale del móvil en la llamada del zurrón`);
      }

      // Ni la reserva, ni cuánto se ha andado, ni la marca de la última lectura.
      for (const vivo of ['metros', 'kilometros', 'reserva', 'leidoHasta', 'latitude', 'longitude']) {
        assert.equal(texto.includes(vivo), false, `"${vivo}" sale del móvil en la llamada del zurrón`);
      }

      // Ni el número de ninguno de los pasos, que es de donde se deduciría cuánto se ha
      // andado. La clave del hueco es un ordinal dentro de la tanda —1 a 5— y no el número
      // del paso: son cosas distintas y por eso se busca el número y no el ordinal.
      for (const p of RESERVA_LLENA) {
        assert.equal(texto.includes(String(p.n)), false, `el número del paso ${p.n} sale del móvil`);
      }
    } finally {
      inspector.suelta();
    }
  });
});
