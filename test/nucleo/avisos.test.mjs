// SPEC-029 · El catálogo de avisos y su emisión: por qué **dos capas** viaja cada uno, qué
// texto se le admite, qué pasa cuando llega durante un beat y qué queda anotado cuando una
// capa no sale.
//
// Lo que se afirma aquí es lo que `game-design/accesibilidad.md` §3 pide y a ojo no se
// puede comprobar: que **ningún aviso viaja por una sola capa** —recorriendo el catálogo
// entero, incluidos los que se añadan mañana—, que el par mezcla bolsillo y pantalla
// —háptico y sonido fallan a la vez para la misma persona, así que duplicar así no es
// duplicar—, que la reserva del canal de notificación se respeta —la noticia no lo usa ni
// siquiera silenciosa— y que **un aviso que llegó y uno que se creyó llegado son cosas
// distintas**, que es el error caro que este subsistema existe para no cometer.
//
// Las tres situaciones que este fichero separa a propósito, porque se arreglan en sitios
// distintos y confundirlas es el fallo de fondo:
//
//   ausente   — la pieza no está cableada. Avería: falla al construir el emisor.
//   denegado  — la pieza está y quien juega dijo que no. Estado: sale por lo que queda.
//   sin respuesta — la pieza está y el canal falló al emitir. Estado, con otro motivo.
//
// Los canales entran **los dos inyectados** y se doblan en `test/dobles/canales-de-aviso.mjs`:
// doblar aquí no es interceptar, es pasar otro argumento. Nada de esto toca la red, el
// reloj del sistema ni el azar: el estado del beat llega como dato de dos valores y no hay
// ninguna semilla que sembrar.
//
// Los casos que salen de `docs/testing.md` llevan su nombre literal; los demás van marcados
// como hueco de la batería en `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAPAS,
  CAPAS_DE_BOLSILLO,
  CAPAS_DE_PANTALLA,
  CATALOGO_DE_AVISOS,
  IDS_DE_AVISO,
  IDS_DE_CAPA_CAIDA,
  LO_QUE_UN_AVISO_NO_LLEVA,
  MOTIVOS_DE_CAPA_CAIDA,
  TIPOS_DE_AVISO,
  TOPE_DE_LINEA,
  avisoDelCatalogo,
  creaEmisorDeAvisos,
  declaraAviso,
  exigeNotificador,
  exigeVibrador,
  revisaElCatalogoDeAvisos,
  validaTextoDeAviso,
} from '../../packages/nucleo/partida/avisos.js';
import { IDS_DE_ENTREGA, TIPOS_DE_ENTREGA } from '../../packages/nucleo/partida/entregas.js';
import { queEnsenaAbrirLaApp } from '../../packages/nucleo/partida/en-marcha.js';
import {
  notificadorAusente,
  notificadorDenegado,
  notificadorQueFalla,
  notificadorQueRegistra,
  vibradorAusente,
  vibradorQueFalla,
  vibradorQueRegistra,
} from '../dobles/canales-de-aviso.mjs';

/** Los sitios del mundo contra los que se comprueba que un aviso diga dónde. */
const SITIOS = ['Monfrida', 'A Fonte Vella', 'O Fuso da Vella'];

/** Los dos textos de referencia, uno por tipo. Los dos nombran sitio y caben en una línea. */
const TEXTO_DE_NOTICIA = 'En Monfrida hay algo que contar';
const TEXTO_DE_OPORTUNIDAD = 'Alguien espera en A Fonte Vella';

/** Un emisor con los dos canales registrando, que es el caso normal. */
function emisorNormal({ sitios = SITIOS } = {}) {
  const vibrador = vibradorQueRegistra();
  const notificador = notificadorQueRegistra();
  return { vibrador, notificador, emisor: creaEmisorDeAvisos({ vibrador, notificador, sitios }) };
}

// ── El par de capas ─────────────────────────────────────────────────────────────

describe('Cada aviso viaja por dos capas y el par mezcla bolsillo y pantalla', () => {
  test('Ningún aviso viaja por una sola capa', () => {
    // Se recorre el catálogo entero y no los dos tipos de hoy escritos a mano: es la
    // regla de mantenimiento de `accesibilidad.md` §3 —«cada vez que se añada una forma
    // nueva de avisar hay que volver aquí»— convertida en criterio, y así un tipo nuevo
    // sin par la pone roja sin que nadie tenga que acordarse.
    const revisados = revisaElCatalogoDeAvisos();
    assert.equal(revisados.length, CATALOGO_DE_AVISOS.length, 'la revisión ha dejado fuera algún aviso del catálogo');
    assert.ok(revisados.length > 0, 'el catálogo de avisos está vacío');

    for (const aviso of revisados) {
      assert.ok(aviso.capas.length >= 2, `el aviso "${aviso.tipo}" viaja por ${aviso.capas.length} capa(s)`);
      assert.ok(aviso.bolsillo.length >= 1, `el aviso "${aviso.tipo}" no tiene ninguna capa de bolsillo: no se nota sin mirar`);
      assert.ok(aviso.pantalla.length >= 1, `el aviso "${aviso.tipo}" no tiene ninguna capa de pantalla: no queda constancia al mirar`);
      for (const capa of aviso.capas) assert.ok(CAPAS.includes(capa), `el aviso "${aviso.tipo}" declara la capa desconocida "${capa}"`);
    }
  });

  test('Una noticia va por háptico y marca', () => {
    const { vibrador, notificador, emisor } = emisorNormal();
    const emitido = emisor.emite({ tipo: TIPOS_DE_AVISO.NOTICIA, texto: TEXTO_DE_NOTICIA });

    assert.deepEqual(emitido.capas.declaradas, ['haptico', 'marca'], 'la noticia no viaja por háptico y marca');
    assert.deepEqual(emitido.capas.salieron, ['haptico', 'marca'], 'alguna de las dos capas de la noticia no salió');
    assert.deepEqual(emitido.capas.faltaron, []);
    assert.equal(emitido.emitido, true);

    // Vibró de verdad: sobre el registro del doble, no sobre lo que el dato dice de sí.
    assert.deepEqual(vibrador.toques(), [{ texto: TEXTO_DE_NOTICIA }], 'el móvil no vibró con la noticia');

    // Y no saltó ninguna notificación. Es la mitad negativa del par, y es la que
    // protege la reserva de `quests.md` decisión 3.
    assert.deepEqual(notificador.notificadas(), [], 'la noticia ha saltado por el canal de notificación');
    assert.equal(emitido.capas.declaradas.includes('notificacion'), false, 'la noticia declara el canal de notificación');
  });

  test('Una oportunidad va por notificación y háptico', () => {
    const { vibrador, notificador, emisor } = emisorNormal();
    const emitido = emisor.emite({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD });

    assert.deepEqual(emitido.capas.declaradas, ['notificacion', 'haptico'], 'la oportunidad no viaja por notificación y háptico');
    assert.deepEqual(emitido.capas.salieron, ['notificacion', 'haptico']);
    assert.deepEqual(emitido.capas.faltaron, []);
    assert.deepEqual(notificador.notificadas(), [{ texto: TEXTO_DE_OPORTUNIDAD }], 'no saltó la notificación');
    assert.deepEqual(vibrador.toques(), [{ texto: TEXTO_DE_OPORTUNIDAD }], 'el móvil no vibró con la oportunidad');
  });

  test('El aviso se lee entero de un vistazo', () => {
    const validado = validaTextoDeAviso(TEXTO_DE_OPORTUNIDAD, { sitios: SITIOS });

    assert.equal(validado.enUnaLinea, true);
    assert.equal(/[\n\r]/.test(validado.texto), false, 'el texto del aviso lleva un salto de línea');
    assert.ok(validado.texto.length <= TOPE_DE_LINEA, 'el texto del aviso no cabe en una línea');
    // Nombra el sitio, y se comprueba contra los nombres que hay: «completo incluye
    // dónde» no es un umbral de parecido.
    assert.equal(validado.sitio, 'A Fonte Vella');
    assert.ok(SITIOS.includes(validado.sitio));
    assert.equal(/toca para saber más/i.test(validado.texto), false);
  });

  test('Tocar un aviso no acepta nada', () => {
    const { emisor } = emisorNormal();
    const emitido = emisor.emite({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD });

    // El aviso no lleva ninguna acción, y lo que hace tocarlo está declarado: ubica.
    assert.deepEqual(emitido.acciones, [], 'el aviso trae acciones: se acepta yendo, y un botón lo convertiría en un menú');
    assert.equal(emitido.seAceptaYendo, true);
    assert.equal(emitido.alTocar, 'abre-el-mapa-con-la-marca');

    // Y lo que abre tocarlo es el mapa con la marca puesta, sin aceptar ni abrir escena.
    const abierto = queEnsenaAbrirLaApp({ clasificacion: 'andando', enGeofence: false, puerta: 'aviso', marca: emitido.sitio });
    assert.equal(abierto.destino, 'mapa');
    assert.equal(abierto.marca, 'A Fonte Vella', 'el mapa no trae la marca del encuentro');
    assert.equal(abierto.acepta, false, 'tocar el aviso acepta la aventura');
    assert.equal(abierto.abreEscena, false, 'tocar el aviso abre una escena');
    assert.equal(abierto.abreVisor, false);
  });

  test('No se avisa durante un beat en curso', () => {
    const { vibrador, notificador, emisor } = emisorNormal();
    const retenido = emisor.emite({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD, beatEnCurso: true });

    assert.equal(retenido.retenido, true);
    assert.equal(retenido.emitido, false);
    assert.deepEqual(retenido.capas.salieron, [], 'una capa ha salido durante la escena');
    // Ni siquiera se llamó al vibrador: la retención va antes de tocar ningún canal,
    // porque un háptico a mitad de escena es igual de intruso que una notificación.
    assert.deepEqual(vibrador.toques(), [], 'el móvil vibró durante el beat');
    assert.deepEqual(notificador.notificadas(), [], 'saltó una notificación durante el beat');
    assert.equal(emisor.ultimo(), null, 'el aviso retenido figura como emitido');
  });
});

// ── Lo que la batería no cubre y la spec exige ──────────────────────────────────

describe('El catálogo de avisos y su vocabulario', () => {
  test('Los tipos de aviso son los mismos dos de la cola de entregas', () => {
    // Se leen de allí en lugar de reescribirse: dos enumerados con el mismo contenido
    // se desincronizan, y `quests.md` decisión 3 enumera dos y no hay un tercero.
    assert.equal(TIPOS_DE_AVISO, TIPOS_DE_ENTREGA, 'los tipos de aviso se han duplicado en vez de leerse de la cola');
    assert.equal(IDS_DE_AVISO, IDS_DE_ENTREGA);
    assert.deepEqual(IDS_DE_AVISO.slice(), ['noticia', 'oportunidad']);
    assert.deepEqual(CATALOGO_DE_AVISOS.map((a) => a.tipo).slice().sort(), IDS_DE_AVISO.slice());
  });

  test('Las capas se reparten en bolsillo y pantalla, y no hay ninguna que sea las dos', () => {
    assert.deepEqual(CAPAS_DE_BOLSILLO.slice(), ['haptico', 'sonido']);
    assert.deepEqual(CAPAS_DE_PANTALLA.slice(), ['marca', 'notificacion']);
    assert.deepEqual(CAPAS.slice(), ['haptico', 'sonido', 'marca', 'notificacion']);
    for (const capa of CAPAS_DE_BOLSILLO) assert.equal(CAPAS_DE_PANTALLA.includes(capa), false, `"${capa}" está en los dos grupos y entonces el par no separa nada`);
  });

  test('Un aviso declarado con dos capas de bolsillo falla nombrando el aviso', () => {
    // La razón, con las palabras del documento: háptico y sonido fallan a la vez para
    // la misma persona —el móvil en el bolsillo, en silencio—, así que duplicar así no
    // es duplicar.
    assert.throws(
      () => declaraAviso({ tipo: TIPOS_DE_AVISO.NOTICIA, capas: ['haptico', 'sonido'] }),
      (e) => /noticia/.test(e.message) && /bolsillo/.test(e.message) && /pantalla/.test(e.message),
      'un par de dos capas de bolsillo no ha fallado, o ha fallado sin nombrar el aviso',
    );
  });

  test('Un aviso declarado con dos capas de pantalla falla igual', () => {
    assert.throws(
      () => declaraAviso({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, capas: ['marca', 'notificacion'] }),
      (e) => /oportunidad/.test(e.message) && /bolsillo/.test(e.message),
      'un par de dos capas de pantalla no ha fallado',
    );
  });

  test('Un aviso sin capas y un aviso con una capa que no existe fallan enumerando las que hay', () => {
    assert.throws(() => declaraAviso({ tipo: TIPOS_DE_AVISO.NOTICIA, capas: [] }), /no declara capas/);
    assert.throws(
      () => declaraAviso({ tipo: TIPOS_DE_AVISO.NOTICIA, capas: ['humo', 'marca'] }),
      (e) => /humo/.test(e.message) && CAPAS.every((c) => e.message.includes(c)),
      'una capa inventada no ha fallado enumerando las declaradas',
    );
  });

  test('Un tipo de aviso que no está en el enumerado falla nombrando los que sí valen', () => {
    for (const intruso of ['rumor', 'logro', '', null, 3]) {
      assert.throws(
        () => avisoDelCatalogo(intruso),
        (e) => IDS_DE_AVISO.every((id) => e.message.includes(id)),
        `"${intruso}" no ha fallado enumerando los tipos que valen`,
      );
    }
    const { emisor } = emisorNormal();
    assert.throws(
      () => emisor.emite({ tipo: 'rumor', texto: TEXTO_DE_NOTICIA }),
      (e) => IDS_DE_AVISO.every((id) => e.message.includes(id)),
      'emitir un tipo de fuera del enumerado no ha fallado nombrando los que valen',
    );
  });

  test('La oportunidad es el único aviso que enciende la pantalla', () => {
    // La reserva de `quests.md` decisión 3: un aviso más que la encienda devalúa todos
    // los demás, así que esto se afirma sobre el catálogo entero y no sobre los dos de hoy.
    const encienden = revisaElCatalogoDeAvisos().filter((a) => a.enciendeLaPantalla);
    assert.deepEqual(encienden.map((a) => a.tipo), [TIPOS_DE_AVISO.OPORTUNIDAD], 'enciende la pantalla algún aviso que no es la oportunidad');
    assert.equal(avisoDelCatalogo(TIPOS_DE_AVISO.NOTICIA).enciendeLaPantalla, false, 'la noticia enciende la pantalla');
  });

  test('Ningún aviso lleva acción de aceptar, de rechazar ni llamada a tocar', () => {
    assert.deepEqual(LO_QUE_UN_AVISO_NO_LLEVA.slice(), [
      'accion-de-aceptar',
      'accion-de-rechazar',
      'accion-de-descartar',
      'llamada-a-tocar',
    ]);
    const { emisor } = emisorNormal();
    for (const tipo of IDS_DE_AVISO) {
      const texto = tipo === TIPOS_DE_AVISO.NOTICIA ? TEXTO_DE_NOTICIA : TEXTO_DE_OPORTUNIDAD;
      const emitido = emisor.emite({ tipo, texto });
      assert.deepEqual(emitido.acciones, [], `el aviso "${tipo}" trae acciones`);
      for (const prohibida of LO_QUE_UN_AVISO_NO_LLEVA) {
        assert.equal(Object.keys(emitido).includes(prohibida), false, `el aviso "${tipo}" declara "${prohibida}"`);
      }
    }
  });
});

// ── La validación del texto ─────────────────────────────────────────────────────

describe('El texto de un aviso', () => {
  test('Un texto de aviso que no nombra ningún sitio del mundo falla', () => {
    assert.throws(
      () => validaTextoDeAviso('Aquí al lado ha pasado algo', { sitios: SITIOS, aviso: 'la oportunidad' }),
      (e) => /la oportunidad/.test(e.message) && /completo incluye dónde/.test(e.message),
      'un aviso sin sitio no ha fallado, o ha fallado sin nombrar el aviso',
    );
  });

  test('Un texto de aviso que no cabe en una línea falla y no se recorta', () => {
    const largo = `En Monfrida ${'algo que contar '.repeat(12)}`.trim();
    assert.ok(largo.length > TOPE_DE_LINEA, 'el texto de prueba cabe en una línea y no prueba nada');
    let recortado = null;
    assert.throws(
      () => { recortado = validaTextoDeAviso(largo, { sitios: SITIOS, aviso: 'la noticia' }); },
      (e) => /la noticia/.test(e.message) && /no se recorta/.test(e.message),
      'un texto que no cabe no ha fallado',
    );
    assert.equal(recortado, null, 'el texto se ha recortado en vez de fallar: un aviso recortado es un «toca para saber más» sin decirlo');
  });

  test('Un texto de aviso con un salto de línea falla: el aviso va entero en una línea', () => {
    assert.throws(() => validaTextoDeAviso('En Monfrida\nhay algo que contar', { sitios: SITIOS }), /salto de línea/);
  });

  test('Un texto de aviso que llama a tocar falla, en las cinco formas', () => {
    const llamadas = [
      'En Monfrida hay algo, toca para saber más',
      'En Monfrida hay algo, pulsa aquí',
      'En Monfrida hay algo: ver más',
      'En Monfrida hay algo, más información',
      'En Monfrida hay algo, toca la notificación',
    ];
    for (const texto of llamadas) {
      assert.throws(
        () => validaTextoDeAviso(texto, { sitios: SITIOS }),
        /llama a tocar/,
        `"${texto}" no ha fallado y es una llamada a tocar`,
      );
    }
  });

  test('Un texto de aviso con una cifra dentro falla', () => {
    assert.throws(() => validaTextoDeAviso('En Monfrida hay 3 cosas que contar', { sitios: SITIOS }), /cifra/);
  });

  test('Validar un texto sin la lista de sitios del mundo falla en vez de dar el aviso por bueno', () => {
    // La alternativa —dar por válido lo que no se puede comprobar— es la que deja pasar
    // un aviso que no dice dónde el día que alguien monte el emisor sin mundo.
    for (const sitios of [undefined, null, [], 'Monfrida']) {
      assert.throws(() => validaTextoDeAviso(TEXTO_DE_NOTICIA, { sitios }), /lista de sitios/);
    }
  });
});

// ── La retención por beat ───────────────────────────────────────────────────────

describe('El mundo espera a que termine la escena', () => {
  test('Los dos tipos de aviso se retienen durante un beat, y no solo la oportunidad', () => {
    // `quests.md` decisión 3 dice «si estás dentro de una escena, el mundo espera» sin
    // distinguir, y el catálogo lo declara por tipo para que no se pueda olvidar uno.
    for (const aviso of CATALOGO_DE_AVISOS) assert.equal(aviso.seRetienePorBeat, true, `el aviso "${aviso.tipo}" no se retiene durante un beat`);

    const { vibrador, notificador, emisor } = emisorNormal();
    emisor.emite({ tipo: TIPOS_DE_AVISO.NOTICIA, texto: TEXTO_DE_NOTICIA, beatEnCurso: true });
    emisor.emite({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD, beatEnCurso: true });

    assert.deepEqual(emisor.retenidos().map((r) => r.tipo), ['noticia', 'oportunidad'], 'alguno de los dos tipos no se retuvo');
    assert.deepEqual(vibrador.toques(), []);
    assert.deepEqual(notificador.notificadas(), []);
  });

  test('Una oportunidad retenida por un beat en curso sale al terminar la escena y no se pierde', () => {
    const { vibrador, notificador, emisor } = emisorNormal();
    emisor.emite({ tipo: TIPOS_DE_AVISO.NOTICIA, texto: TEXTO_DE_NOTICIA, beatEnCurso: true });
    emisor.emite({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD, beatEnCurso: true });

    const salieron = emisor.terminaElBeat();

    // Salen los dos, en el orden en que llegaron: esperar no es perder, y el orden es
    // lo que hace comparable el mismo recorrido dos veces.
    assert.deepEqual(salieron.map((s) => s.tipo), ['noticia', 'oportunidad'], 'se ha perdido un aviso retenido, o han salido en otro orden');
    for (const s of salieron) assert.equal(s.emitido, true, `el aviso "${s.tipo}" salió del beat sin emitirse`);
    assert.deepEqual(emisor.retenidos(), [], 'ha quedado algún aviso retenido después de terminar la escena');
    assert.deepEqual(vibrador.toques().map((t) => t.texto), [TEXTO_DE_NOTICIA, TEXTO_DE_OPORTUNIDAD]);
    assert.deepEqual(notificador.notificadas().map((n) => n.texto), [TEXTO_DE_OPORTUNIDAD]);
  });

  test('Terminar el beat sin nada retenido no emite nada', () => {
    const { vibrador, emisor } = emisorNormal();
    assert.deepEqual(emisor.terminaElBeat(), []);
    assert.deepEqual(vibrador.toques(), []);
    assert.equal(emisor.ultimo(), null);
  });

  test('El estado del beat es un dato de dos valores y una tercera cosa falla', () => {
    // Deducirlo de la posición o del tiempo parado metería el reloj real donde no puede
    // estar, así que llega como dato y lo que no sea booleano se ve fallar.
    const { emisor } = emisorNormal();
    for (const raro of ['si', 1, null]) {
      assert.throws(() => emisor.emite({ tipo: TIPOS_DE_AVISO.NOTICIA, texto: TEXTO_DE_NOTICIA, beatEnCurso: raro }), /dos valores/);
    }
  });
});

// ── Nada degrada por falta de cableado ──────────────────────────────────────────

describe('Un canal denegado es un estado y un canal sin cablear es una avería', () => {
  test('El emisor sin vibrador cableado falla nombrando la pieza que falta', () => {
    assert.throws(
      () => creaEmisorDeAvisos({ vibrador: vibradorAusente(), notificador: notificadorQueRegistra(), sitios: SITIOS }),
      (e) => /vibrador/.test(e.message) && /una sola capa/.test(e.message),
      'el emisor se ha construido sin vibrador',
    );
    assert.throws(() => exigeVibrador(null), /vibrador/);
    assert.throws(() => exigeVibrador({}), /vibrador/);
  });

  test('El emisor sin notificador cableado falla, y no lo confunde con un permiso denegado', () => {
    assert.throws(
      () => creaEmisorDeAvisos({ vibrador: vibradorQueRegistra(), notificador: notificadorAusente(), sitios: SITIOS }),
      (e) => /notificador/.test(e.message) && /avería/.test(e.message),
      'el emisor se ha construido sin notificador',
    );
    assert.throws(() => exigeNotificador({ notifica: () => {} }), /notificador/);
    // Y el denegado sí construye: es la mitad que separa el estado de la avería.
    assert.ok(creaEmisorDeAvisos({ vibrador: vibradorQueRegistra(), notificador: notificadorDenegado(), sitios: SITIOS }));
  });

  test('El emisor sin los sitios del mundo falla en vez de admitir cualquier texto', () => {
    for (const sitios of [undefined, null, []]) {
      assert.throws(() => creaEmisorDeAvisos({ vibrador: vibradorQueRegistra(), notificador: notificadorQueRegistra(), sitios }), /sitios/);
    }
  });

  test('Con el permiso de notificaciones denegado la oportunidad se emite por las capas que quedan', () => {
    const vibrador = vibradorQueRegistra();
    const notificador = notificadorDenegado();
    const emisor = creaEmisorDeAvisos({ vibrador, notificador, sitios: SITIOS });

    const emitido = emisor.emite({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD });

    // No se castiga a quien denegó un permiso: el aviso sale.
    assert.equal(emitido.emitido, true, 'la oportunidad no se emitió con el permiso denegado');
    assert.deepEqual(emitido.capas.salieron, ['haptico']);
    assert.deepEqual(vibrador.toques(), [{ texto: TEXTO_DE_OPORTUNIDAD }]);

    // Y la falta queda declarada en el dato con su motivo, que es lo que permite medir
    // cuánto se pierde: «el error caro es creer que un aviso llegó».
    assert.deepEqual(emitido.capas.faltaron, [{ capa: 'notificacion', motivo: MOTIVOS_DE_CAPA_CAIDA.PERMISO_DENEGADO }]);
    assert.equal(emitido.capas.faltaron[0].motivo, 'permiso-denegado');
    assert.ok(IDS_DE_CAPA_CAIDA.includes(emitido.capas.faltaron[0].motivo), 'el motivo no está en el catálogo cerrado de motivos');
    // Sin notificación no se enciende la pantalla, aunque el tipo lo permita.
    assert.equal(emitido.enciendeLaPantalla, false, 'se dio por encendida la pantalla sin haber salido la notificación');
  });

  test('Una capa que estaba cableada y no respondió se anota con otro motivo', () => {
    // Se separa de «permiso denegado» a propósito: uno se arregla en los ajustes del
    // sistema y el otro en la app, y una sola clave para los dos haría el recuento inútil.
    const emisorConVibradorRoto = creaEmisorDeAvisos({ vibrador: vibradorQueFalla(), notificador: notificadorQueRegistra(), sitios: SITIOS });
    const conVibradorRoto = emisorConVibradorRoto.emite({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD });
    assert.deepEqual(conVibradorRoto.capas.faltaron, [{ capa: 'haptico', motivo: MOTIVOS_DE_CAPA_CAIDA.CANAL_SIN_RESPUESTA }]);
    assert.deepEqual(conVibradorRoto.capas.salieron, ['notificacion']);
    assert.equal(conVibradorRoto.emitido, true);

    const emisorConNotificadorRoto = creaEmisorDeAvisos({ vibrador: vibradorQueRegistra(), notificador: notificadorQueFalla(), sitios: SITIOS });
    const conNotificadorRoto = emisorConNotificadorRoto.emite({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD });
    assert.deepEqual(conNotificadorRoto.capas.faltaron, [{ capa: 'notificacion', motivo: MOTIVOS_DE_CAPA_CAIDA.CANAL_SIN_RESPUESTA }]);
    assert.equal(conNotificadorRoto.enciendeLaPantalla, false);
  });

  test('Todo aviso emitido dice qué capas salieron y cuáles faltaron, aunque no faltase ninguna', () => {
    // La tercera lista es la que importa: un aviso que llegó y uno que se creyó llegado
    // son cosas distintas, y sin la anotación son indistinguibles después.
    const { emisor } = emisorNormal();
    const emitido = emisor.emite({ tipo: TIPOS_DE_AVISO.NOTICIA, texto: TEXTO_DE_NOTICIA });
    assert.deepEqual(Object.keys(emitido.capas).sort(), ['declaradas', 'faltaron', 'salieron']);
    assert.deepEqual(
      [...emitido.capas.salieron, ...emitido.capas.faltaron.map((f) => f.capa)].sort(),
      emitido.capas.declaradas.slice().sort(),
      'lo que salió más lo que faltó no suma las capas declaradas: hay una capa de la que no se sabe nada',
    );
  });
});

// ── Determinismo ────────────────────────────────────────────────────────────────

describe('La secuencia de avisos de un recorrido', () => {
  test('El mismo recorrido simulado dos veces da la misma secuencia de avisos', () => {
    const guion = [
      { tipo: TIPOS_DE_AVISO.NOTICIA, texto: TEXTO_DE_NOTICIA, beatEnCurso: false },
      { tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD, beatEnCurso: true },
      { tipo: TIPOS_DE_AVISO.NOTICIA, texto: 'En O Fuso da Vella hay algo que contar', beatEnCurso: true },
    ];
    const recorre = () => {
      const { emisor } = emisorNormal();
      for (const aviso of guion) emisor.emite(aviso);
      emisor.terminaElBeat();
      return emisor.emitidos();
    };

    // Serialización completa y no campo a campo: es lo único que afirma «idéntico».
    assert.equal(JSON.stringify(recorre()), JSON.stringify(recorre()), 'dos recorridos iguales han dado secuencias distintas');
    assert.deepEqual(recorre().map((e) => e.tipo), ['noticia', 'oportunidad', 'noticia'], 'el orden de la secuencia no es el de llegada');
  });

  test('El módulo de avisos no usa ninguna fuente de azar ni de tiempo del sistema', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const fuente = readFileSync(fileURLToPath(new URL('../../packages/nucleo/partida/avisos.js', import.meta.url)), 'utf8');
    for (const prohibido of ['Math.random', 'Date.now', 'new Date', 'setTimeout', 'performance.now']) {
      assert.equal(fuente.includes(prohibido), false, `avisos.js usa ${prohibido}`);
    }
  });

  test('Lo emitido no guarda ninguna posición', () => {
    // RF-PRIV-002: por este subsistema pasa el momento con más posiciones del juego y de
    // ellas no sobrevive ninguna. Lo que se anota es el tipo, el texto y el sitio.
    const { emisor } = emisorNormal();
    emisor.emite({ tipo: TIPOS_DE_AVISO.OPORTUNIDAD, texto: TEXTO_DE_OPORTUNIDAD });
    const escrito = JSON.stringify(emisor.emitidos());
    for (const campo of ['"x"', '"y"', 'lat', 'lon', 'coord', 'posicion', 'traza']) {
      assert.equal(escrito.includes(campo), false, `lo emitido guarda "${campo}"`);
    }
    assert.deepEqual(Object.keys(emisor.ultimo()).sort(), [
      'acciones', 'alTocar', 'capas', 'emitido', 'enciendeLaPantalla', 'retenido', 'seAceptaYendo', 'sitio', 'texto', 'tipo',
    ]);
  });
});
