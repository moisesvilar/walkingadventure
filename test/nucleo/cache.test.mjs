// SPEC-023 · La caché de lo inerte y la de generación, que es la que roza la promesa.
//
// La caché es un oráculo: el prompt de ficción es función determinista de la semilla y la
// semilla es la coordenada redondeada del mapa, así que cualquiera con el generador puede
// recorrer coordenadas, calcular el prompt que saldría y preguntar si esa imagen existe.
// Lo que se comprueba aquí es que ese oráculo responde **un solo bit** —alguien, alguna
// vez, aquí— y no «cuándo», «cuántos» ni «con qué frecuencia»: sin marca de tiempo dentro
// ni fuera, sin contador de aciertos, sin entradas negativas y sin nada que enumere.

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { claveDeFoto, claveDeImagen, creaAlmacenEnDisco, normalizaPrompt } from '../../server/cache.mjs';
import { creaAguasArribaDobladas, creaProveedorDoblado } from '../dobles/aguas-arriba.mjs';
import { pideTanda } from '../dobles/atestacion.mjs';
import { creaReloj, DIA } from '../dobles/reloj.mjs';
import { EJEMPLOS, montaProxy, peticionDe, porEntrada, conteoPorEntrada } from '../dobles/proxy-ciego.mjs';

const temporales = [];
const dirTemporal = () => {
  const d = mkdtempSync(join(tmpdir(), 'wa-proxy-cache-'));
  temporales.push(d);
  return d;
};
after(() => { for (const d of temporales) rmSync(d, { recursive: true, force: true }); });

describe('La caché de lo inerte', () => {
  test('La clave de una imagen sale del prompt normalizado y del formato, y de nada más', async () => {
    const base = { prompt: 'el puente viejo', formato: { tipo: 'png', ancho: 512, alto: 512 } };
    assert.equal(claveDeImagen(base), claveDeImagen({ ...base, prompt: '  el   puente\n viejo  ' }),
      'el espaciado no puede cambiar la clave');
    assert.notEqual(claveDeImagen(base), claveDeImagen({ ...base, prompt: 'el puente nuevo' }));
    assert.notEqual(claveDeImagen(base), claveDeImagen({ ...base, formato: { tipo: 'png', ancho: 256, alto: 256 } }));
    assert.equal(normalizaPrompt('  a   b '), 'a b');

    // Y de nada más: dos móviles con fichas distintas derivan la misma clave, que es la
    // razón por la que el segundo se sirve de la caché.
    const { proxy, aguasArriba } = montaProxy();
    const a = await pideTanda(proxy, { cuantas: 1, instalacion: 'movil-A' });
    const b = await pideTanda(proxy, { cuantas: 1, instalacion: 'movil-B' });
    await proxy.atiende(peticionDe('imagen', { ficha: a.fichas[0], lote: { id: 'L1', tipo: 'mapa' }, ...base }));
    const segunda = await proxy.atiende(peticionDe('imagen', { ficha: b.fichas[0], lote: { id: 'L2', tipo: 'mapa' }, ...base }));

    assert.equal(segunda.sobre.deCache, true);
    assert.equal(aguasArriba.imagen.llamadas(), 1, 'la segunda no puede llegar a aguas arriba');
    assert.deepEqual(porEntrada(await proxy.recorreSuperficie())['cache-imagenes'], [claveDeImagen(base)]);
  });

  test('La clave de una foto es el place_id y nada más', async () => {
    assert.equal(claveDeFoto({ place_id: 'ChIJfixture0001' }), 'ChIJfixture0001');
    const { proxy } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });
    await proxy.atiende(peticionDe('places', { ficha: fichas[0], ...EJEMPLOS.places }));
    assert.deepEqual(porEntrada(await proxy.recorreSuperficie())['cache-fotos'], ['ChIJfixture0001']);
  });

  test('Una clave de caché elegida por el cliente se ignora y la deriva el proxy del contenido', async () => {
    const { proxy, aguasArriba } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 2 });

    // El esquema cerrado la rechaza antes de llegar a la derivación: no hay ningún camino
    // por el que una clave del cliente llegue a la caché.
    const conClave = await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen, clave: 'la-que-yo-diga' }));
    assert.equal(conClave.estado, 400);
    assert.match(conClave.sobre.error, /clave/);
    assert.equal(aguasArriba.imagen.llamadas(), 0);

    // Y la que se usa de verdad es la derivada del contenido.
    await proxy.atiende(peticionDe('imagen', { ficha: fichas[1], ...EJEMPLOS.imagen }));
    const claves = porEntrada(await proxy.recorreSuperficie())['cache-imagenes'];
    assert.deepEqual(claves, [claveDeImagen(EJEMPLOS.imagen)]);
    assert.ok(!claves.includes('la-que-yo-diga'));
  });

  test('Una entrada de la caché de imágenes lleva el binario y la clave derivada, y ni un dato de quién la pidió', async () => {
    const { proxy } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 1, instalacion: 'movil-que-la-pidio' });
    await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], lote: { id: 'lote-secreto', tipo: 'mapa' }, ...EJEMPLOS.imagen }));

    const fila = (await proxy.recorreSuperficie()).find((f) => f.entrada === 'cache-imagenes');
    assert.deepEqual(Object.keys(fila.valor).sort(), ['alto', 'ancho', 'datos_base64', 'formato']);
    const texto = JSON.stringify(fila);
    for (const rastro of ['movil-que-la-pidio', 'lote-secreto', 'keyid-', 'aciertos', 'contador', 'cuando', 'desde', 'ts']) {
      assert.ok(!texto.includes(rastro), `la entrada de caché lleva «${rastro}»`);
    }
  });

  test('Una entrada de la caché de fotos lleva el binario y la atribución que exige Places, y nada más', async () => {
    const { proxy } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });
    await proxy.atiende(peticionDe('places', { ficha: fichas[0], ...EJEMPLOS.places }));

    const fila = (await proxy.recorreSuperficie()).find((f) => f.entrada === 'cache-fotos');
    assert.deepEqual(Object.keys(fila.valor), ['foto']);
    assert.deepEqual(Object.keys(fila.valor.foto).sort(), ['alto', 'ancho', 'atribucion', 'referencia']);
    assert.ok(fila.valor.foto.atribucion.length > 0, 'Places exige la atribución y sin ella la entrada no vale');
  });

  test('Las fotos de Places se piden al crear el mapa', async () => {
    // La mitad servidor del escenario: el proxy sirve el lote entero de fotos por
    // `place_id` y las cachea por sitio, así que el mapa siguiente que contenga los
    // mismos sitios no vuelve a pagarlas. Que el cliente no las vuelva a pedir es de
    // SPEC-009, que las congela con la partida.
    const { proxy, aguasArriba } = montaProxy();
    const sitios = ['ChIJ-a', 'ChIJ-b', 'ChIJ-c', 'ChIJ-d', 'ChIJ-e'];
    const primera = await pideTanda(proxy, { cuantas: 5, instalacion: 'movil-A' });
    for (let i = 0; i < sitios.length; i++) {
      const r = await proxy.atiende(peticionDe('places', { ficha: primera.fichas[i], lote: { id: 'mapa-A', tipo: 'mapa' }, place_id: sitios[i] }));
      assert.equal(r.sobre.hay, true);
    }
    assert.equal(aguasArriba.places.llamadas(), 5, 'el lote entero se pide al crear el mapa');

    const segunda = await pideTanda(proxy, { cuantas: 5, instalacion: 'movil-B' });
    for (let i = 0; i < sitios.length; i++) {
      const r = await proxy.atiende(peticionDe('places', { ficha: segunda.fichas[i], lote: { id: 'mapa-B', tipo: 'mapa' }, place_id: sitios[i] }));
      assert.equal(r.sobre.deCache, true);
    }
    assert.equal(aguasArriba.places.llamadas(), 5, 'otro móvil con los mismos sitios no paga ninguna');
  });

  test('Dos peticiones simultáneas del mismo prompt hacen una sola llamada de pago', async () => {
    let suelta;
    const enEspera = new Promise((r) => { suelta = r; });
    const { proxy, aguasArriba } = montaProxy({
      aguasArriba: creaAguasArribaDobladas({ porRuta: { imagen: { antesDeResponder: () => enEspera } } }),
    });
    const { fichas } = await pideTanda(proxy, { cuantas: 2 });

    const dos = Promise.all([
      proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen })),
      proxy.atiende(peticionDe('imagen', { ficha: fichas[1], ...EJEMPLOS.imagen })),
    ]);
    // Un turno del bucle de eventos para que las dos lleguen a la coalescencia antes de
    // que aguas arriba responda. Sin temporizadores: se cede el turno, no se espera.
    await Promise.resolve();
    suelta();
    const [a, b] = await dos;

    assert.equal(aguasArriba.imagen.llamadas(), 1, 'la coalescencia es la mitad del ahorro de la caché');
    assert.deepEqual(a.sobre.contenido, b.sobre.contenido, 'las dos reciben el mismo contenido');
    assert.equal(conteoPorEntrada(await proxy.recorreSuperficie())['cache-imagenes'], 1);
  });

  test('Una llamada que aguas arriba no llegó a devolver no deja ninguna entrada negativa que enumerar', async () => {
    const { proxy } = montaProxy({ aguasArriba: creaAguasArribaDobladas({ modo: 'falla-siempre' }) });
    const { fichas } = await pideTanda(proxy, { cuantas: 4 });
    let i = 0;
    for (const tipo of ['texto', 'imagen', 'places', 'generacion']) {
      await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] }));
    }
    const cacheadas = (await proxy.recorreSuperficie()).filter((f) => f.entrada.startsWith('cache-'));
    assert.deepEqual(cacheadas, [], 'un fallo no puede dejar entrada, ni siquiera para no repetirlo');
  });

  test('Un texto del LLM no se cachea en el servidor', async () => {
    const { proxy, aguasArriba } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 2 });
    await proxy.atiende(peticionDe('texto', { ficha: fichas[0], ...EJEMPLOS.texto }));
    const segunda = await proxy.atiende(peticionDe('texto', { ficha: fichas[1], ...EJEMPLOS.texto }));

    assert.equal(segunda.sobre.deCache, false, 'el mismo prompt se vuelve a pedir: no hay caché de textos');
    assert.equal(aguasArriba.texto.llamadas(), 2);
    const entradas = new Set((await proxy.recorreSuperficie()).map((f) => f.entrada));
    assert.ok(!entradas.has('cache-textos'));
    assert.equal(conteoPorEntrada(await proxy.recorreSuperficie())['cache-imagenes'], undefined);
  });

  test('No existe ninguna ruta que enumere la caché, la liste o la cuente por zonas', async () => {
    const { proxy } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 1 });
    await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen }));

    for (const ruta of ['/cache', '/cache/imagenes', '/zonas', '/listado', '/estadisticas', '/generacion/zonas']) {
      assert.equal((await proxy.atiende({ ruta, cuerpo: {} })).estado, 404, ruta);
    }
    // Recorrer la caché existe, pero es una operación de quien opera el servidor: no está
    // detrás de ninguna ruta declarada.
    assert.equal(typeof proxy.recorreSuperficie, 'function');
    assert.equal(proxy.RUTAS.length, 5);
  });

  test('Un fichero de caché recién escrito lleva la marca de tiempo constante declarada', async () => {
    const reloj = creaReloj();
    const raiz = dirTemporal();
    const { config } = montaProxy({ reloj });
    const disco = creaAlmacenEnDisco({ entrada: 'cache-imagenes', raiz, config });
    const { proxy } = montaProxy({ reloj, almacenes: { 'cache-imagenes': disco } });

    const { fichas } = await pideTanda(proxy, { cuantas: 1 });
    await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen }));

    const ficheros = readdirSync(raiz);
    assert.equal(ficheros.length, 1);
    const primero = statSync(join(raiz, ficheros[0]));
    assert.equal(primero.mtimeMs, config.MTIME_CONSTANTE, 'el `ls -l` no puede responder «cuándo»');
    assert.equal(statSync(raiz).mtimeMs, config.MTIME_CONSTANTE, 'ni el del directorio, que cambia con cada entrada');

    // Y con un mes de por medio, los dos ficheros son indistinguibles por sus metadatos.
    // La tanda se renueva porque a los treinta días ya ha caducado, que es otra forma de
    // ver lo mismo: el tiempo pasa para las fichas y no pasa para lo que queda escrito.
    reloj.avanza(30 * DIA);
    const tarde = await pideTanda(proxy, { cuantas: 1 });
    await proxy.atiende(peticionDe('imagen', {
      ficha: tarde.fichas[0], prompt: 'un mes después', formato: { tipo: 'png', ancho: 512, alto: 512 },
    }));
    const dos = readdirSync(raiz).map((f) => statSync(join(raiz, f)));
    assert.equal(dos.length, 2);
    assert.equal(dos[0].mtimeMs, dos[1].mtimeMs, 'no hay forma de decir cuál se escribió antes');
    assert.equal(dos[0].atimeMs, dos[1].atimeMs);
  });
});

describe('La caché de generación, que es la que roza la promesa', () => {
  test('Con la configuración por defecto no se escribe ninguna respuesta de generación en ninguna caché', async () => {
    const { proxy, config, aguasArriba } = montaProxy();
    assert.equal(config.CACHE_GENERACION, 'off', 'viene apagada, y es la decisión que sostiene el criterio');

    const { fichas } = await pideTanda(proxy, { cuantas: 2 });
    const zona = { consulta: { ql: '[out:json];node(42.4012,-8.8114);out;' } };
    const uno = await proxy.atiende(peticionDe('generacion', { ficha: fichas[0], ...zona }));
    const dos = await proxy.atiende(peticionDe('generacion', { ficha: fichas[1], ...zona }));

    assert.equal(uno.sobre.hay, true);
    assert.equal(dos.sobre.deCache, false, 'apagada no sirve de caché: se vuelve a pedir');
    assert.equal(aguasArriba.generacion.llamadas(), 2);
    assert.equal(conteoPorEntrada(await proxy.recorreSuperficie())['cache-generacion'], undefined);
  });

  test('Con la caché de generación encendida, la entrada se escribe sin marca de tiempo y sin contador de aciertos', async () => {
    const reloj = creaReloj();
    const raiz = dirTemporal();
    const { config } = montaProxy({ entorno: { CACHE_GENERACION: 'on' } });
    const disco = creaAlmacenEnDisco({ entrada: 'cache-generacion', raiz, config });
    const { proxy, aguasArriba } = montaProxy({
      reloj, entorno: { CACHE_GENERACION: 'on' }, almacenes: { 'cache-generacion': disco },
    });

    const { fichas } = await pideTanda(proxy, { cuantas: 3 });
    const zona = { consulta: { ql: '[out:json];node(42.4012,-8.8114);out;' } };
    await proxy.atiende(peticionDe('generacion', { ficha: fichas[0], ...zona }));
    for (const ficha of [fichas[1], fichas[2]]) {
      const r = await proxy.atiende(peticionDe('generacion', { ficha, ...zona }));
      assert.equal(r.sobre.deCache, true);
    }
    assert.equal(aguasArriba.generacion.llamadas(), 1);

    const filas = (await proxy.recorreSuperficie()).filter((f) => f.entrada === 'cache-generacion');
    assert.equal(filas.length, 1);
    // La entrada dice de qué zona es —su contenido son los datos de OSM de ese sitio— y
    // no dice nada más. Ni cuándo se pidió, ni cuántas veces, ni por cuántos.
    assert.deepEqual(Object.keys(filas[0].valor), ['elements']);
    const texto = JSON.stringify(filas[0]);
    for (const rastro of ['aciertos', 'contador', 'veces', 'cuando', 'desde', 'ultima', 'primera']) {
      assert.ok(!texto.includes(rastro), `la entrada lleva «${rastro}» tras tres peticiones`);
    }
    assert.equal(statSync(join(raiz, readdirSync(raiz)[0])).mtimeMs, config.MTIME_CONSTANTE);
    // Y la clave es un resumen, no la consulta: la coordenada no está escrita en claro.
    assert.doesNotMatch(String(filas[0].clave), /42\.4012/);
  });

  test('Lo único que la caché de generación añade es que alguien, alguna vez, generó un mapa en esa zona', async () => {
    const { proxy } = montaProxy({
      entorno: { CACHE_GENERACION: 'on' },
      aguasArriba: {
        ...creaAguasArribaDobladas(),
        generacion: creaProveedorDoblado({ ruta: 'generacion' }),
      },
    });
    const { fichas } = await pideTanda(proxy, { cuantas: 3 });
    const zonas = ['42.4012,-8.8114', '43.3623,-8.4115', '42.8805,-8.5457'];
    for (let i = 0; i < zonas.length; i++) {
      await proxy.atiende(peticionDe('generacion', { ficha: fichas[i], consulta: { ql: `[out:json];node(${zonas[i]});out;` } }));
    }

    const filas = (await proxy.recorreSuperficie()).filter((f) => f.entrada === 'cache-generacion');
    assert.equal(filas.length, 3, 'tres zonas, tres bits');
    // El bit es el único: cada entrada existe o no, y ninguna admite un orden, una
    // frecuencia ni un momento. Todas tienen exactamente la misma forma.
    const formas = new Set(filas.map((f) => JSON.stringify(Object.keys(f.valor).sort())));
    assert.equal(formas.size, 1);
    // Y las coordenadas siguen sin estar en ninguna otra entrada, ni en la métrica.
    const dia = await proxy.metrica.delDia();
    assert.equal(dia.contadores.generacion['llamada-de-pago'], 3, 'sólo un recuento de generaciones');
    assert.ok(!JSON.stringify(dia).includes('42.4'), 'la métrica no puede llevar ninguna geografía');
  });

  test('El documento de despliegue declara la consecuencia de encender la caché de generación con esas palabras', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const despliegue = readFileSync(join(raiz, 'server', 'DESPLIEGUE.md'), 'utf8');

    assert.match(despliegue, /el disco del servidor contiene un mapa de qué zonas se han jugado/i);
    assert.match(despliegue, /que alguien, alguna vez, generó un mapa en esa zona/i);
    assert.match(despliegue, /No dice quién, ni cuándo, ni cuántos, ni con qué frecuencia/i);
    // Y no se disimula: la caché de imágenes tiene la misma forma y también está dicho.
    assert.match(despliegue, /la caché de imágenes tiene la misma forma/i);
  });
});
