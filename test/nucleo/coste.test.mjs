// SPEC-023 · La medición del coste sin identidad, y los topes que la acotan.
//
// El pendiente 3 de `game-design/arquitectura.md` pide una cifra de coste por jugador y
// esta spec no la inventa: entrega el instrumento y evita que el instrumento reintroduzca
// identidad. La unidad no es el jugador —contar por instalación es exactamente el
// identificador persistente que RNF-PRIV-001 descarta— sino el **lote de trabajo**, y de
// ahí salen dos factores medidos y un tercero que se declara supuesto.
//
// Y el `TOPE_DIARIO_GASTO` sin valor por defecto es la otra mitad de la mitigación del
// riesgo 3: una clave de API sin tope es la forma conocida de descubrir el presupuesto
// cuando ya se ha gastado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CUBOS_COSTE_LOTE, PARAMETROS, cargaConfig } from '../../server/config.mjs';
import { ESLABONES_MEDIDOS, RESULTADOS, RUTAS_MEDIDAS, UNIDAD_DE_COSTE } from '../../server/metrica.mjs';
import { SUPERFICIE } from '../../server/superficie.mjs';
import { pideTanda } from '../dobles/atestacion.mjs';
import { creaReloj, DIA, HORA, MINUTO } from '../dobles/reloj.mjs';
import { EJEMPLOS, montaProxy, peticionDe, todoLoEscrito } from '../dobles/proxy-ciego.mjs';

describe('Los topes, el presupuesto y lo que pasa al agotarlo', () => {
  test('El proxy no arranca sin un tope diario de gasto declarado en su configuración', () => {
    // El parámetro se declara obligatorio de forma explícita, y no se infiere de que le
    // falte el defecto: es la ambigüedad que convertiría un olvido en una factura.
    const declarado = PARAMETROS.find((p) => p.nombre === 'TOPE_DIARIO_GASTO');
    assert.equal(declarado.obligatorio, true);
    assert.equal(declarado.defecto, undefined);
    assert.equal(PARAMETROS.filter((p) => p.obligatorio).length, 1, 'es el único sin valor por defecto');

    for (const entorno of [{}, { TOPE_DIARIO_GASTO: '' }, { TOPE_DIARIO_GASTO: '   ' }]) {
      assert.throws(() => cargaConfig(entorno), (e) => {
        assert.match(e.message, /no arranca/);
        assert.match(e.message, /TOPE_DIARIO_GASTO/, 'el error tiene que decir que falta el tope');
        return true;
      }, JSON.stringify(entorno));
    }
    // Y el resto de parámetros sí tienen defecto: sin el tope, y sólo sin él, no arranca.
    assert.equal(cargaConfig({ TOPE_DIARIO_GASTO: '10' }).TOPE_DIARIO_GASTO, 10);
    assert.throws(() => montaProxy({ entorno: { TOPE_DIARIO_GASTO: undefined } }), /TOPE_DIARIO_GASTO/);
  });

  test('Un lote de mapa que se pasa de su tope de llamadas de pago no se corta a la mitad para el jugador', async () => {
    const { proxy, aguasArriba } = montaProxy({ entorno: { TOPE_PAGO_LOTE_MAPA: '3' } });
    const { fichas } = await pideTanda(proxy, { cuantas: 8 });
    const lote = { id: 'mapa-1', tipo: 'mapa' };

    const respuestas = [];
    for (let i = 0; i < 6; i++) {
      respuestas.push(await proxy.atiende(peticionDe('imagen', {
        ficha: fichas[i], lote, prompt: `ilustración ${i}`, formato: { tipo: 'png', ancho: 512, alto: 512 },
      })));
    }
    assert.equal(aguasArriba.imagen.llamadas(), 3, 'el tope corta antes de llegar a aguas arriba');
    assert.deepEqual(respuestas.map((r) => r.sobre.hay), [true, true, true, false, false, false]);
    // «No se corta a la mitad»: las tres de más son un «no hay» normal, con el mismo
    // código de éxito y sin error, que es lo que el cliente ya sabe tratar.
    for (const r of respuestas.slice(3)) {
      assert.equal(r.estado, 200);
      assert.equal(r.sobre.error, undefined);
    }
  });

  test('Un lote de salida que se pasa de su tope se comporta igual', async () => {
    const { proxy, aguasArriba } = montaProxy({ entorno: { TOPE_PAGO_LOTE_SALIDA: '2' } });
    const { fichas } = await pideTanda(proxy, { cuantas: 5 });
    const lote = { id: 'salida-1', tipo: 'salida' };

    const respuestas = [];
    for (let i = 0; i < 5; i++) {
      respuestas.push(await proxy.atiende(peticionDe('texto', {
        ficha: fichas[i], lote, prompt: `beat ${i}`, idioma: 'es', tono: 'sobrio',
      })));
    }
    assert.equal(aguasArriba.texto.llamadas(), 2);
    assert.deepEqual(respuestas.map((r) => r.sobre.hay), [true, true, false, false, false]);
  });

  test('Un bucle del cliente que repite la misma petición se corta por el tope del lote', async () => {
    const { proxy, aguasArriba } = montaProxy({ entorno: { TOPE_PAGO_LOTE_MAPA: '5', FICHAS_POR_TANDA: '200' } });
    const { fichas } = await pideTanda(proxy, { cuantas: 200 });
    const lote = { id: 'el-bucle', tipo: 'mapa' };

    // El texto no se cachea, así que sin tope serían doscientas llamadas de pago.
    for (let i = 0; i < 200; i++) {
      await proxy.atiende(peticionDe('texto', { ficha: fichas[i], lote, prompt: 'lo mismo otra vez', idioma: 'es', tono: 'sobrio' }));
    }
    assert.equal(aguasArriba.texto.llamadas(), 5, 'el tope por lote es lo que corta el bucle');
    // Y las 195 rechazadas no gastaron ficha: el rechazo por tope va antes del gasto.
    const gastadas = (await proxy.recorreSuperficie()).filter((f) => f.entrada === 'fichas-gastadas');
    assert.equal(gastadas.length, 5);
  });

  test('Con el tope diario agotado todas las rutas responden que no hay y los aciertos de caché siguen sirviéndose', async () => {
    const { proxy, aguasArriba } = montaProxy({ entorno: { TOPE_DIARIO_GASTO: '4' } });
    const { fichas } = await pideTanda(proxy, { cuantas: 6 });

    // Una imagen cuesta 4, que es el tope entero del día.
    const imagen = await proxy.atiende(peticionDe('imagen', { ficha: fichas[0], ...EJEMPLOS.imagen }));
    assert.equal(imagen.sobre.hay, true);

    let i = 1;
    for (const tipo of ['texto', 'places', 'generacion']) {
      const r = await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] }));
      assert.equal(r.sobre.hay, false, tipo);
      assert.equal(r.estado, 200, tipo);
    }
    assert.equal(aguasArriba.llamadasDePago(), 1, 'ninguna llamada de pago más ese día');

    // Los aciertos de caché siguen sirviéndose: ya están pagados.
    const otraVez = await proxy.atiende(peticionDe('imagen', { ficha: fichas[4], ...EJEMPLOS.imagen }));
    assert.equal(otraVez.sobre.hay, true);
    assert.equal(otraVez.sobre.deCache, true);
  });

  test('Con el tope diario agotado, una salida entera se completa de principio a fin', async () => {
    const reloj = creaReloj();
    const { proxy, aguasArriba } = montaProxy({ reloj, entorno: { TOPE_DIARIO_GASTO: '1' } });
    const { fichas } = await pideTanda(proxy, { cuantas: 6 });

    await proxy.atiende(peticionDe('texto', { ficha: fichas[0], prompt: 'el gasto del día', idioma: 'es', tono: 'sobrio' }));
    const beats = ['arranque', 'nudo', 'giro', 'desenlace'];
    for (let i = 0; i < beats.length; i++) {
      const r = await proxy.atiende(peticionDe('texto', {
        ficha: fichas[i + 1], lote: { id: 'salida-de-hoy', tipo: 'salida' }, prompt: beats[i], idioma: 'es', tono: 'sobrio',
      }));
      assert.equal(r.estado, 200, beats[i]);
      assert.equal(r.sobre.hay, false, `${beats[i]}: cae a plantilla, como sin cobertura`);
      assert.equal(r.sobre.error, undefined);
    }
    assert.equal(aguasArriba.texto.llamadas(), 1);

    // Y al día siguiente el tope vuelve a estar entero: la ventana es el día natural.
    reloj.avanza(DIA);
    const manana = await pideTanda(proxy, { cuantas: 1 });
    const r = await proxy.atiende(peticionDe('texto', { ficha: manana.fichas[0], prompt: 'mañana', idioma: 'es', tono: 'sobrio' }));
    assert.equal(r.sobre.hay, true);
  });

  test('El identificador de lote caduca y en ningún momento se escribe en la superficie', async () => {
    const reloj = creaReloj();
    const { proxy, config, aguasArriba } = montaProxy({ reloj, entorno: { TOPE_PAGO_LOTE_SALIDA: '1' } });
    const { fichas } = await pideTanda(proxy, { cuantas: 4 });
    const lote = { id: 'lote-que-caduca', tipo: 'salida' };

    await proxy.atiende(peticionDe('texto', { ficha: fichas[0], lote, prompt: 'uno', idioma: 'es', tono: 'sobrio' }));
    const cortado = await proxy.atiende(peticionDe('texto', { ficha: fichas[1], lote, prompt: 'dos', idioma: 'es', tono: 'sobrio' }));
    assert.equal(cortado.sobre.hay, false, 'el tope del lote lo corta mientras el lote vive');

    // Pasada su vigencia deja de servir: el mismo identificador arranca un lote nuevo.
    reloj.avanza(config.VIGENCIA_LOTE + MINUTO);
    const despues = await proxy.atiende(peticionDe('texto', { ficha: fichas[2], lote, prompt: 'tres', idioma: 'es', tono: 'sobrio' }));
    assert.equal(despues.sobre.hay, true);
    assert.equal(aguasArriba.texto.llamadas(), 2);

    assert.ok(!todoLoEscrito(await proxy.recorreSuperficie()).includes('lote-que-caduca'));
  });

  test('Un identificador de lote que no existe se trata como un lote nuevo y el intento no se registra', async () => {
    const { proxy, aguasArriba } = montaProxy({ entorno: { TOPE_PAGO_LOTE_MAPA: '2' } });
    const { fichas } = await pideTanda(proxy, { cuantas: 4 });

    // Cuatro peticiones con cuatro identificadores que el proxy no ha visto nunca: cada
    // una estrena su tope entero, y ninguna deja escrito que llegó con un lote inventado.
    for (let i = 0; i < 4; i++) {
      const r = await proxy.atiende(peticionDe('imagen', {
        ficha: fichas[i], lote: { id: `inventado-${i}`, tipo: 'mapa' },
        prompt: `cosa ${i}`, formato: { tipo: 'png', ancho: 512, alto: 512 },
      }));
      assert.equal(r.sobre.hay, true, `inventado-${i}`);
    }
    assert.equal(aguasArriba.imagen.llamadas(), 4);
    const escrito = todoLoEscrito(await proxy.recorreSuperficie());
    for (let i = 0; i < 4; i++) assert.ok(!escrito.includes(`inventado-${i}`));
    // Y no hay ningún contador de intentos con lote desconocido: registrarlo sería una
    // fila por llamada con otro nombre.
    const dia = await proxy.metrica.delDia();
    assert.deepEqual(Object.keys(dia.lotes).sort(), ['mapa', 'salida'], 'los lotes sólo agregan por tipo');
    assert.ok(!JSON.stringify(dia).includes('inventado'));
  });
});

describe('La medición del coste, agregada y sin identidad', () => {
  test('La métrica de un día son recuentos por ruta y por resultado, coste imputado y nada más', async () => {
    const { proxy } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 4 });
    let i = 0;
    for (const tipo of RUTAS_MEDIDAS) {
      await proxy.atiende(peticionDe(tipo, { ficha: fichas[i++], ...EJEMPLOS[tipo] }));
    }

    const dia = await proxy.metrica.delDia();
    // El criterio no es «seis campos» sino **nada que identifique**, y la diferencia se vio
    // con SPEC-024: el recuento por eslabón del origen de datos es un campo más que la spec
    // pide, y contarlo como intruso ponía en rojo una métrica que sigue sin decir quién,
    // desde dónde ni qué zona. Lo que este caso afirma es que cada campo que hay es un
    // agregado del día —y por eso la lista se compara con la superficie declarada, que es
    // donde una escritura nueva tiene que darse de alta para poder existir—.
    const declarados = SUPERFICIE.find((e) => e.entrada === 'metrica-del-dia').campos;
    assert.deepEqual(Object.keys(dia).sort(), [...declarados].sort());
    assert.deepEqual([...declarados].sort(), ['contadores', 'coste', 'degradadas', 'dia', 'eslabones', 'lotes', 'peticiones']);
    // `eslabones` es cuántas generaciones sirvió cada origen, nunca dónde (SPEC-024).
    assert.deepEqual(Object.keys(dia.eslabones), [...ESLABONES_MEDIDOS]);
    assert.ok(Object.values(dia.eslabones).every((n) => Number.isInteger(n)));
    assert.deepEqual(Object.keys(dia.contadores).sort(), [...RUTAS_MEDIDAS].sort());
    for (const ruta of RUTAS_MEDIDAS) {
      assert.deepEqual(Object.keys(dia.contadores[ruta]).sort(), ['coste', ...RESULTADOS].sort(), ruta);
      assert.equal(dia.contadores[ruta]['llamada-de-pago'], 1, ruta);
    }
    // texto 1 + imagen 4 + places 1 + generación 1
    assert.equal(dia.coste, 7);
    assert.deepEqual(RESULTADOS, ['acierto-cache', 'llamada-de-pago', 'fallo-aguas-arriba', 'rechazo']);
  });

  test('La unidad de la métrica es el lote de trabajo y no existe la unidad jugador', async () => {
    const { proxy } = montaProxy();
    const { fichas } = await pideTanda(proxy, { cuantas: 2 });
    await proxy.atiende(peticionDe('texto', { ficha: fichas[0], ...EJEMPLOS.texto }));

    assert.equal(UNIDAD_DE_COSTE, 'lote-de-trabajo');
    const dia = JSON.stringify(await proxy.metrica.delDia());
    for (const unidad of ['jugador', 'usuario', 'instalacion', 'dispositivo', 'sesion']) {
      assert.ok(!dia.includes(unidad), `la métrica habla de «${unidad}»`);
    }
    assert.equal((await proxy.metrica.porLote('mapa')).unidad, 'lote-de-trabajo');
  });

  test('Un día sin una sola petición tiene todos los contadores a cero y no le falta ninguno', async () => {
    const { proxy } = montaProxy();
    const vacio = await proxy.metrica.delDia();

    for (const ruta of RUTAS_MEDIDAS) {
      for (const resultado of RESULTADOS) assert.equal(vacio.contadores[ruta][resultado], 0, `${ruta}/${resultado}`);
      assert.equal(vacio.contadores[ruta].coste, 0, ruta);
    }
    assert.equal(vacio.peticiones, 0);
    assert.equal(vacio.coste, 0);
    for (const tipo of ['mapa', 'salida']) {
      assert.equal(vacio.lotes[tipo].n, 0);
      assert.deepEqual(vacio.lotes[tipo].histograma, CUBOS_COSTE_LOTE[tipo].map(() => 0));
    }
    // Y leerla no la escribe: un día sin tráfico no deja fila.
    assert.deepEqual(await proxy.recorreSuperficie(), []);
  });

  test('El coste de un lote completo suma en el histograma de su tipo, en cubos declarados', async () => {
    const reloj = creaReloj();
    const { proxy, config } = montaProxy({ reloj });
    const { fichas } = await pideTanda(proxy, { cuantas: 6 });

    // Un lote de mapa: una generación (1), dos imágenes (4 cada una) y una foto (1) = 10.
    const mapa = { id: 'mapa-medido', tipo: 'mapa' };
    await proxy.atiende(peticionDe('generacion', { ficha: fichas[0], lote: mapa, ...EJEMPLOS.generacion }));
    await proxy.atiende(peticionDe('imagen', { ficha: fichas[1], lote: mapa, prompt: 'a', formato: { tipo: 'png', ancho: 512, alto: 512 } }));
    await proxy.atiende(peticionDe('imagen', { ficha: fichas[2], lote: mapa, prompt: 'b', formato: { tipo: 'png', ancho: 512, alto: 512 } }));
    await proxy.atiende(peticionDe('places', { ficha: fichas[3], lote: mapa, ...EJEMPLOS.places }));
    // Y un lote de salida: dos textos = 2.
    const salida = { id: 'salida-medida', tipo: 'salida' };
    await proxy.atiende(peticionDe('texto', { ficha: fichas[4], lote: salida, prompt: 'x', idioma: 'es', tono: 'sobrio' }));
    await proxy.atiende(peticionDe('texto', { ficha: fichas[5], lote: salida, prompt: 'y', idioma: 'es', tono: 'sobrio' }));

    // Los lotes se cierran al caducar, dentro del mismo día natural.
    reloj.avanza(config.VIGENCIA_LOTE + MINUTO);
    await proxy.cierra();

    const porMapa = await proxy.metrica.porLote('mapa');
    assert.equal(porMapa.n, 1);
    assert.equal(porMapa.media, 10);
    assert.deepEqual(porMapa.cubos, CUBOS_COSTE_LOTE.mapa);
    assert.equal(porMapa.histograma[CUBOS_COSTE_LOTE.mapa.indexOf(10)], 1);

    const porSalida = await proxy.metrica.porLote('salida');
    assert.equal(porSalida.n, 1);
    assert.equal(porSalida.media, 2);
    assert.equal(porSalida.histograma[CUBOS_COSTE_LOTE.salida.indexOf(2)], 1);
  });

  test('De la métrica no se puede sacar ninguna serie más fina que el día', async () => {
    const reloj = creaReloj();
    const { proxy } = montaProxy({ reloj });

    // Tres peticiones separadas por horas dentro del mismo día: acaban en la misma fila.
    for (let i = 0; i < 3; i++) {
      const { fichas } = await pideTanda(proxy, { cuantas: 1 });
      await proxy.atiende(peticionDe('texto', { ficha: fichas[0], prompt: `hora ${i}`, idioma: 'es', tono: 'sobrio' }));
      reloj.avanza(4 * HORA);
    }
    const filas = (await proxy.recorreSuperficie()).filter((f) => f.entrada === 'metrica-del-dia');
    assert.equal(filas.length, 1, 'doce horas de tráfico son una sola fila');
    assert.match(String(filas[0].clave), /^\d{4}-\d{2}-\d{2}$/, 'la clave es el día natural y no baja de ahí');
    assert.equal(filas[0].valor.peticiones, 3);
    assert.doesNotMatch(JSON.stringify(filas[0].valor), /\d{2}:\d{2}/, 'no puede haber ninguna hora dentro');
    assert.doesNotMatch(JSON.stringify(filas[0].valor), /1[6-9]\d{11}/, 'ni ningún instante en milisegundos');
    // Y no hay ninguna forma de pedirle una ventana más fina: `delDia` es la única.
    assert.equal(typeof proxy.metrica.delDia, 'function');
    assert.equal(proxy.metrica.delaHora, undefined);
  });

  test('Del histograma de coste por lote no se reconstruye la secuencia de lotes de un móvil', async () => {
    const reloj = creaReloj();
    const { proxy, config } = montaProxy({ reloj });

    // Tres salidas de tres costes distintos, en un orden concreto.
    const costes = [1, 3, 2];
    for (let i = 0; i < costes.length; i++) {
      const { fichas } = await pideTanda(proxy, { cuantas: costes[i] });
      for (let j = 0; j < costes[i]; j++) {
        await proxy.atiende(peticionDe('texto', {
          ficha: fichas[j], lote: { id: `salida-${i}`, tipo: 'salida' }, prompt: `${i}-${j}`, idioma: 'es', tono: 'sobrio',
        }));
      }
    }
    reloj.avanza(config.VIGENCIA_LOTE + MINUTO);
    await proxy.cierra();

    const h = await proxy.metrica.porLote('salida');
    assert.equal(h.n, 3);
    assert.equal(h.media, 2);
    // Lo que se guarda son suma y suma de cuadrados, no los valores: media y desviación
    // salen exactas y no queda ni un lote individual del que reconstruir el orden.
    const guardado = (await proxy.metrica.delDia()).lotes.salida;
    assert.deepEqual(Object.keys(guardado).sort(), ['histograma', 'n', 'suma', 'sumaCuadrados']);
    assert.ok(!('valores' in guardado) && !('lotes' in guardado), 'no puede quedar la lista de lotes');
    assert.ok(!JSON.stringify(guardado).includes('salida-0'), 'ni un identificador de lote');
  });

  test('El coste por mapa se responde medido y el coste por jugador se responde declarado como modelo', async () => {
    const reloj = creaReloj();
    const { proxy, config } = montaProxy({ reloj });

    // Dos mapas de coste distinto, para que la dispersión no sea cero.
    for (const [i, cuantas] of [[0, 2], [1, 4]]) {
      const { fichas } = await pideTanda(proxy, { cuantas });
      for (let j = 0; j < cuantas; j++) {
        await proxy.atiende(peticionDe('places', {
          ficha: fichas[j], lote: { id: `mapa-${i}`, tipo: 'mapa' }, place_id: `ChIJ-${i}-${j}`,
        }));
      }
    }
    reloj.avanza(config.VIGENCIA_LOTE + MINUTO);
    await proxy.cierra();

    const medido = await proxy.metrica.porLote('mapa');
    assert.equal(medido.n, 2);
    assert.equal(medido.media, 3);
    assert.equal(medido.desviacion, 1, 'la dispersión también es medida, no estimada');

    const modelo = await proxy.metrica.costePorJugador({ salidasPorMapa: 12 });
    assert.equal(modelo.esModelo, true);
    assert.deepEqual(modelo.factorSupuesto, { salidasPorMapa: 12 });
    assert.equal(modelo.factoresMedidos.costeMedioPorLoteDeMapa, 3);
    assert.match(modelo.advertencia, /no es una medición|es un modelo, no una medición/);
    assert.match(modelo.advertencia, /ese identificador no existe/);
  });
});
