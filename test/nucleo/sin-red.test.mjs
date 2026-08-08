// SPEC-009 · Los tres huecos de B3 y B4 —ilustraciones, fotos del lado real y
// textos ya validados— y la pregunta que sostiene RF-PERS-002: qué le falta a una
// aventura para jugarse **sin una sola petición de red**.
//
// Lo que hay aquí es la forma del hueco y no su contenido: generar las imágenes es
// de la fila 25 y los textos, de la fila 18. Por eso todas las declaraciones se
// construyen a mano, con un reloj inyectado para la única fecha del documento.
//
// Las afirmaciones de ausencia van con el inspector de tráfico saliente en modo
// estricto y con el doble del proxy en modo «falla siempre»: una prueba de «esto
// funciona sin red» que no corte la red está fingiendo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESTADOS,
  FAMILIAS,
  claveDeElemento,
  claveDeIlustracion,
  claveDeTextoDeBeat,
  declaraFoto,
  declaraIlustracion,
  declaraTexto,
  inventario,
  ordenaRecursos,
  queFaltaParaJugarSinRed,
  recursosVacios,
} from '../../packages/nucleo/partida/recursos.js';
import { congelaCelda, levantaCelda, textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { texto } from '../../packages/nucleo/partida/formato.js';
import { repartoDeAventuras } from '../../packages/nucleo/partida/aventuras.js';
import { declaraTramo } from '../../packages/nucleo/partida/tramo.js';
import { incorporaMedida, mideRitmoDeSalida } from '../../packages/nucleo/partida/ritmo.js';
import { CLAVES, cargaCelda, cargaMapa, creaMapa, guardaMapa, mundoDeCelda, pisa } from '../../packages/nucleo/partida/mapa.js';
import { proyectorDeRejilla } from '../../packages/nucleo/world/rejilla.js';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { creaDobleDelProxy } from '../dobles/proxy.mjs';
import { simulaRecorrido } from '../dobles/gps-simulado.mjs';
import { SEMILLA_A, consultaDeFixture, coordenadaDe } from './celda-de-prueba.mjs';
import {
  almacenEnMemoria,
  celdaDeFixture,
  placesDePrueba,
  recorreDocumento,
  textosDe,
  trazaDesdeRecorrido,
} from './partida-de-prueba.mjs';

/** El reloj inyectado. Fijo, para que el documento siga siendo comparable byte a byte. */
const RELOJ = () => '2026-08-07';

/** Los tres huecos rellenos sobre un mundo concreto: una ilustración, una foto y un texto. */
function recursosDe(mundo, { ilustraciones = 'todas', conFoto = true, conTexto = true } = {}) {
  const elementos = [
    ...mundo.settlements.map((s) => [s.type, s.name]),
    ...mundo.parajes.map((p) => [p.type, p.name]),
  ];
  const cuantas = ilustraciones === 'todas' ? elementos.length : ilustraciones;
  const placeId = 'ChIJ-A';
  return {
    ilustraciones: elementos.slice(0, cuantas).map(([tipo, nombre]) => declaraIlustracion({
      elemento: claveDeElemento(tipo, nombre),
      prompt: `un ${tipo} de fantasía llamado ${nombre}, tinta y acuarela`,
      recurso: `local/il/${nombre}.webp`,
    })),
    fotos: conFoto ? [declaraFoto({ placeId, recurso: `local/fotos/${placeId}.webp`, reloj: RELOJ })] : [],
    textos: conTexto ? [declaraTexto({ clave: claveDeTextoDeBeat('entrega-sospechosa', 1), texto: 'El encargo huele a chamusquina.', origen: 'llm' })] : [],
  };
}

describe('Los tres huecos de las ilustraciones, las fotos y los textos', () => {
  test('El documento guarda el prompt de ficción de una ilustración, su clave y dónde está el recurso', async () => {
    const registro = await celdaDeFixture('costero');
    const paraje = registro.mundo.parajes[0];
    const prompt = `una ${paraje.type} de fantasía llamada ${paraje.name}, tinta y acuarela`;
    const recursos = {
      ilustraciones: [
        declaraIlustracion({ elemento: claveDeElemento(paraje.type, paraje.name), prompt, recurso: 'local/il/paraje.webp' }),
        declaraIlustracion({ elemento: claveDeElemento('nucleo', 'Sin Pintar'), prompt: 'una aldea de fantasía sin pintar' }),
      ],
      fotos: [],
      textos: [],
    };
    const doc = congelaCelda(registro, { recursos });

    const [conRecurso, sinRecurso] = [...doc.recursos.ilustraciones].sort((a, b) => (a.estado < b.estado ? 1 : -1));
    assert.equal(conRecurso.prompt, prompt, 'el documento no guarda el prompt de ficción');
    assert.equal(conRecurso.clave, claveDeIlustracion(prompt), 'la clave no está derivada del prompt');
    assert.equal(conRecurso.recurso, 'local/il/paraje.webp', 'el documento no guarda la referencia al recurso local');
    assert.equal(conRecurso.estado, ESTADOS.RESIDENTE);
    assert.equal(sinRecurso.recurso, null, 'una ilustración que no está no declara que no la hay');
    assert.equal(sinRecurso.estado, ESTADOS.AUSENTE);

    // El binario no entra, ni en línea ni codificado: solo la clave con la que se
    // vuelve a pedir. Y la clave es estable, que es lo que la hace servir de caché.
    assert.equal(claveDeIlustracion(prompt), claveDeIlustracion(prompt));
    assert.notEqual(claveDeIlustracion(prompt), claveDeIlustracion(`${prompt} `));
    for (const { valor } of textosDe(doc.recursos)) assert.equal(/^data:/.test(valor), false, 'hay un binario en línea en la capa de recursos');

    // Y vuelve entera del documento.
    const levantado = levantaCelda(texto(doc), { semilla: SEMILLA_A });
    assert.deepEqual(levantado.recursos.ilustraciones, doc.recursos.ilustraciones, 'las ilustraciones no vuelven del documento');
  });

  test('El documento guarda el place_id de una foto, su recurso local y su fecha de captura, y ninguna URL de Places', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles'), demanda: { total: 40, suelo: 4 } });
    const recursos = {
      ilustraciones: [],
      fotos: [
        declaraFoto({ placeId: 'ChIJ-A', recurso: 'local/fotos/ChIJ-A.webp', reloj: RELOJ }),
        declaraFoto({ placeId: 'ChIJ-B' }),
      ],
      textos: [],
    };
    const doc = congelaCelda(registro, { recursos });

    const conFoto = doc.recursos.fotos.find((f) => f.placeId === 'ChIJ-A');
    assert.equal(conFoto.anclaje, 'places:ChIJ-A');
    assert.equal(conFoto.recurso, 'local/fotos/ChIJ-A.webp');
    assert.equal(conFoto.capturadaEn, '2026-08-07', 'la foto residente no lleva la fecha en que se capturó');
    assert.equal(conFoto.estado, ESTADOS.RESIDENTE);

    const sinFoto = doc.recursos.fotos.find((f) => f.placeId === 'ChIJ-B');
    assert.equal(sinFoto.recurso, null);
    assert.equal(sinFoto.capturadaEn, null, 'una foto que no está declara fecha de captura');
    assert.equal(sinFoto.estado, ESTADOS.AUSENTE);

    // Ninguna URL de Places: caducan, y guardarlas sería guardar algo que dejará de
    // funcionar. Lo único suyo que se guarda es el identificador.
    for (const { ruta, valor } of textosDe(doc)) {
      assert.equal(/^https?:\/\//.test(valor), false, `${ruta}: hay una URL en el documento (${valor})`);
      assert.equal(valor.includes('maps.googleapis'), false, `${ruta}: hay una URL de Places en el documento`);
    }

    // El reloj entra inyectado: sin él y sin fecha, una foto residente no se declara
    // en silencio con fecha desconocida.
    assert.throws(() => declaraFoto({ placeId: 'ChIJ-C', recurso: 'local/fotos/ChIJ-C.webp' }), /reloj/, 'una foto residente sin fecha ni reloj se ha declarado igual');
    // Y con el reloj fijo el documento sigue siendo el mismo texto dos veces.
    assert.equal(textoDeCelda(registro, { recursos: recursosDe(registro.mundo) }), textoDeCelda(registro, { recursos: recursosDe(registro.mundo) }));
  });

  test('Un texto ya validado se guarda en línea con su clave y con su origen declarado', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles');
    const recursos = {
      ilustraciones: [],
      fotos: [],
      textos: [
        declaraTexto({ clave: claveDeTextoDeBeat('entrega-sospechosa', 1), texto: 'El encargo huele a chamusquina.', origen: 'llm' }),
        declaraTexto({ clave: claveDeTextoDeBeat('entrega-sospechosa', 2), texto: 'Recibes el paquete y las señas del herrero.', origen: 'plantilla' }),
      ],
    };
    const doc = congelaCelda(registro, { recursos });

    assert.deepEqual(doc.recursos.textos.map((t) => t.clave), ['entrega-sospechosa:beat:1', 'entrega-sospechosa:beat:2']);
    assert.deepEqual(doc.recursos.textos.map((t) => t.origen), ['llm', 'plantilla']);
    assert.equal(doc.recursos.textos[0].texto, 'El encargo huele a chamusquina.', 'el texto no va en línea en el documento');
    assert.throws(() => declaraTexto({ clave: 'x', texto: 'y', origen: 'inventado' }), /origen de texto desconocido/, 'un texto sin origen declarado se ha aceptado');

    const levantado = levantaCelda(texto(doc), { semilla: SEMILLA_A });
    assert.deepEqual(levantado.recursos.textos, doc.recursos.textos, 'los textos no vuelven del documento');
  });

  test('Un mundo sin ninguna ilustración, ninguna foto y ningún texto del LLM está completo y es jugable', async () => {
    const registro = await celdaDeFixture('costero');
    const doc = congelaCelda(registro);

    for (const familia of FAMILIAS) {
      assert.deepEqual(doc.recursos[familia], [], `el hueco "${familia}" no declara que está vacío`);
    }
    assert.deepEqual(doc.recursos, recursosVacios(), 'los tres huecos no salen declarados y vacíos');

    // Y el mundo levantado es jugable: castea plantillas y reparte aventuras.
    const levantado = levantaCelda(texto(doc), { semilla: SEMILLA_A });
    assert.ok(levantado.mundo.casting.some((c) => c.ok), 'el mundo levantado sin recursos no castea ninguna plantilla');
    const reparto = repartoDeAventuras({ mundo: levantado.mundo, tramo: declaraTramo('otro-barrio'), tamano: 'aventura' });
    assert.equal(reparto.hayReparto, true, 'un mundo sin recursos no ofrece ninguna aventura');
    assert.ok(reparto.aventuras.some((a) => a.cabe), 'ninguna aventura del mundo sin recursos cabe en la salida');
    assert.deepEqual(inventario(doc.recursos), { ilustraciones: [], fotos: [], textos: [] });
  });

  test('Rellenar los huecos después no toca ni un nombre, ni un tipo, ni una posición de la capa de ficción', async () => {
    const registro = await celdaDeFixture('costero');
    const sinNada = congelaCelda(registro);
    const conTodo = congelaCelda(registro, { recursos: recursosDe(registro.mundo) });

    assert.deepEqual(conTodo.mundo, sinNada.mundo, 'rellenar los huecos ha cambiado el mundo');
    assert.equal(JSON.stringify(conTodo.mundo), JSON.stringify(sinNada.mundo), 'la capa de ficción de los dos documentos no es la misma');
    assert.deepEqual(conTodo.celda, sinNada.celda);
    assert.deepEqual(conTodo.cupos, sinNada.cupos);
    assert.equal(conTodo.version, sinNada.version, 'rellenar los huecos ha subido la versión del formato');
    assert.notDeepEqual(conTodo.recursos, sinNada.recursos, 'los dos documentos tienen los mismos recursos: no se está comprobando nada');
  });

  test('La capa de recursos sale en un orden declarado y no en el de inserción', async () => {
    const registro = await celdaDeFixture('costero');
    const recursos = recursosDe(registro.mundo);
    const alReves = {
      ilustraciones: [...recursos.ilustraciones].reverse(),
      fotos: [...recursos.fotos].reverse(),
      textos: [...recursos.textos].reverse(),
    };
    assert.deepEqual(ordenaRecursos(alReves), ordenaRecursos(recursos), 'la capa de recursos depende del orden en que se declaró');
    assert.equal(textoDeCelda(registro, { recursos: alReves }), textoDeCelda(registro, { recursos }), 'el documento cambia si los recursos se declaran en otro orden');
  });
});

describe('Qué falta para jugar sin red', () => {
  test('Se enumeran los recursos ausentes de una aventura sin hacer ninguna petición', async () => {
    const registro = await celdaDeFixture('costero');
    const reparto = repartoDeAventuras({ mundo: registro.mundo, tramo: declaraTramo('otro-barrio'), tamano: 'aventura' });
    const aventura = reparto.aventuras.find((a) => a.cabe) ?? reparto.aventuras[0];

    const inspector = creaInspectorDeRed({ estricto: true });
    let falta;
    try {
      falta = queFaltaParaJugarSinRed({ aventura, recursos: recursosVacios() });
      assert.deepEqual(inspector.peticiones(), [], 'preguntar qué falta ha salido a la red');
    } finally {
      inspector.suelta();
    }

    assert.equal(falta.completo, false, 'un mundo sin ningún recurso dice que no le falta nada');
    assert.ok(falta.faltan.length > 0, 'no se ha enumerado ningún recurso ausente');
    for (const f of falta.faltan) {
      assert.ok(['ilustracion', 'foto', 'texto'].includes(f.familia), `familia de recurso desconocida: ${f.familia}`);
      assert.equal(typeof f.clave, 'string');
      assert.match(f.de, /^beat \d+$/, `no se dice de qué beat falta el recurso: ${f.de}`);
    }
    // Un beat por texto, y una ilustración por lugar distinto: enumera, no repite.
    assert.equal(falta.faltan.filter((f) => f.familia === 'texto').length, aventura.beats.length, 'no falta el texto de cada beat');
    const claves = falta.faltan.map((f) => `${f.familia}|${f.clave}`);
    assert.deepEqual(claves.filter((c, i) => claves.indexOf(c) !== i), [], 'se enumera dos veces el mismo recurso');
  });

  test('Con todos los recursos residentes la respuesta es que no falta nada', async () => {
    const registro = await celdaDeFixture('costero');
    const reparto = repartoDeAventuras({ mundo: registro.mundo, tramo: declaraTramo('otro-barrio'), tamano: 'aventura' });
    const aventura = reparto.aventuras.find((a) => a.cabe) ?? reparto.aventuras[0];

    // Se declara exactamente lo que esa aventura necesita, que es lo que la
    // preparación de la salida habrá dejado residente.
    const recursos = recursosVacios();
    for (const beat of aventura.beats) {
      recursos.ilustraciones.push(declaraIlustracion({
        elemento: claveDeElemento(beat.lugar.tipo, beat.lugar.nombre),
        prompt: `un ${beat.lugar.tipo} llamado ${beat.lugar.nombre}`,
        recurso: `local/il/${beat.n}.webp`,
      }));
      const placeId = beat.lugar.real?.placeId ?? null;
      if (placeId) recursos.fotos.push(declaraFoto({ placeId, recurso: `local/fotos/${placeId}.webp`, reloj: RELOJ }));
      recursos.textos.push(declaraTexto({ clave: claveDeTextoDeBeat(aventura.plantilla, beat.n), texto: beat.texto, origen: 'plantilla' }));
    }

    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const falta = queFaltaParaJugarSinRed({ aventura, recursos });
      assert.deepEqual(falta.faltan, [], `todavía falta algo: ${falta.faltan.map((f) => `${f.familia} ${f.clave}`).join(', ')}`);
      assert.equal(falta.completo, true, 'con todos los recursos residentes se sigue diciendo que falta algo');
      assert.deepEqual(inspector.peticiones(), []);
    } finally {
      inspector.suelta();
    }
  });

  test('Una ilustración que no está residente no impide jugar el paraje: se cae al material de plantilla', async () => {
    const registro = await celdaDeFixture('costero');
    const reparto = repartoDeAventuras({ mundo: registro.mundo, tramo: declaraTramo('otro-barrio'), tamano: 'aventura' });
    const aventura = reparto.aventuras.find((a) => a.cabe) ?? reparto.aventuras[0];

    const inspector = creaInspectorDeRed({ estricto: true });
    const proxy = creaDobleDelProxy({ modo: 'falla-siempre' });
    try {
      const falta = queFaltaParaJugarSinRed({ aventura, recursos: recursosVacios() });
      const sinIlustracion = falta.faltan.filter((f) => f.familia === 'ilustracion');
      assert.ok(sinIlustracion.length > 0, 'no falta ninguna ilustración: el caso no comprueba nada');

      // Lo que falta se enumera, **no se rechaza**: cada beat conserva su texto de
      // plantilla y su lugar, así que el paraje se juega igual.
      for (const beat of aventura.beats) {
        assert.equal(typeof beat.texto, 'string', `el beat ${beat.n} no trae texto de plantilla`);
        assert.ok(beat.texto.length > 0, `el beat ${beat.n} trae un texto de plantilla vacío`);
        assert.equal(typeof beat.lugar.nombre, 'string');
        assert.equal(typeof beat.escena, 'string');
      }
      assert.equal(aventura.cabe || aventura.lazo.trazado, true, 'la aventura sin ilustraciones no se puede recorrer');

      // Un anclaje sin foto residente conserva su cartela: nombre real y tipo, que
      // es con lo que el visor abre sobre fondo liso.
      const conAnclaje = registro.mundo.settlements.flatMap((s) => s.services).filter((v) => v.real);
      assert.ok(conAnclaje.length > 0, 'ningún servicio del mundo está anclado: el caso no comprueba nada');
      for (const v of conAnclaje) assert.equal(typeof v.real.kind, 'string', 'un anclaje sin foto se queda sin cartela');

      assert.deepEqual(proxy.peticiones(), [], 'se ha pedido algo al proxy para jugar un paraje sin ilustración');
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico para jugar un paraje sin ilustración');
    } finally {
      inspector.suelta();
    }
  });
});

describe('El mundo se congela entero', () => {
  test('Una salida entera se juega sin red', async () => {
    // El mundo se genera y se guarda; después se corta la red del todo —el
    // inspector en modo estricto y el proxy en modo «falla siempre»— y desde ahí
    // se hace la salida entera: abrir el mapa, leer la celda, repartir aventuras,
    // recorrer el lazo y medir el ritmo al llegar.
    const { lat, lon } = coordenadaDe('costero');
    const mapa = creaMapa({ semilla: SEMILLA_A, lat, lon, tramoM: 2000 });
    const consultaOsm = consultaDeFixture('costero');
    const almacen = almacenEnMemoria();
    await pisa(mapa, lat, lon, { consultaOsm });
    await guardaMapa(mapa, { almacen });
    const consultasAlGenerar = consultaOsm.llamadas.length;
    const documentoAntes = almacen.datos.get(CLAVES.celda(mapa.id, '0,0'));

    const inspector = creaInspectorDeRed({ estricto: true });
    const proxy = creaDobleDelProxy({ modo: 'falla-siempre' });
    try {
      const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
      await cargaCelda(cargado, { i: 0, j: 0 }, { almacen });
      const mundo = mundoDeCelda(cargado, { i: 0, j: 0 });

      let tramo = declaraTramo('otro-barrio');
      const reparto = repartoDeAventuras({ mundo, tramo, tamano: 'aventura' });
      assert.equal(reparto.hayReparto, true, 'sin red no se ofrece ninguna aventura');
      const aventura = reparto.aventuras.find((a) => a.cabe);
      assert.ok(aventura, 'ninguna aventura cabe en la salida: la salida no se puede jugar');
      assert.equal(aventura.lazo.trazado, true, 'el lazo de la aventura no se ha trazado sin red');

      // Se anda el lazo entero, de principio a fin y de vuelta al principio.
      const proy = proyectorDeRejilla(cargado.rejilla);
      const polilinea = aventura.lazo.recorrido.map((p) => proy.toLatLon(p));
      assert.ok(polilinea.length >= 2, 'el lazo no tiene recorrido que andar');
      const posiciones = simulaRecorrido({ polilinea, velocidadKmH: 4.5 });
      const medida = mideRitmoDeSalida(trazaDesdeRecorrido(posiciones));
      tramo = incorporaMedida(tramo, medida);
      assert.ok(medida.metrosAndando > 0, 'no se ha andado nada de la salida');

      // Todos los beats de la aventura están en el recorrido: se completa entera.
      const enElRecorrido = (lugar) => aventura.lazo.recorrido.some((p) => Math.hypot(p.x - lugar.x, p.y - lugar.y) < 1);
      for (const beat of aventura.beats) {
        assert.ok(enElRecorrido(beat.lugar), `el beat ${beat.n} (${beat.lugar.nombre}) no está en el recorrido de la salida`);
        assert.ok(beat.texto.length > 0, `el beat ${beat.n} se queda sin texto sin red`);
      }
      const primero = aventura.lazo.recorrido[0];
      const ultimo = aventura.lazo.recorrido[aventura.lazo.recorrido.length - 1];
      assert.ok(Math.hypot(primero.x - ultimo.x, primero.y - ultimo.y) < 1, 'el lazo de la salida no cierra donde empezó');

      // Y el mapa no ha cambiado durante la salida.
      assert.equal(almacen.datos.get(CLAVES.celda(mapa.id, '0,0')), documentoAntes, 'el documento de la celda ha cambiado durante la salida');
      assert.equal(consultaOsm.llamadas.length, consultasAlGenerar, 'se ha consultado OSM durante la salida');
      assert.deepEqual(proxy.peticiones(), [], 'se ha pedido algo al proxy durante la salida');
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico del móvil durante la salida');
    } finally {
      inspector.suelta();
    }
  });
});

describe('El árbitro es el código y el narrador es el LLM', () => {
  test('Sin red, la aventura funciona entera', async () => {
    // Los huecos de textos e ilustraciones con su origen declarado son lo que
    // sostiene esto: sin conexión, todos los textos salen de plantilla y la
    // aventura se completa de principio a fin.
    const registro = await celdaDeFixture('costero');
    const guardado = textoDeCelda(registro);

    const inspector = creaInspectorDeRed({ estricto: true });
    const proxy = creaDobleDelProxy({ modo: 'falla-siempre' });
    try {
      const levantado = levantaCelda(guardado, { semilla: SEMILLA_A });
      const reparto = repartoDeAventuras({ mundo: levantado.mundo, tramo: declaraTramo('otro-barrio'), tamano: 'aventura' });
      const aventura = reparto.aventuras.find((a) => a.cabe);
      assert.ok(aventura, 'sin red no hay ninguna aventura que quepa');

      // Todos los textos de la aventura salen de plantilla y llevan su origen
      // declarado, que es lo que permite saber después cuáles se pueden reescribir.
      const recursos = recursosVacios();
      for (const beat of aventura.beats) {
        recursos.textos.push(declaraTexto({ clave: claveDeTextoDeBeat(aventura.plantilla, beat.n), texto: beat.texto, origen: 'plantilla' }));
      }
      const doc = congelaCelda(registro, { recursos });
      assert.equal(doc.recursos.textos.length, aventura.beats.length);
      for (const t of doc.recursos.textos) assert.equal(t.origen, 'plantilla', 'un texto de plantilla no declara su origen');
      assert.equal(queFaltaParaJugarSinRed({ aventura, recursos }).faltan.filter((f) => f.familia === 'texto').length, 0, 'con los textos de plantilla dentro sigue faltando texto');

      // Y la estructura de la aventura es la del código, no la del narrador: los
      // mismos beats, en el mismo orden, con el mismo lazo.
      assert.deepEqual(aventura.beats.map((b) => b.n), aventura.beats.map((_, i) => i + 1));
      assert.deepEqual(aventura.beats.map((b) => b.rol), reparto.aventuras.find((a) => a.plantilla === aventura.plantilla).beats.map((b) => b.rol));
      assert.equal(aventura.lazo.trazado, true, 'la aventura no se puede recorrer sin red');

      // El documento con los textos dentro no lleva ni una URL ni una marca de red.
      const conRed = [];
      recorreDocumento(doc, (ruta, valor) => {
        if (typeof valor === 'string' && /https?:\/\/|proxy|api\./.test(valor)) conRed.push(ruta);
      });
      assert.deepEqual(conRed, [], `el documento menciona la red: ${conRed.join(', ')}`);
      assert.deepEqual(proxy.peticiones(), [], 'se ha pedido algo al proxy para jugar la aventura sin red');
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico para jugar la aventura sin red');
    } finally {
      inspector.suelta();
    }
  });
});
