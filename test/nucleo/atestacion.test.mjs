// SPEC-023 · Los dos planos del proxy: el que ve la identidad y el que ve la ficción, y
// qué pasa cuando la atestación falla.
//
// Es la decisión estructural de la spec y la que hace que «no identifica» sea afirmable
// en lugar de prometido: App Attest lleva un identificador estable por instalación, así
// que verificar una aserción en cada llamada pondría ese identificador delante del proxy
// en cada llamada. Aquí se comprueba que los dos planos no se hablan, que las fichas no
// se pueden enlazar y que quedarse sin atestación es un modo de juego y no un error.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PLATAFORMAS } from '../../server/atestacion.mjs';
import { creaAguasArribaDobladas } from '../dobles/aguas-arriba.mjs';
import { CAMPO_DELATOR, creaEvidencia, creaVerificadorDoblado, pideTanda } from '../dobles/atestacion.mjs';
import { creaReloj, DIA, MINUTO } from '../dobles/reloj.mjs';
import { EJEMPLOS, montaProxy, peticionDe, porEntrada, todoLoEscrito } from '../dobles/proxy-ciego.mjs';

describe('Las dos mitades del proxy: la que ve la identidad y la que ve la ficción', () => {
  test('Una instalación legítima recibe una tanda de fichas anónimas con la vigencia declarada', async () => {
    const { proxy, config } = montaProxy();
    const tanda = await pideTanda(proxy, { cuantas: 5 });

    assert.equal(tanda.ok, true, tanda.motivo);
    assert.equal(tanda.fichas.length, 5);
    assert.equal(tanda.vigencia, config.VIGENCIA_TANDA);
    for (const ficha of tanda.fichas) {
      assert.deepEqual(Object.keys(ficha).sort(), ['firma', 'kid', 'nonce']);
    }
    // Y sirven: cada una paga una llamada de contenido.
    const r = await proxy.atiende(peticionDe('texto', { ficha: tanda.fichas[0], ...EJEMPLOS.texto }));
    assert.equal(r.estado, 200);
    assert.equal(r.sobre.hay, true);
  });

  test('Una llamada a una ruta de contenido no admite ninguna evidencia de plataforma ni cabecera de cliente', async () => {
    const { proxy, aguasArriba } = montaProxy();
    const { fichas, evidencia } = await pideTanda(proxy, { cuantas: 4 });

    // Nada de lo que vive en el plano de identidad cabe en el sobre de contenido.
    const intrusos = [
      { evidencia },
      { plataforma: 'app-attest' },
      { idClaveAtestada: evidencia[CAMPO_DELATOR] },
      { cabeceras: { 'User-Agent': 'WalkingAdventure/1.0' } },
    ];
    for (const intruso of intrusos) {
      const r = await proxy.atiende({
        ruta: '/texto',
        cuerpo: { ficha: fichas[0], peticion: EJEMPLOS.texto, ...intruso },
      });
      assert.equal(r.estado, 400, JSON.stringify(intruso));
      assert.match(r.sobre.error, new RegExp(Object.keys(intruso)[0]));
    }
    assert.equal(aguasArriba.llamadasDePago(), 0, 'un sobre rechazado no llega a aguas arriba');
  });

  test('La ruta de atestación no admite ningún prompt, ningún place_id y ninguna coordenada', async () => {
    const { proxy } = montaProxy();
    for (const ficcion of [{ prompt: 'el puente viejo' }, { place_id: 'ChIJ-x' }, { consulta: { ql: '42.4,-8.8' } }, { lat: 42.4 }]) {
      const r = await proxy.atiende({ ruta: '/atestacion', cuerpo: { plataforma: 'app-attest', ...ficcion } });
      assert.equal(r.estado, 400, JSON.stringify(ficcion));
      assert.match(r.sobre.error, new RegExp(Object.keys(ficcion)[0]));
    }
  });

  test('Dos fichas de la misma tanda no muestran que salieron de la misma tanda ni de qué atestación', async () => {
    const { proxy } = montaProxy();
    const a = await pideTanda(proxy, { cuantas: 4, instalacion: 'movil-A' });
    const b = await pideTanda(proxy, { cuantas: 4, instalacion: 'movil-B' });

    // Entre sí: nonce y firma distintos, y ningún campo compartido salvo el
    // identificador de la época de la clave de firma, que es el mismo para las ocho —
    // las de A y las de B—, así que agrupa una época entera y no una tanda.
    const nonces = [...a.fichas, ...b.fichas].map((f) => f.nonce);
    assert.equal(new Set(nonces).size, 8);
    assert.equal(new Set([...a.fichas, ...b.fichas].map((f) => f.kid)).size, 1);

    // Con la atestación que las produjo: ni el identificador de la clave atestada ni el
    // reto aparecen en ninguna ficha.
    const enLasFichas = JSON.stringify(a.fichas);
    assert.ok(!enLasFichas.includes(a.evidencia[CAMPO_DELATOR]));
    assert.ok(!enLasFichas.includes(a.reto));

    // Y la propiedad que lo sostiene: el proxy firmó valores cegados y no vio ninguna de
    // las fichas que salieron de ellos. Ni un nonce ni una firma coincide con lo que el
    // servidor tuvo delante.
    const loQueVioElProxy = JSON.stringify({ cegadas: a.cegadas, firmas: a.firmas });
    for (const ficha of a.fichas) {
      assert.ok(!loQueVioElProxy.includes(ficha.firma), 'la firma desciegada es la que vio el servidor');
      assert.ok(!loQueVioElProxy.includes(ficha.nonce), 'el nonce de la ficha es el que vio el servidor');
    }
  });

  test('Una ficha ya gastada se rechaza al volver a presentarla', async () => {
    const { proxy, aguasArriba } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });

    const primera = await proxy.atiende(peticionDe('texto', { ficha: fichas[0], prompt: 'uno', idioma: 'es', tono: 'sobrio' }));
    assert.equal(primera.sobre.hay, true);
    const segunda = await proxy.atiende(peticionDe('texto', { ficha: fichas[0], prompt: 'dos', idioma: 'es', tono: 'sobrio' }));
    assert.equal(segunda.estado, 401);
    assert.equal(segunda.sobre.hay, false);
    assert.equal(aguasArriba.texto.llamadas(), 1, 'la segunda no llegó a aguas arriba');
  });

  test('Una ficha caducada se rechaza diciendo que hay que volver a atestar, y nada más', async () => {
    const reloj = creaReloj();
    const { proxy, config, aguasArriba } = montaProxy({ reloj });
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });

    reloj.avanza(2 * config.VIGENCIA_TANDA + DIA);
    const r = await proxy.atiende(peticionDe('texto', { ficha: fichas[0], ...EJEMPLOS.texto }));

    assert.equal(r.estado, 401);
    assert.equal(r.sobre.error, 'hay que volver a atestar');
    // «Y nada más»: el error no dice de quién era la ficha, ni cuándo se emitió, ni por
    // qué falló exactamente. El motivo interno no sale del proxy.
    assert.deepEqual(Object.keys(r.sobre).sort(), ['contenido', 'deCache', 'error', 'hay', 'tipo']);
    assert.equal(aguasArriba.llamadasDePago(), 0);
  });

  test('Una ficha falsificada se rechaza sin llegar a aguas arriba', async () => {
    const { proxy, aguasArriba } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });
    const falsa = { ...fichas[0], firma: fichas[0].firma.replace(/.$/, (c) => (c === '0' ? '1' : '0')) };

    const r = await proxy.atiende(peticionDe('texto', { ficha: falsa, ...EJEMPLOS.texto }));
    assert.equal(r.estado, 401);
    assert.equal(aguasArriba.llamadasDePago(), 0);

    // Y una inventada de cero tampoco pasa.
    const inventada = { kid: fichas[0].kid, nonce: 'aaaa', firma: 'deadbeef' };
    assert.equal((await proxy.atiende(peticionDe('texto', { ficha: inventada, ...EJEMPLOS.texto }))).estado, 401);
    assert.equal(aguasArriba.llamadasDePago(), 0);
  });

  test('Una evidencia falsificada o ausente no produce ninguna tanda', async () => {
    const { proxy } = montaProxy();
    const falsificada = await pideTanda(proxy, { cuantas: 2, falsificada: true });
    assert.equal(falsificada.ok, false);
    assert.equal(falsificada.estado, 401);

    const sinEvidencia = montaProxy({ verificador: creaVerificadorDoblado({ modo: 'ausente' }) });
    const nada = await pideTanda(sinEvidencia.proxy, { cuantas: 2 });
    assert.equal(nada.ok, false);

    // Y si el verificador revienta, el motivo del verificador no se propaga: puede traer
    // el identificador de la clave atestada dentro.
    const revienta = montaProxy({ verificador: creaVerificadorDoblado({ modo: 'revienta' }) });
    const roto = await pideTanda(revienta.proxy, { cuantas: 2 });
    assert.equal(roto.ok, false);
    assert.equal(roto.motivo, 'la evidencia no verifica');
    assert.ok(!roto.motivo.includes('keyid-'));
  });

  test('Una evidencia no vale dos veces: el reto se consume y caduca en el plazo declarado', async () => {
    const reloj = creaReloj();
    const { proxy, config } = montaProxy({ reloj });

    const primera = await proxy.atiende({ ruta: '/atestacion', cuerpo: {} });
    const reto = primera.sobre.reto;
    assert.equal(primera.sobre.vigencia, config.VIGENCIA_RETO);
    const evidencia = creaEvidencia({ reto });

    const cegadas = ['0f'];
    const uno = await proxy.atiende({ ruta: '/atestacion', cuerpo: { plataforma: 'app-attest', reto, evidencia, cegadas } });
    assert.equal(uno.sobre.ok, true);
    const dos = await proxy.atiende({ ruta: '/atestacion', cuerpo: { plataforma: 'app-attest', reto, evidencia, cegadas } });
    assert.equal(dos.sobre.ok, false, 'la misma evidencia no puede valer dos veces');

    // Y un reto que nadie usa se barre al pasar su vigencia.
    const otra = await proxy.atiende({ ruta: '/atestacion', cuerpo: {} });
    reloj.avanza(config.VIGENCIA_RETO + MINUTO);
    const tarde = await proxy.atiende({
      ruta: '/atestacion',
      cuerpo: { plataforma: 'app-attest', reto: otra.sobre.reto, evidencia: creaEvidencia({ reto: otra.sobre.reto }), cegadas },
    });
    assert.equal(tarde.sobre.ok, false);
    assert.equal(porEntrada(await proxy.recorreSuperficie())['retos-vivos'], undefined);
  });

  test('El plano de atestación no guarda ningún contador por instalación ni nada que sobreviva a la tanda', async () => {
    const reloj = creaReloj();
    const { proxy } = montaProxy({ reloj });

    // El mismo móvil ateste cinco veces: si hubiera contador por instalación, aquí
    // estaría, y con él el identificador persistente que la spec descarta.
    for (let i = 0; i < 5; i++) await pideTanda(proxy, { cuantas: 1, instalacion: 'el-mismo-de-siempre' });

    const escrito = todoLoEscrito(await proxy.recorreSuperficie());
    assert.ok(!escrito.includes('el-mismo-de-siempre'));
    assert.ok(!escrito.includes('keyid-'), 'el identificador de la clave atestada está escrito');
    assert.equal(porEntrada(await proxy.recorreSuperficie())['retos-vivos'], undefined,
      'los retos se consumen: no queda uno por atestación');

    // A qué instalación se emitió una tanda: el proxy no lo sabe, y no lo sabe porque no
    // hay ninguna forma de preguntárselo ni ningún sitio de donde sacarlo.
    assert.ok(!('aQuienEmitio' in proxy), 'no puede existir una forma de preguntarlo');
    assert.deepEqual(PLATAFORMAS, ['app-attest', 'play-integrity']);
  });

  test('Un reto vivo no guarda nada más que el propio reto', async () => {
    // La superficie declara `retos-vivos` con `campos: []` —«nada más que el reto»— y
    // `ventana: null`, que en `superficie.mjs` significa que la entrada no admite
    // ninguna marca de tiempo. Este caso lo comprueba con un reto en vuelo, que es el
    // estado normal del proxy mientras alguien está atestando.
    const reloj = creaReloj();
    const { proxy } = montaProxy({ reloj });
    await proxy.atiende({ ruta: '/atestacion', cuerpo: {} });

    const filas = (await proxy.recorreSuperficie()).filter((f) => f.entrada === 'retos-vivos');
    assert.equal(filas.length, 1, 'el reto emitido tiene que estar vivo');
    assert.deepEqual(Object.keys(filas[0].valor), [],
      'la entrada de retos guarda campos que la superficie no declara');
  });
});

describe('Cuando la atestación falla', () => {
  test('Sin ficha válida, una imagen que ya está en la caché se sirve de la caché', async () => {
    const { proxy, aguasArriba } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });
    await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen }));
    assert.equal(aguasArriba.imagen.llamadas(), 1);

    const sinFicha = await proxy.atiende(peticionDe('imagen', EJEMPLOS.imagen));
    assert.equal(sinFicha.estado, 200);
    assert.equal(sinFicha.sobre.hay, true);
    assert.equal(sinFicha.sobre.deCache, true);
    assert.equal(aguasArriba.imagen.llamadas(), 1, 'servir lo cacheado no cuesta una llamada de pago');
  });

  test('Sin ficha válida no se hace ninguna llamada de pago y se responde que no hay', async () => {
    const { proxy, aguasArriba } = montaProxy();

    // Las cuatro rutas, sin ficha y sin nada en la caché: cero llamadas de pago.
    for (const tipo of ['texto', 'imagen', 'places', 'generacion']) {
      const r = await proxy.atiende(peticionDe(tipo, EJEMPLOS[tipo]));
      assert.equal(r.estado, 200, tipo);
      assert.equal(r.sobre.hay, false, tipo);
      assert.equal(r.sobre.contenido, null, tipo);
      // La forma es la misma que la de cualquier otra ausencia: el cliente no puede
      // distinguir esto de estar sin cobertura, que es lo que evita que aparezca una
      // pantalla explicando la red.
      assert.equal(r.sobre.error, undefined, `${tipo}: «no hay» no es un error de transporte`);
    }
    assert.equal(aguasArriba.llamadasDePago(), 0);
  });

  test('Una salida entera se completa sin ninguna atestación válida', async () => {
    // Un dispositivo rooteado, un emulador o una versión que la atestación no cubre son
    // el mismo caso: no hay ficha. La salida se juega igual, con «no hay» en cada texto,
    // que es el mismo camino que el cliente ya recorre sin cobertura.
    const { proxy, aguasArriba } = montaProxy({
      verificador: creaVerificadorDoblado({ modo: 'falsificada' }),
    });
    const tanda = await pideTanda(proxy, { cuantas: 4 });
    assert.equal(tanda.ok, false, 'el dispositivo no puede atestar, que es el supuesto');

    const beats = ['el arranque', 'el nudo', 'el giro', 'el desenlace'];
    const respuestas = [];
    for (const beat of beats) {
      const r = await proxy.atiende(peticionDe('texto', { prompt: beat, idioma: 'es', tono: 'sobrio' }));
      respuestas.push(r);
    }
    assert.equal(respuestas.length, beats.length, 'la salida se recorre entera');
    for (const r of respuestas) {
      assert.equal(r.estado, 200);
      assert.equal(r.sobre.hay, false);
    }
    assert.equal(aguasArriba.llamadasDePago(), 0, 'el gasto imputable a la vía sin atestación es cero');
  });

  test('Cuando la cuota de la vía sin atestación se agota, deja de responder y el juego sigue igual', async () => {
    // Con la cuota al mínimo y el suelo en dos, la tercera petición degradada ya no cabe.
    const { proxy, aguasArriba } = montaProxy({
      entorno: { CUOTA_VIA_DEGRADADA: '0', FICHAS_POR_TANDA: '2' },
    });
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });
    await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen }));

    const antes = await proxy.atiende(peticionDe('imagen', EJEMPLOS.imagen));
    assert.equal(antes.sobre.hay, true, 'dentro de la cuota se sirve lo cacheado');
    await proxy.atiende(peticionDe('texto', EJEMPLOS.texto));
    const despues = await proxy.atiende(peticionDe('imagen', EJEMPLOS.imagen));
    assert.equal(despues.sobre.hay, false, 'agotada la cuota, ni siquiera se sirve la caché');
    assert.equal(despues.sobre.error, undefined, 'y sigue sin ser un error: el juego no distingue esto de sin cobertura');
    assert.equal(aguasArriba.llamadasDePago(), 1, 'la única llamada de pago fue la de la ficha válida');
  });

  test('De una llamada sin atestación sólo queda el contador agregado del día', async () => {
    const { proxy } = montaProxy({ aguasArriba: creaAguasArribaDobladas() });
    await proxy.atiende(peticionDe('texto', { prompt: 'sin ficha', idioma: 'es', tono: 'sobrio' }));

    const dia = await proxy.metrica.delDia();
    assert.equal(dia.contadores.texto.rechazo, 1);
    assert.equal(dia.degradadas, 1);
    // No se escribe en ninguna parte que la atestación falló **para nadie en concreto**.
    const escrito = todoLoEscrito(await proxy.recorreSuperficie());
    assert.ok(!escrito.includes('sin ficha'));
    assert.ok(!escrito.includes('atestacion-fallida'));
    assert.ok(!escrito.includes('keyid-'));
  });
});
