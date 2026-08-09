// SPEC-023 · La superficie de escritura del proxy ciego, y lo que nunca aparece en ella.
//
// Es el fichero bloqueante de la spec. `docs/testing.md` tiene el escenario que importa
// —«El proxy no identifica a nadie»— y no tenía ninguno de los que hacen falta para
// afirmarlo, así que la mayoría de los casos de aquí son huecos de la batería declarados
// en el mapa de cobertura.
//
// Todas las afirmaciones se hacen **sobre lo escrito**, no sobre la intención del código:
// se genera tráfico, se recorre la superficie entera y se busca dentro. Es la única forma
// de que «no registramos nada» se pueda poner en rojo en lugar de creerse.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUPERFICIE, ENTRADAS, compruebaSuperficie, creaAlmacenEnMemoria } from '../../server/superficie.mjs';
import { creaAguasArribaDobladas } from '../dobles/aguas-arriba.mjs';
import { CAMPO_DELATOR, pideTanda } from '../dobles/atestacion.mjs';
import { creaReloj, DIA } from '../dobles/reloj.mjs';
import { EJEMPLOS, conteoPorEntrada, montaProxy, peticionDe, porEntrada, todoLoEscrito } from '../dobles/proxy-ciego.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Un mes de tráfico, a escala.
 *
 * La spec habla de mil generaciones y diez mil salidas; aquí son treinta días con un lote
 * de mapa y tres salidas cada uno, con zonas y prompts distintos por día. Lo que se
 * verifica no es el volumen sino la **forma** de lo que queda escrito, y esa no cambia
 * entre trescientas peticiones y diez mil: si algo creciera por llamada, ya crece aquí.
 */
async function traficoDeUnMes(proxy, reloj, { dias = 30 } = {}) {
  const coordenadas = [];
  for (let d = 0; d < dias; d++) {
    const zona = `42.${400 + d},-8.${800 + d}`;
    coordenadas.push(zona);
    const { fichas } = await pideTanda(proxy, { cuantas: 12, instalacion: `instalacion-${d % 3}` });
    let i = 0;
    const lote = { id: `lote-mapa-${d}`, tipo: 'mapa' };

    await proxy.atiende(peticionDe('generacion', {
      ficha: fichas[i++], lote, consulta: { ql: `[out:json];node(${zona});out;` },
    }));
    for (const cosa of ['la torre', 'el vado']) {
      await proxy.atiende(peticionDe('imagen', {
        ficha: fichas[i++], lote, prompt: `${cosa} de ${zona}`, formato: { tipo: 'png', ancho: 512, alto: 512 },
      }));
    }
    for (const sitio of ['ChIJ-a', 'ChIJ-b']) {
      await proxy.atiende(peticionDe('places', { ficha: fichas[i++], lote, place_id: `${sitio}-${d}` }));
    }
    for (let s = 0; s < 3; s++) {
      const loteSalida = { id: `lote-salida-${d}-${s}`, tipo: 'salida' };
      await proxy.atiende(peticionDe('texto', {
        ficha: fichas[i++], lote: loteSalida, prompt: `la aventura ${s} de ${zona}`, idioma: 'es', tono: 'sobrio',
      }));
    }
    reloj.avanza(DIA);
  }
  return { coordenadas };
}

describe('La superficie de escritura, declarada y cerrada', () => {
  test('El proxy enumera su superficie de escritura entera sin que haga falta leer su código', async () => {
    const { proxy } = montaProxy();
    const declarada = proxy.declaracionDeSuperficie();

    assert.equal(declarada.length, 6, 'la spec declara seis entradas y ni una más');
    assert.deepEqual(declarada.map((e) => e.entrada), [
      'cache-imagenes', 'cache-fotos', 'cache-generacion', 'retos-vivos', 'fichas-gastadas', 'metrica-del-dia',
    ]);
    for (const entrada of declarada) {
      assert.equal(typeof entrada.claveDerivadaDe, 'string');
      assert.ok(entrada.claveDerivadaDe.length > 0, `${entrada.entrada} no dice de qué deriva su clave`);
      assert.ok(Array.isArray(entrada.campos), `${entrada.entrada} no declara sus campos`);
      assert.ok(entrada.vive, `${entrada.entrada} no dice cuánto vive`);
    }
  });

  test('Cada entrada de la superficie dice de qué deriva su clave y ninguna se deriva de quién llamó', () => {
    for (const entrada of SUPERFICIE) {
      assert.equal(entrada.deQuienLlama, false, `${entrada.entrada} deriva su clave de quien llama`);
    }
    // Y la comprobación de que «de quién llamó» no se cuela por el texto de la
    // declaración: ninguna clave se deriva de una instalación, un dispositivo, una
    // sesión, una IP ni una cabecera.
    const prohibido = /instalaci[oó]n|dispositivo|sesi[oó]n|\bIP\b|cabecera|usuario|jugador/i;
    for (const entrada of SUPERFICIE) {
      assert.doesNotMatch(entrada.claveDerivadaDe, prohibido, entrada.entrada);
    }
  });

  test('Un proxy recién desplegado lista su superficie de escritura vacía y no falla', async () => {
    const { proxy } = montaProxy();
    assert.deepEqual(await proxy.recorreSuperficie(), []);
    // El estado vacío es un estado, no un error: la declaración sigue completa aunque
    // no se haya atendido ni una petición.
    assert.equal(proxy.declaracionDeSuperficie().length, 6);
  });

  test('Tras el tráfico declarado, lo escrito es exactamente la superficie declarada y nada más', async () => {
    const { proxy, aguasArriba } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 4 });
    let i = 0;
    for (const tipo of ['texto', 'imagen', 'places', 'generacion']) {
      const r = await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] }));
      assert.equal(r.sobre.hay, true, tipo);
    }

    // La cifra entera, entrada por entrada. Los textos no aparecen porque no se cachean
    // y la caché de generación no aparece porque viene apagada; los retos se consumen al
    // emitir la tanda, así que tampoco quedan.
    assert.deepEqual(conteoPorEntrada(await proxy.recorreSuperficie()), {
      'cache-imagenes': 1,
      'cache-fotos': 1,
      'fichas-gastadas': 4,
      'metrica-del-dia': 1,
    });
    assert.equal(aguasArriba.llamadasDePago(), 4);
  });

  test('Tras un mes de tráfico no hay ni una entrada fuera de la superficie declarada', async () => {
    const reloj = creaReloj();
    const { proxy } = montaProxy({ reloj });
    await traficoDeUnMes(proxy, reloj);

    const recorrido = await proxy.recorreSuperficie();
    assert.ok(recorrido.length > 0, 'el tráfico tiene que dejar algo escrito, o la prueba no mide nada');
    for (const fila of recorrido) {
      assert.ok(ENTRADAS.includes(fila.entrada), `entrada no declarada en el disco: "${fila.entrada}"`);
    }
  });

  test('Una escritura que la declaración no contempla impide arrancar y el error nombra la entrada', () => {
    assert.throws(
      () => montaProxy({ escriturasExtra: [{ modulo: 'server/registro.mjs', entradas: ['registro-de-llamadas'] }] }),
      (e) => {
        assert.match(e.message, /no arranca/);
        assert.match(e.message, /registro-de-llamadas/, 'el error tiene que nombrar la entrada no declarada');
        assert.match(e.message, /server\/registro\.mjs/, 'y el módulo que la escribe');
        return true;
      },
    );
    // Y por la otra mitad del mecanismo: no hay forma de abrir un almacén sobre una
    // entrada que la superficie no contempla, ni siquiera sin llegar a escribir.
    assert.throws(() => creaAlmacenEnMemoria('registro-de-llamadas'), /no arranca/);
    assert.throws(() => compruebaSuperficie([{ modulo: 'x', entradas: ['huellas'] }]), /huellas/);
  });
});

describe('El proxy no identifica a nadie', () => {
  test('El proxy no identifica a nadie', async () => {
    const reloj = creaReloj();
    const { proxy, verificador } = montaProxy({ reloj });
    await traficoDeUnMes(proxy, reloj, { dias: 10 });
    const escrito = todoLoEscrito(await proxy.recorreSuperficie());

    // Quién llama: el identificador de la clave atestada es el dato que App Attest pone
    // delante del proxy y el que RNF-PRIV-001 prohíbe conservar. El doble del verificador
    // lo devuelve a propósito para que esta afirmación pueda ponerse roja.
    const delatores = verificador.vistas().map((v) => v.evidencia[CAMPO_DELATOR]);
    assert.ok(delatores.length >= 10, 'sin evidencias verificadas la prueba no afirma nada');
    for (const id of new Set(delatores)) {
      assert.ok(!escrito.includes(id), `el identificador de la clave atestada ${id} está escrito`);
    }

    // Desde dónde: ninguna dirección IP, ninguna cabecera del cliente, ningún
    // identificador de instalación, de dispositivo o de sesión.
    assert.doesNotMatch(escrito, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, 'hay algo con forma de dirección IP');
    for (const rastro of ['User-Agent', 'user-agent', 'X-Forwarded-For', 'remoteAddress', 'cabecera',
      'instalacion', 'idInstalacion', 'dispositivo', 'sesion', 'sessionId', 'idJugador']) {
      assert.ok(!escrito.includes(rastro), `«${rastro}» aparece en la superficie de escritura`);
    }

    // Ninguna partida: ni un fragmento de la aventura de nadie. Los textos del LLM son
    // la única categoría de contenido que describe la partida concreta de alguien, y por
    // eso son la única que no se cachea.
    assert.ok(!escrito.includes('la aventura'), 'un texto de aventura ha acabado en el disco');
    assert.ok(!escrito.includes('texto de ficción'), 'un texto del LLM ha acabado en el disco');
    const porEntradas = porEntrada(await proxy.recorreSuperficie());
    assert.equal(porEntradas['cache-textos'], undefined, 'no existe ninguna caché de textos');
  });

  test('El rastro de ubicación no se guarda nunca', async () => {
    const reloj = creaReloj();
    const { proxy } = montaProxy({ reloj });
    const { coordenadas } = await traficoDeUnMes(proxy, reloj, { dias: 8 });
    const escrito = todoLoEscrito(await proxy.recorreSuperficie());

    // Es la otra mitad de la frase que SPEC-003 afirma sobre la partida: ni las
    // coordenadas de las celdas generadas ni sus prompts derivados quedan escritos.
    for (const zona of coordenadas) {
      assert.ok(!escrito.includes(zona), `la coordenada ${zona} está escrita en el disco`);
    }
    assert.doesNotMatch(escrito, /-?\d{1,2}\.\d{3,},\s*-?\d{1,3}\.\d{3,}/, 'hay algo con forma de par de coordenadas');
  });

  test('No se reporta a ningún sitio', async () => {
    const { proxy } = montaProxy();
    const antes = await proxy.recorreSuperficie();

    // No existe ningún endpoint que reciba sucesos del jugador. Se prueban por nombre
    // los cuatro que la spec nombra, más los dos que enumerarían la caché.
    for (const ruta of ['/anclajes-descartados', '/ajustes', '/progreso', '/errores',
      '/sucesos', '/telemetria', '/cache', '/superficie', '/metrica']) {
      const r = await proxy.atiende({ ruta, cuerpo: { lo: 'que sea' } });
      assert.equal(r.estado, 404, `la ruta ${ruta} no debería existir`);
      assert.match(r.sobre.error, /ruta no declarada/);
    }
    // Y una ruta no declarada se rechaza **sin escribir nada**: ni siquiera un contador.
    assert.deepEqual(await proxy.recorreSuperficie(), antes);
    assert.deepEqual(proxy.RUTAS, ['/atestacion', '/texto', '/imagen', '/places', '/generacion']);
  });

  test('Nada de lo escrito relaciona dos llamadas del mismo móvil separadas por un día', async () => {
    const reloj = creaReloj();
    const { proxy } = montaProxy({ reloj });

    // Un móvil ateste una vez y gasta dos fichas de la misma tanda con un día de por medio.
    const mismoMovil = await pideTanda(proxy, { cuantas: 2, instalacion: 'el-movil-de-siempre' });
    await proxy.atiende(peticionDe('texto', {
      ficha: mismoMovil.fichas[0], lote: { id: 'lote-lunes', tipo: 'salida' },
      prompt: 'lunes', idioma: 'es', tono: 'sobrio',
    }));
    reloj.avanza(DIA);
    await proxy.atiende(peticionDe('texto', {
      ficha: mismoMovil.fichas[1], lote: { id: 'lote-martes', tipo: 'salida' },
      prompt: 'martes', idioma: 'es', tono: 'sobrio',
    }));

    const recorrido = await proxy.recorreSuperficie();
    const escrito = todoLoEscrito(recorrido);
    const gastadas = porEntrada(recorrido)['fichas-gastadas'];
    assert.equal(gastadas.length, 2, 'las dos llamadas tienen que haber dejado sus dos fichas');

    // Ninguno de los cuatro valores que podrían atar las dos llamadas está escrito.
    assert.ok(!escrito.includes(mismoMovil.evidencia[CAMPO_DELATOR]), 'el id de la clave atestada las ataría');
    assert.ok(!escrito.includes(mismoMovil.reto), 'el reto las ataría');
    for (const ficha of mismoMovil.fichas) {
      assert.ok(!escrito.includes(ficha.nonce), 'el nonce de la ficha está escrito en claro');
      assert.ok(!escrito.includes(ficha.firma), 'la firma de la ficha está escrita en claro');
    }
    for (const lote of ['lote-lunes', 'lote-martes']) {
      assert.ok(!escrito.includes(lote), `el identificador de lote ${lote} está escrito`);
    }

    // Lo único que las dos entradas comparten es el prefijo de la época de la clave de
    // firma, y ese no distingue a nadie: otro móvil que ateste el mismo día produce
    // fichas con el mismo prefijo, así que no correlaciona, agrupa.
    const prefijo = (clave) => String(clave).split('.')[0];
    assert.equal(prefijo(gastadas[0]), prefijo(gastadas[1]));
    const otroMovil = await pideTanda(proxy, { cuantas: 1, instalacion: 'otro-movil-distinto' });
    await proxy.atiende(peticionDe('texto', { ficha: otroMovil.fichas[0], prompt: 'otro', idioma: 'es', tono: 'sobrio' }));
    const todas = porEntrada(await proxy.recorreSuperficie())['fichas-gastadas'];
    assert.equal(todas.length, 3);
    assert.equal(new Set(todas.map(prefijo)).size, 1, 'el prefijo de época tiene que ser el mismo para dos móviles distintos');
  });

  test('Ninguna entrada de la superficie crece a razón de una fila por llamada', async () => {
    const reloj = creaReloj();
    const { proxy } = montaProxy({ reloj });

    // Doscientas peticiones del mismo contenido en el mismo día. Lo que crece es el
    // contador; lo que no crece es el número de filas.
    const { fichas } = await pideTanda(proxy, { cuantas: 200 });
    for (let i = 0; i < 200; i++) {
      await proxy.atiende(peticionDe('imagen', { ficha: fichas[i], ...EJEMPLOS.imagen }));
    }
    const conteo = conteoPorEntrada(await proxy.recorreSuperficie());
    assert.equal(conteo['cache-imagenes'], 1, 'doscientas peticiones iguales, una sola entrada de caché');
    assert.equal(conteo['metrica-del-dia'], 1, 'un día es una fila, pasen las peticiones que pasen');
    const dia = await proxy.metrica.delDia();
    assert.equal(dia.peticiones, 200, 'y el contador sí ha contado las doscientas');

    // La única entrada que crece con las llamadas de pago es la de fichas gastadas, y no
    // es un registro de peticiones: no dice qué se pidió, está acotada por las fichas
    // emitidas —los aciertos de caché no gastan ninguna— y se barre entera cuando su
    // época muere, que es lo que la separa de una fila por llamada para siempre.
    assert.equal(conteo['fichas-gastadas'], 1, 'las 199 restantes fueron aciertos de caché y no gastaron ficha');
    reloj.avanza(15 * DIA);
    await proxy.cierra();
    assert.equal(conteoPorEntrada(await proxy.recorreSuperficie())['fichas-gastadas'], undefined);
  });

  test('Ninguna marca de tiempo escrita baja de la ventana de agregación declarada', async () => {
    const reloj = creaReloj();
    const { proxy, config } = montaProxy({ reloj });
    await traficoDeUnMes(proxy, reloj, { dias: 10 });

    assert.equal(config.VENTANA_METRICA, 'dia-natural');
    const recorrido = await proxy.recorreSuperficie();
    const escrito = todoLoEscrito(recorrido);

    // Ni marcas ISO con hora dentro, ni instantes en milisegundos con los que se pueda
    // reconstruir el momento de una petición.
    assert.doesNotMatch(escrito, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'hay una marca de tiempo con hora');
    assert.doesNotMatch(escrito, /1[6-9]\d{11}/, 'hay algo con forma de instante en milisegundos');

    // Las únicas claves con forma de fecha son los días naturales de la métrica.
    for (const { entrada, clave } of recorrido) {
      if (entrada === 'metrica-del-dia') assert.match(String(clave), /^\d{4}-\d{2}-\d{2}$/);
      else assert.doesNotMatch(String(clave), /\d{4}-\d{2}-\d{2}/, `${entrada} lleva una fecha en la clave`);
    }
  });

  test('El diagnóstico de un fallo de aguas arriba lleva la ruta y el tipo, y nada del cuerpo', async () => {
    const reloj = creaReloj();
    const { proxy } = montaProxy({
      reloj,
      aguasArriba: creaAguasArribaDobladas({ modo: 'falla-siempre', fallo: 'caido' }),
    });
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });
    const r = await proxy.atiende(peticionDe('texto', {
      ficha: fichas[0], prompt: 'el bar de Casa Manuela', idioma: 'es', tono: 'sobrio',
    }));

    assert.deepEqual(r.diagnostico, { ruta: 'texto', fallo: 'caido' });
    assert.equal(Object.keys(r.diagnostico).length, 2, 'el diagnóstico son dos campos y ninguno más');
    const texto = JSON.stringify(r);
    assert.ok(!texto.includes('Casa Manuela'), 'el prompt ha viajado dentro del diagnóstico');

    // Y lo que queda escrito de ese fallo es un contador agregado del día: ni cuerpo, ni
    // clave, ni prompt, y ninguna entrada negativa en la caché.
    const escrito = todoLoEscrito(await proxy.recorreSuperficie());
    assert.ok(!escrito.includes('Casa Manuela'));
    assert.ok(!escrito.includes('caido'));
    assert.equal((await proxy.metrica.delDia()).contadores.texto['fallo-aguas-arriba'], 1);
  });

  test('El registro de conexiones está apagado y la configuración lo declara a propósito', () => {
    // Este criterio es sobre configuración, así que se afirma sobre el texto que la
    // fija. El proxy no puede apagar el `access_log` de la capa que tiene delante, pero
    // sí puede no escribir una línea por petición y dejar escrito que la de delante
    // tiene que apagarlo; las dos cosas se comprueban aquí.
    const proxyMjs = readFileSync(join(RAIZ, 'server', 'proxy.mjs'), 'utf8');
    for (const rastro of ['req.headers', 'remoteAddress', 'socket.address', 'x-forwarded-for']) {
      assert.ok(!proxyMjs.includes(rastro), `el servidor HTTP lee ${rastro}`);
    }
    assert.equal((proxyMjs.match(/console\.(log|info|warn|error)/g) ?? []).length, 0,
      'el proxy no escribe ni una línea por petición');

    const despliegue = readFileSync(join(RAIZ, 'server', 'DESPLIEGUE.md'), 'utf8');
    assert.match(despliegue, /access_log/, 'el despliegue no dice qué hacer con el registro de la capa de delante');
    assert.match(despliegue, /apagar el registro de conexiones/i);
  });
});
