// SPEC-023 · El sobre, la ruta y el esquema cerrado, y qué pasa con aguas arriba caído,
// lento o respondiendo mal.
//
// El esquema cerrado es la segunda red de «el prompt del LLM no lleva ningún dato real»:
// no hace falta saber qué dice el contrato del prompt para afirmar que un campo con el
// nombre real de un bar no cabe en la ruta de texto. Y el sobre común es lo que permite
// que sin cobertura, aguas arriba caído, presupuesto agotado y sin atestación terminen
// los cuatro en la misma forma, que es lo que evita una pantalla explicando la red.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CAMPOS_DEL_SOBRE, ESQUEMAS, RUTAS_DE_CONTENIDO } from '../../server/proxy.mjs';
import { creaClienteDeTexto } from '../../server/aguas-arriba/texto.mjs';
import { creaClienteDeImagen } from '../../server/aguas-arriba/imagen.mjs';
import { creaAguasArribaDobladas, creaProveedorDoblado } from '../dobles/aguas-arriba.mjs';
import { pideTanda } from '../dobles/atestacion.mjs';
import { creaReloj } from '../dobles/reloj.mjs';
import { EJEMPLOS, montaProxy, peticionDe, todoLoEscrito } from '../dobles/proxy-ciego.mjs';
import { respuestasFijas } from '../dobles/proxy.mjs';

/** La clave del proveedor, tal cual la vería un mensaje de error suyo. */
const CLAVE_DEL_PROVEEDOR = 'sk-CLAVE-SECRETA-DEL-PROVEEDOR-0001';

describe('El sobre, la ruta y el esquema cerrado', () => {
  test('Un campo que el esquema de la ruta no declara se rechaza nombrándolo y no llega a aguas arriba', async () => {
    const { proxy, aguasArriba } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 8 });

    // Uno por ruta, y en los tres niveles del sobre: el sobre, la petición y lo anidado.
    const intrusos = [
      ['texto', { ...EJEMPLOS.texto, nombre_real: 'Casa Manuela' }, /nombre_real/],
      ['texto', { ...EJEMPLOS.texto, lat: 42.4012 }, /lat/],
      ['imagen', { ...EJEMPLOS.imagen, place_id: 'ChIJ-x' }, /place_id/],
      ['imagen', { prompt: 'x', formato: { tipo: 'png', ancho: 1, alto: 1, semilla: '42.40,-8.81' } }, /formato\.semilla/],
      ['places', { place_id: 'ChIJ-x', direccion: 'Rúa Nova 3' }, /direccion/],
      ['generacion', { consulta: { ql: 'x', lat: 42.4 } }, /consulta\.lat/],
    ];
    let i = 0;
    for (const [tipo, peticion, esperado] of intrusos) {
      const r = await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...peticion }));
      assert.equal(r.estado, 400, `${tipo}: ${JSON.stringify(peticion)}`);
      assert.match(r.sobre.error, esperado);
      assert.match(r.sobre.error, /campo no declarado/);
    }
    assert.equal(aguasArriba.llamadasDePago(), 0, 'ningún rechazo puede llegar a aguas arriba');
  });

  test('El esquema de cada ruta admite lo que la spec declara y ningún campo más', () => {
    assert.deepEqual(ESQUEMAS.texto, ['prompt', 'idioma', 'tono']);
    assert.deepEqual(ESQUEMAS.imagen, ['prompt', 'formato']);
    assert.deepEqual(ESQUEMAS.places, ['place_id']);
    assert.deepEqual(ESQUEMAS.generacion, ['consulta']);
    assert.deepEqual(CAMPOS_DEL_SOBRE, ['ficha', 'lote', 'peticion']);
    assert.deepEqual(RUTAS_DE_CONTENIDO, ['texto', 'imagen', 'places', 'generacion']);
  });

  test('El prompt del LLM no lleva ningún dato real', async () => {
    // Aquí se entrega la segunda red del escenario: sin saber qué dice el contrato del
    // prompt, la ruta de texto rechaza cualquier campo que no sea el prompt de ficción,
    // el idioma y el tono. Un nombre real, una dirección, un identificador de OSM o de
    // Places y una coordenada no tienen por dónde entrar.
    const { proxy, aguasArriba } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 6 });
    let i = 0;
    for (const dato of [{ nombre: 'Casa Manuela' }, { direccion: 'Rúa Nova 3' }, { osm_id: 'node/123' },
      { place_id: 'ChIJ-x' }, { lat: 42.4012 }, { lon: -8.8114 }]) {
      const r = await proxy.atiende(peticionDe('texto', { ficha: fichas[i++], ...EJEMPLOS.texto, ...dato }));
      assert.equal(r.estado, 400, JSON.stringify(dato));
    }
    assert.equal(aguasArriba.texto.llamadas(), 0);
  });

  test('Las coordenadas salen una sola vez, al generar el mapa', async () => {
    const reloj = creaReloj();
    const { proxy, aguasArriba } = montaProxy({ reloj });
    const { fichas } = await pideTanda(proxy, { cuantas: 8 });

    // Ninguna ruta salvo la de generación admite una coordenada en su esquema.
    for (const tipo of ['texto', 'imagen', 'places']) {
      assert.ok(!ESQUEMAS[tipo].includes('consulta'), tipo);
      const r = await proxy.atiende(peticionDe(tipo, { ficha: fichas[0], ...EJEMPLOS[tipo], consulta: { ql: '42.4,-8.8' } }));
      assert.equal(r.estado, 400, tipo);
    }

    // La de generación sí, y es la única: una vez, al generar el mapa.
    const zona = '42.4012,-8.8114';
    const generacion = await proxy.atiende(peticionDe('generacion', {
      ficha: fichas[1], lote: { id: 'lote-mapa', tipo: 'mapa' }, consulta: { ql: `[out:json];node(${zona});out;` },
    }));
    assert.equal(generacion.sobre.hay, true);
    assert.equal(aguasArriba.generacion.llamadas(), 1);
    assert.ok(aguasArriba.generacion.peticiones()[0].peticion.consulta.ql.includes(zona));

    // Y no quedan escritas en ninguna entrada de la superficie, ni siquiera en la métrica.
    let i = 2;
    for (const tipo of ['texto', 'imagen', 'places']) {
      await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] }));
    }
    const escrito = todoLoEscrito(await proxy.recorreSuperficie());
    assert.ok(!escrito.includes(zona), 'la coordenada está escrita en la superficie');
    assert.ok(!escrito.includes('42.4012'));
    const dia = await proxy.metrica.delDia();
    assert.ok(!JSON.stringify(dia).includes('42.4'), 'la métrica no puede llevar geografía');
    assert.equal(dia.contadores.generacion['llamada-de-pago'], 1, 'sólo el recuento de generaciones');
  });

  test('Las cuatro rutas comparten la misma forma de sobre', async () => {
    const { proxy } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 8 });

    const conContenido = [];
    let i = 0;
    for (const tipo of RUTAS_DE_CONTENIDO) {
      const r = await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] }));
      assert.deepEqual(Object.keys(r.sobre).sort(), ['contenido', 'deCache', 'hay', 'tipo'], tipo);
      assert.equal(r.sobre.tipo, tipo);
      conContenido.push(r.sobre);
    }
    // Qué se pide, si viene de caché, y el contenido o la declaración de que no hay.
    for (const s of conContenido) assert.equal(s.hay, true);

    const sinContenido = montaProxy({ aguasArriba: creaAguasArribaDobladas({ modo: 'falla-siempre' }) });
    const tanda = await pideTanda(sinContenido.proxy, { cuantas: 8 });
    let j = 0;
    for (const tipo of RUTAS_DE_CONTENIDO) {
      const r = await sinContenido.proxy.atiende(peticionDe(tipo, { ficha: tanda.fichas[j++], ...EJEMPLOS[tipo] }));
      assert.deepEqual(Object.keys(r.sobre).sort(), ['contenido', 'deCache', 'hay', 'tipo'], tipo);
      assert.equal(r.sobre.hay, false);
      assert.equal(r.sobre.contenido, null);
      assert.equal(r.estado, 200, 'la ausencia llega con el mismo código de éxito que las demás');
    }
  });

  test('La misma petición dos veces devuelve la misma respuesta salvo en la marca de acierto de caché', async () => {
    const { proxy } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 4 });

    const uno = await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen }));
    const dos = await proxy.atiende(peticionDe('imagen', { ficha: fichas[1], ...EJEMPLOS.imagen }));

    assert.equal(uno.sobre.deCache, false);
    assert.equal(dos.sobre.deCache, true);
    assert.deepEqual({ ...uno.sobre, deCache: null }, { ...dos.sobre, deCache: null });
  });

  test('El sobre del proxy real coincide campo a campo con el del doble del andamiaje', async () => {
    // El doble que entregó SPEC-001 llevaba escrito que la forma del sobre «es
    // convención del andamiaje hasta que la spec del proxy la cierre». Ésta es esa spec,
    // y la cierra con la forma que el andamiaje ya usaba: si dejaran de coincidir, las
    // pruebas que afirman «con LLM y sin LLM la estructura es idéntica» estarían
    // comparando contra algo que el proxy real ya no devuelve.
    const { proxy } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 4 });
    const fijas = respuestasFijas();

    let i = 0;
    for (const tipo of ['texto', 'imagen', 'places']) {
      const r = await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] }));
      assert.deepEqual(Object.keys(r.sobre.contenido).sort(), Object.keys(fijas[tipo]).sort(), tipo);
    }
    assert.deepEqual(Object.keys(fijas.places.foto).sort(), ['alto', 'ancho', 'atribucion', 'referencia']);
  });
});

describe('Aguas arriba caído, lento o respondiendo mal', () => {
  test('Con el proveedor de texto caído se responde que no hay y el cliente cae a plantilla', async () => {
    const { proxy } = montaProxy({ aguasArriba: creaAguasArribaDobladas({ porRuta: { texto: { modo: 'falla-siempre' } } }) });
    const { fichas } = await pideTanda(proxy, { cuantas: 2 });

    const texto = await proxy.atiende(peticionDe('texto', { ficha: fichas[0], ...EJEMPLOS.texto }));
    assert.equal(texto.estado, 200);
    assert.equal(texto.sobre.hay, false);
    // El resto de rutas sigue sirviendo: un proveedor caído no tumba el proxy.
    const imagen = await proxy.atiende(peticionDe('imagen', { ficha: fichas[1], ...EJEMPLOS.imagen }));
    assert.equal(imagen.sobre.hay, true);
  });

  test('Con el proveedor de imágenes caído, una imagen que sí está en la caché se sirve de la caché', async () => {
    const aguasArriba = creaAguasArribaDobladas();
    const { proxy } = montaProxy({ aguasArriba });
    const { fichas } = await pideTanda(proxy, { cuantas: 3 });
    await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen }));

    // El proveedor se cae a partir de aquí: lo cacheado sigue estando pagado.
    aguasArriba.imagen.pide = async () => { throw new Error('el proveedor de imágenes no responde'); };
    const r = await proxy.atiende(peticionDe('imagen', { ficha: fichas[1], ...EJEMPLOS.imagen }));
    assert.equal(r.sobre.hay, true);
    assert.equal(r.sobre.deCache, true);

    // Y una que no estuviera cacheada, no.
    const otra = await proxy.atiende(peticionDe('imagen', { ficha: fichas[2], prompt: 'otra cosa', formato: { tipo: 'png', ancho: 512, alto: 512 } }));
    assert.equal(otra.sobre.hay, false);
  });

  test('Sin foto de Places, el visor abre igual', async () => {
    // La mitad servidor del escenario: Places caído termina en el mismo «no hay» que
    // cualquier otra ausencia, que es lo que permite que el visor abra con la cartela
    // sobre fondo liso sin saber por qué no hay foto.
    const { proxy } = montaProxy({ aguasArriba: creaAguasArribaDobladas({ porRuta: { places: { modo: 'falla-siempre' } } }) });
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });

    const r = await proxy.atiende(peticionDe('places', { ficha: fichas[0], ...EJEMPLOS.places }));
    assert.equal(r.estado, 200);
    assert.equal(r.sobre.hay, false);
    assert.equal(r.sobre.contenido, null);
    assert.equal(r.sobre.error, undefined);
  });

  test('Un proveedor que se pasa del plazo declarado se corta y no deja ninguna llamada a medias en la caché', async () => {
    const { proxy } = montaProxy({
      aguasArriba: creaAguasArribaDobladas({ porRuta: { imagen: { modo: 'falla-siempre', fallo: 'plazo-agotado' } } }),
    });
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });

    const r = await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen }));
    assert.equal(r.sobre.hay, false);
    assert.deepEqual(r.diagnostico, { ruta: 'imagen', fallo: 'plazo-agotado' });
    const recorrido = await proxy.recorreSuperficie();
    assert.equal(recorrido.filter((f) => f.entrada === 'cache-imagenes').length, 0,
      'una llamada cortada no puede dejar media entrada escrita');
  });

  test('El plazo máximo de aguas arriba lo corta el cliente real y no el proveedor', async () => {
    // El único caso que el doble no puede sostener, porque lo que se prueba es el propio
    // mecanismo del plazo. El plazo se baja a unos milisegundos: sigue sin haber reloj
    // real ni espera perceptible, y lo que se verifica es que la carrera corta de verdad.
    const { proxy } = montaProxy({
      entorno: { ESPERA_MAXIMA_AGUAS_ARRIBA: '5' },
      aguasArriba: {
        ...creaAguasArribaDobladas(),
        texto: creaClienteDeTexto({
          fetch: () => new Promise(() => {}),
          url: 'https://proveedor.invalido/v1',
          clave: CLAVE_DEL_PROVEEDOR,
          config: { ESPERA_MAXIMA_AGUAS_ARRIBA: 5 },
        }),
      },
    });
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });

    const r = await proxy.atiende(peticionDe('texto', { ficha: fichas[0], ...EJEMPLOS.texto }));
    assert.equal(r.sobre.hay, false);
    assert.equal(r.diagnostico.fallo, 'plazo-agotado');
  });

  test('Un proveedor que devuelve algo fuera del esquema de su ruta no se cachea y responde que no hay', async () => {
    for (const respuestaNula of [false, true]) {
      const { proxy } = montaProxy({ aguasArriba: creaAguasArribaDobladas({ modo: 'responde-mal', respuestaNula }) });
      const { fichas } = await pideTanda(proxy, { cuantas: 8 });
      let i = 0;
      for (const tipo of RUTAS_DE_CONTENIDO) {
        const r = await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] }));
        assert.equal(r.sobre.hay, false, `${tipo} (respuestaNula=${respuestaNula})`);
        assert.equal(r.diagnostico.fallo, 'respuesta-invalida');
      }
      assert.deepEqual(await proxy.recorreSuperficie().then((r) => r.filter((f) => f.entrada.startsWith('cache-'))), []);
    }
  });

  test('De un fallo de aguas arriba queda un contador agregado y ningún cuerpo, clave ni prompt', async () => {
    const { proxy } = montaProxy({ aguasArriba: creaAguasArribaDobladas({ modo: 'falla-siempre' }) });
    const { fichas } = await pideTanda(proxy, { cuantas: 4 });
    let i = 0;
    for (const tipo of RUTAS_DE_CONTENIDO) {
      await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] }));
    }

    const dia = await proxy.metrica.delDia();
    for (const tipo of RUTAS_DE_CONTENIDO) assert.equal(dia.contadores[tipo]['fallo-aguas-arriba'], 1, tipo);
    const escrito = todoLoEscrito(await proxy.recorreSuperficie());
    assert.ok(!escrito.includes('el puente viejo'), 'el prompt está escrito');
    assert.ok(!escrito.includes('ChIJfixture0001'), 'el place_id está escrito');
    assert.ok(!escrito.includes('out:json'), 'la consulta de celda está escrita');
  });

  test('La clave de un proveedor no aparece en ninguna respuesta, ningún error ni la superficie de escritura', async () => {
    // Con los clientes **reales**, que son los que tienen la clave dentro, y un `fetch`
    // inyectado que se comporta como el peor de los proveedores: devuelve el error con
    // la clave repetida en el mensaje y la URL con la clave en la query.
    const urlConClave = `https://proveedor.invalido/v1?key=${CLAVE_DEL_PROVEEDOR}`;
    const fetchQueFiltra = async () => {
      throw new Error(`401 Unauthorized {"url":"${urlConClave}","authorization":"Bearer ${CLAVE_DEL_PROVEEDOR}"}`);
    };
    const config = { ESPERA_MAXIMA_AGUAS_ARRIBA: 20000 };
    const { proxy } = montaProxy({
      aguasArriba: {
        texto: creaClienteDeTexto({ fetch: fetchQueFiltra, url: urlConClave, clave: CLAVE_DEL_PROVEEDOR, config }),
        imagen: creaClienteDeImagen({ fetch: fetchQueFiltra, url: urlConClave, clave: CLAVE_DEL_PROVEEDOR, config }),
        places: creaProveedorDoblado({ ruta: 'places' }),
        generacion: creaProveedorDoblado({ ruta: 'generacion' }),
      },
    });
    const { fichas } = await pideTanda(proxy, { cuantas: 2 });

    const respuestas = [];
    let i = 0;
    for (const tipo of ['texto', 'imagen']) {
      respuestas.push(await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] })));
    }
    for (const r of respuestas) {
      assert.equal(r.sobre.hay, false);
      assert.ok(!JSON.stringify(r).includes(CLAVE_DEL_PROVEEDOR), 'la clave del proveedor viaja en la respuesta');
      assert.ok(!JSON.stringify(r).includes('proveedor.invalido'), 'la URL del proveedor viaja en la respuesta');
    }
    assert.ok(!todoLoEscrito(await proxy.recorreSuperficie()).includes(CLAVE_DEL_PROVEEDOR));
  });
});
