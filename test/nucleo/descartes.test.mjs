// SPEC-035 · El sitio que no pega: el descarte de un anclaje, el gesto de dos toques que
// **saca del casting sin resembrar**, y su contrapartida, la alarma de estirón.
//
// Lo que hace probable esta fila entera sin dispositivo es dónde la puso la spec: el
// descarte es estado de partida y entra en `candidatosDeRol`, así que todo lo que decide
// —qué sale del casting, qué documento no cambia, cuándo salta la alarma, a quién se le
// atribuye la falta de reparto— son funciones puras del paquete. En `test/app/descarte.yaml`
// queda solo el dedo: los dos toques de A4P8 y el deshacer desde ajustes.
//
// Seis decisiones de este fichero que no son de estilo:
//
// - **«No resiembra» se afirma sobre el texto del documento, no sobre un campo.** El
//   criterio dice «idéntico byte a byte», así que se compara `textoDeCelda` entero antes y
//   después; comparar `mundo.parajes.length` diría que el sitio sigue y no diría nada del
//   resto de la celda. El tamaño medido se escribe al lado como dato: 283 991 B para
//   `costero`, no los 283 455 que traía el encargo — la cifra no es un criterio, la
//   identidad sí, y por eso lo que se asegura es la identidad.
// - **La alarma se pone roja por los dos lados, y con un mundo elegido para eso.**
//   `urbano-denso` tiene 7 parajes y su celda congeló un suelo de 5, así que hay dos
//   descartes que **no** deben hacerla saltar (6 y 5 vivos) y uno que sí (4). Un mundo con
//   un solo paraje solo podría poner rojo el lado fácil.
// - **El cruce se cuenta, no se mira una vez.** `cruzaElSuelo` tiene que ser cierto
//   **exactamente en un descarte** de los cinco: si un día saltara en todos los de debajo
//   del suelo, la alarma pasaría de aviso a reproche repetido y ningún caso puntual lo
//   vería.
// - **La atribución de la falta de reparto se afirma con el mismo mundo por los dos
//   lados.** `barrio-tres-calles` con tramo 300 declara los descartes y con tramo 120
//   declara el mundo pequeño **aun con un descarte puesto**: es lo único que demuestra que
//   la regla es «solo si sin ellos había reparto» y no «hay descartes, luego es culpa suya».
// - **La ausencia de tráfico se afirma con el inspector en modo estricto.** Un observador
//   que solo ve lo que le dan no puede afirmar una ausencia; en estricto, cualquier salida
//   no envuelta revienta, así que el cero significa algo.
// - **Lo que no cambia se compara contra el estado entero**, no contra el área que se
//   tocó: descartar un núcleo no puede mover ni el diario, ni el oro, ni las relaciones, y
//   la manera de saberlo es congelar la partida antes y después y mirar que la única
//   diferencia está en `areas.anclajes`.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «Marcarlo lo saca del
// casting sin resembrar», «Es reversible», «No hace falta dar motivo», «No se reporta a
// ningún sitio» y «Si el filtro deja el mundo sin reparto, se ofrece el estirón». Los
// cuatro primeros están etiquetados `@app` en la batería porque se escribieron pensando en
// el gesto: aquí se implementa la mitad que la spec bajó al paquete y en
// `test/app/descarte.yaml` queda la que necesita dedo. El quinto ya tiene implementación
// para la causa del filtro en `test/nucleo/accesibilidad.test.mjs`; aquí se implementa la
// **causa nueva** que esta fila añade, que es la misma oferta con el mismo número de
// tramos. Todo lo demás va marcado como hueco de la batería en `test/spec-test-map.json`.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  IDS_DE_MOTIVO,
  LO_QUE_UN_MOTIVO_NO_LLEVA,
  MOTIVOS_DE_DESCARTE,
  SIN_DESCARTES,
  TEXTOS_DE_DESCARTE,
  alarmaDeEstiron,
  anotaDescarte,
  congelaDescartes,
  creaCapaDeDescartes,
  descartesDeMapa,
  estaDescartado,
  estadoDeDescartes,
  exigeDescartes,
  exigeMotivo,
  exigeSueloDeParajes,
  hayDescartes,
  hechoDeDescarte,
  hechoDeDevolucion,
  levantaDescartes,
  motivoDe,
  quitaDescarte,
  vistaDeDescartes,
} from '../../packages/nucleo/partida/descartes.js';
import { CATALOGO } from '../../packages/nucleo/quests/catalogo.js';
import { candidatosDeRol, castAll } from '../../packages/nucleo/quests/casting.js';
import { TRAMOS_DEL_ESTIRON, repartoDeAventuras } from '../../packages/nucleo/partida/aventuras.js';
import { MOTIVOS_DE_FALTA } from '../../packages/nucleo/partida/filtro.js';
import {
  AREAS_QUE_NO_REPRODUCEN,
  congelaEstado,
  estadoInicial,
  levantaEstado,
} from '../../packages/nucleo/partida/estado.js';
import {
  TIPOS_DE_HECHO,
  anexa,
  areaDeTipo,
  hechosDe,
  registroInicial,
  tiposDelArea,
} from '../../packages/nucleo/partida/hechos.js';
import { reconstruye } from '../../packages/nucleo/partida/reconstruccion.js';
import { acepta, estadoDeAventuras, resuelveBeat } from '../../packages/nucleo/partida/aventura-en-curso.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { texto as textoCanonico } from '../../packages/nucleo/partida/formato.js';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { bytesDe, celdaDeFixture } from './partida-de-prueba.mjs';
import { fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';

// ── El decorado ────────────────────────────────────────────────────────────────

const DESCARTES = 'packages/nucleo/partida/descartes.js';

/** El tamaño medido del documento de `costero`, escrito como dato y no como criterio. */
const BYTES_DE_COSTERO = 283991;

/**
 * La celda entera —mundo, cupos y mapa— sobre la que se monta la capa. Se pide la de
 * fixture y no un mundo suelto a propósito: el suelo de parajes **se lee de la celda**, y
 * un mundo sin celda detrás no lo tiene.
 */
async function frontera(nombre, { registro = null, puntoDePartida = undefined } = {}) {
  const celda = await celdaDeFixture(nombre);
  const estado = estadoDeDescartes();
  const capa = creaCapaDeDescartes({
    mundo: celda.mundo,
    cupos: celda.cupos,
    estado,
    mapaId: celda.mapaId,
    registro,
    puntoDePartida,
  });
  return { celda, mundo: celda.mundo, cupos: celda.cupos, mapaId: celda.mapaId, estado, capa };
}

/** Una vista de descartes montada a mano, para lo que se afirma sin capa detrás. */
function vistaDe(nombres) {
  const estado = estadoDeDescartes();
  for (const n of nombres) anotaDescarte(estado, { mapaId: 'mapa', anclaje: n });
  return vistaDeDescartes(estado, 'mapa');
}

/** Todos los nombres de sitio de un mundo: núcleos, sus servicios y parajes. */
function todosLosSitios(mundo) {
  return [
    ...mundo.settlements.map((s) => s.name),
    ...mundo.settlements.flatMap((s) => s.services.map((v) => v.name)),
    ...mundo.parajes.map((p) => p.name),
  ];
}

/** Lo que se dibuja de un sitio: su nombre y su posición, que el descarte no puede tocar. */
function dibujoDe(mundo, nombre) {
  const p = mundo.parajes.find((x) => x.name === nombre);
  if (p) return { nombre: p.name, x: p.x, y: p.y, tipo: p.type };
  const s = mundo.settlements.find((x) => x.name === nombre);
  if (s) return { nombre: s.name, x: s.x, y: s.y, tipo: s.type };
  return null;
}

const serializado = (v) => JSON.stringify(v);

/**
 * Si algún casteo del catálogo manda a ese sitio.
 *
 * Se mira el lugar de cada beat y no el texto del casteo entero: el nombre de un núcleo
 * aparece también como el `en` de cada uno de sus servicios, así que buscar la cadena
 * daría rojo por un sitio al que nadie te manda.
 */
function algunaMandaA(casting, nombre) {
  return casting.some((c) => c.ok && c.beats.some((b) => b.lugar.nombre === nombre));
}

// ── El gesto ───────────────────────────────────────────────────────────────────

describe('El jugador puede marcar un anclaje que no vale', () => {
  test('Marcarlo lo saca del casting sin resembrar', async () => {
    const { celda, mundo, capa } = await frontera('costero');
    const sitio = mundo.parajes[0].name;

    // Lo que no puede cambiar, capturado antes del gesto: el documento entero de la
    // celda, lo que se dibuja del sitio y el grafo por el que viajan los rumores.
    const documentoAntes = textoDeCelda(celda);
    const dibujoAntes = dibujoDe(mundo, sitio);
    const viarioAntes = serializado(mundo.viario);
    assert.equal(bytesDe(documentoAntes), BYTES_DE_COSTERO, 'el documento de costero ha cambiado de tamaño: el número es el medido, no un criterio');

    const marcado = capa.descarta({ anclaje: sitio, porque: 'casa-particular', dia: 1, paso: 3 });
    assert.equal(marcado.anotado, true);
    assert.equal(marcado.rol, 'paraje', 'el descarte anota el rol que el sitio ocupaba');

    // «El resto del mundo sigue idéntico byte a byte», literalmente.
    assert.equal(textoDeCelda(celda), documentoAntes, 'marcar un sitio ha cambiado el documento de la celda: eso es resembrar con otro nombre');
    assert.deepEqual(dibujoDe(mundo, sitio), dibujoAntes, 'el sitio marcado ha dejado de dibujarse con su nombre de fantasía y en su posición');
    assert.equal(serializado(mundo.viario), viarioAntes, 'el grafo se ha movido: los rumores dejarían de viajar por las mismas calzadas');

    // Y lo que sí cambia: ninguna aventura vuelve a mandarte allí.
    const limpio = castAll(mundo, mundo.seed);
    const conDescarte = castAll(mundo, mundo.seed, { descartes: capa.vista() });
    assert.ok(limpio.filter((c) => c.ok).length > conDescarte.filter((c) => c.ok).length, 'el descarte no ha cambiado el casting: el sitio marcado seguía dando de comer a alguna plantilla');
    assert.equal(algunaMandaA(limpio, sitio), true, 'antes del descarte ya no mandaba nadie allí, así que el caso no mediría nada');
    assert.equal(algunaMandaA(conDescarte, sitio), false, 'alguna aventura sigue mandando al sitio marcado');

    // Ni como candidato de ningún rol de ninguna plantilla, que es la afirmación fuerte:
    // no aparecer entre los elegidos podría ser casualidad del backtracking.
    let rolesMirados = 0;
    for (const plantilla of CATALOGO) {
      for (const rol of Object.values(plantilla.roles)) {
        if (rol.tipo === 'humano') continue;
        rolesMirados++;
        const pool = candidatosDeRol(mundo, rol, { descartes: capa.vista() });
        assert.equal(pool.some((c) => c.nombre === sitio), false, `"${sitio}" sigue siendo candidato del rol ${rol.tipo} de ${plantilla.id}`);
      }
    }
    assert.ok(rolesMirados > 30, `se han mirado ${rolesMirados} roles de sitio del catálogo, que no son bastantes para afirmar nada`);
  });

  test('Un sitio que era candidato y no elegido puede cambiar el reparto, y no regenera ninguna celda', async () => {
    const { celda, mundo, capa } = await frontera('costero');
    const documentoAntes = textoDeCelda(celda);
    const limpio = castAll(mundo, mundo.seed);

    // Un candidato de algún rol que el casteo limpio **no** eligió en ninguna aventura.
    const elegidos = new Set(limpio.filter((c) => c.ok).flatMap((c) => c.beats.map((b) => b.lugar.nombre)));
    const candidato = todosLosSitios(mundo).find((n) => !elegidos.has(n) && CATALOGO.some((p) =>
      Object.values(p.roles).some((r) => r.tipo !== 'humano' && candidatosDeRol(mundo, r).some((c) => c.nombre === n))));
    assert.ok(candidato, 'este mundo no tiene ningún candidato sin elegir: el caso no mediría lo que dice');

    capa.descarta({ anclaje: candidato, dia: 1, paso: 1 });
    const despues = castAll(mundo, mundo.seed, { descartes: capa.vista() });
    assert.equal(textoDeCelda(celda), documentoAntes, 'volver a castear con un descarte más ha tocado la celda: el casting no es parte del mundo congelado');
    assert.equal(algunaMandaA(despues, candidato), false, 'el candidato marcado ha entrado en el reparto nuevo');
    for (const rol of CATALOGO.flatMap((p) => Object.values(p.roles)).filter((r) => r.tipo !== 'humano')) {
      assert.equal(candidatosDeRol(mundo, rol, { descartes: capa.vista() }).some((c) => c.nombre === candidato), false, `"${candidato}" sigue siendo candidato del rol ${rol.tipo}`);
    }
  });

  test('Un identificador que no es de ningún sitio del mundo falla nombrándolo y no anota nada', async () => {
    const { capa, estado, mapaId } = await frontera('costero');
    assert.throws(
      () => capa.descarta({ anclaje: 'A Torre Que No Existe', dia: 1, paso: 1 }),
      /A Torre Que No Existe.*no es ningún sitio de este mundo/s,
    );
    assert.deepEqual(descartesDeMapa(estado, mapaId), [], 'ha quedado anotado un descarte que no afecta a nada');
    // Y por coordenada tampoco: a un sitio se le nombra.
    assert.throws(() => capa.descarta({ anclaje: { x: 10, y: 20 }, dia: 1, paso: 1 }), /nunca por su coordenada/);
  });

  test('Descartar dos veces el mismo sitio no cambia nada y no anota un segundo hecho', async () => {
    const registro = registroInicial();
    const { mundo, capa, estado, mapaId } = await frontera('costero', { registro });
    const sitio = mundo.parajes[0].name;

    capa.descarta({ anclaje: sitio, porque: 'ya-no-existe', dia: 1, paso: 1 });
    const antes = serializado(descartesDeMapa(estado, mapaId));
    const otra = capa.descarta({ anclaje: sitio, porque: 'otra-cosa', dia: 2, paso: 4 });

    assert.equal(otra.anotado, false);
    assert.equal(otra.yaEstaba, true);
    assert.equal(otra.hecho, null, 'el segundo descarte ha emitido un hecho');
    assert.equal(serializado(descartesDeMapa(estado, mapaId)), antes, 'el segundo descarte ha cambiado el estado, incluido el motivo del primero');
    assert.equal(hechosDe(registro).length, 1, 'el registro tiene dos hechos para un solo sitio marcado');
  });

  test('El descarte es del mapa y no de la partida', async () => {
    const estado = estadoDeDescartes();
    anotaDescarte(estado, { mapaId: 'casa', anclaje: 'A Torre Rota' });
    anotaDescarte(estado, { mapaId: 'casa', anclaje: 'O Muíño' });
    anotaDescarte(estado, { mapaId: 'trabajo', anclaje: 'A Fonte Vella' });

    assert.deepEqual(descartesDeMapa(estado, 'casa').map((d) => d.anclaje), ['A Torre Rota', 'O Muíño'].sort());
    assert.deepEqual(descartesDeMapa(estado, 'trabajo').map((d) => d.anclaje), ['A Fonte Vella']);
    assert.equal(estaDescartado(estado, { mapaId: 'trabajo', anclaje: 'A Torre Rota' }), false, 'un descarte de un mapa está saliendo en otro');
    // Y una partida sin ningún descarte es un caso normal, no un error.
    assert.deepEqual(descartesDeMapa(estadoDeDescartes(), 'casa'), []);
    assert.equal(hayDescartes(SIN_DESCARTES), false);
    assert.equal(SIN_DESCARTES.cuantos(), 0);
  });

  test('El orden de los descartes es el del identificador y no el de llegada', async () => {
    const uno = estadoDeDescartes();
    const otro = estadoDeDescartes();
    for (const n of ['O Muíño', 'A Fonte Vella', 'Z Última']) anotaDescarte(uno, { mapaId: 'casa', anclaje: n });
    for (const n of ['Z Última', 'O Muíño', 'A Fonte Vella']) anotaDescarte(otro, { mapaId: 'casa', anclaje: n });
    assert.equal(serializado(congelaDescartes(uno)), serializado(congelaDescartes(otro)), 'dos partidas con los mismos descartes en distinto orden se escriben distinto');
  });
});

// ── Deshacer ───────────────────────────────────────────────────────────────────

describe('Es reversible', () => {
  test('Es reversible', async () => {
    const registro = registroInicial();
    const { mundo, capa } = await frontera('costero', { registro });
    const sitio = mundo.parajes[0].name;
    const limpio = serializado(castAll(mundo, mundo.seed));

    capa.descarta({ anclaje: sitio, porque: 'casa-particular', dia: 1, paso: 1 });
    assert.notEqual(serializado(castAll(mundo, mundo.seed, { descartes: capa.vista() })), limpio, 'el descarte no cambió nada, así que deshacerlo no demuestra nada');

    const deshecho = capa.deshaz({ anclaje: sitio, dia: 2, paso: 5 });
    assert.equal(deshecho.deshecho, true);
    // «Cuando se compara el reparto con el de antes del descarte y con la misma semilla,
    // entonces es el mismo»: el mismo texto, no un reparto parecido.
    assert.equal(serializado(castAll(mundo, mundo.seed, { descartes: capa.vista() })), limpio, 'deshacer no ha devuelto el sitio al casting');
    assert.equal(capa.vista().descartado(sitio), false);

    // El hecho del descarte sigue en el registro, con su deshacer anotado detrás.
    const hechos = hechosDe(registro);
    assert.deepEqual(hechos.map((h) => h.tipo), ['anclaje-descartado', 'anclaje-devuelto'], 'deshacer ha borrado el hecho del descarte en lugar de anotarse detrás');
    assert.equal(hechos[1].carga.anclaje, sitio);
    assert.equal(hechos[1].carga.rol, 'paraje', 'el deshacer no lleva el rol, así que la línea no se lee sola');
  });

  test('La lista de ajustes trae cada sitio con su nombre de fantasía y con qué es en realidad', async () => {
    const { mundo, capa } = await frontera('costero');
    const vacia = capa.sitiosMarcados();
    assert.equal(vacia.etiqueta, TEXTOS_DE_DESCARTE.filaDeAjustes);
    assert.equal(vacia.cuantos, 0, 'con cero marcados la fila de ajustes no enseña el número cero');
    assert.deepEqual(vacia.filas, []);
    assert.equal(vacia.ninguno, TEXTOS_DE_DESCARTE.ninguno, 'con cero marcados la lista no dice que no hay ninguno');

    const paraje = mundo.parajes[0].name;
    const nucleo = mundo.settlements[1].name;
    capa.descarta({ anclaje: paraje, porque: 'casa-particular', dia: 1, paso: 1 });
    capa.descarta({ anclaje: nucleo, dia: 1, paso: 2 });

    const lista = capa.sitiosMarcados();
    assert.equal(lista.cuantos, 2, 'con dos sitios marcados no están los dos en la lista');
    assert.equal(lista.ninguno, null);
    for (const fila of lista.filas) {
      assert.ok(fila.nombre, 'una fila sin nombre de fantasía');
      assert.ok(fila.tipo, `"${fila.nombre}" no dice qué es`);
      assert.equal(fila.deshacer, TEXTOS_DE_DESCARTE.deshacer);
      // Sin motivo, sin fecha, sin agrupación y sin buscador: el sitio marcado sin motivo
      // aparece igual que los demás y no se le pide motivo para deshacerlo.
      assert.deepEqual(Object.keys(fila).sort(), ['anclaje', 'deshacer', 'enRealidad', 'nombre', 'tipo']);
    }
    assert.equal(serializado(lista).includes('casa-particular'), false, 'la lista enseña el motivo, y ahí sería una rendición de cuentas');

    capa.deshaz({ anclaje: nucleo, dia: 2, paso: 1 });
    const despues = capa.sitiosMarcados();
    assert.equal(despues.cuantos, 1);
    assert.equal(despues.filas.some((f) => f.anclaje === nucleo), false, 'el sitio deshecho sigue en la lista');
  });

  test('Deshacer lo que no estaba marcado no cambia nada y no emite ningún hecho', async () => {
    const registro = registroInicial();
    const { mundo, capa } = await frontera('costero', { registro });
    const nada = capa.deshaz({ anclaje: mundo.parajes[0].name, dia: 1, paso: 1 });
    assert.equal(nada.deshecho, false);
    assert.equal(nada.hecho, null);
    assert.deepEqual(hechosDe(registro), []);
    assert.deepEqual(quitaDescarte(estadoDeDescartes(), { mapaId: 'casa', anclaje: 'x' }), { deshecho: false, estaba: false });
  });
});

// ── Los motivos ────────────────────────────────────────────────────────────────

describe('No hace falta dar motivo, y los motivos son un vocabulario cerrado', () => {
  test('No hace falta dar motivo', async () => {
    const { mundo, capa } = await frontera('costero');
    const sitio = mundo.parajes[0].name;
    const sinMotivo = capa.descarta({ anclaje: sitio, dia: 1, paso: 1 });
    assert.equal(sinMotivo.anotado, true, 'marcar sin elegir motivo no ha marcado');
    assert.equal(sinMotivo.porque, null);
    assert.equal(capa.vista().descartado(sitio), true);

    // Y la capa de A4P8 llega con los cinco motivos sin ninguno marcado y sin campo de
    // texto en ninguno: el que escribe es el segundo toque.
    const otro = mundo.parajes[1].name;
    const puesta = capa.capaDe(otro);
    assert.deepEqual(puesta.motivos.map((m) => m.id), [...IDS_DE_MOTIVO]);
    assert.equal(puesta.motivos.every((m) => m.marcado === false), true, 'algún motivo viene marcado de serie');
    assert.equal(puesta.confirmacion, null, 'hay un diálogo de confirmación detrás de «Marcarlo»: eso serían tres toques');
    assert.equal(puesta.confirmar, TEXTOS_DE_DESCARTE.confirmar);
    // La línea que quita la obligación va antes de los motivos, y por eso está.
    assert.equal(puesta.sinObligacion, TEXTOS_DE_DESCARTE.sinObligacion);
    assert.equal(puesta.reversibilidad, TEXTOS_DE_DESCARTE.reversibilidad);
    assert.equal(puesta.yaMarcado, false);
    assert.equal(capa.capaDe(sitio).yaMarcado, true, 'la capa de un sitio ya marcado no lo dice');
  });

  test('Los motivos son los cinco del artefacto y ninguno lleva texto libre', () => {
    assert.deepEqual(MOTIVOS_DE_DESCARTE.map((m) => m.texto), [
      'Es una casa particular',
      'No se puede llegar a pie',
      'No es sitio para pararse',
      'Ya no existe',
      'Otra cosa',
    ]);
    assert.equal(MOTIVOS_DE_DESCARTE.length, 5, 'el vocabulario cerrado ha dejado de tener cinco motivos');
    for (const m of MOTIVOS_DE_DESCARTE) {
      // El catálogo declara el identificador y el texto que el artefacto dibuja, y nada
      // más: no hay ningún campo colgando donde escribir por qué.
      assert.deepEqual(Object.keys(m).sort(), ['id', 'texto'], `el motivo "${m.id}" declara un campo de más`);
      // Y lo que se **anota** es el identificador pelado, así que no puede llevar ninguno
      // de los campos que invitarían a escribir datos de personas reales del barrio.
      const anotado = exigeMotivo(m.id);
      assert.equal(typeof anotado, 'string', `el motivo "${m.id}" se anota como algo más que su identificador`);
      for (const campo of LO_QUE_UN_MOTIVO_NO_LLEVA) {
        assert.equal(anotado[campo], undefined, `el motivo anotado "${m.id}" lleva "${campo}", que es donde se escribiría texto libre`);
      }
    }
    // «Otra cosa» está en el catálogo y tampoco lleva ninguno: es el que más invitaría.
    assert.deepEqual(motivoDe('otra-cosa'), { id: 'otra-cosa', texto: 'Otra cosa' });
    assert.equal(motivoDe(null), null);
  });

  test('Un motivo que no está en el vocabulario falla nombrándolo y enumerando los válidos', async () => {
    const { mundo, capa, estado, mapaId } = await frontera('costero');
    let mensaje = '';
    try {
      capa.descarta({ anclaje: mundo.parajes[0].name, porque: 'el perro del vecino', dia: 1, paso: 1 });
    } catch (e) {
      mensaje = e.message;
    }
    assert.match(mensaje, /el perro del vecino/, 'el error no nombra el motivo que llegó');
    for (const id of IDS_DE_MOTIVO) assert.ok(mensaje.includes(id), `el error no enumera el motivo válido "${id}"`);
    assert.deepEqual(descartesDeMapa(estado, mapaId), [], 'un motivo inválido ha marcado el sitio igual');

    // Y el motivo que no es una cadena falla igual: es lo que cierra la puerta al texto
    // libre disfrazado de objeto.
    assert.throws(() => exigeMotivo({ id: 'otra-cosa', texto: 'porque hay un perro' }), /vocabulario cerrado/);
    assert.throws(() => exigeMotivo('otra cosa'), /vocabulario cerrado/);
  });

  test('El motivo no cambia nada de lo que ocurre', async () => {
    const con = await frontera('costero');
    const sin = await frontera('costero');
    const sitio = con.mundo.parajes[0].name;
    con.capa.descarta({ anclaje: sitio, porque: 'no-se-llega-a-pie', dia: 1, paso: 1 });
    sin.capa.descarta({ anclaje: sitio, dia: 1, paso: 1 });
    assert.equal(
      serializado(castAll(con.mundo, con.mundo.seed, { descartes: con.capa.vista() })),
      serializado(castAll(sin.mundo, sin.mundo.seed, { descartes: sin.capa.vista() })),
      'el motivo está cambiando el efecto sobre el casting, y no alimenta ninguna mecánica',
    );
  });
});

// ── La privacidad ──────────────────────────────────────────────────────────────

describe('No se reporta a ningún sitio', () => {
  test('No se reporta a ningún sitio', async () => {
    const registro = registroInicial();
    const { mundo, capa } = await frontera('costero', { registro });
    const sitio = mundo.parajes[0].name;

    // Modo estricto: cualquier salida no envuelta revienta, así que el cero significa algo.
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      capa.capaDe(sitio);
      capa.descarta({ anclaje: sitio, porque: 'casa-particular', dia: 1, paso: 1 });
      capa.sitiosMarcados();
      capa.alarma(2);
      castAll(mundo, mundo.seed, { descartes: capa.vista() });
      capa.deshaz({ anclaje: sitio, dia: 2, paso: 1 });
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico al marcar, listar o deshacer un sitio');
    } finally {
      inspector.suelta();
    }

    // Y no es que no haya salido: es que no hay a quién llamar.
    const codigo = fuente(DESCARTES);
    for (const prohibido of [/fetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /https?:\/\//, /proxy/i, /Date\.now/, /new Date/, /Math\.random/]) {
      assert.equal(prohibido.test(codigo.replace(/^\s*\/\/.*$/gm, ' ')), false, `${DESCARTES} contiene ${prohibido}`);
    }
    for (const dependencia of [...codigo.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])) {
      assert.ok(dependencia.startsWith('.'), `${DESCARTES} importa "${dependencia}", que no es del paquete`);
    }
  });

  test('El hecho del descarte lleva el sitio, el rol y el motivo, y ninguna coordenada', () => {
    const h = hechoDeDescarte({ mapaId: 'casa', anclaje: 'A Torre Rota', rol: 'paraje', porque: 'casa-particular', dia: 4, paso: 12 });
    assert.deepEqual(Object.keys(h.carga).sort(), ['anclaje', 'porque', 'rol']);
    assert.deepEqual({ dia: h.dia, paso: h.paso }, { dia: 4, paso: 12 });
    assert.throws(() => hechoDeDescarte({ mapaId: 'casa', anclaje: { lat: 42.4, lon: -8.8 }, dia: 1, paso: 1 }), /anclaje/);
    const d = hechoDeDevolucion({ mapaId: 'casa', anclaje: 'A Torre Rota', rol: 'paraje', dia: 5, paso: 1 });
    assert.deepEqual(Object.keys(d.carga).sort(), ['anclaje', 'rol'], 'el deshacer arrastra un motivo que nadie le pidió');
    for (const tipo of ['anclaje-descartado', 'anclaje-devuelto']) {
      assert.equal(areaDeTipo(tipo), 'anclajes');
      assert.equal(serializado(h).includes('lat'), false);
    }
    assert.deepEqual([...tiposDelArea('anclajes')], ['anclaje-descartado', 'anclaje-devuelto']);
  });

  test('Los descartes viajan dentro de la copia de la partida y no hay otra copia en ningún sitio', async () => {
    const celda = await celdaDeFixture('costero');
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const capa = creaCapaDeDescartes({ mundo: celda.mundo, cupos: celda.cupos, estado: estado.anclajes, mapaId: celda.mapaId });
    const sitio = celda.mundo.parajes[0].name;
    capa.descarta({ anclaje: sitio, porque: 'ya-no-existe', dia: 1, paso: 1 });

    const doc = congelaEstado(estado);
    assert.deepEqual(doc.areas.anclajes.mapas[celda.mapaId], [{ anclaje: sitio, rol: 'paraje', porque: 'ya-no-existe' }], 'los descartes no están dentro de la copia de la partida');
    // Y están **una sola vez**: ninguna otra área guarda una copia del sitio marcado.
    const veces = textoCanonico(doc).split(JSON.stringify(sitio).slice(1, -1)).length - 1;
    assert.equal(veces, 1, `"${sitio}" aparece ${veces} veces en la copia de la partida: hay otra copia de los descartes en algún sitio`);
  });
});

// ── La alarma de estirón ───────────────────────────────────────────────────────

describe('La alarma de estirón, que salta exactamente al cruzar el suelo', () => {
  test('Si el filtro deja el mundo sin reparto, se ofrece el estirón', async () => {
    // `urbano-denso` tiene siete parajes y su celda congeló un suelo de cinco: es el
    // único de los cuatro donde la alarma se puede poner roja por los dos lados.
    const { mundo, cupos, capa } = await frontera('urbano-denso');
    assert.equal(mundo.parajes.length, 7, 'el mundo ya no tiene siete parajes y el caso deja de medir el cruce');
    assert.equal(cupos.parajes.suelo, 5, 'el suelo congelado de esta celda ya no es cinco');
    assert.equal(capa.alarma().salta, false, 'la alarma salta en un mundo sin ni un descarte');

    const vivos = [];
    const cruces = [];
    for (const paraje of mundo.parajes.slice(0, 5)) {
      const marcado = capa.descarta({ anclaje: paraje.name, dia: 1, paso: 1 });
      vivos.push({ vivos: marcado.alarma.parajesVivos, salta: marcado.alarma.salta });
      if (marcado.cruzaElSuelo) cruces.push(marcado.alarma.parajesVivos);
    }

    // No salta mientras los vivos sean el suelo o más; salta en el descarte que lo cruza.
    assert.deepEqual(vivos, [
      { vivos: 6, salta: false },
      { vivos: 5, salta: false },
      { vivos: 4, salta: true },
      { vivos: 3, salta: true },
      { vivos: 2, salta: true },
    ], 'la alarma no salta exactamente al cruzar el suelo');
    assert.deepEqual(cruces, [4], 'la alarma cruza el suelo más de una vez, o en el descarte que no era');
  });

  test('Lo que se ofrece es el estirón que ya existe, y no ha cambiado nada al ofrecerlo', async () => {
    const { mundo, cupos, capa } = await frontera('urbano-denso');
    for (const p of mundo.parajes.slice(0, 3)) capa.descarta({ anclaje: p.name, dia: 1, paso: 1 });

    const alarma = capa.alarma(4);
    assert.equal(alarma.salta, true);
    assert.equal(alarma.estiron.tramosMas, TRAMOS_DEL_ESTIRON, 'la oferta no es el estirón que ya existe, con su mismo número de tramos');
    assert.equal(alarma.estiron.alcanceEnTramos, 4 + TRAMOS_DEL_ESTIRON, 'la oferta no dice hasta dónde llegaría el alcance ampliado');
    assert.equal(alarma.estiron.aceptado, false, 'la oferta llega dada por aceptada: el estirón se ofrece y no se impone');
    assert.equal(alarma.estiron.impuesto, false);

    // Es un dato y no una acción: no responder no amplía nada.
    assert.equal(serializado(capa.alarma(4)), serializado(alarma), 'algo se ha ampliado solo entre dos consultas idénticas');
    assert.equal(capa.alarma(4).estiron.alcanceEnTramos - TRAMOS_DEL_ESTIRON, 4, 'el alcance de la salida ha cambiado por devolver la oferta');

    // Y el texto de la oferta no menciona los descartes ni insinúa nada sobre quien juega.
    const dicho = serializado(alarma);
    for (const palabra of [/descart/i, /marcad/i, /demasiad/i, /culpa/i, /has marcado/i]) {
      assert.equal(palabra.test(dicho), false, `la alarma dice ${palabra}, y eso es un reproche con datos`);
    }
    assert.equal(cupos.parajes.suelo, alarma.suelo, 'la alarma no compara contra el suelo de la celda');
  });

  test('Deshacer el último descarte apaga la alarma', async () => {
    const { mundo, capa } = await frontera('urbano-denso');
    const marcados = mundo.parajes.slice(0, 3).map((p) => p.name);
    for (const n of marcados) capa.descarta({ anclaje: n, dia: 1, paso: 1 });
    assert.equal(capa.alarma().salta, true, 'la alarma no había saltado, así que apagarla no demuestra nada');

    const deshecho = capa.deshaz({ anclaje: marcados[2], dia: 2, paso: 1 });
    assert.equal(deshecho.alarma.salta, false, 'deshacer el último descarte no apaga la alarma');
    assert.equal(deshecho.alarma.parajesVivos, 5);
  });

  test('El suelo se lee de la celda y no se recalcula', async () => {
    const { mundo, cupos } = await frontera('urbano-denso');
    assert.equal(exigeSueloDeParajes(cupos), cupos.parajes.suelo);

    // Un suelo distinto en el cupo de la celda manda sobre cualquier recálculo: es lo que
    // hace que un mapa viejo siga comparándose contra el suelo con el que se generó.
    const otro = alarmaDeEstiron({ mundo, cupos: { parajes: { suelo: 7 } }, descartes: SIN_DESCARTES });
    assert.equal(otro.suelo, 7, 'el suelo se está recalculando en lugar de leerse de la celda');
    assert.equal(otro.salta, false, 'con siete parajes vivos y suelo siete la alarma salta: el criterio es «por debajo», no «igual o por debajo»');
    assert.equal(alarmaDeEstiron({ mundo, cupos: { parajes: { suelo: 8 } }, descartes: SIN_DESCARTES }).salta, true);
  });

  test('La falta de reparto se atribuye a los descartes solo si sin ellos había reparto', async () => {
    const mundo = await generaMundo('barrio-tres-calles', semillaDe('barrio-tres-calles', '1'));
    const uno = vistaDe([mundo.parajes[0].name]);

    // Con tramo 300 este mundo reparte, y con un sitio marcado deja de repartir: eso es
    // lo que distingue el motivo de los descartes del motivo del mundo.
    assert.equal(repartoDeAventuras({ mundo, tramo: 300 }).hayReparto, true, 'sin descartes este mundo ya no reparte y el caso deja de medir la atribución');
    const porLosDescartes = repartoDeAventuras({ mundo, tramo: 300, descartes: uno });
    assert.equal(porLosDescartes.hayReparto, false);
    assert.equal(porLosDescartes.motivo, MOTIVOS_DE_FALTA.DESCARTES);
    assert.equal(porLosDescartes.estiron.tramosMas, TRAMOS_DEL_ESTIRON, 'la falta por descartes no ofrece el estirón');

    // Y con tramo 120 no repartía ni antes: el barrio de tres calles sigue declarando el
    // mundo pequeño aunque haya un sitio marcado. No se le echa la culpa a quien juega de
    // algo que ya pasaba.
    assert.equal(repartoDeAventuras({ mundo, tramo: 120 }).motivo, MOTIVOS_DE_FALTA.MUNDO);
    assert.equal(repartoDeAventuras({ mundo, tramo: 120, descartes: uno }).motivo, MOTIVOS_DE_FALTA.MUNDO, 'un mundo que nunca dio para un lazo le está echando la culpa a los descartes');
  });

  test('Con todo marcado el motivo es el de los descartes, en los cuatro mundos de referencia', async () => {
    for (const nombre of ['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso']) {
      const mundo = await generaMundo(nombre, semillaDe(nombre, '1'));
      assert.equal(repartoDeAventuras({ mundo, tramo: 1500 }).hayReparto, true, `${nombre}: sin descartes no reparte`);
      const falta = repartoDeAventuras({ mundo, tramo: 1500, descartes: vistaDe(todosLosSitios(mundo)) });
      assert.equal(falta.hayReparto, false, `${nombre}: con el mundo entero marcado sigue repartiendo`);
      assert.equal(falta.motivo, MOTIVOS_DE_FALTA.DESCARTES, `${nombre}: el motivo declarado no es el de los descartes`);
    }
  });
});

// ── Lo que ya estaba en marcha ─────────────────────────────────────────────────

describe('El descarte no rompe lo que ya estaba en marcha', () => {
  test('La aventura en curso sigue con su cadena intacta y su beat se puede resolver', async () => {
    const celda = await celdaDeFixture('costero');
    const mundo = celda.mundo;
    const casteada = mundo.casting.find((c) => c.ok);
    assert.ok(casteada, 'el mundo de referencia no castea ninguna aventura y el caso no mide nada');

    const aventuras = estadoDeAventuras();
    const registro = registroInicial();
    acepta(aventuras, { aventura: casteada.aventura, mapaId: celda.mapaId, registro, dia: 1, paso: 0 });
    const cadenaAntes = serializado(casteada.beats);

    const capa = creaCapaDeDescartes({ mundo, cupos: celda.cupos, estado: estadoDeDescartes(), mapaId: celda.mapaId });
    const sitioDelBeat = casteada.beats[0].lugar.nombre;
    capa.descarta({ anclaje: sitioDelBeat, dia: 1, paso: 2 });

    assert.equal(serializado(casteada.beats), cadenaAntes, 'descartar un sitio ha recalculado la cadena de la aventura en curso');
    const resuelto = resuelveBeat(aventuras, { beat: casteada.beats[0] });
    assert.equal(resuelto.beat, casteada.beats[0].n, 'el beat del sitio marcado ya no se puede resolver');

    // Y al volver a repartir, ninguna aventura nueva usa ese sitio.
    const despues = castAll(mundo, mundo.seed, { descartes: capa.vista() });
    assert.equal(algunaMandaA(despues, sitioDelBeat), false, 'una aventura nueva vuelve a mandar al sitio marcado');
  });

  test('Un núcleo descartado no se borra: el descarte saca del casting, no borra el pueblo', async () => {
    const celda = await celdaDeFixture('costero');
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const capa = creaCapaDeDescartes({ mundo: celda.mundo, cupos: celda.cupos, estado: estado.anclajes, mapaId: celda.mapaId });
    const nucleo = celda.mundo.settlements[1];
    const antes = congelaEstado(estado);

    capa.descarta({ anclaje: nucleo.name, porque: 'no-es-sitio-para-pararse', dia: 1, paso: 1 });

    const vivo = celda.mundo.settlements.find((s) => s.name === nucleo.name);
    assert.ok(vivo, 'el núcleo marcado ha desaparecido del mundo');
    assert.equal(vivo.services.length, nucleo.services.length, 'el núcleo marcado ha perdido servicios');
    assert.equal(serializado(vivo.anchor), serializado(nucleo.anchor));

    // Y nada más de la partida se ha movido: la única diferencia está en `anclajes`.
    const despues = congelaEstado(estado);
    for (const area of Object.keys(antes.areas)) {
      if (area === 'anclajes') continue;
      assert.equal(serializado(despues.areas[area]), serializado(antes.areas[area]), `descartar un núcleo ha tocado el área "${area}"`);
    }
  });

  test('El punto de partida del mapa no se puede descartar', async () => {
    const celda = await celdaDeFixture('costero');
    const partida = celda.mundo.settlements[0].name;
    const estado = estadoDeDescartes();
    const capa = creaCapaDeDescartes({
      mundo: celda.mundo,
      cupos: celda.cupos,
      estado,
      mapaId: celda.mapaId,
      puntoDePartida: partida,
    });
    assert.throws(
      () => capa.descarta({ anclaje: partida, dia: 1, paso: 1 }),
      new RegExp(`${partida}.*punto de partida.*sin sitio desde el que salir`, 's'),
    );
    assert.deepEqual(descartesDeMapa(estado, celda.mapaId), [], 'el punto de partida ha quedado marcado igual');
    // Y cualquier otro sitio del mismo mundo sí se puede marcar: la puerta cerrada es una.
    assert.equal(capa.descarta({ anclaje: celda.mundo.parajes[0].name, dia: 1, paso: 1 }).anotado, true);
  });
});

// ── El cableado ────────────────────────────────────────────────────────────────

describe('Nada degrada por falta de cableado', () => {
  test('El reparto y el casting sin los descartes cableados fallan nombrando la pieza', async () => {
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    for (const roto of [null, {}, { descartado: 'sí' }, []]) {
      assert.throws(
        () => repartoDeAventuras({ mundo, tramo: 1500, descartes: roto }),
        /el reparto de aventuras necesita la vista de descartes del mapa/,
        `el reparto reparte igual con ${serializado(roto)} en lugar de la vista`,
      );
      assert.throws(
        () => castAll(mundo, mundo.seed, { descartes: roto }),
        /necesita la vista de descartes del mapa/,
        `el casting devuelve candidatos con ${serializado(roto)} en lugar de la vista`,
      );
      assert.throws(() => exigeDescartes(roto), /Sin ella devolvería candidatos que quien juega ya marcó/);
    }
    // Y los candidatos de un rol suelto, que es donde entra de verdad el descarte.
    const rol = Object.values(CATALOGO[0].roles).find((r) => r.tipo !== 'humano');
    assert.throws(() => candidatosDeRol(mundo, rol, { descartes: null }), /vista de descartes/);
  });

  test('El comprobador del suelo sin el cupo de la celda falla nombrando el cupo', async () => {
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    for (const cupos of [null, {}, { parajes: {} }, { parajes: { suelo: null } }, { parajes: { suelo: 2.5 } }, { parajes: { suelo: -1 } }]) {
      assert.throws(
        () => alarmaDeEstiron({ mundo, cupos, descartes: SIN_DESCARTES }),
        /cupos\.parajes\.suelo.*darlo por cero dejaría la alarma sin poder saltar nunca/s,
        `la alarma da el suelo por cero con ${serializado(cupos)}`,
      );
      assert.throws(() => creaCapaDeDescartes({ mundo, cupos, estado: estadoDeDescartes(), mapaId: 'casa' }), /cupos\.parajes\.suelo/);
    }
    // Y sin los parajes del mundo tampoco se da nada por bueno.
    assert.throws(() => alarmaDeEstiron({ mundo: {}, cupos: { parajes: { suelo: 5 } }, descartes: SIN_DESCARTES }), /sin ellos no hay nada que comparar contra el suelo/);
  });

  test('El área anclajes ya no está entre las que no reproducen', () => {
    assert.equal(AREAS_QUE_NO_REPRODUCEN.includes('anclajes'), false, 'el área anclajes sigue declarada como no reproducible, así que sus hechos no vuelven');
  });

  test('Una partida con descartes se congela y se vuelve a levantar con todos, en el mismo orden', async () => {
    const celda = await celdaDeFixture('costero');
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const capa = creaCapaDeDescartes({ mundo: celda.mundo, cupos: celda.cupos, estado: estado.anclajes, mapaId: celda.mapaId });
    const marcados = [celda.mundo.parajes[0].name, celda.mundo.parajes[1].name, celda.mundo.settlements[2].name];
    capa.descarta({ anclaje: marcados[0], porque: 'casa-particular', dia: 1, paso: 1 });
    capa.descarta({ anclaje: marcados[1], dia: 1, paso: 2 });
    capa.descarta({ anclaje: marcados[2], porque: 'otra-cosa', dia: 2, paso: 1 });

    const doc = congelaEstado(estado);
    const vuelta = levantaEstado(doc);
    assert.equal(serializado(congelaEstado(vuelta)), serializado(doc), 'la ida y vuelta del documento ha cambiado los descartes');
    assert.deepEqual(
      descartesDeMapa(vuelta.anclajes, celda.mapaId).map((d) => d.anclaje),
      descartesDeMapa(estado.anclajes, celda.mapaId).map((d) => d.anclaje),
      'los descartes vuelven en otro orden',
    );

    // Un motivo guardado que ya no está en el vocabulario falla nombrándolo, en lugar de
    // volver como `null`: un motivo que desaparece es un cambio de reglas que hay que ver.
    assert.throws(
      () => levantaDescartes({ mapas: { casa: [{ anclaje: 'A Torre Rota', porque: 'porque-sí' }] } }),
      /A Torre Rota.*porque-sí.*vocabulario cerrado/s,
    );
  });

  test('Una partida con descartes se reconstruye desde el registro y salen los mismos', async () => {
    const celda = await celdaDeFixture('costero');
    const registro = registroInicial();
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const capa = creaCapaDeDescartes({ mundo: celda.mundo, cupos: celda.cupos, estado: estado.anclajes, mapaId: celda.mapaId, registro });

    const uno = celda.mundo.parajes[0].name;
    const dos = celda.mundo.parajes[1].name;
    const tres = celda.mundo.settlements[2].name;
    capa.descarta({ anclaje: uno, porque: 'casa-particular', dia: 1, paso: 1 });
    capa.descarta({ anclaje: dos, dia: 1, paso: 2 });
    capa.descarta({ anclaje: tres, porque: 'ya-no-existe', dia: 2, paso: 1 });
    // Deshecho: si el registro solo trajera los descartes, este resucitaría.
    capa.deshaz({ anclaje: dos, dia: 2, paso: 4 });

    const reconstruido = reconstruye({ registro, semilla: SEMILLA_A });
    assert.deepEqual(
      descartesDeMapa(reconstruido.estado.anclajes, celda.mapaId),
      descartesDeMapa(estado.anclajes, celda.mapaId),
      'la reconstrucción desde el registro no devuelve los mismos descartes',
    );
    assert.equal(descartesDeMapa(reconstruido.estado.anclajes, celda.mapaId).some((d) => d.anclaje === dos), false, 'el descarte deshecho ha resucitado al reconstruir');

    // Y un deshacer sin su descarte delante falla nombrando el anclaje: el registro está
    // incompleto, y quitar en silencio lo que nadie marcó daría un estado que se declara
    // correcto y no lo es.
    const huerfano = registroInicial();
    anexa(huerfano, [hechoDeDevolucion({ mapaId: celda.mapaId, anclaje: uno, rol: 'paraje', dia: 1, paso: 1 })]);
    assert.throws(() => reconstruye({ registro: huerfano, semilla: SEMILLA_A }), new RegExp(`${uno}.*no trae antes su descarte`, 's'));
  });

  test('El área llega mal formada y se dice, en lugar de dar la partida por sin descartes', () => {
    for (const roto of [null, undefined, {}, { mapas: null }, 'sin descartes']) {
      assert.throws(() => descartesDeMapa(roto, 'casa'), /el área de descartes llega mal formada|se anota por el identificador|el mapa/i);
    }
    assert.throws(() => anotaDescarte(estadoDeDescartes(), { mapaId: 'casa', anclaje: '' }), /se anota por el identificador del sitio/);
    assert.deepEqual([...TIPOS_DE_HECHO].filter((t) => t.startsWith('anclaje-')), ['anclaje-descartado', 'anclaje-devuelto']);
  });
});
