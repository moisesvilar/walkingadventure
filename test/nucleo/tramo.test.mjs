// SPEC-004 · El tramo personal: el catálogo del arranque, la corrección en
// silencio y el suelo de moverse.
//
// La afirmación más difícil de este fichero es una negativa, y por eso se hace
// sobre datos y no leyendo el código: se recorren **todos los textos que el
// núcleo puede producir** —los exportados por sus módulos y los que salen de
// generar un mundo— y se comprueba que ninguno menciona el tramo, ni su cambio,
// ni cuánto se ha andado, ni la palabra «accesibilidad».
//
// Los casos con nombre de escenario son los de docs/testing.md, literales; el
// resto van marcados como hueco en test/spec-test-map.json, y son casi todos:
// la batería no tiene ninguna característica sobre el catálogo del arranque, ni
// sobre el suelo, ni sobre RNF-ACC-001, y la propia spec lo declara.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import {
  DECLARACION_DEL_SUELO,
  IDS_DE_RESPUESTA,
  RESPUESTAS_DE_TRAMO,
  SEGUNDOS_POR_TRAMO,
  SUELO_MUNDO_JUGABLE_M,
  SUELO_TRAMO_M,
  TECHO_TRAMO_M,
  cambiaTramo,
  declaraTramo,
  tramoDeRespuesta,
  tramoDeclaradoM,
  tramoEnMetros,
  tramoEstimadoM,
} from '../../packages/nucleo/partida/tramo.js';
import { incorporaMedida } from '../../packages/nucleo/partida/ritmo.js';
import { dimensionaSalida, TAMANOS_DE_SALIDA } from '../../packages/nucleo/partida/salida.js';
import { cuposDeCelda } from '../../packages/nucleo/world/cupos.js';
import { generaCelda } from '../../packages/nucleo/world/celda.js';
import { creaRejilla, TRAMO_SUELO_M } from '../../packages/nucleo/world/rejilla.js';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { SEMILLA_A, consultaDeFixture, coordenadaDe, serializado } from './celda-de-prueba.mjs';
import { generaMundo, fuente, modulosDelPaquete, nombresDelMundo } from './mundo-de-prueba.mjs';

/** Una medida ya hecha, sin pasar por la traza: lo que aquí se prueba es la corrección. */
const medidaDe = (metrosPorMediaHora) => ({ hayMedida: true, metrosPorMediaHora, metrosAndando: 1000, segundosAndando: 900, motivo: null });

// Prosa: una cadena con espacios y longitud de frase. Es el filtro que separa los
// textos de los identificadores (`vuelta-de-la-esquina`, `ficha-de-la-tienda`) sin
// tener que enumerar a mano qué exporta cada módulo.
const esProsa = (v) => typeof v === 'string' && v.length >= 15 && /\s/.test(v);

function recogeProsa(valor, out = [], vistos = new Set()) {
  if (esProsa(valor)) out.push(valor);
  else if (valor && typeof valor === 'object' && !vistos.has(valor)) {
    vistos.add(valor);
    for (const v of Object.values(valor)) recogeProsa(v, out, vistos);
  }
  return out;
}

/** Todas las cadenas de un dato estructurado, a cualquier profundidad y en orden estable. */
function cadenasDe(valor, out = []) {
  if (typeof valor === 'string') out.push(valor);
  else if (Array.isArray(valor)) for (const v of valor) cadenasDe(v, out);
  else if (valor && typeof valor === 'object') for (const v of Object.values(valor)) cadenasDe(v, out);
  return out;
}

/** Todo texto que el núcleo exporta, venga de donde venga, sin enumerar módulos. */
async function textosExportadosDelNucleo() {
  const textos = [];
  for (const modulo of modulosDelPaquete()) {
    const mod = await import(join(RAIZ_REPO, modulo));
    for (const [nombre, valor] of Object.entries(mod)) {
      for (const texto of recogeProsa(valor)) textos.push({ modulo, exportado: nombre, texto });
    }
  }
  return textos;
}

/** Los textos que el núcleo produce **para mostrarse dentro del juego**. */
async function textosDeDentroDelJuego() {
  const exportados = (await textosExportadosDelNucleo())
    // La declaración del suelo lleva su destino escrito al lado y es de fuera: se
    // dice antes de instalar. Que no aparezca dentro se comprueba aparte.
    .filter((t) => t.exportado !== 'DECLARACION_DEL_SUELO')
    .map((t) => ({ de: `${t.modulo} · ${t.exportado}`, texto: t.texto }));

  // Y lo que sale de generar: títulos y nombres de fantasía, que es la otra mitad
  // de lo que el jugador llega a leer del núcleo.
  for (const nombre of ['barrio-tres-calles', 'urbano-denso']) {
    const mundo = await generaMundo(nombre, '42.40,-8.81#1');
    exportados.push({ de: `mundo ${nombre}`, texto: mundo.title });
    for (const n of nombresDelMundo(mundo)) exportados.push({ de: `mundo ${nombre}`, texto: n });
    // SPEC-010 convierte el motivo del fallo en **dato estructurado** —clave, roles
    // y requisito— y deja de ser la frase que este bucle metía tal cual. Se recorren
    // todas sus cadenas, una por una, en vez de la cadena de antes: el motivo ya no
    // es prosa, y precisamente por eso hay que seguir mirándolo, para que nadie lo
    // devuelva a serlo por la puerta de atrás. Los números quedan fuera a propósito:
    // `enTramos` o `topeEnTramos` son la medida del fallo, no un texto que nadie lee.
    for (const c of mundo.casting) {
      if (!c.motivo) continue;
      for (const cadena of cadenasDe(c.motivo)) exportados.push({ de: `casting ${nombre}`, texto: cadena });
    }
  }
  return exportados;
}

/** El único módulo del núcleo que exporta texto con **registro declarado**. */
const MODULO_DEL_GUION = 'packages/nucleo/partida/guion-de-arranque.js';

/**
 * Los textos que el núcleo pone **en boca del mundo**.
 *
 * Es el corpus de «el ajuste no se comenta nunca», y no coincide con el de dentro
 * del juego desde que SPEC-027 metió el guion del arranque en el núcleo. La regla que
 * hay que sostener no es «esta frase no existe en ninguna parte», es **«el ajuste del
 * tramo no se comenta»**: que el mundo no le diga a nadie que se le ha medido el paso.
 * Preguntar «en media hora andando, ¿tú dónde llegas?» es la pregunta del onboarding
 * —`accesibilidad.md` §1 la formula así, literal, y la maqueta la dibuja— y es la voz
 * de la aplicación explicando qué le está preguntando, no el mundo comentando una
 * medición que todavía no ha ocurrido.
 *
 * Así que el corpus es el núcleo entero **menos las piezas del guion que hablan como
 * aplicación**, que son las únicas cadenas del paquete con registro escrito al lado.
 * Las de registro `mundo` siguen dentro, y siguen sujetas a la prohibición entera.
 *
 * Esto no afloja nada por dos motivos: cualquier texto nuevo del núcleo sigue entrando
 * al corpus por defecto —hay que declararse voz de aplicación del arranque para
 * quedarse fuera, y eso se ve en el diff—, y las piezas que se quedan fuera pasan por
 * `revisaGuion`, que en el arranque prohíbe los dígitos, las distancias, los tiempos y
 * el ritmo. Un texto que le dijera a alguien que anda menos que antes cae en un lado o
 * en el otro.
 */
async function textosQueHablaElMundo() {
  const { GUION, REGISTROS } = await import(join(RAIZ_REPO, MODULO_DEL_GUION));
  const textos = (await textosDeDentroDelJuego()).filter((t) => !t.de.startsWith(`${MODULO_DEL_GUION} ·`));
  for (const pieza of GUION) {
    if (pieza.registro !== REGISTROS.MUNDO || typeof pieza.texto !== 'string') continue;
    textos.push({ de: `${MODULO_DEL_GUION} · ${pieza.paso}/${pieza.id}`, texto: pieza.texto });
  }
  return textos;
}

describe('El tramo declarado', () => {
  test('El catálogo del arranque son cuatro sitios a los que se llega, sin ninguna cifra', () => {
    assert.equal(RESPUESTAS_DE_TRAMO.length, 4, 'el catálogo del arranque no tiene cuatro respuestas');
    assert.deepEqual([...IDS_DE_RESPUESTA], RESPUESTAS_DE_TRAMO.map((r) => r.id));

    for (const respuesta of RESPUESTAS_DE_TRAMO) {
      // Lo que viaja es el identificador del sitio, y un sitio no lleva cifras: ni
      // de distancia ni de tiempo. La redacción es de la pantalla A1P2 (fila 27).
      assert.match(respuesta.id, /^[a-z]+(-[a-z]+)*$/, `la respuesta "${respuesta.id}" no es un identificador de sitio`);
      assert.equal(/\d/.test(respuesta.id), false, `la respuesta "${respuesta.id}" lleva una cifra`);
      assert.equal(/\b(km|metros?|minutos?|hora)\b/i.test(respuesta.id), false, `la respuesta "${respuesta.id}" nombra una medida`);
    }
    // Una y solo una viene preseleccionada, como en la maqueta.
    assert.equal(RESPUESTAS_DE_TRAMO.filter((r) => r.preseleccionada).length, 1);
  });

  test('Las cuatro respuestas se traducen a metros por media hora, ordenadas de menor a mayor sin empates', () => {
    const metros = IDS_DE_RESPUESTA.map((id) => tramoDeRespuesta(id));
    for (const m of metros) assert.ok(Number.isFinite(m) && m > 0, `una respuesta se traduce a ${m}`);
    for (let k = 1; k < metros.length; k++) {
      assert.ok(metros[k] > metros[k - 1], `las respuestas no están ordenadas: ${metros.join(', ')}`);
    }
    assert.equal(new Set(metros).size, metros.length, 'hay dos respuestas con los mismos metros');
    // Acepta el identificador o la entrada entera, y da lo mismo.
    for (const respuesta of RESPUESTAS_DE_TRAMO) assert.equal(tramoDeRespuesta(respuesta), tramoDeRespuesta(respuesta.id));
  });

  test('La respuesta más corta no baja del suelo declarado', () => {
    const metros = IDS_DE_RESPUESTA.map((id) => tramoDeRespuesta(id));
    assert.ok(Math.min(...metros) >= SUELO_TRAMO_M, `la respuesta más corta (${Math.min(...metros)} m) está por debajo del suelo de ${SUELO_TRAMO_M} m`);
    assert.ok(Math.max(...metros) <= TECHO_TRAMO_M, 'la respuesta más larga pasa del techo');
  });

  test('Una respuesta fuera del catálogo falla nombrando lo recibido y enumerando las cuatro válidas', () => {
    for (const mala of ['al-fin-del-mundo', '', 'OTRO-BARRIO', undefined, null, 42, {}]) {
      assert.throws(
        () => tramoDeRespuesta(mala),
        (e) => {
          assert.match(e.message, /respuesta de tramo desconocida/, `el error no dice qué pasa: ${e.message}`);
          for (const id of IDS_DE_RESPUESTA) assert.match(e.message, new RegExp(id), `el error no enumera "${id}": ${e.message}`);
          return true;
        },
        `se ha aceptado la respuesta ${JSON.stringify(mala)}`,
      );
    }
    // Y el error nombra lo que llegó, para que se vea qué se mandó mal.
    assert.throws(() => tramoDeRespuesta('al-fin-del-mundo'), /al-fin-del-mundo/);
  });

  test('Una partida sin respuesta declarada falla nombrando el dato que falta en vez de suponer uno', () => {
    for (const vacia of [undefined, null, {}, { personaje: {} }, { tramo: {} }, { tramo: { declaradoM: '2000' } }]) {
      for (const consulta of [tramoDeclaradoM, tramoEstimadoM]) {
        assert.throws(
          () => consulta(vacia),
          (e) => {
            assert.match(e.message, /falta el tramo declarado/, `el error no nombra el dato que falta: ${e.message}`);
            return true;
          },
          `se ha devuelto un tramo para ${JSON.stringify(vacia)}`,
        );
      }
    }
  });

  test('El tramo viaja con el personaje y no con el mundo', async () => {
    const tramo = declaraTramo('otro-barrio');
    // Se lee igual suelto, dentro del personaje o dentro de la partida: es dato del
    // personaje, y por eso las tres formas son la misma.
    for (const entrada of [tramo, { tramo }, { personaje: { tramo } }]) {
      assert.equal(tramoDeclaradoM(entrada), 1200);
      assert.equal(tramoEstimadoM(entrada), 1200);
    }

    // Y no viaja con el mundo: en el registro de una celda no está el estado del
    // tramo del personaje. El `tramoM` que sí está es la dimensión con la que se
    // generó lo que hay, que es otra cosa y no se mueve nunca.
    const { lat, lon } = coordenadaDe('barrio-tres-calles');
    const rejilla = creaRejilla({ lat, lon, tramoM: 2000 });
    const registro = await generaCelda({
      rejilla,
      semilla: SEMILLA_A,
      mapaId: rejilla.id,
      celda: { i: 0, j: 0 },
      consultaOsm: consultaDeFixture('barrio-tres-calles'),
      tramoM: tramoEstimadoM(tramo),
    });
    const texto = serializado(registro);
    for (const campo of ['declaradoM', 'estimadoM', 'salidasMedidas', 'respuesta']) {
      assert.equal(texto.includes(campo), false, `el registro de la celda guarda "${campo}", que es dato del personaje`);
    }
    assert.equal(registro.tramoM, 1200, 'el registro no guarda con qué tramo se dimensionó');
  });

  test('Dos partidas con la misma semilla y tramos distintos generan el mismo mundo', async () => {
    // Mismo tamaño de celda en metros y misma semilla: el tramo de quien juega
    // dimensiona los cupos, nunca la geometría ni el contenido.
    const { lat, lon } = coordenadaDe('costero');
    const rejilla = creaRejilla({ lat, lon, tramoM: 2000 });
    const genera = (tramoM) => generaCelda({
      rejilla,
      semilla: SEMILLA_A,
      mapaId: rejilla.id,
      celda: { i: 0, j: 0 },
      consultaOsm: consultaDeFixture('costero'),
      tramoM,
    });

    const largo = await genera(2000);
    const corto = await genera(600);
    assert.equal(serializado(largo.mundo), serializado(corto.mundo), 'dos tramos distintos han generado mundos distintos');
    assert.notEqual(serializado(largo.cupos), serializado(corto.cupos), 'el tramo no ha dimensionado los cupos');
  });
});

describe('La corrección del tramo, en silencio', () => {
  test('El tramo se ajusta con lo andado', () => {
    // El escenario de la batería, con el número que la spec fija: cinco salidas
    // medidas en 1,2 km por media hora desde un tramo declarado de 2 km.
    let tramo = declaraTramo('pueblo-de-al-lado');
    assert.equal(tramo.declaradoM, 2000);

    const una = incorporaMedida(tramo, medidaDe(1200));
    assert.ok(una.estimadoM < 2000 && una.estimadoM > 1200, `una medida deja el tramo en ${una.estimadoM}, fuera de los dos valores`);

    for (let k = 0; k < 5; k++) tramo = incorporaMedida(tramo, medidaDe(1200));
    assert.equal(tramo.salidasMedidas, 5);
    const desvio = Math.abs(tramo.estimadoM - 1200) / 1200;
    assert.ok(desvio < 0.10, `tras cinco salidas el tramo estimado es ${Math.round(tramo.estimadoM)} m, a un ${(desvio * 100).toFixed(1)} % de 1,2 km`);
    // Baja *hacia* el valor medido y no salta a él: es lo que pide el escenario.
    assert.ok(tramo.estimadoM > 1200, 'el tramo estimado ha saltado al valor medido');
    assert.equal(tramo.declaradoM, 2000, 'la corrección ha reescrito lo declarado');
  });

  test('Una partida sin ninguna salida medida estima exactamente el tramo declarado', () => {
    for (const id of IDS_DE_RESPUESTA) {
      const tramo = declaraTramo(id);
      assert.equal(tramo.salidasMedidas, 0);
      assert.equal(tramoEstimadoM(tramo), tramoDeclaradoM(tramo), `${id}: el estimado de una partida nueva no es el declarado`);
      assert.equal(tramoEstimadoM(tramo), tramoDeRespuesta(id));
    }
    // Una medida que no lo es tampoco mueve nada.
    const tramo = declaraTramo('otro-barrio');
    for (const nada of [undefined, null, { hayMedida: false, metrosPorMediaHora: null }]) {
      assert.equal(incorporaMedida(tramo, nada).estimadoM, tramo.declaradoM);
      assert.equal(incorporaMedida(tramo, nada).salidasMedidas, 0);
    }
  });

  test('La misma serie de medidas incorporada dos veces da el mismo tramo estimado', () => {
    const serie = [1400, 900, 1250, 1310, 980, 1120];
    const corre = () => serie.reduce((tramo, m) => incorporaMedida(tramo, medidaDe(m)), declaraTramo('pueblo-de-al-lado'));
    assert.equal(serializado(corre()), serializado(corre()), 'la misma serie da dos tramos estimados distintos');
    // Y el orden importa —es una media móvil—, que es lo que hace que la anterior
    // afirme algo: si diera igual, sería una media a secas.
    const alReves = [...serie].reverse().reduce((tramo, m) => incorporaMedida(tramo, medidaDe(m)), declaraTramo('pueblo-de-al-lado'));
    assert.notEqual(alReves.estimadoM, corre().estimadoM);
  });

  test('La estimación no baja del suelo ni sube del techo', () => {
    let bajo = declaraTramo('vuelta-de-la-esquina');
    for (let k = 0; k < 20; k++) bajo = incorporaMedida(bajo, medidaDe(50));
    assert.equal(bajo.estimadoM, SUELO_TRAMO_M, `la estimación ha bajado a ${bajo.estimadoM}, por debajo del suelo`);

    let alto = declaraTramo('pueblo-de-al-lado');
    for (let k = 0; k < 40; k++) alto = incorporaMedida(alto, medidaDe(30000));
    assert.equal(alto.estimadoM, TECHO_TRAMO_M, `la estimación ha subido a ${alto.estimadoM}, por encima del techo`);

    // Una sola medida disparatada tampoco se lleva el mundo por delante.
    const deUna = incorporaMedida(declaraTramo('otro-barrio'), medidaDe(90000));
    assert.ok(deUna.estimadoM <= TECHO_TRAMO_M);
  });

  test('El ajuste no se comenta nunca', async () => {
    // Una jugadora cuyo tramo acaba de bajar, y todos los textos que el núcleo
    // puede producir. Ninguno menciona el tramo, ni su cambio, ni lo andado.
    const antes = declaraTramo('pueblo-de-al-lado');
    const despues = incorporaMedida(antes, medidaDe(1200));
    assert.ok(despues.estimadoM < antes.estimadoM, 'el tramo no ha bajado: la prueba no está mirando lo que dice mirar');

    const prohibido = [
      [/\btramos?\b/i, 'el tramo'],
      [/\britmo\b/i, 'el ritmo'],
      [/\bmedia hora\b/i, 'la media hora'],
      [/\bandas? (más|menos)\b/i, 'cuánto se anda'],
      [/\b\d+([.,]\d+)?\s*(m|km|metros?|kil[óo]metros?|minutos?|pasos?)\b/i, 'una cifra de distancia o de tiempo'],
    ];
    const textos = await textosQueHablaElMundo();
    assert.ok(textos.length > 20, `solo se han recogido ${textos.length} textos: la prueba no está recorriendo nada`);
    for (const { de, texto } of textos) {
      for (const [patron, que] of prohibido) {
        assert.equal(patron.test(texto), false, `${de} menciona ${que}: «${texto}»`);
      }
    }

    // Y la mitad que el recorte no cubre: la voz de aplicación del arranque puede
    // decir «media hora» porque es la definición del tramo, pero **no** puede
    // comentar la medición. Se afirma pieza a pieza sobre lo que se dejó fuera.
    const { GUION, REGISTROS } = await import(join(RAIZ_REPO, MODULO_DEL_GUION));
    const deAplicacion = GUION.filter((p) => p.registro === REGISTROS.APLICACION && typeof p.texto === 'string');
    assert.ok(deAplicacion.length > 10, `el guion del arranque solo declara ${deAplicacion.length} piezas de aplicación: la prueba no está mirando nada`);
    for (const pieza of deAplicacion) {
      for (const [patron, que] of [prohibido[0], prohibido[1], prohibido[3], prohibido[4]]) {
        assert.equal(patron.test(pieza.texto), false, `${pieza.paso}/${pieza.id} menciona ${que}: «${pieza.texto}»`);
      }
    }
  });

  test('El módulo del tramo no exporta ningún texto destinado a mostrarse dentro del juego', async () => {
    const mod = await import(join(RAIZ_REPO, 'packages/nucleo/partida/tramo.js'));
    for (const [exportado, valor] of Object.entries(mod)) {
      const prosa = recogeProsa(valor);
      if (!prosa.length) continue;
      // Lo único que puede llevar prosa es la declaración del suelo, y lleva su
      // destino escrito al lado precisamente para que esto se pueda afirmar.
      assert.equal(exportado, 'DECLARACION_DEL_SUELO', `partida/tramo.js exporta texto en "${exportado}": «${prosa[0]}»`);
      assert.equal(valor.destino, 'ficha-de-la-tienda', 'la declaración del suelo no dice que su destino es de fuera del juego');
    }
  });

  test('Ninguna consulta del núcleo devuelve el tramo en metros a una capa de presentación', () => {
    // Lo que se ofrece son tamaños de salida y cupos, y ninguno de los dos lleva el
    // número: de dónde salen los metros de una salida es cosa del núcleo.
    const tramo = incorporaMedida(declaraTramo('pueblo-de-al-lado'), medidaDe(1200));
    for (const tamano of TAMANOS_DE_SALIDA) {
      const salida = dimensionaSalida(tamano.id, tramo);
      for (const campo of ['declaradoM', 'estimadoM', 'tramoM', 'tramoEstimadoM']) {
        assert.equal(campo in salida, false, `la salida dimensionada expone "${campo}"`);
      }
    }
    for (const campo of ['declaradoM', 'estimadoM', 'tramoM']) {
      assert.equal(campo in cuposDeCelda({ radioEnTramos: 1 }), false, `los cupos exponen "${campo}"`);
    }

    // Y quien lee el tramo del personaje es solo el área de la partida: nadie más
    // lo importa, así que no hay por dónde llegue a pintarse.
    const lectores = modulosDelPaquete().filter((m) => /\btramo(Estimado|Declarado)M\b/.test(fuente(m)));
    for (const m of lectores) {
      assert.match(m, /^packages\/nucleo\/partida\//, `${m} lee el tramo del personaje y no es del área de la partida`);
    }
  });
});

describe('El suelo de moverse', () => {
  test('El suelo es una constante única de la que salen el mínimo del tramo y el mínimo de la celda', () => {
    assert.equal(SUELO_TRAMO_M, TRAMO_SUELO_M, 'hay dos suelos distintos para lo mismo');
    assert.equal(creaRejilla({ lat: 42.40, lon: -8.81, tramoM: SUELO_TRAMO_M }).radioInscritoM, SUELO_MUNDO_JUGABLE_M);

    // Y no hay dos números escritos que digan lo mismo: el 250 se declara una vez.
    const declaran = modulosDelPaquete().filter((m) => /=\s*250\b/.test(fuente(m)));
    assert.deepEqual(declaran, ['packages/nucleo/world/rejilla.js'], `el suelo se escribe a mano en más de un sitio: ${declaran.join(', ')}`);
    assert.match(fuente('packages/nucleo/partida/tramo.js'), /export const SUELO_TRAMO_M = TRAMO_SUELO_M;/, 'el suelo del tramo no se deriva del que ya existía');
  });

  test('La declaración del suelo dice el límite y que por debajo no hay juego, y no promete nada sobre las cuestas', () => {
    const { texto, suelo, destino } = DECLARACION_DEL_SUELO;
    assert.equal(suelo, SUELO_TRAMO_M);
    assert.match(texto, new RegExp(String(SUELO_TRAMO_M)), 'la declaración no dice el límite concreto');
    assert.match(texto, /no hay juego que montar/, 'la declaración no dice que por debajo de ahí no hay juego que montar');
    assert.match(texto, /media hora/, 'la declaración no dice de qué es el límite');
    assert.match(texto, /cuestas/, 'la declaración no habla de las cuestas');
    // Hablar de las cuestas es decir que no se prometen: lo que no puede es
    // prometer que se manejan.
    assert.equal(/(cuestas[^.]*(garantiza|aseguramos|prometemos|funciona bien))/i.test(texto), false, `la declaración promete algo sobre las cuestas: «${texto}»`);
    assert.match(texto, /De las cuestas no te decimos nada/, 'la declaración no dice claramente que de las cuestas no se dice nada');
    assert.equal(destino, 'ficha-de-la-tienda', 'la declaración no dice a dónde va');
  });

  test('La declaración del suelo se dice antes de instalar y no aparece en ningún texto de dentro del juego', async () => {
    const textos = await textosDeDentroDelJuego();
    const frases = DECLARACION_DEL_SUELO.texto.split(/(?<=\.)\s+/).filter((f) => f.length > 20);
    assert.ok(frases.length >= 2, 'la declaración no tiene frases que buscar');
    for (const { de, texto } of textos) {
      for (const frase of frases) {
        assert.equal(texto.includes(frase), false, `${de} lleva dentro del juego una frase de la declaración del suelo: «${frase}»`);
      }
      assert.equal(/no hay juego que montar/.test(texto), false, `${de} declara el suelo dentro del juego: «${texto}»`);
    }
  });

  test('La palabra «accesibilidad» no aparece en ningún texto que el núcleo produce', async () => {
    const textos = [...(await textosDeDentroDelJuego()), { de: 'la declaración del suelo', texto: DECLARACION_DEL_SUELO.texto }];
    for (const { de, texto } of textos) {
      assert.equal(/accesibilidad/i.test(texto), false, `${de} usa la palabra «accesibilidad»: «${texto}»`);
      // Ni sus alrededores, que dicen lo mismo con otro nombre.
      assert.equal(/\b(discapacidad|minusval|adaptad[oa] para)\b/i.test(texto), false, `${de} nombra la condición de quien juega: «${texto}»`);
    }
  });

  test('Un tramo en el suelo dimensiona una celda jugable y una salida con los mismos beats', () => {
    const suelo = tramoEnMetros(SUELO_TRAMO_M);
    assert.equal(suelo.declaradoM, SUELO_TRAMO_M);
    // Por debajo del suelo se recorta en lugar de rechazar: es lo que deja jugar a
    // quien la decisión quería incluir.
    assert.equal(tramoEnMetros(80).declaradoM, SUELO_TRAMO_M);

    const rejilla = creaRejilla({ lat: 42.40, lon: -8.81, tramoM: SUELO_TRAMO_M });
    const cupos = cuposDeCelda({ radioEnTramos: rejilla.radioInscritoM / SUELO_TRAMO_M });
    assert.ok(cupos.nucleos.total >= 4, `la celda del suelo se queda con ${cupos.nucleos.total} núcleos`);
    for (const tipo of ['ciudad', 'pueblo', 'aldea', 'granja']) {
      assert.ok(cupos.nucleos[tipo] >= 1, `la celda del suelo no tiene ni una ${tipo}`);
    }
    assert.ok(cupos.parajes.cupo >= cupos.parajes.suelo, 'la celda del suelo no llega al suelo de parajes');

    // Y la salida se dimensiona igual que para cualquier otro: mismos beats.
    for (const tamano of TAMANOS_DE_SALIDA) {
      const corta = dimensionaSalida(tamano.id, suelo);
      const larga = dimensionaSalida(tamano.id, declaraTramo('pueblo-de-al-lado'));
      assert.equal(corta.beats, larga.beats, `${tamano.id}: quien anda el suelo recibe otro número de beats`);
      assert.equal(corta.tramos, larga.tramos);
      assert.ok(corta.metros < larga.metros, `${tamano.id}: la salida del suelo no es más corta en metros`);
    }
  });

  test('Recalibrar el tramo vuelve a declararlo y no arrastra la estimación anterior', () => {
    const viejo = incorporaMedida(declaraTramo('pueblo-de-al-lado'), medidaDe(1200));
    const nuevo = cambiaTramo(viejo, 'par-de-manzanas');
    assert.equal(nuevo.declaradoM, 700);
    assert.equal(nuevo.estimadoM, 700, 'la estimación de la respuesta anterior se ha arrastrado a la nueva');
    assert.equal(nuevo.salidasMedidas, 0);
    assert.equal(viejo.salidasMedidas, 1, 'cambiar el tramo ha tocado el estado anterior');
    assert.throws(() => cambiaTramo(undefined, 'par-de-manzanas'), /falta el tramo declarado/);
    assert.throws(() => cambiaTramo(viejo, 'al-fin-del-mundo'), /respuesta de tramo desconocida/);
  });

  test('El estado del tramo se entrega congelado', () => {
    const tramo = declaraTramo('otro-barrio');
    assert.equal(Object.isFrozen(tramo), true, 'el estado del tramo no está congelado');
    assert.throws(() => { tramo.estimadoM = 9000; }, TypeError);
    assert.equal(tramo.estimadoM, 1200);
    assert.equal(SEGUNDOS_POR_TRAMO, 1800, 'la media hora se ha dejado de medir en media hora');
  });
});
