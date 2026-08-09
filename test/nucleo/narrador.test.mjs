// SPEC-018 · El contrato con el LLM: el árbitro es el código y el narrador es el
//            modelo.
//
// Lo que se afirma aquí es una frontera, y una frontera se comprueba por los dos
// lados: que lo inerte llega y se adopta, y que lo vivo no llega nunca. Los casos
// con nombre de escenario son los de docs/testing.md, literales; los demás van
// marcados como hueco en test/spec-test-map.json, porque la propia spec declara en
// su sección de huecos que los dos puntos de invocación, el registro de tópicos,
// la generación cacheada, el descarte por partes, cinco de las seis comprobaciones
// del filtro y el cribado del prompt no tienen escenario en la batería.
//
// La mitad de privacidad es bloqueante y se afirma con instrumentos, no con fe: el
// inspector de tráfico saliente en modo estricto y el doble del proxy. Un caso de
// «esto no sale del móvil» que no corte la red está fingiendo, y un criterio que se
// cumple por construcción no mide nada — por eso cada afirmación de ausencia trae
// al lado su caso rojo, que es el que la hace afirmar algo.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema: el mundo sale de
// test/fixtures/osm/ por el doble de siempre y la espera se inyecta.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { creaDobleDelProxy, respuestasDefectuosas } from '../dobles/proxy.mjs';

import {
  CAMPOS_DEL_ESQUEMA,
  CAMPOS_INERTES,
  CATEGORIA_POR_TIPO,
  CLAVES_DEL_NARRADOR,
  DATOS_VIVOS,
  FALLBACK_DEL_ZURRON,
  MOMENTOS_DE_SALIDA,
  MOMENTO_PROHIBIDO,
  MOTIVOS_DEL_NARRADOR,
  PUNTOS_DE_INVOCACION,
  claveDeHueco,
  esqueletoDeAventura,
  exigeHueco,
  exigePunto,
  exigeTipoDeHueco,
  histogramaDelNarrador,
  huecoDelZurron,
  huecosDeAventura,
  leeRespuesta,
  motivoDelNarrador,
  peticionDeAventura,
  pideRedaccion,
  redactaAventura,
  redactaZurron,
  visteAventura,
} from '../../packages/nucleo/quests/narrador.js';
import {
  CAMPOS_DEL_SOBRE,
  REGLAS_DE_ESCRITURA,
  TONO,
  construyePrompt,
  cribaSegmentos,
  datosRealesDeMundo,
  segmentosDelPrompt,
  sobreDePeticion,
} from '../../packages/nucleo/quests/prompt.js';
import {
  CLAVES_DE_APTITUD,
  FAMILIAS_DE_APTITUD,
  IDIOMAS_CON_APTITUD,
  MOTIVOS_DE_APTITUD,
  apareceDato,
  claveDeAptitud,
  creaFiltroDeAptitud,
  histogramaDeAptitud,
  listasDeAptitud,
  motivoDeAptitud,
} from '../../packages/nucleo/names/aptitud-de-texto.js';
import { ALCANCE_DE_LA_CAPA, TOPE_DE_NOMBRE, adoptaNombrePropuesto } from '../../packages/nucleo/names/propuesta.js';
import {
  CATEGORIAS_DE_TOPICO,
  TAMANO_DE_VENTANA,
  TICS_PRECARGADOS,
  anotaTopico,
  aperturaDeTexto,
  congelaTopicos,
  estadoDeTopicos,
  levantaTopicos,
  registroDeMundo,
  registroInicialDeTopicos,
  tamanosDeVentana,
  topicosParaElPrompt,
} from '../../packages/nucleo/partida/topicos.js';
import { CATALOGO, TOPES_DE_TEXTO, compruebaCatalogo, huecosDePlantilla } from '../../packages/nucleo/quests/catalogo.js';
import { crearIndiceDeNombres, localeFor } from '../../packages/nucleo/names/index.js';
import { congelaTextos, estadoDeTextos, levantaTextos } from '../../packages/nucleo/partida/diario.js';

// ── El mundo de los escenarios ────────────────────────────────────────────────
//
// «42.40,-8.81#1» es literalmente la semilla que citan los escenarios de la
// batería, y es la del extracto costero: no hay que traducir nada.

const SEMILLA_DEL_ESCENARIO = '42.40,-8.81#1';

let MUNDO = null;
async function mundoDePrueba() {
  if (!MUNDO) MUNDO = await generaMundo('costero', semillaDe('costero', '1'));
  return MUNDO;
}

/** La primera plantilla que castea sobre ese mundo, con su aventura ya repartida. */
function primeraCasteada(mundo) {
  const c = (mundo.casting ?? []).find((x) => x.ok);
  assert.ok(c, 'el mundo del escenario no castea ninguna plantilla y sin aventura no hay nada que vestir');
  return c;
}

/** El idioma del mundo, que sale de dónde está y no de una constante de prueba. */
const localeDe = (mundo) => localeFor(mundo.origin.lat, mundo.origin.lon);

/**
 * La espera inyectada que **nunca vence**.
 *
 * El presupuesto de espera por defecto arma un `setTimeout` de verdad, y una
 * batería que dependa del reloj del sistema deja de ser reproducible. Aquí se
 * inyecta una que no resuelve jamás, así que gana siempre la llamada; y para el
 * caso del presupuesto agotado se inyecta la contraria, que resuelve ya.
 */
const NUNCA_VENCE = () => ({ promesa: new Promise(() => {}), cancela: () => {} });
const VENCE_YA = () => ({ promesa: Promise.resolve('espera'), cancela: () => {} });

/** El filtro de un locale, con los datos reales de un mundo si se le pasan. */
const filtroDe = (locale, datosReales = []) => creaFiltroDeAptitud({ locale, datosReales });

/** Un hueco de prueba, con todo lo que `exigeHueco` pide. */
const hueco = (clave, tipo = 'escena', tope = 220, fallback = 'El camino sigue por donde siempre, sin prisa y sin queja.') =>
  ({ clave, tipo, tope, fallback });

/** Los textos de una redacción, indexados por clave, que es como se leen. */
const porClave = (redaccion) => Object.fromEntries(redaccion.textos.map((t) => [t.clave, t]));

/** Las claves de descarte de una redacción, que es lo que se agrega. */
const clavesDeDescarte = (redaccion) => redaccion.diagnostico.descartes.map((d) => d.motivo.clave);

/** Todos los textos de fallback del catálogo, que son los que llegan a pantalla sin red. */
function fallbacksDelCatalogo() {
  const out = [];
  for (const plantilla of CATALOGO) {
    for (const h of huecosDePlantilla(plantilla)) out.push({ plantilla: plantilla.id, clave: h.clave, texto: h.fallback });
  }
  return out;
}

// ── El árbitro es el código y el narrador es el LLM ───────────────────────────

describe('El árbitro es el código y el narrador es el LLM', () => {
  test('Con LLM y sin LLM la estructura es idéntica', async () => {
    // SPEC-010 lo sostiene por el lado del casting —quitarle los textos al catálogo
    // no mueve el reparto—. Aquí se sostiene por el otro, que es el que de verdad
    // podría romperlo: la misma aventura vestida con narrador y sin él.
    const mundo = await mundoDePrueba();
    const c = primeraCasteada(mundo);
    const locale = localeDe(mundo);
    const huecos = huecosDeAventura(c.tpl);

    const comun = { mundo, aventura: c.aventura, plantilla: c.tpl, locale, momento: 'antes-de-salir', presupuestoMs: 5000, espera: NUNCA_VENCE };
    const sinRed = await redactaAventura({ ...comun });
    const conRed = await redactaAventura({
      ...comun,
      llamada: async () => ({ textos: Object.fromEntries(huecos.map((h) => [h.clave, 'Una brisa serena empuja la puerta del molino y sigue camino.'])) }),
    });

    const conNarrador = visteAventura({ aventura: c.aventura, redaccion: conRed, estado: null, mapa: 'mapa-del-escenario' });
    const sinNarrador = visteAventura({ aventura: c.aventura, redaccion: sinRed, estado: null, mapa: 'mapa-del-escenario' });

    // El mismo casting, los mismos beats en el mismo orden, las mismas cantidades y
    // el mismo lazo: el esqueleto es todo lo que no es texto, y se compara entero.
    assert.equal(
      JSON.stringify(esqueletoDeAventura(conNarrador)),
      JSON.stringify(esqueletoDeAventura(sinNarrador)),
      'vestir la aventura con narrador ha cambiado algo que no es texto',
    );
    assert.deepEqual(conNarrador.beats.map((b) => b.n), sinNarrador.beats.map((b) => b.n));
    assert.deepEqual(conNarrador.presupuesto, sinNarrador.presupuesto, 'el oro difiere con narrador y sin él');

    // Pero los textos difieren, que es lo que hace que lo anterior afirme algo.
    const con = porClave(conRed);
    const sin = porClave(sinRed);
    const cambiados = huecos.filter((h) => con[h.clave].texto !== sin[h.clave].texto);
    assert.ok(cambiados.length > 0, 'con narrador y sin él no ha cambiado ni un texto');
    for (const h of cambiados) assert.equal(con[h.clave].origen, 'llm');
    for (const h of huecos) assert.equal(sin[h.clave].origen, 'plantilla');
  });

  test('El modelo no escribe ningún dato vivo', async () => {
    // La respuesta trae un campo «oro» con valor 500. El oro de la aventura es el
    // que fijó la plantilla, y el campo del modelo se descarta **sin interpretarse**.
    const mundo = await mundoDePrueba();
    const c = primeraCasteada(mundo);
    const oroDeLaPlantilla = JSON.stringify(c.aventura.presupuesto);
    const huecos = huecosDeAventura(c.tpl);

    const redaccion = await redactaAventura({
      mundo,
      aventura: c.aventura,
      plantilla: c.tpl,
      locale: localeDe(mundo),
      momento: 'antes-de-salir',
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      llamada: async () => ({
        oro: 500,
        textos: { titulo: 'La puerta que no cerraba' },
      }),
    });

    const vestida = visteAventura({ aventura: c.aventura, redaccion, estado: null, mapa: 'mapa-del-escenario' });
    assert.equal(JSON.stringify(vestida.presupuesto), oroDeLaPlantilla, 'el modelo ha movido el oro de la aventura');
    assert.equal(vestida.oro, undefined, 'el campo vivo del modelo ha llegado a la aventura');
    assert.equal(JSON.stringify(vestida).includes('"oro"'), false, 'el campo vivo del modelo ha llegado a la aventura');
    assert.equal(JSON.stringify(redaccion.textos).includes('500'), false, 'el valor del campo vivo se ha leído como si fuera un texto');

    // Y el descarte consta con su clave propia: no es lo mismo un campo inventado
    // que un intento de escribir el oro.
    assert.ok(clavesDeDescarte(redaccion).includes(MOTIVOS_DEL_NARRADOR.DATO_VIVO), 'el campo «oro» no se descartó como dato vivo');
    assert.equal(redaccion.diagnostico.histograma[MOTIVOS_DEL_NARRADOR.DATO_VIVO], 1);
    // El resto de la respuesta se adopta igual: descartar un campo no tira la llamada.
    assert.equal(porClave(redaccion).titulo.origen, 'llm');

    // Y ninguno de los datos vivos declarados llega por su nombre: se comprueban
    // todos, no solo el del escenario.
    const { propuestas, descartes } = leeRespuesta(Object.fromEntries(DATOS_VIVOS.map((d) => [d, 'lo que sea'])), [hueco('titulo', 'titulo', 52)]);
    assert.equal(propuestas.size, 0, 'un dato vivo ha llegado a las propuestas');
    assert.equal(descartes.length, DATOS_VIVOS.length);
    for (const d of descartes) assert.equal(d.motivo.clave, MOTIVOS_DEL_NARRADOR.DATO_VIVO);
  });

  test('Lo que llega fuera del esquema se descarta', async () => {
    // El caso sale del catálogo de respuestas defectuosas del doble, que existe
    // exactamente para esto: la respuesta trae un campo que el esquema no declara.
    const defectuosa = respuestasDefectuosas().find((e) => e.id === 'campo-desconocido');
    assert.ok(defectuosa, 'el doble del proxy ya no trae la respuesta defectuosa «campo-desconocido»');
    const proxy = creaDobleDelProxy({ modo: 'responde-mal', defecto: 'campo-desconocido' });

    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [hueco('beat:1')],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      llamada: async (peticion) => proxy.texto(peticion),
    });

    // El campo se descarta y el resto de la respuesta se adopta igual.
    assert.equal(porClave(redaccion)['beat:1'].texto, defectuosa.respuesta.texto);
    assert.equal(porClave(redaccion)['beat:1'].origen, 'llm');

    // Y no existe ningún sitio donde se haya leído su valor.
    const serializada = JSON.stringify(redaccion);
    assert.equal(serializada.includes(String(defectuosa.respuesta.prioridad_render)), false, 'el valor del campo desconocido se ha leído en algún sitio');
    assert.equal(serializada.includes(defectuosa.respuesta.continuacion_sugerida), false, 'el valor del campo desconocido se ha leído en algún sitio');

    // Nada de esto es un error visible para la jugadora: lo que llega a pantalla es
    // el texto, y el descarte vive solo en el diagnóstico, con su clave y su motivo.
    for (const t of redaccion.textos) assert.equal(typeof t.texto, 'string');
    const descartes = redaccion.diagnostico.descartes.filter((d) => d.motivo.clave === MOTIVOS_DEL_NARRADOR.CAMPO_DESCONOCIDO);
    assert.equal(descartes.length, 2, 'los dos campos que el esquema no declara no constan en el diagnóstico');
    for (const d of descartes) {
      assert.ok(Object.keys(defectuosa.respuesta).includes(d.clave), 'el descarte no nombra la clave que lo provocó');
      assert.ok(CLAVES_DEL_NARRADOR.includes(d.motivo.clave), 'el motivo del descarte no es del catálogo cerrado');
    }
  });

  test('Un texto que no pasa el filtro cae al fallback', async () => {
    // La otra respuesta defectuosa del doble: manda a beber en el anclaje real y
    // suelta un exabrupto. Se usa el texto de plantilla y la aventura funciona igual.
    const proxy = creaDobleDelProxy({ modo: 'responde-mal', defecto: 'no-apto' });
    const suyo = hueco('beat:1');

    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [suyo],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      llamada: async (peticion) => proxy.texto(peticion),
    });

    assert.equal(porClave(redaccion)['beat:1'].texto, suyo.fallback, 'el texto no apto no cayó al fallback de la plantilla');
    assert.equal(porClave(redaccion)['beat:1'].origen, 'plantilla');
    const descarte = redaccion.diagnostico.descartes.find((d) => d.clave === 'beat:1');
    assert.equal(descarte.motivo.clave, MOTIVOS_DEL_NARRADOR.NO_APTO);
    // Y el motivo fino sigue siendo una clave del catálogo del filtro, no una frase.
    assert.ok(CLAVES_DE_APTITUD.includes(descarte.motivo.detalle.clave), 'el motivo fino del rechazo no es del catálogo cerrado');
  });

  test('Sin red, la aventura funciona entera', async () => {
    // Con el inspector en modo estricto y el doble en «falla siempre»: todos los
    // textos salen de plantilla, ningún hueco queda vacío y no sale nada del móvil.
    const mundo = await mundoDePrueba();
    const c = primeraCasteada(mundo);
    const huecos = huecosDeAventura(c.tpl);
    const inspector = creaInspectorDeRed({ estricto: true });
    const proxy = creaDobleDelProxy({ modo: 'falla-siempre' });

    try {
      const redaccion = await redactaAventura({
        mundo,
        aventura: c.aventura,
        plantilla: c.tpl,
        locale: localeDe(mundo),
        momento: 'antes-de-salir',
        presupuestoMs: 5000,
        espera: NUNCA_VENCE,
        llamada: async (peticion) => proxy.texto(peticion),
      });

      assert.equal(redaccion.textos.length, huecos.length, 'algún hueco de la aventura se ha quedado sin texto');
      for (const t of redaccion.textos) {
        assert.equal(t.origen, 'plantilla', `el hueco "${t.clave}" no cayó a plantilla sin red`);
        assert.ok(t.texto.trim().length > 0, `el hueco "${t.clave}" ha quedado vacío`);
      }
      // Un fallo de red no rompe la aventura: se puede recorrer entera igual.
      const vestida = visteAventura({ aventura: c.aventura, redaccion, estado: null, mapa: 'mapa-del-escenario' });
      assert.equal(vestida.beats.length, c.aventura.beats.length);
      for (const h of huecos) assert.ok(vestida.textos[h.clave], `la aventura vestida no cita el texto del hueco "${h.clave}"`);

      // Silencio hacia la jugadora, constancia en el dato.
      assert.equal(new Set(clavesDeDescarte(redaccion)).size, 1);
      assert.equal(clavesDeDescarte(redaccion)[0], MOTIVOS_DEL_NARRADOR.FALLO_DE_RED);
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico del móvil sin red');
    } finally {
      inspector.suelta();
    }
  });
});

// ── El esquema cerrado, y lo que llega fuera de él ────────────────────────────

describe('El esquema cerrado, y lo que llega fuera de él', () => {
  test('El catálogo de campos inertes son seis y no se cruza con ningún dato vivo', () => {
    assert.deepEqual([...CAMPOS_INERTES], ['titulo', 'gancho', 'escena', 'rumor', 'zurron', 'nombre']);
    const cruce = CAMPOS_INERTES.filter((c) => DATOS_VIVOS.includes(c));
    assert.deepEqual(cruce, [], 'un campo está declarado a la vez como inerte y como dato vivo');
    // Y cada tipo de hueco sabe a qué categoría del registro va lo que se adopte.
    for (const tipo of CAMPOS_INERTES) assert.ok(CATEGORIAS_DE_TOPICO.includes(CATEGORIA_POR_TIPO[tipo]), `el tipo "${tipo}" no declara categoría de tópico`);
    // El esquema de la respuesta es igual de cerrado y también se enumera.
    assert.deepEqual([...CAMPOS_DEL_ESQUEMA], ['textos', 'nombres', 'texto', 'nombre']);
    assert.throws(() => exigeTipoDeHueco('resumen'), /resumen/, 'un tipo fuera del catálogo no falla nombrándolo');
  });

  test('Una respuesta que no es un documento legible se rechaza entera', async () => {
    const huecos = [hueco('beat:1'), hueco('beat:2', 'escena', 220, 'El segundo tramo huele a leña mojada.')];
    for (const ilegible of ['una frase suelta', 42, null, ['textos']]) {
      const redaccion = await pideRedaccion({
        punto: 'crear-aventura',
        momento: 'antes-de-salir',
        huecos,
        presupuestoMs: 5000,
        espera: NUNCA_VENCE,
        filtro: filtroDe('es'),
        llamada: async () => ilegible,
      });
      assert.equal(redaccion.textos.length, 2);
      for (const t of redaccion.textos) assert.equal(t.origen, 'plantilla', `una respuesta ilegible (${JSON.stringify(ilegible)}) no mandó todos los huecos al fallback`);
      assert.deepEqual(new Set(clavesDeDescarte(redaccion)), new Set([MOTIVOS_DEL_NARRADOR.RESPUESTA_ILEGIBLE]));
    }
  });

  test('Un texto vacío cae al fallback con motivo propio', async () => {
    const suyo = hueco('beat:1');
    for (const vacio of ['', '   ', '\n\t ']) {
      const redaccion = await pideRedaccion({
        punto: 'crear-aventura',
        momento: 'antes-de-salir',
        huecos: [suyo],
        presupuestoMs: 5000,
        espera: NUNCA_VENCE,
        filtro: filtroDe('es'),
        llamada: async () => ({ texto: vacio }),
      });
      assert.equal(porClave(redaccion)['beat:1'].texto, suyo.fallback);
      assert.equal(porClave(redaccion)['beat:1'].origen, 'plantilla');
      const descarte = redaccion.diagnostico.descartes.find((d) => d.clave === 'beat:1');
      assert.equal(descarte.motivo.clave, MOTIVOS_DEL_NARRADOR.NO_APTO);
      assert.equal(descarte.motivo.detalle.clave, MOTIVOS_DE_APTITUD.TEXTO_VACIO, 'el texto vacío no trae su motivo propio');
    }
  });

  test('Cada texto adoptado declara su origen y cada hueco que cayó declara el suyo', async () => {
    const bueno = hueco('beat:1');
    const malo = hueco('beat:2', 'escena', 220, 'El segundo tramo huele a leña mojada.');
    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [bueno, malo],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      llamada: async () => ({ textos: { 'beat:1': 'Una brisa serena empuja la puerta del molino.', 'beat:2': 'El tabernero te sirve una ronda de aguardiente.' } }),
    });
    const textos = porClave(redaccion);
    assert.equal(textos['beat:1'].origen, 'llm');
    assert.equal(textos['beat:2'].origen, 'plantilla');
    assert.equal(textos['beat:2'].texto, malo.fallback);
    // Los dos orígenes son los del enumerado cerrado del área de textos y no otros.
    for (const t of redaccion.textos) assert.ok(['llm', 'plantilla'].includes(t.origen));
  });

  test('Los huecos que nadie pidió se descartan y los que faltan caen al fallback', async () => {
    const pedidos = [hueco('beat:1'), hueco('beat:2', 'escena', 220, 'El segundo tramo huele a leña mojada.')];
    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: pedidos,
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      llamada: async () => ({ textos: { 'beat:1': 'Una brisa serena empuja la puerta del molino.', 'beat:9': 'Un beat que nadie pidió.' } }),
    });
    const textos = porClave(redaccion);
    assert.equal(textos['beat:1'].origen, 'llm');
    assert.equal(textos['beat:2'].origen, 'plantilla', 'el hueco que faltaba no cayó al fallback');
    assert.equal(redaccion.textos.length, 2, 'un hueco que nadie pidió ha llegado a los textos');
    const claves = clavesDeDescarte(redaccion);
    assert.ok(claves.includes(MOTIVOS_DEL_NARRADOR.HUECO_NO_PEDIDO));
    assert.ok(claves.includes(MOTIVOS_DEL_NARRADOR.HUECO_AUSENTE));
    // Y el mismo hueco que llega dos veces se resuelve por **el orden declarado de
    // lectura y no por el del documento**: dos respuestas con los mismos campos
    // escritos al revés dan la misma propuesta y el mismo diagnóstico.
    const unaForma = leeRespuesta({ textos: { 'beat:1': 'por el diccionario' }, texto: 'por el atajo' }, [pedidos[0]]);
    const laOtra = leeRespuesta({ texto: 'por el atajo', textos: { 'beat:1': 'por el diccionario' } }, [pedidos[0]]);
    assert.equal(unaForma.propuestas.get('beat:1'), laOtra.propuestas.get('beat:1'), 'el resultado depende del orden en que el modelo escribió su documento');
    assert.deepEqual(unaForma.descartes, laOtra.descartes);
  });
});

// ── El fallback es el camino normal, no el de excepción ───────────────────────

describe('El fallback es el camino normal, no el de excepción', () => {
  test('Toda plantilla del catálogo declara un texto de fallback para cada uno de sus huecos', () => {
    for (const plantilla of CATALOGO) {
      const huecos = huecosDePlantilla(plantilla);
      assert.ok(huecos.length > 0, `la plantilla "${plantilla.id}" no declara ningún hueco`);
      for (const h of huecos) {
        assert.equal(typeof h.fallback, 'string', `el hueco "${h.clave}" de "${plantilla.id}" no declara fallback`);
        assert.ok(h.fallback.trim().length > 0, `el hueco "${h.clave}" de "${plantilla.id}" declara un fallback vacío`);
        assert.ok(h.fallback.length <= h.tope, `el fallback de "${h.clave}" de "${plantilla.id}" pasa de su tope`);
      }
    }
    // Y una plantilla sin uno se rechaza **al cargar el catálogo**, no al pedirlo.
    const roto = JSON.parse(JSON.stringify(CATALOGO));
    roto[0].desenlace.texto = '   ';
    assert.throws(() => compruebaCatalogo(roto), /fallback|desenlace/, 'una plantilla sin texto de fallback no se rechaza al cargarse el catálogo');
  });

  test('El presupuesto de espera sin declarar hace fallar la llamada nombrando la dependencia', async () => {
    // Al revés que la llamada de red: su ausencia no describe ningún estado
    // legítimo, así que falla en vez de esperar sin límite.
    for (const sinPresupuesto of [undefined, null, 0, -1, 'mucho']) {
      await assert.rejects(
        () => pideRedaccion({ punto: 'crear-aventura', momento: 'antes-de-salir', huecos: [hueco('beat:1')], presupuestoMs: sinPresupuesto, filtro: filtroDe('es'), espera: NUNCA_VENCE }),
        /presupuesto de espera/,
        `el presupuesto ${JSON.stringify(sinPresupuesto)} no hizo fallar la llamada`,
      );
    }
  });

  test('El presupuesto de espera agotado manda todos los huecos al fallback', async () => {
    const huecos = [hueco('beat:1'), hueco('beat:2', 'escena', 220, 'El segundo tramo huele a leña mojada.')];
    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos,
      presupuestoMs: 1200,
      espera: VENCE_YA,
      filtro: filtroDe('es'),
      llamada: () => new Promise(() => {}),
    });
    for (const t of redaccion.textos) assert.equal(t.origen, 'plantilla');
    assert.deepEqual(new Set(clavesDeDescarte(redaccion)), new Set([MOTIVOS_DEL_NARRADOR.ESPERA_AGOTADA]));
    assert.equal(redaccion.diagnostico.descartes[0].motivo.detalle.presupuestoMs, 1200, 'el motivo no dice con qué presupuesto se agotó');
  });

  test('La llamada de red que lanza un error no se propaga a la pantalla', async () => {
    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [hueco('beat:1')],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      llamada: async () => { throw new Error('el proxy no responde'); },
    });
    assert.equal(porClave(redaccion)['beat:1'].origen, 'plantilla');
    assert.equal(clavesDeDescarte(redaccion)[0], MOTIVOS_DEL_NARRADOR.FALLO_DE_RED);
    // El error queda en el dato y no en el texto: la pantalla no lo ve.
    for (const t of redaccion.textos) assert.equal(t.texto.includes('proxy'), false);
  });

  test('Ningún texto que llega a las pantallas menciona la red, la aplicación, un permiso ni una espera', () => {
    // Lo que llega a las pantallas cuando la llamada falla son los textos de
    // fallback del catálogo, así que la afirmación se hace sobre ellos: dentro del
    // juego solo habla el mundo, también —y sobre todo— cuando no hay cobertura.
    const listas = listasDeAptitud('es');
    const choques = [];
    for (const { plantilla, clave, texto } of fallbacksDelCatalogo()) {
      for (const regla of listas.vozDeAplicacion) {
        const casa = texto.match(regla.re);
        if (casa) choques.push(`${plantilla} · ${clave}: «${casa[0]}» (${regla.formula})`);
      }
    }
    assert.deepEqual(choques, [], `hay textos de fallback con voz de aplicación:\n${choques.join('\n')}`);
  });

  test('El diagnóstico de una caída entera se lee sin pantalla y se agrega por clave', async () => {
    const huecos = [hueco('beat:1'), hueco('beat:2', 'escena', 220, 'El segundo tramo huele a leña mojada.')];
    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos,
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
    });
    // Sin llamada inyectada: cae entera, con su clave, y sin intentar nada.
    assert.deepEqual(new Set(clavesDeDescarte(redaccion)), new Set([MOTIVOS_DEL_NARRADOR.SIN_LLAMADA]));
    assert.equal(redaccion.llamo, false);

    // El histograma sale por clave y sin parsear ninguna frase, y enumera el
    // catálogo entero para que un motivo a cero se distinga de uno que no existe.
    const histograma = redaccion.diagnostico.histograma;
    assert.deepEqual(Object.keys(histograma).sort(), [...CLAVES_DEL_NARRADOR].sort());
    assert.equal(histograma[MOTIVOS_DEL_NARRADOR.SIN_LLAMADA], 2);
    assert.equal(histograma[MOTIVOS_DEL_NARRADOR.NO_APTO], 0);
    assert.deepEqual(histogramaDelNarrador([]), Object.fromEntries(CLAVES_DEL_NARRADOR.map((c) => [c, 0])));
    // Y una causa fuera del catálogo hace fallar la entrega en vez de salir genérica.
    assert.throws(() => motivoDelNarrador({ clave: 'se-me-ocurrio-ahora' }), /se-me-ocurrio-ahora/);
  });
});

// ── El filtro de aptitud sobre todo texto generado ────────────────────────────

describe('El filtro de aptitud sobre todo texto generado', () => {
  // Un texto que pasa las ocho familias, para poder medir el tope sin que lo tumbe
  // otra cosa. Se comprueba abajo que de verdad pasa, porque si dejara de pasar el
  // caso del tope estaría midiendo el motivo equivocado.
  const LIMPIO = 'Una brisa serena empuja la puerta del molino y sigue camino';

  test('Un texto exactamente en el tope de longitud pasa y uno de un carácter más cae al fallback', () => {
    const filtro = filtroDe('es');
    const tope = LIMPIO.length;
    const enElTope = filtro.valida(LIMPIO, { tope });
    assert.equal(enElTope.apto, true, `el texto de control ya no pasa el filtro: ${JSON.stringify(enElTope.motivo)}`);

    const unoMas = filtro.valida(`${LIMPIO}.`, { tope });
    assert.equal(unoMas.apto, false, 'un carácter de más no cayó');
    assert.equal(claveDeAptitud(unoMas.motivo), MOTIVOS_DE_APTITUD.FUERA_DE_TOPE);
    assert.equal(unoMas.motivo.detalle.tope, tope);
    assert.equal(unoMas.motivo.detalle.longitud, tope + 1);
  });

  test('El motivo de un rechazo es una clave del catálogo cerrado y no una frase', () => {
    const filtro = filtroDe('es');
    const casos = [
      ['', MOTIVOS_DE_APTITUD.TEXTO_VACIO],
      ['El tabernero te sirve una ronda de aguardiente.', MOTIVOS_DE_APTITUD.LEXICO_NO_APTO],
      ['Todos los vecinos salen a mirar.', MOTIVOS_DE_APTITUD.MASCULINO_GENERICO],
      ['Les vecines salen a mirar.', MOTIVOS_DE_APTITUD.MORFOLOGIA_INVENTADA],
      ['Sin conexión no se puede seguir.', MOTIVOS_DE_APTITUD.VOZ_DE_APLICACION],
    ];
    for (const [texto, clave] of casos) {
      const veredicto = filtro.valida(texto, { tope: 240 });
      assert.equal(veredicto.apto, false, `«${texto}» pasó el filtro`);
      assert.equal(claveDeAptitud(veredicto.motivo), clave, `«${texto}» no dio el motivo esperado`);
      assert.equal(typeof veredicto.motivo.clave, 'string');
      assert.ok(CLAVES_DE_APTITUD.includes(veredicto.motivo.clave));
    }
    // Los rechazos se agregan por clave, sin parsear ninguna frase.
    const motivos = casos.map(([texto]) => filtro.valida(texto, { tope: 240 }).motivo);
    const histograma = histogramaDeAptitud(motivos);
    assert.deepEqual(Object.keys(histograma).sort(), [...CLAVES_DE_APTITUD].sort());
    assert.equal(Object.values(histograma).reduce((a, b) => a + b, 0), casos.length);
  });

  test('Una causa que no está en el catálogo hace fallar la entrega nombrándola', () => {
    assert.throws(() => motivoDeAptitud({ clave: 'no-me-gusta' }), /no-me-gusta/);
    assert.throws(() => claveDeAptitud({ clave: 'no-me-gusta' }), /no-me-gusta/);
  });

  test('Las listas del filtro llegan inyectadas por locale y un locale sin listas hace fallar la validación', () => {
    // Las ocho familias existen para los dos idiomas declarados, y ninguna está
    // escrita dentro de la comprobación: se compilan fuera y se inyectan.
    for (const locale of IDIOMAS_CON_APTITUD) {
      const listas = listasDeAptitud(locale);
      for (const familia of FAMILIAS_DE_APTITUD) {
        assert.ok(Array.isArray(listas[familia]) && listas[familia].length > 0, `${locale} no declara la familia "${familia}"`);
      }
    }
    // Y un idioma sin listas falla nombrándolo y enumerando los disponibles, en vez
    // de dar por apto lo que no ha podido comprobar.
    assert.throws(() => listasDeAptitud('fr'), /"fr"/);
    assert.throws(() => listasDeAptitud('fr'), new RegExp(IDIOMAS_CON_APTITUD.join(', ')));
    assert.throws(() => creaFiltroDeAptitud({ locale: 'fr' }), /"fr"/);

    // Con listas inyectadas a mano, la comprobación usa esas y no las de por defecto.
    const aMano = { ...listasDeAptitud('es'), lexicoNoApto: [] };
    assert.equal(creaFiltroDeAptitud({ locale: 'es', listas: aMano }).valida('Sirve aguardiente del bueno', { tope: 240 }).apto, true);
  });

  test('El mismo texto y las mismas listas dan el mismo veredicto y el mismo motivo', () => {
    const filtro = filtroDe('es');
    for (const texto of [LIMPIO, 'Todos los vecinos salen a mirar.', 'El tabernero te sirve una ronda de aguardiente.']) {
      const a = filtro.valida(texto, { tope: 240 });
      const b = filtro.valida(texto, { tope: 240 });
      assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), `«${texto}» da dos veredictos distintos`);
    }
  });

  test('El filtro no importa la red ni el reloj', () => {
    for (const modulo of ['packages/nucleo/names/aptitud-de-texto.js', 'packages/nucleo/names/propuesta.js', 'packages/nucleo/quests/prompt.js', 'packages/nucleo/quests/narrador.js', 'packages/nucleo/partida/topicos.js']) {
      const texto = fuente(modulo);
      const rutas = [...texto.matchAll(/(?:^|\n)\s*(?:import|export)[^\n]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const ruta of rutas) {
        assert.ok(ruta.startsWith('.'), `${modulo} importa "${ruta}", que no es un módulo del propio paquete`);
      }
      // Ni red, ni reloj, ni azar del sistema dentro del módulo. `setTimeout` sí, y
      // solo en el narrador: es la espera por defecto, y se puede inyectar otra.
      const sinComentarios = texto.replace(/^\s*\/\/.*$/gm, '');
      for (const prohibido of ['fetch(', 'XMLHttpRequest', 'Date.now', 'new Date', 'Math.random']) {
        assert.equal(sinComentarios.includes(prohibido), false, `${modulo} usa ${prohibido}`);
      }
    }
  });

  test('Un texto que manda a consumir en el anclaje real no pasa el filtro', () => {
    const filtro = filtroDe('es');
    for (const texto of ['El posadero te invita a tomar algo antes de seguir.', 'Paga la cuenta y sal por la puerta de atrás.']) {
      const veredicto = filtro.valida(texto, { tope: 240 });
      assert.equal(veredicto.apto, false, `«${texto}» pasó el filtro`);
      assert.ok(
        [MOTIVOS_DE_APTITUD.CONSUMO_EN_EL_ANCLAJE, MOTIVOS_DE_APTITUD.LEXICO_NO_APTO].includes(claveDeAptitud(veredicto.motivo)),
        `«${texto}» no cayó por consumo ni por léxico`,
      );
    }
  });

  test('Un texto que arrastra el nombre real de un anclaje no pasa el filtro y lo nombra', async () => {
    // La puerta de atrás que el prompt tiene cerrada: el nombre real volviendo
    // dentro de la respuesta. El filtro la cierra por su lado.
    const mundo = await mundoDePrueba();
    const datosReales = datosRealesDeMundo(mundo);
    const real = datosReales.find((d) => d.de.includes('nombre real') && d.dato.length >= 5);
    assert.ok(real, 'el mundo del escenario no trae ningún nombre real de anclaje con el que probar');

    const filtro = filtroDe('es', datosReales);
    const veredicto = filtro.valida(`Vas hacia ${real.dato} sin mucha gana.`, { tope: 240 });
    assert.equal(veredicto.apto, false, 'un texto con el nombre real del anclaje pasó el filtro');
    assert.equal(claveDeAptitud(veredicto.motivo), MOTIVOS_DE_APTITUD.DATO_REAL);
    assert.equal(veredicto.motivo.fragmento, real.dato, 'el rechazo no nombra el anclaje que lo tumbó');
    // Y sin los datos reales inyectados, el mismo texto pasa: la comprobación es
    // del mundo que se le da, no de una lista escondida dentro.
    assert.equal(filtroDe('es').valida(`Vas hacia ${real.dato} sin mucha gana.`, { tope: 240 }).apto, true);
  });

  test('No se usa masculino genérico en fórmulas frecuentes', () => {
    // La batería lo pedía sobre los textos de plantilla y de fallback; con esta fila
    // se afirma también sobre lo generado, que es la mitad que faltaba.
    const listas = listasDeAptitud('es');
    const choques = [];
    for (const { plantilla, clave, texto } of fallbacksDelCatalogo()) {
      for (const regla of listas.masculinoGenerico) {
        const casa = texto.match(regla.re);
        if (casa) choques.push(`${plantilla} · ${clave}: «${casa[0]}»`);
      }
    }
    assert.deepEqual(choques, [], `hay fallbacks con masculino genérico evitable:\n${choques.join('\n')}`);

    const filtro = filtroDe('es');
    const veredicto = filtro.valida('Todos los vecinos salen a mirar el jaleo.', { tope: 240 });
    assert.equal(veredicto.apto, false, 'un texto generado con masculino genérico pasó el filtro');
    assert.equal(claveDeAptitud(veredicto.motivo), MOTIVOS_DE_APTITUD.MASCULINO_GENERICO);
    assert.ok(veredicto.motivo.detalle.formula, 'el rechazo no nombra la fórmula que lo tumbó');
  });

  test('No se usa morfología inventada', () => {
    const listas = listasDeAptitud('es');
    const choques = [];
    for (const { plantilla, clave, texto } of fallbacksDelCatalogo()) {
      for (const regla of listas.morfologiaInventada) {
        const casa = texto.match(regla.re);
        if (casa) choques.push(`${plantilla} · ${clave}: «${casa[0]}»`);
      }
    }
    assert.deepEqual(choques, [], `hay fallbacks con morfología inventada:\n${choques.join('\n')}`);

    const filtro = filtroDe('es');
    for (const texto of ['Les vecines salen a mirar.', 'Todxs miran hacia el monte.', 'Bienvenid@s al valle.']) {
      const veredicto = filtro.valida(texto, { tope: 240 });
      assert.equal(veredicto.apto, false, `«${texto}» pasó el filtro`);
      assert.equal(claveDeAptitud(veredicto.motivo), MOTIVOS_DE_APTITUD.MORFOLOGIA_INVENTADA);
    }
  });

  test('Ningún texto depende de un número que solo existe en la maqueta', () => {
    // De este escenario esta fila sostiene la parte mecánica —las cifras
    // prohibidas— y no la semántica, que sigue siendo de revisión humana.
    const listas = listasDeAptitud('es');
    const choques = [];
    for (const { plantilla, clave, texto } of fallbacksDelCatalogo()) {
      for (const regla of listas.cifras) {
        const casa = texto.match(regla.re);
        if (casa) choques.push(`${plantilla} · ${clave}: «${casa[0]}»`);
      }
    }
    assert.deepEqual(choques, [], `hay fallbacks con cifras que ninguna pantalla lleva:\n${choques.join('\n')}`);

    const filtro = filtroDe('es');
    for (const texto of ['Te quedan 3 leguas de camino.', 'Llevas dos jornadas andando sin parar.']) {
      const veredicto = filtro.valida(texto, { tope: 240 });
      assert.equal(veredicto.apto, false, `«${texto}» pasó el filtro`);
      assert.equal(claveDeAptitud(veredicto.motivo), MOTIVOS_DE_APTITUD.CIFRA_PROHIBIDA);
    }
  });
});

// ── Los nombres: suelo determinista, capa opcional ────────────────────────────

describe('Los nombres son únicos y del idioma del sitio', () => {
  test('Un nombre propuesto por el LLM solo se adopta si pasa validación', () => {
    // El escenario, literal: un mundo con un paraje llamado «O Fuso da Vella» y el
    // modelo proponiendo ese mismo nombre para otro elemento.
    const indice = crearIndiceDeNombres();
    indice.reserva('O Fuso da Vella');
    const filtro = filtroDe('gl');

    const choque = adoptaNombrePropuesto({ propuesto: 'O Fuso da Vella', base: 'A Pena do Corvo', indice, filtro });
    assert.equal(choque.nombre, 'A Pena do Corvo', 'el elemento no conservó el nombre del paquete de idioma');
    assert.equal(choque.origen, 'idioma');
    assert.equal(claveDeAptitud(choque.motivo), MOTIVOS_DE_APTITUD.NOMBRE_QUE_CHOCA);

    // Y las otras cuatro razones para no adoptarlo, cada una conservando el base.
    const largo = 'A'.repeat(TOPE_DE_NOMBRE + 1);
    assert.equal(adoptaNombrePropuesto({ propuesto: largo, base: 'A Pena do Corvo', indice, filtro }).origen, 'idioma');
    assert.equal(claveDeAptitud(adoptaNombrePropuesto({ propuesto: largo, base: 'A Pena do Corvo', indice, filtro }).motivo), MOTIVOS_DE_APTITUD.FUERA_DE_TOPE);
    for (const raro of ['A Ponte 2', 'A Ponte!', 'A Ponte (vella)']) {
      const veredicto = adoptaNombrePropuesto({ propuesto: raro, base: 'A Pena do Corvo', indice, filtro });
      assert.equal(veredicto.origen, 'idioma', `«${raro}» se adoptó`);
      assert.equal(claveDeAptitud(veredicto.motivo), MOTIVOS_DE_APTITUD.CARACTER_AJENO);
    }

    // El que pasa las cuatro sí se adopta, declara su origen y **queda reservado**:
    // ningún otro elemento puede tomarlo después.
    const adoptado = adoptaNombrePropuesto({ propuesto: 'A Fonte do Sapo', base: 'A Pena do Corvo', indice, filtro });
    assert.equal(adoptado.nombre, 'A Fonte do Sapo');
    assert.equal(adoptado.origen, 'llm');
    assert.equal(adoptado.base, 'A Pena do Corvo', 'el nombre base deja de constar como el que había');
    assert.equal(adoptado.motivo, null);
    assert.equal(indice.tomado('A Fonte do Sapo'), true);
    assert.equal(adoptaNombrePropuesto({ propuesto: 'A Fonte do Sapo', base: 'O Muíño Vello', indice, filtro }).origen, 'idioma');

    // Y sin propuesta, o fuera de una aventura, se conserva el base sin motivo: la
    // capa está apagada de origen para las entidades del mundo.
    assert.equal(ALCANCE_DE_LA_CAPA.aventura, true);
    assert.equal(ALCANCE_DE_LA_CAPA.mundo, false);
    assert.deepEqual(adoptaNombrePropuesto({ propuesto: null, base: 'O Muíño Vello', indice, filtro }).motivo, null);
    const fuera = adoptaNombrePropuesto({ propuesto: 'A Veiga Longa', base: 'O Muíño Vello', indice, filtro, dentroDeAventura: false });
    assert.equal(fuera.origen, 'idioma');
    assert.equal(indice.tomado('A Veiga Longa'), false, 'la capa apagada ha reservado un nombre igualmente');
  });

  test('El nombre de cualquier elemento lo produce primero el paquete de idioma, sin ninguna llamada de red', async () => {
    // El suelo determinista: el mundo entero nace con todos sus nombres puestos y
    // sin que nadie hable con nadie. La capa del narrador va encima y es opcional.
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const mundo = await generaMundo('costero', semillaDe('costero', '1'));
      for (const s of mundo.settlements ?? []) {
        assert.ok(s.name && s.name.trim().length > 0, 'un núcleo ha nacido sin nombre');
        for (const v of s.services ?? []) assert.ok(v.name && v.name.trim().length > 0, 'un servicio ha nacido sin nombre');
      }
      for (const p of mundo.parajes ?? []) assert.ok(p.name && p.name.trim().length > 0, 'un paraje ha nacido sin nombre');
      assert.deepEqual(inspector.peticiones(), [], 'generar los nombres del mundo ha sacado tráfico del móvil');
      // Y el idioma sale de dónde está el mundo, no de una constante.
      assert.equal(localeDe(mundo), 'gl');
    } finally {
      inspector.suelta();
    }
  });

  test('No hay dos nombres iguales en un mundo', async () => {
    // Con la capa de propuestas **encendida**: el mundo ya no tiene repetidos, y
    // adoptar propuestas no puede introducir ninguno porque la adopción reserva.
    const mundo = await mundoDePrueba();
    const indice = crearIndiceDeNombres();
    const nombres = [
      ...mundo.settlements.map((s) => s.name),
      ...mundo.settlements.flatMap((s) => (s.services ?? []).map((v) => v.name)),
      ...mundo.parajes.map((p) => p.name),
      ...(mundo.geo?.calzadas ?? mundo.rutas ?? []).map((r) => r.name).filter(Boolean),
    ];
    for (const n of nombres) {
      assert.equal(indice.tomado(n), false, `el nombre "${n}" aparece dos veces en el mundo`);
      indice.reserva(n);
    }

    const filtro = filtroDe(localeDe(mundo));
    // Y proponer cualquiera de los que ya existen no lo duplica.
    for (const n of nombres.slice(0, 12)) {
      const veredicto = adoptaNombrePropuesto({ propuesto: n, base: 'O Muíño Vello', indice, filtro });
      assert.notEqual(veredicto.nombre, n, `el nombre "${n}" se ha adoptado dos veces`);
    }
    // Un nombre nuevo sí entra, y a partir de ahí queda tomado.
    const nuevo = adoptaNombrePropuesto({ propuesto: 'A Congostra Calada', base: 'O Muíño Vello', indice, filtro });
    assert.equal(nuevo.origen, 'llm');
    assert.equal(indice.tomado('A Congostra Calada'), true);
  });

  test('Un nombre propuesto que coincide con el nombre real de un anclaje se descarta', async () => {
    // La quinta validación, que no es de unicidad sino de privacidad: un nombre de
    // fantasía idéntico al real revelaría por la puerta de atrás lo que el prompt
    // tiene prohibido llevar.
    const mundo = await mundoDePrueba();
    const datosReales = datosRealesDeMundo(mundo);
    const real = datosReales.find((d) => d.de.includes('nombre real') && d.dato.length >= 5 && /^[\p{L}\p{M} '’·-]+$/u.test(d.dato));
    assert.ok(real, 'el mundo del escenario no trae ningún nombre real con forma de nombre propio');

    const veredicto = adoptaNombrePropuesto({
      propuesto: real.dato,
      base: 'A Pena do Corvo',
      indice: crearIndiceDeNombres(),
      filtro: filtroDe(localeDe(mundo), datosReales),
    });
    assert.equal(veredicto.nombre, 'A Pena do Corvo');
    assert.equal(claveDeAptitud(veredicto.motivo), MOTIVOS_DE_APTITUD.DATO_REAL);
  });
});

// ── El prompt no lleva ningún dato real ───────────────────────────────────────

describe('Del móvil no sale nada del jugador', () => {
  test('El prompt del LLM no lleva ningún dato real', async () => {
    // Bloqueante, y por eso se afirma con el prompt ya construido delante y con la
    // lista completa de datos reales del mundo congelado del que salió — no con una
    // cadena elegida a mano. Sobre el costero de «42.40,-8.81#1» son 439 datos.
    const mundo = await mundoDePrueba();
    assert.equal(mundo.seed, SEMILLA_DEL_ESCENARIO, 'el mundo del escenario ya no se siembra con la semilla que cita la batería');
    const datosReales = datosRealesDeMundo(mundo);
    assert.ok(datosReales.length > 400, `el mundo del escenario solo aporta ${datosReales.length} datos reales, y con tan pocos el cribado deja de medir`);

    const c = primeraCasteada(mundo);
    const huecos = huecosDeAventura(c.tpl);
    const topicos = estadoDeTopicos();
    const peticion = peticionDeAventura({
      mundo,
      aventura: c.aventura,
      plantilla: c.tpl,
      locale: localeDe(mundo),
      huecos,
      topicos,
      semillaDeMundo: mundo.seed,
    });
    const prompt = peticion.prompt.texto;
    assert.ok(prompt.length > 0);

    // Ni un nombre de anclaje, ni un nombre de calle: se comprueban **todos**.
    const anclajes = new Set();
    for (const s of mundo.settlements ?? []) {
      for (const ficha of [s.anchor, s.real]) if (ficha?.name) anclajes.add(ficha.name);
      for (const v of s.services ?? []) if (v.real?.name) anclajes.add(v.real.name);
    }
    for (const p of mundo.parajes ?? []) if (p.real?.name) anclajes.add(p.real.name);
    const calles = new Set();
    for (const familia of ['roads', 'callejero']) for (const via of mundo.geo?.[familia] ?? []) if (via.name) calles.add(via.name);
    assert.ok(anclajes.size >= 10, `solo hay ${anclajes.size} anclajes con nombre real: con tan pocos la afirmación no mide`);
    assert.ok(calles.size >= 30, `solo hay ${calles.size} calles con nombre real: con tan pocas la afirmación no mide`);

    assert.deepEqual([...anclajes].filter((n) => apareceDato(prompt, n)), [], 'el prompt lleva el nombre real de un anclaje');
    assert.deepEqual([...calles].filter((n) => apareceDato(prompt, n)), [], 'el prompt lleva el nombre real de una calle');

    // Ni coordenadas, ni semilla, ni identificadores de OSM o de Places.
    assert.equal(prompt.includes(String(mundo.origin.lat)), false, 'el prompt lleva la latitud de origen');
    assert.equal(prompt.includes(String(mundo.origin.lon)), false, 'el prompt lleva la longitud de origen');
    assert.equal(prompt.includes(mundo.seed), false, 'el prompt lleva la semilla del mapa');
    assert.equal(/\d+\.\d{3,}/.test(prompt), false, 'el prompt lleva algo con forma de coordenada');
    assert.deepEqual(cribaSegmentos(peticion.prompt.segmentos, datosReales), null, 'el cribado encuentra un dato real dentro del prompt');

    // Y todo el sobre son campos de la lista blanca, ni uno más.
    for (const campo of Object.keys(peticion.sobre)) assert.ok(CAMPOS_DEL_SOBRE.includes(campo), `el sobre lleva el campo "${campo}", que no está en la lista blanca`);

    // ── El rojo, que es lo que hace que lo de arriba mida algo (§6o) ────────────
    //
    // Un criterio que se cumple casi siempre por construcción no es un criterio.
    // Metiendo un dato real a propósito, la construcción **falla nombrando cuál y
    // por qué campo entró**, y falla dos veces: en el sobre, antes de construir
    // ningún prompt, y en el cribado del prompt ya construido.
    const real = datosReales.find((d) => d.de.includes('nombre real') && d.dato.length >= 5);
    assert.ok(real, 'el mundo del escenario no trae ningún nombre real con el que ponerlo rojo');

    assert.throws(
      () => sobreDePeticion({ locale: 'gl', tono: TONO, reglas: REGLAS_DE_ESCRITURA, punto: 'crear-aventura', nombres: [real.dato] }, { datosReales }),
      (e) => e.message.includes(real.dato) && e.message.includes('"nombres"'),
      'meter el nombre real de un anclaje en el sobre no lo pone rojo',
    );

    // Y el nombre de fantasía que por casualidad coincide con el real: entra por un
    // campo permitido, así que la lista blanca no lo ve y lo tumba el cribado.
    const sobreLimpio = sobreDePeticion({ locale: 'gl', tono: TONO, reglas: REGLAS_DE_ESCRITURA, punto: 'crear-aventura' }, { datosReales });
    assert.throws(
      () => construyePrompt({ sobre: { ...sobreLimpio, nombres: [real.dato] }, datosReales }),
      (e) => e.message.includes(real.dato) && e.message.includes('"nombres"'),
      'un nombre de fantasía idéntico al real no hace fallar la construcción del prompt',
    );
    // El cribado no distingue por qué coincide: falla igual, y eso es lo asumido.
    const segmentos = segmentosDelPrompt({ ...sobreLimpio, nombres: [real.dato] });
    const choque = cribaSegmentos(segmentos, datosReales);
    assert.equal(choque.dato, real.dato);
    assert.equal(choque.campo, 'nombres');
    assert.equal(choque.de, real.de, 'el choque no dice de dónde salió el dato');

    // Y la construcción no abre ninguna conexión: se afirma entera sin red.
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const otra = peticionDeAventura({ mundo, aventura: c.aventura, plantilla: c.tpl, locale: localeDe(mundo), huecos });
      assert.equal(otra.prompt.texto.length > 0, true);
      assert.deepEqual(inspector.peticiones(), [], 'construir el prompt ha sacado tráfico del móvil');
    } finally {
      inspector.suelta();
    }
  });

  test('Las coordenadas salen una sola vez, al generar el mapa', async () => {
    // De este escenario esta fila sostiene la mitad de que **ninguna llamada al
    // narrador las lleva**: la generación del mapa es de otra fila.
    const mundo = await mundoDePrueba();
    const c = primeraCasteada(mundo);
    const huecos = huecosDeAventura(c.tpl);
    const inspector = creaInspectorDeRed({ estricto: true });
    const proxy = creaDobleDelProxy({ modo: 'responde' });

    try {
      // La llamada al narrador sale por la frontera envuelta, que es la única
      // manera de afirmar sobre lo que sale de verdad y no sobre lo que se supone.
      const sale = inspector.envuelve(async (destino, opciones) => {
        await proxy.texto(JSON.parse(opciones.body));
        return { textos: Object.fromEntries(huecos.map((h) => [h.clave, 'Una brisa serena empuja la puerta del molino.'])) };
      });

      await redactaAventura({
        mundo,
        aventura: c.aventura,
        plantilla: c.tpl,
        locale: localeDe(mundo),
        momento: 'antes-de-salir',
        presupuestoMs: 5000,
        espera: NUNCA_VENCE,
        llamada: async ({ sobre, huecos: pedidos }) => sale('https://proxy.ciego/texto', { method: 'POST', body: JSON.stringify({ sobre, huecos: pedidos }) }),
      });

      assert.equal(inspector.peticiones().length, 1, 'la aventura no se ha pedido en una sola llamada');
      for (const aguja of [String(mundo.origin.lat), String(mundo.origin.lon), mundo.seed, '42.40', '-8.81']) {
        assert.equal(inspector.contiene(aguja), false, `«${aguja}» ha salido en la llamada al narrador`);
      }
      // Ni el nombre real de ningún anclaje, que es lo mismo por otra puerta.
      const cuerpo = inspector.peticiones()[0].cuerpo;
      for (const entrada of datosRealesDeMundo(mundo)) {
        assert.equal(apareceDato(cuerpo, entrada.dato), false, `«${entrada.dato}» (${entrada.de}) ha salido en la llamada al narrador`);
      }
    } finally {
      inspector.suelta();
    }
  });

  test('El signo y el nivel de un rumor viajan en el prompt como restricción y no como pregunta', () => {
    // El signo es dato vivo: viaja **dicho**, para que el modelo no lo decida. Y si
    // aun así devolviera uno, se descarta como cualquier otro dato vivo.
    const sobre = sobreDePeticion({ locale: 'es', tono: TONO, reglas: REGLAS_DE_ESCRITURA, punto: 'crear-aventura', signo: 'bueno', nivel: 2 }, { datosReales: [] });
    const segmentos = segmentosDelPrompt(sobre);
    const delSigno = segmentos.find((s) => s.campo === 'signo');
    const delNivel = segmentos.find((s) => s.campo === 'nivel');
    assert.ok(/restricción/.test(delSigno.texto), 'el signo no viaja declarado como restricción');
    assert.ok(/no la decides|no lo decides/.test(delSigno.texto), 'el prompt le pide al modelo que decida el signo');
    assert.ok(/restricción/.test(delNivel.texto), 'el nivel no viaja declarado como restricción');
    assert.ok(delSigno.texto.includes('bueno') && delNivel.texto.includes('2'));

    // Y una versión de signo contrario que llegue de vuelta no cambia nada: `signo`
    // está entre los datos vivos, así que se descarta sin interpretarse.
    assert.ok(DATOS_VIVOS.includes('signo'));
    const { propuestas, descartes } = leeRespuesta({ signo: 'malo', texto: 'La versión que se cuenta en el molino.' }, [hueco('rumor:1', 'rumor', 220, 'Se cuenta que el carro volvió solo.')]);
    assert.equal(propuestas.get('rumor:1'), 'La versión que se cuenta en el molino.');
    assert.deepEqual(descartes.map((d) => d.motivo.clave), [MOTIVOS_DEL_NARRADOR.DATO_VIVO]);
  });

  test('El módulo del narrador no genera mundo, no castea, no propaga y no resiembra', () => {
    // Hacia fuera entrega tres cosas y solo tres: los textos con su origen, el
    // diagnóstico y el registro de tópicos. Ni una decisión.
    const texto = fuente('packages/nucleo/quests/narrador.js');
    const rutas = [...texto.matchAll(/(?:^|\n)\s*(?:import|export)[^\n]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const prohibida of ['../world/build.js', './casting.js', '../partida/rumores.js', '../partida/deformacion.js', '../core/rng.js', '../core/semilla.js']) {
      assert.equal(rutas.includes(prohibida), false, `el narrador importa "${prohibida}": generar, castear, propagar o resembrar no es suyo`);
    }
    assert.equal(/makeRng|siembra|resiembra\(/.test(texto.replace(/^\s*\/\/.*$/gm, '')), false, 'el narrador toca el azar de la generación');
  });

  test('Un campo fuera de la lista blanca hace fallar el sobre nombrándolo', () => {
    // La lista blanca es lo que se ejecuta: lo que no está declarado no puede entrar.
    assert.throws(
      () => sobreDePeticion({ locale: 'es', coordenada: '42.402,-8.809' }, { datosReales: [] }),
      /"coordenada"/,
      'un campo fuera de la lista blanca no hace fallar el sobre nombrándolo',
    );
    assert.throws(() => sobreDePeticion({ locale: 'es', nombreDelPersonaje: 'Moisés' }, { datosReales: [] }), /"nombreDelPersonaje"/);
    assert.throws(() => sobreDePeticion({ locale: 'es', semilla: '42.40,-8.81#1' }, { datosReales: [] }), /"semilla"/);
    // Y el locale es obligatorio: sin él no hay listas con las que validar nada.
    assert.throws(() => sobreDePeticion({ tono: TONO }, { datosReales: [] }), /locale/);
    // El mote sí puede viajar, porque lo produce el código desde la semilla.
    assert.ok(CAMPOS_DEL_SOBRE.includes('mote'));
    assert.equal(sobreDePeticion({ locale: 'es', mote: 'Pé de Ferro' }, { datosReales: [] }).mote, 'Pé de Ferro');
  });
});

// ── Los dos puntos de invocación, y ni uno más ────────────────────────────────

describe('Los dos puntos de invocación, y ni uno más', () => {
  test('Los puntos de invocación son exactamente dos: crear la aventura y abrir la salida', () => {
    assert.deepEqual([...PUNTOS_DE_INVOCACION], ['crear-aventura', 'abrir-salida']);
    assert.equal(PUNTOS_DE_INVOCACION.length, 2);
    for (const punto of PUNTOS_DE_INVOCACION) assert.equal(exigePunto(punto), punto);
    assert.deepEqual([...MOMENTOS_DE_SALIDA], ['antes-de-salir', 'en-marcha', 'al-parar', 'telon']);
    assert.equal(MOMENTO_PROHIBIDO, 'en-marcha');
  });

  test('Un punto de invocación que no existe falla nombrando el recibido y enumerando los dos válidos', () => {
    for (const punto of ['al-parar', 'telon', 'a-media-cuesta', null, undefined, '']) {
      assert.throws(() => exigePunto(punto), (e) => e.message.includes('crear-aventura') && e.message.includes('abrir-salida'), `el punto ${JSON.stringify(punto)} no falló nombrando los dos válidos`);
    }
    assert.throws(() => exigePunto('a-media-cuesta'), /a-media-cuesta/);
  });

  test('Una salida en marcha no pide ninguna redacción y no registra ninguna llamada saliente', async () => {
    // «Nunca en marcha» es la mitad de RF-QUEST-008, y sin el momento entre las
    // entradas sería una convención en vez de una comprobación.
    const inspector = creaInspectorDeRed({ estricto: true });
    let llamadas = 0;
    try {
      for (const punto of PUNTOS_DE_INVOCACION) {
        await assert.rejects(
          () => pideRedaccion({
            punto,
            momento: MOMENTO_PROHIBIDO,
            huecos: [hueco('beat:1')],
            presupuestoMs: 5000,
            espera: NUNCA_VENCE,
            filtro: filtroDe('es'),
            llamada: async () => { llamadas += 1; return { texto: 'no debería llegar aquí' }; },
          }),
          (e) => e.message.includes(MOMENTO_PROHIBIDO) && e.message.includes(punto),
          `pedir una redacción en marcha desde "${punto}" no falló nombrando el momento`,
        );
      }
      assert.equal(llamadas, 0, 'se ha llamado al narrador en marcha');
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico del móvil en marcha');
    } finally {
      inspector.suelta();
    }
  });

  test('El módulo sin el momento de la salida falla nombrando la dependencia que falta', async () => {
    for (const momento of [undefined, null, 'cuando-sea']) {
      await assert.rejects(
        () => pideRedaccion({ punto: 'crear-aventura', momento, huecos: [hueco('beat:1')], presupuestoMs: 5000, espera: NUNCA_VENCE, filtro: filtroDe('es') }),
        (e) => e.message.includes('momento') && MOMENTOS_DE_SALIDA.every((m) => e.message.includes(m)),
        `el momento ${JSON.stringify(momento)} no falló nombrando la dependencia`,
      );
    }
    // Y sin el filtro tampoco se pide nada: todo texto generado pasa por él.
    await assert.rejects(
      () => pideRedaccion({ punto: 'crear-aventura', momento: 'antes-de-salir', huecos: [hueco('beat:1')], presupuestoMs: 5000, espera: NUNCA_VENCE }),
      /filtro de aptitud/,
    );
  });

  test('Todos los huecos de una aventura recién creada se piden en una sola llamada', async () => {
    const mundo = await mundoDePrueba();
    const c = primeraCasteada(mundo);
    const huecos = huecosDeAventura(c.tpl);
    const peticiones = [];

    await redactaAventura({
      mundo,
      aventura: c.aventura,
      plantilla: c.tpl,
      locale: localeDe(mundo),
      momento: 'antes-de-salir',
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      llamada: async (peticion) => { peticiones.push(peticion); return { textos: {} }; },
    });

    assert.equal(peticiones.length, 1, `la aventura se pidió en ${peticiones.length} llamadas`);
    assert.deepEqual(peticiones[0].huecos.map((h) => h.clave), huecos.map((h) => h.clave), 'la llamada no lleva todos los huecos de la aventura');
    // Y cada hueco viaja con su tipo y su tope, que es lo único que el modelo
    // necesita saber de él.
    for (const h of peticiones[0].huecos) assert.deepEqual(Object.keys(h).sort(), ['clave', 'tipo', 'tope']);
  });

  test('Una reserva de cinco pasos se pide en una sola llamada agrupada', async () => {
    const mundo = await mundoDePrueba();
    const reserva = Array.from({ length: 5 }, (_, i) => ({
      fallback: `El paso ${'de vuelta '.repeat(i % 2)}quedó anotado en el zurrón.`.trim(),
      hechos: { eje: 'camino', signo: 'bueno' },
    }));
    const peticiones = [];

    const redaccion = await redactaZurron({
      mundo,
      locale: localeDe(mundo),
      momento: 'antes-de-salir',
      reserva,
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      llamada: async (peticion) => { peticiones.push(peticion); return { textos: {} }; },
    });

    assert.equal(peticiones.length, 1, `el zurrón se pidió en ${peticiones.length} llamadas`);
    assert.equal(peticiones[0].huecos.length, reserva.length + 1, 'la llamada agrupada no lleva el envoltorio más las cinco entradas');
    assert.equal(peticiones[0].huecos[0].clave, 'zurron');
    assert.equal(redaccion.punto, 'abrir-salida');
    assert.equal(huecoDelZurron().fallback, FALLBACK_DEL_ZURRON);
  });

  test('Una reserva vacía no hace ninguna llamada y no es un error', async () => {
    const mundo = await mundoDePrueba();
    let llamadas = 0;
    const redaccion = await redactaZurron({
      mundo,
      locale: localeDe(mundo),
      momento: 'antes-de-salir',
      reserva: [],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      llamada: async () => { llamadas += 1; return { textos: {} }; },
    });
    assert.equal(llamadas, 0, 'sin reserva se ha llamado al narrador');
    assert.equal(redaccion.llamo, false);
    assert.deepEqual(redaccion.textos, []);
    assert.deepEqual(redaccion.diagnostico.descartes, []);
  });

  test('El modo de pasos de fondo apagado no hace ninguna llamada del zurrón', async () => {
    const mundo = await mundoDePrueba();
    let llamadas = 0;
    const redaccion = await redactaZurron({
      mundo,
      locale: localeDe(mundo),
      momento: 'antes-de-salir',
      reserva: [{ fallback: 'Un paso anotado.', hechos: null }, { fallback: 'Otro paso anotado.', hechos: null }],
      modoDeFondo: false,
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      llamada: async () => { llamadas += 1; return { textos: {} }; },
    });
    assert.equal(llamadas, 0, 'con el modo de fondo apagado se ha llamado al narrador');
    assert.deepEqual(redaccion.textos, []);
  });

  test('El envoltorio del zurrón que no se pudo redactar deja cada entrada con el texto de su plantilla', async () => {
    const mundo = await mundoDePrueba();
    const reserva = [
      { fallback: 'La vecina del molino cuenta lo del carro atascado.', hechos: null },
      { fallback: 'En la fuente se comenta lo del perro que volvió solo.', hechos: null },
    ];
    const proxy = creaDobleDelProxy({ modo: 'falla-siempre' });
    const redaccion = await redactaZurron({
      mundo,
      locale: localeDe(mundo),
      momento: 'antes-de-salir',
      reserva,
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      llamada: async (peticion) => proxy.texto(peticion),
    });

    const textos = porClave(redaccion);
    assert.equal(textos.zurron.texto, FALLBACK_DEL_ZURRON, 'el envoltorio no cayó a su propio fallback');
    assert.equal(textos.zurron.origen, 'plantilla');
    reserva.forEach((e, i) => {
      assert.equal(textos[`zurron:entrada:${i + 1}`].texto, e.fallback, 'una entrada de la reserva perdió el texto de la plantilla que la generó');
      assert.equal(textos[`zurron:entrada:${i + 1}`].origen, 'plantilla');
    });
    // El resumen se lee igual: ninguna entrada queda vacía.
    for (const t of redaccion.textos) assert.ok(t.texto.trim().length > 0);
  });
});

// ── El registro de tópicos, como restricción negativa ─────────────────────────

describe('El registro de tópicos, como restricción negativa', () => {
  test('El registro de tópicos es uno por semilla de mundo y no uno global', () => {
    const estado = estadoDeTopicos();
    anotaTopico(estado, { semillaDeMundo: '42.40,-8.81#1', categoria: 'imagenes', topico: 'la niebla baja' });
    anotaTopico(estado, { semillaDeMundo: '39.86,-4.02#1', categoria: 'imagenes', topico: 'el sol pega' });

    const uno = registroDeMundo(estado, '42.40,-8.81#1');
    const otro = registroDeMundo(estado, '39.86,-4.02#1');
    assert.ok(uno.imagenes.includes('la niebla baja'));
    assert.equal(otro.imagenes.includes('la niebla baja'), false, 'el registro de un mundo se ha colado en el de otro');
    assert.deepEqual(Object.keys(estado.mundos).sort(), ['39.86,-4.02#1', '42.40,-8.81#1']);
    // Y sin semilla no hay registro: un registro global mezclaría mapas que nadie
    // lee seguidos.
    assert.throws(() => registroDeMundo(estado, null), /semilla de mundo/);
  });

  test('Un registro recién creado ya trae la lista negra de tics precargada', () => {
    const registro = registroInicialDeTopicos();
    assert.deepEqual(Object.keys(registro).sort(), [...CATEGORIAS_DE_TOPICO].sort());
    assert.deepEqual([...CATEGORIAS_DE_TOPICO], ['aperturas', 'imagenes', 'giros', 'oficios', 'objetos']);
    for (const categoria of CATEGORIAS_DE_TOPICO) {
      assert.ok(registro[categoria].length > 0, `la categoría "${categoria}" nace vacía`);
      assert.deepEqual(registro[categoria], [...TICS_PRECARGADOS[categoria]]);
    }
  });

  test('El registro viaja dentro del prompt como restricción negativa y nunca como ejemplo', async () => {
    const mundo = await mundoDePrueba();
    const c = primeraCasteada(mundo);
    const topicos = estadoDeTopicos();
    anotaTopico(topicos, { semillaDeMundo: mundo.seed, categoria: 'aperturas', topico: 'cuenta la leyenda' });

    const peticion = peticionDeAventura({
      mundo,
      aventura: c.aventura,
      plantilla: c.tpl,
      locale: localeDe(mundo),
      huecos: huecosDeAventura(c.tpl),
      topicos,
      semillaDeMundo: mundo.seed,
    });
    const segmento = peticion.prompt.segmentos.find((s) => s.campo === 'topicos');
    assert.ok(segmento, 'el registro de tópicos no viaja dentro del prompt');
    assert.ok(/NO uses/.test(segmento.texto), 'el registro no viaja declarado como restricción negativa');
    assert.ok(segmento.texto.includes('cuenta la leyenda'));
    // Y ninguna regla bifurca por él fuera de la construcción del prompt: la
    // aventura vestida sale idéntica con el registro lleno y con el inicial.
    const otro = peticionDeAventura({ mundo, aventura: c.aventura, plantilla: c.tpl, locale: localeDe(mundo), huecos: huecosDeAventura(c.tpl) });
    assert.equal(otro.prompt.segmentos.some((s) => s.campo === 'topicos'), false);
  });

  test('Una categoría con la ventana llena pierde la entrada más antigua y conserva su tamaño', () => {
    const estado = estadoDeTopicos();
    const semilla = '42.40,-8.81#1';
    // Se llena la ventana desde cero, así que se parte de un registro vacío para
    // que la cuenta no dependa de cuántos tics vengan precargados.
    estado.mundos[semilla] = Object.fromEntries(CATEGORIAS_DE_TOPICO.map((c) => [c, []]));
    for (let i = 1; i <= TAMANO_DE_VENTANA; i += 1) anotaTopico(estado, { semillaDeMundo: semilla, categoria: 'giros', topico: `giro ${'x'.repeat(i)}` });
    assert.equal(tamanosDeVentana(estado, semilla).giros, TAMANO_DE_VENTANA);
    const elMasAntiguo = registroDeMundo(estado, semilla).giros[0];

    anotaTopico(estado, { semillaDeMundo: semilla, categoria: 'giros', topico: 'el giro que entra el último' });
    const ventana = registroDeMundo(estado, semilla).giros;
    assert.equal(ventana.length, TAMANO_DE_VENTANA, 'la ventana ha cambiado de tamaño');
    assert.equal(ventana.includes(elMasAntiguo), false, 'no ha salido el más antiguo');
    assert.equal(ventana.at(-1), 'el giro que entra el último', 'el orden dentro de la ventana no es el de anotación');
    // Anotar dos veces lo mismo lo mueve al final en vez de duplicarlo.
    anotaTopico(estado, { semillaDeMundo: semilla, categoria: 'giros', topico: ventana[0] });
    const despues = registroDeMundo(estado, semilla).giros;
    assert.equal(despues.filter((t) => t === ventana[0]).length, 1);
    assert.equal(despues.length, TAMANO_DE_VENTANA);
  });

  test('Una categoría exactamente en el tamaño de la ventana cabe entera en el prompt', () => {
    const estado = estadoDeTopicos();
    const semilla = '42.40,-8.81#1';
    estado.mundos[semilla] = Object.fromEntries(CATEGORIAS_DE_TOPICO.map((c) => [c, []]));
    const entradas = Array.from({ length: TAMANO_DE_VENTANA }, (_, i) => `imagen ${'y'.repeat(i + 1)}`);
    for (const t of entradas) anotaTopico(estado, { semillaDeMundo: semilla, categoria: 'imagenes', topico: t });

    const paraElPrompt = topicosParaElPrompt(estado, semilla);
    assert.deepEqual([...paraElPrompt.imagenes], entradas, 'la ventana llena no cabe entera o se ha recortado');
    const segmento = segmentosDelPrompt({ locale: 'gl', topicos: paraElPrompt }).find((s) => s.campo === 'topicos');
    for (const entrada of entradas) assert.ok(segmento.texto.includes(entrada), `la entrada «${entrada}» se ha recortado del prompt`);
  });

  test('Solo se anota lo adoptado: un texto descartado no deja tópico', async () => {
    const topicos = estadoDeTopicos();
    const semilla = '42.40,-8.81#1';
    const antes = JSON.stringify(congelaTopicos(topicos));

    // Primero el descartado: no apto, así que no se anota nada.
    await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [hueco('beat:1')],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      semillaDeMundo: semilla,
      topicos,
      llamada: async () => ({ texto: 'El tabernero te sirve una ronda de aguardiente.' }),
    });
    assert.equal(JSON.stringify(congelaTopicos(topicos)), antes, 'un texto descartado ha dejado tópico en el registro');

    // Y ahora el adoptado: entra en su categoría, y es la apertura del texto.
    const adoptado = 'Una brisa serena empuja la puerta del molino.';
    await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [hueco('beat:1')],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      semillaDeMundo: semilla,
      topicos,
      llamada: async () => ({ texto: adoptado }),
    });
    const registro = registroDeMundo(topicos, semilla);
    assert.ok(registro.imagenes.includes(aperturaDeTexto(adoptado)), 'lo adoptado no se ha anotado en su categoría');
    assert.equal(registro.imagenes.at(-1), aperturaDeTexto(adoptado), 'el orden dentro de la ventana no es el de anotación');
    // La categoría es la del tipo de hueco, declarada y no inventada al vuelo.
    assert.equal(CATEGORIA_POR_TIPO.escena, 'imagenes');
  });

  test('Una partida sin ninguna llamada al narrador conserva su registro inicial', async () => {
    const topicos = estadoDeTopicos();
    const semilla = '42.40,-8.81#1';
    registroDeMundo(topicos, semilla);
    const inicial = JSON.stringify(congelaTopicos(topicos));

    await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [hueco('beat:1')],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      semillaDeMundo: semilla,
      topicos,
    });
    assert.equal(JSON.stringify(congelaTopicos(topicos)), inicial, 'sin llamada al narrador el registro ha cambiado');

    // Y el registro va y vuelve de su documento con las ventanas intactas: es
    // estado inerte, pero se guarda con la partida porque si no, no sirve de nada.
    const levantado = levantaTopicos(JSON.parse(inicial));
    assert.equal(JSON.stringify(congelaTopicos(levantado)), inicial);
  });
});

// ── Generación única, cacheada y guardada con la partida ──────────────────────

describe('Generación única, cacheada y guardada con la partida', () => {
  test('Un hueco ya redactado se devuelve del guardado y no hace ninguna llamada', async () => {
    let llamadas = 0;
    const ya = new Map([['beat:1', { texto: 'El texto que ya estaba escrito.', origen: 'llm' }]]);
    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [hueco('beat:1')],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      ya,
      llamada: async () => { llamadas += 1; return { texto: 'otro texto distinto' }; },
    });
    assert.equal(llamadas, 0, 'un hueco ya redactado ha vuelto a pedirse');
    assert.equal(redaccion.llamo, false);
    assert.equal(porClave(redaccion)['beat:1'].texto, 'El texto que ya estaba escrito.');
    assert.equal(porClave(redaccion)['beat:1'].origen, 'llm');
  });

  test('La clave de un hueco sale del mapa, del punto de invocación y de la identidad del elemento', () => {
    const base = { mapa: 'mapa-0,0', punto: 'crear-aventura', elemento: 'titulo' };
    assert.equal(claveDeHueco(base), claveDeHueco({ ...base }), 'la misma clave sale distinta en dos ejecuciones');
    assert.notEqual(claveDeHueco(base), claveDeHueco({ ...base, punto: 'abrir-salida' }));
    assert.notEqual(claveDeHueco(base), claveDeHueco({ ...base, mapa: 'mapa-1,0' }));
    assert.notEqual(claveDeHueco(base), claveDeHueco({ ...base, elemento: 'gancho' }));
    // Las tres partes son obligatorias, y el punto tiene que ser uno de los dos.
    assert.throws(() => claveDeHueco({ ...base, mapa: '' }), /mapa/);
    assert.throws(() => claveDeHueco({ ...base, elemento: null }), /elemento/);
    assert.throws(() => claveDeHueco({ ...base, punto: 'a-media-cuesta' }), /a-media-cuesta/);
  });

  test('Un texto adoptado viaja con la partida y al reabrirla se lee sin ninguna llamada', async () => {
    const mundo = await mundoDePrueba();
    const c = primeraCasteada(mundo);
    const huecos = huecosDeAventura(c.tpl);
    const estado = estadoDeTextos();

    const primera = await redactaAventura({
      mundo,
      aventura: c.aventura,
      plantilla: c.tpl,
      locale: localeDe(mundo),
      momento: 'antes-de-salir',
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      llamada: async () => ({ textos: Object.fromEntries(huecos.map((h) => [h.clave, 'Una brisa serena empuja la puerta del molino.'])) }),
    });
    const vestida = visteAventura({ aventura: c.aventura, redaccion: primera, estado, mapa: 'mapa-0,0' });

    // Cada texto vive **una sola vez** en el área de textos, con sus tres partes y
    // ninguna más, y la aventura lo cita por su clave.
    const guardados = Object.values(estado.textos);
    for (const t of guardados) assert.deepEqual(Object.keys(t).sort(), ['clave', 'origen', 'texto']);
    const repetidos = guardados.filter((t) => t.texto === 'Una brisa serena empuja la puerta del molino.');
    assert.ok(repetidos.length >= 1);
    for (const h of huecos) assert.equal(vestida.textos[h.clave], claveDeHueco({ mapa: 'mapa-0,0', punto: 'crear-aventura', elemento: h.clave }));

    // Se guarda la partida y se vuelve a abrir: los mismos textos, sin llamada.
    const reabierto = levantaTextos(congelaTextos(estado));
    let llamadas = 0;
    const ya = new Map(huecos.map((h) => {
      const clave = claveDeHueco({ mapa: 'mapa-0,0', punto: 'crear-aventura', elemento: h.clave });
      return [h.clave, reabierto.textos[clave]];
    }));
    const segunda = await redactaAventura({
      mundo,
      aventura: c.aventura,
      plantilla: c.tpl,
      locale: localeDe(mundo),
      momento: 'antes-de-salir',
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      ya,
      llamada: async () => { llamadas += 1; return { textos: {} }; },
    });
    assert.equal(llamadas, 0, 'reabrir la partida ha vuelto a llamar al narrador');
    assert.equal(segunda.llamo, false);
    assert.deepEqual(porClave(segunda), porClave(primera), 'los textos han cambiado al reabrir la partida');
  });

  test('Dos huecos distintos que piden el mismo texto lo guardan una sola vez y lo citan por su clave', () => {
    // El área de textos es la de SPEC-016 y se consume tal cual: clave, texto y
    // origen, sin añadirle ninguna parte. Guardar dos veces la misma clave deja el
    // primero, que es lo que hace que el texto viva una sola vez.
    const estado = estadoDeTextos();
    const redaccion = {
      textos: [
        { clave: 'beat:1', tipo: 'escena', texto: 'La misma imagen para los dos.', origen: 'llm' },
        { clave: 'beat:2', tipo: 'escena', texto: 'La misma imagen para los dos.', origen: 'llm' },
      ],
    };
    const vestida = visteAventura({ aventura: { id: 'a', beats: [] }, redaccion, estado, mapa: 'mapa-0,0' });
    assert.equal(Object.keys(estado.textos).length, 2, 'dos claves distintas no han producido dos entradas');
    for (const t of Object.values(estado.textos)) assert.deepEqual(Object.keys(t).sort(), ['clave', 'origen', 'texto']);
    assert.equal(vestida.textos['beat:1'], claveDeHueco({ mapa: 'mapa-0,0', punto: 'crear-aventura', elemento: 'beat:1' }));

    // Y el mismo hueco pedido dos veces se guarda una sola: el segundo no gana.
    visteAventura({ aventura: { id: 'a', beats: [] }, redaccion: { textos: [{ clave: 'beat:1', tipo: 'escena', texto: 'Otro texto para la misma clave.', origen: 'llm' }] }, estado, mapa: 'mapa-0,0' });
    assert.equal(Object.keys(estado.textos).length, 2);
    assert.equal(estado.textos[claveDeHueco({ mapa: 'mapa-0,0', punto: 'crear-aventura', elemento: 'beat:1' })].texto, 'La misma imagen para los dos.');
  });

  test('Un texto guardado con origen plantilla no se sustituye después por uno del narrador', async () => {
    let llamadas = 0;
    const ya = new Map([['beat:1', { texto: 'El texto de plantilla que ya se leyó.', origen: 'plantilla' }]]);
    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [hueco('beat:1')],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      ya,
      llamada: async () => { llamadas += 1; return { texto: 'Una prosa nueva y flamante del narrador.' }; },
    });
    assert.equal(llamadas, 0, 'con cobertura se ha reescrito un texto de plantilla ya leído');
    assert.equal(porClave(redaccion)['beat:1'].texto, 'El texto de plantilla que ya se leyó.');
    assert.equal(porClave(redaccion)['beat:1'].origen, 'plantilla');
  });
});

// ── Entradas inválidas, estado vacío y errores ────────────────────────────────

describe('Entradas inválidas, estado vacío y errores del narrador', () => {
  test('Una petición sin ningún hueco que redactar devuelve una lista vacía y no es un error', async () => {
    let llamadas = 0;
    const redaccion = await pideRedaccion({
      punto: 'crear-aventura',
      momento: 'antes-de-salir',
      huecos: [],
      presupuestoMs: 5000,
      espera: NUNCA_VENCE,
      filtro: filtroDe('es'),
      llamada: async () => { llamadas += 1; return { textos: {} }; },
    });
    assert.equal(llamadas, 0, 'sin ningún hueco se ha llamado al narrador');
    assert.deepEqual(redaccion.textos, []);
    assert.equal(redaccion.llamo, false);
    // Y un catálogo de plantillas vacío tampoco es un error: no hay ningún hueco.
    assert.deepEqual(huecosDePlantilla({ titulo: 't', gancho: 'g', beats: [], desenlace: { texto: 'd' }, repuesto: { sinTi: 'a', conLoConseguido: 'b' } }).length, 5);
  });

  test('Un tipo de hueco que el catálogo no declara falla nombrando el recibido', () => {
    assert.throws(() => exigeTipoDeHueco('resumen'), (e) => e.message.includes('resumen') && CAMPOS_INERTES.every((c) => e.message.includes(c)));
    assert.throws(() => exigeHueco({ clave: 'x', tipo: 'resumen', tope: 100, fallback: 'algo' }), /resumen/);
  });

  test('Un hueco sin texto de fallback falla antes de llamar a nadie', async () => {
    let llamadas = 0;
    await assert.rejects(
      () => pideRedaccion({
        punto: 'crear-aventura',
        momento: 'antes-de-salir',
        huecos: [{ clave: 'beat:1', tipo: 'escena', tope: 220 }],
        presupuestoMs: 5000,
        espera: NUNCA_VENCE,
        filtro: filtroDe('es'),
        llamada: async () => { llamadas += 1; return { textos: {} }; },
      }),
      (e) => e.message.includes('beat:1') && e.message.includes('fallback'),
    );
    assert.equal(llamadas, 0, 'se ha llamado a alguien con un hueco sin fallback');
    // Y el tope es obligatorio por la misma razón: es lo que cabe en su pantalla.
    assert.throws(() => exigeHueco({ clave: 'beat:1', tipo: 'escena', fallback: 'algo' }), /tope/);
    assert.throws(() => exigeHueco({ clave: '', tipo: 'escena', tope: 220, fallback: 'algo' }), /clave/);
  });

  test('El módulo sin la llamada de red inyectada cae al fallback sin intentar ninguna conexión', async () => {
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const suyo = hueco('beat:1');
      for (const llamada of [null, undefined, 'no soy una función']) {
        const redaccion = await pideRedaccion({
          punto: 'crear-aventura',
          momento: 'antes-de-salir',
          huecos: [suyo],
          presupuestoMs: 5000,
          espera: NUNCA_VENCE,
          filtro: filtroDe('es'),
          llamada,
        });
        assert.equal(porClave(redaccion)['beat:1'].texto, suyo.fallback);
        assert.equal(porClave(redaccion)['beat:1'].origen, 'plantilla');
        assert.equal(clavesDeDescarte(redaccion)[0], MOTIVOS_DEL_NARRADOR.SIN_LLAMADA);
      }
      assert.deepEqual(inspector.peticiones(), [], 'sin llamada inyectada se ha intentado una conexión');
    } finally {
      inspector.suelta();
    }
  });

  test('Un locale que ningún paquete de idioma cubre falla nombrando el locale y enumerando los disponibles', async () => {
    const mundo = await mundoDePrueba();
    const c = primeraCasteada(mundo);
    await assert.rejects(
      () => redactaAventura({
        mundo,
        aventura: c.aventura,
        plantilla: c.tpl,
        locale: 'fr',
        momento: 'antes-de-salir',
        presupuestoMs: 5000,
        espera: NUNCA_VENCE,
      }),
      (e) => e.message.includes('fr') && IDIOMAS_CON_APTITUD.every((l) => e.message.includes(l)),
    );
  });
});

// ── El bucle: la mitad de datos de dos escenarios de @app ─────────────────────

describe('Antes de salir es el único momento que pide atención', () => {
  test('Sin cobertura, la preparación dice lo mismo', () => {
    // De este escenario esta fila sostiene la mitad de datos: que sin red hay texto
    // igual. Lo que la preparación pinta es el texto de la aventura, y sin red es el
    // de plantilla, byte a byte el mismo que se lleva puesto con cobertura.
    for (const plantilla of CATALOGO) {
      for (const h of huecosDePlantilla(plantilla)) {
        assert.equal(typeof h.fallback, 'string');
        assert.ok(h.fallback.trim().length > 0, `sin red el hueco "${h.clave}" de "${plantilla.id}" se queda mudo`);
      }
    }
  });

  test('El zurrón solo aparece si hay reserva que vaciar', async () => {
    // La otra mitad de datos: sin reserva no ocurre nada, ni llamada ni error.
    const mundo = await mundoDePrueba();
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      for (const reserva of [[], null, undefined]) {
        const redaccion = await redactaZurron({
          mundo,
          locale: localeDe(mundo),
          momento: 'antes-de-salir',
          reserva,
          presupuestoMs: 5000,
          espera: NUNCA_VENCE,
          llamada: async () => { throw new Error('no debería llamarse'); },
        });
        assert.equal(redaccion.llamo, false);
        assert.deepEqual(redaccion.textos, []);
      }
      assert.deepEqual(inspector.peticiones(), [], 'sin reserva ha salido tráfico del móvil');
    } finally {
      inspector.suelta();
    }
  });
});
