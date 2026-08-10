// SPEC-041 · El reparto del repertorio de nombres entre las celdas de un mapa: lo que
// hace que dos celdas vecinas no llamen igual a dos sitios distintos **sin preguntarse
// nada**, que es la única forma de tenerlo sin romper el determinismo.
//
// El hueco que SPEC-026 dejó anotado tiene una trampa: mirar los nombres de las vecinas
// ya abiertas haría que el contenido de una celda dependiera de por dónde anduvo quien
// juega. Por eso las dos afirmaciones que mandan aquí son de ausencia: una celda
// generada **sin conocer a sus vecinas** ya es única contra ellas, y una celda es
// **idéntica byte a byte** se genere antes o después que ellas.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás van
// declarados como huecos de la batería en test/spec-test-map.json: la propia spec dice
// que la unicidad entre celdas vecinas no tiene escenario escrito, y es el caso que ya
// se rompió una vez en este repo con dos «Casal da Colmea» en `costero#2`.
//
// Nada de aquí toca la red ni el reloj: los extractos son los congelados de SPEC-001.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  PORCIONES_DE_REPERTORIO,
  PORCION_DE_LAS_FORMAS_CONSTRUIDAS,
  CELDAS_CON_REPERTORIO_LIBRE,
  TOPE_DE_DESEMPATES,
  desempateDeCelda,
  ordinalDeCelda,
  porcionDeNombre,
  repartoDeCelda,
} from '../../packages/nucleo/world/rejilla.js';
import {
  crearIndiceDeMapa,
  crearIndiceDeNombres,
  levantaIndiceDeMapa,
  localeFor,
  nombresDelMundo,
} from '../../packages/nucleo/names/index.js';
import { abreCelda, celdasAbiertas, creaMapa } from '../../packages/nucleo/partida/mapa.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { SEMILLA_A, consultaDeFixture, coordenadaDe } from './celda-de-prueba.mjs';

const TRAMO_M = 2000;

/** Las tres celdas contiguas sobre las que se afirma la unicidad: la del anclaje y dos vecinas. */
const TRES_CONTIGUAS = [{ i: 0, j: 0 }, { i: 1, j: 0 }, { i: 0, j: 1 }];

/**
 * Un mapa con las celdas que se pidan abiertas, **todas sobre el mismo extracto**.
 *
 * Servir el mismo mundo real a las tres celdas es el peor caso a propósito: sin reparto
 * las tres nombrarían con el mismo repertorio y sobre los mismos anclajes, así que
 * cualquier nombre repetido saldría aquí y no en un mundo afortunado.
 */
async function mapaCon(celdas, { nombre = 'costero', semilla = SEMILLA_A, desplazaLon = 0 } = {}) {
  const c = coordenadaDe(nombre);
  const consulta = consultaDeFixture(nombre);
  const mapa = creaMapa({ semilla, lat: c.lat, lon: c.lon + desplazaLon, tramoM: TRAMO_M });
  for (const celda of celdas) await abreCelda(mapa, celda, { consultaOsm: consulta });
  return { mapa, consulta };
}

/** Todos los nombres de fantasía de una celda, por familia y aplanados. */
function nombresDe(registro) {
  return Object.values(nombresDelMundo(registro.mundo)).flat();
}

/** Los nombres repetidos de una lista, cada uno una vez. */
function repetidos(nombres) {
  return [...new Set(nombres.filter((n, i) => nombres.indexOf(n) !== i))];
}

describe('Los nombres no chocan entre celdas vecinas', () => {
  test('No hay dos nombres iguales en un mundo', async () => {
    // El escenario de la batería, afirmado ahora sobre **un mapa con varias celdas** y
    // no sobre un mundo generado de una vez, que es lo que esta fila estrena.
    const { mapa } = await mapaCon(TRES_CONTIGUAS);
    assert.equal(celdasAbiertas(mapa).length, 3);

    const todos = celdasAbiertas(mapa).flatMap(nombresDe);
    assert.ok(todos.length >= 70, `tres celdas del mismo extracto tenían que nombrar setenta y tantos sitios y han nombrado ${todos.length}`);
    assert.deepEqual(repetidos(todos), [], 'dos sitios del mismo mapa se llaman igual');

    // Y celda a celda, que es la afirmación de siempre: dentro de una, tampoco.
    for (const celda of celdasAbiertas(mapa)) {
      assert.deepEqual(repetidos(nombresDe(celda)), [], `la celda ${celda.clave} repite un nombre dentro de sí misma`);
    }

    // El índice del mapa lo ha comprobado al registrarlas, y sabe de quién es cada uno.
    assert.equal(mapa.nombres.todos().length, todos.length, 'el índice del mapa no ha visto todos los nombres');
    for (const celda of celdasAbiertas(mapa)) {
      for (const nombre of nombresDe(celda)) {
        assert.equal(mapa.nombres.celdaDe(nombre), celda.clave, `el índice cree que "${nombre}" es de otra celda`);
      }
    }
  });

  test('Dos celdas contiguas no repiten ningún nombre aunque se generen sin conocerse', async () => {
    // Cada celda se genera en su propio mapa, sin que ninguna vea a la otra: la unicidad
    // **no depende de consultar al vecino**, que es la decisión entera de esta fila.
    const sola = await mapaCon([{ i: 0, j: 0 }]);
    const laVecina = await mapaCon([{ i: 1, j: 0 }]);
    assert.equal(sola.mapa.id, laVecina.mapa.id, 'las dos celdas tienen que ser del mismo mapa para que la unicidad sea exigible');

    const unos = nombresDe(sola.mapa.celdas[0]);
    const otros = nombresDe(laVecina.mapa.celdas[0]);
    assert.ok(unos.length > 0 && otros.length > 0, 'alguna de las dos celdas no ha nombrado nada');
    assert.deepEqual(unos.filter((n) => otros.includes(n)), [], 'dos celdas generadas por separado se han puesto de acuerdo en un nombre');
  });

  test('Una celda es idéntica byte a byte con vecinas abiertas y sin ninguna', async () => {
    // La propiedad que impide que el determinismo dependa del itinerario: quien va al
    // norte y quien va al sur tienen exactamente la misma celda de casa.
    const sola = await mapaCon([{ i: 0, j: 0 }]);
    const documento = textoDeCelda(sola.mapa.celdas[0]);
    assert.equal(Buffer.byteLength(documento, 'utf8'), 282996, 'el documento de la celda del anclaje ha cambiado de tamaño: el número es el medido, no un criterio');

    for (const orden of [[{ i: 1, j: 0 }, { i: 0, j: 1 }, { i: 0, j: 0 }], [{ i: 0, j: 0 }, { i: 1, j: 0 }, { i: 0, j: 1 }]]) {
      const { mapa } = await mapaCon(orden);
      const propia = mapa.celdas.find((c) => c.clave === '0,0');
      assert.equal(textoDeCelda(propia), documento, `abriendo en el orden ${orden.map((c) => `${c.i},${c.j}`).join(' → ')} la celda del anclaje sale distinta`);
    }
  });

  test('Dos mapas distintos de la misma partida sí pueden repetir nombres', async () => {
    // La unicidad es **por mapa** y no por partida, igual que el índice: dos mapas nunca
    // se ven juntos, y exigir unicidad global agotaría el repertorio por un problema que
    // nadie tiene.
    const uno = await mapaCon([{ i: 0, j: 0 }]);
    const otro = await mapaCon([{ i: 0, j: 0 }], { desplazaLon: 0.5 });
    assert.notEqual(uno.mapa.id, otro.mapa.id);

    const suyos = nombresDe(uno.mapa.celdas[0]);
    const ajenos = nombresDe(otro.mapa.celdas[0]);
    const comunes = suyos.filter((n) => ajenos.includes(n));
    assert.ok(comunes.length >= 1, 'los dos mapas no comparten ni un nombre: el caso no demostraría que se permite');

    // Y ninguno de los dos índices sabe nada del otro, que es lo que lo hace legítimo.
    for (const nombre of comunes) {
      assert.equal(uno.mapa.nombres.celdaDe(nombre), '0,0');
      assert.equal(otro.mapa.nombres.celdaDe(nombre), '0,0');
    }
    // El corte del reparto es distinto en cada mapa, y por eso el mismo nombre puede
    // caer en la porción de la celda del anclaje de los dos.
    const distintos = suyos.filter((n) => porcionDeNombre(SEMILLA_A, uno.mapa.id, n) !== porcionDeNombre(SEMILLA_A, otro.mapa.id, n));
    assert.ok(distintos.length > 0, 'los dos mapas reparten su repertorio exactamente igual');
  });
});

describe('El reparto, que no le pregunta nada a nadie', () => {
  test('El reparto de una celda sale de la semilla, del mapa y del índice, y de nada más', () => {
    const mapaId = '42.40,-8.81';
    const celda = { i: 1, j: 0 };
    const una = repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda });
    const otra = repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda });
    assert.equal(una.porcion, otra.porcion, 'dos repartos de la misma celda no dan la misma porción');
    assert.equal(una.clave, '1,0');
    assert.equal(una.porciones, PORCIONES_DE_REPERTORIO);

    // Ningún nombre es de dos celdas a la vez: la porción es disjunta por construcción.
    const nombres = Array.from({ length: 400 }, (_, k) => `Sitio ${k}`);
    for (const nombre of nombres) {
      const duenos = TRES_CONTIGUAS.filter((c) => repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda: c }).acepta(nombre));
      assert.ok(duenos.length <= 1, `"${nombre}" es del repertorio libre de ${duenos.length} celdas a la vez`);
    }

    // Sin semilla o sin mapa no hay reparto que valga: fallan nombrando lo que falta.
    assert.throws(() => repartoDeCelda({ mapaId, celda }), /semilla/);
    assert.throws(() => repartoDeCelda({ semilla: SEMILLA_A, celda }), /identificador del mapa/);
    assert.throws(() => repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda: { i: 0.5, j: 0 } }), /índice de celda mal formado/);
  });

  test('Las celdas de más allá del reparto libre nombran siempre construyendo, y se declara', () => {
    const mapaId = '42.40,-8.81';
    const conRepertorio = repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda: { i: 0, j: 0 } });
    assert.equal(conRepertorio.ordinal, 0, 'la celda del anclaje es la primera del reparto');
    assert.equal(conRepertorio.libre, true);

    // La 4,0 está en el quinto anillo por ordinal y ya no tiene porción libre.
    const lejana = repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda: { i: 4, j: 0 } });
    assert.ok(lejana.ordinal >= CELDAS_CON_REPERTORIO_LIBRE, 'la celda lejana de la prueba todavía tiene repertorio libre');
    assert.equal(lejana.libre, false, 'una celda de más allá del reparto se declara sin repertorio libre');
    assert.equal(lejana.acepta('Fonte Vella'), false, 'una celda sin repertorio libre acepta un nombre del repertorio');
    assert.equal(lejana.porcion, null);

    // El ordinal es una biyección: ninguna celda comparte el suyo con otra.
    const vistos = new Set();
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const ordinal = ordinalDeCelda({ i, j });
        assert.ok(!vistos.has(ordinal), `las celdas comparten el ordinal ${ordinal}`);
        vistos.add(ordinal);
      }
    }
  });

  test('Las series de desempate de dos celdas no comparten un solo número', () => {
    const series = [0, 1, 2, 7, 14].map((ordinal) => new Set(Array.from({ length: 20 }, (_, k) => desempateDeCelda(ordinal, k))));
    for (let a = 0; a < series.length; a++) {
      for (let b = a + 1; b < series.length; b++) {
        const comunes = [...series[a]].filter((n) => series[b].has(n));
        assert.deepEqual(comunes, [], `dos celdas construyen el mismo desempate: ${comunes.join(', ')}`);
      }
    }
    // El primero de cada celda crece despacio: el número se gasta en encadenar epítetos
    // y uno grande sería un rótulo ilegible.
    assert.equal(desempateDeCelda(3, 0), 6);
    assert.throws(() => desempateDeCelda(0, TOPE_DE_DESEMPATES), new RegExp(String(TOPE_DE_DESEMPATES)));
  });
});

describe('El agotamiento del reparto tiene salida declarada', () => {
  /** Un nombre cuya porción en este mapa es la que se le pida. */
  const nombreDePorcion = (mapaId, cumple) => {
    for (let k = 0; k < 4000; k++) {
      const candidato = `Candidato ${k}`;
      if (cumple(porcionDeNombre(SEMILLA_A, mapaId, candidato))) return candidato;
    }
    throw new Error('no se ha encontrado ningún nombre de la porción pedida: la prueba no mediría nada');
  };

  test('Cuando el reparto se agota se cae a la forma construida y no a un nombre repetido', () => {
    const mapaId = '42.40,-8.81';
    const reparto = repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda: { i: 0, j: 0 } });
    const indice = crearIndiceDeNombres({ reparto, idioma: 'gl' });

    // El sorteo devuelve siempre el mismo nombre, que además no es de esta celda: es el
    // agotamiento, dicho de la manera más dura que hay.
    const base = nombreDePorcion(mapaId, (p) => p !== reparto.porcion);
    const nombre = indice.fija(() => base, (b, n) => `${b} ${n}`, 8, 'un núcleo');

    assert.notEqual(nombre, base, 'un nombre que no es de esta celda se ha adoptado tal cual');
    assert.ok(nombre.startsWith(base), 'la forma construida no se construye sobre el nombre sorteado');
    assert.equal(reparto.aceptaConstruido(nombre), true, 'la forma construida no ha caído en la zona que no es de nadie');
    assert.ok(porcionDeNombre(SEMILLA_A, mapaId, nombre) >= PORCION_DE_LAS_FORMAS_CONSTRUIDAS);

    // Y el segundo elemento que cae sobre la misma base construye otro, nunca el mismo.
    const otro = indice.fija(() => base, (b, n) => `${b} ${n}`, 8, 'otro núcleo');
    assert.notEqual(otro, nombre, 'dos elementos de la misma celda han acabado con el mismo nombre');
  });

  test('Cuando la forma construida también colisiona se falla nombrando el paquete y el elemento', () => {
    const mapaId = '42.40,-8.81';
    const reparto = repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda: { i: 0, j: 0 } });
    const indice = crearIndiceDeNombres({ reparto, idioma: 'gl' });

    // Una desambiguación rota: construye siempre lo mismo, y encima en la porción libre
    // de otra celda. Repetirlo en silencio es exactamente lo que no puede pasar.
    const fijo = nombreDePorcion(mapaId, (p) => p < PORCION_DE_LAS_FORMAS_CONSTRUIDAS);
    assert.throws(
      () => indice.fija(() => 'Lo Que Sea', () => fijo, 8, 'un paraje'),
      (e) => e.message.includes('"gl"') && e.message.includes('un paraje') && /celda 0,0/.test(e.message),
      'el fallo tiene que nombrar el paquete de idioma, el elemento y la celda, en vez de repetir un nombre',
    );
  });

  test('Sin reparto el índice de nombres se comporta exactamente como antes', () => {
    // Es como lo usan las herramientas y los mundos sueltos, y tenía que seguir valiendo.
    const indice = crearIndiceDeNombres();
    assert.equal(indice.reparto(), null);
    assert.equal(indice.fija(() => 'Fonte Vella', (b, n) => `${b} ${n}`, 8, 'un núcleo'), 'Fonte Vella');
    assert.equal(indice.fija(() => 'Fonte Vella', (b, n) => `${b} ${n}`, 8, 'otro núcleo'), 'Fonte Vella 0');
    assert.equal(indice.tomado('Fonte Vella'), true);

    // Y un reparto que no sabe decir qué nombres son suyos no se acepta.
    assert.throws(() => crearIndiceDeNombres({ reparto: {} }), /acepta\(nombre\)/);
  });
});

describe('El índice de nombres de un mapa comprueba, y ya no produce', () => {
  const mapaId = '42.40,-8.81';
  const nuevo = () => crearIndiceDeMapa({ semilla: SEMILLA_A, mapaId, reparto: repartoDeCelda });

  test('Dos celdas que dicen el mismo nombre se cazan al registrarlas', () => {
    const indice = nuevo();
    const suyoDeLaPrimera = (() => {
      const reparto = repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda: { i: 0, j: 0 } });
      for (let k = 0; k < 4000; k++) if (reparto.acepta(`Candidato ${k}`)) return `Candidato ${k}`;
      throw new Error('no se ha encontrado ningún nombre de la porción de la celda del anclaje');
    })();

    indice.registra({ i: 0, j: 0 }, { nucleo: [suyoDeLaPrimera] });
    assert.equal(indice.celdaDe(suyoDeLaPrimera), '0,0');

    // La vecina dice el mismo nombre: es un reparto roto, y se dice nombrando las dos
    // celdas en lugar de dejar dos «Casal da Colmea» en el mismo mapa.
    assert.throws(
      () => indice.registra({ i: 1, j: 0 }, { nucleo: [suyoDeLaPrimera] }),
      (e) => e.message.includes(suyoDeLaPrimera) && e.message.includes('0,0') && e.message.includes('1,0'),
    );

    // Y un nombre que no es de la porción de quien lo dice tampoco pasa: podría aparecer
    // también en otra celda, y entonces la unicidad dejaría de estar garantizada.
    const ajeno = (() => {
      const reparto = repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda: { i: 0, j: 1 } });
      for (let k = 0; k < 4000; k++) if (!reparto.acepta(`Ajeno ${k}`) && !reparto.aceptaConstruido(`Ajeno ${k}`)) return `Ajeno ${k}`;
      throw new Error('no se ha encontrado ningún nombre de fuera del reparto');
    })();
    assert.throws(() => nuevo().registra({ i: 0, j: 1 }, { nucleo: [ajeno] }), /no es de su porción/);

    // Un nombre vacío se dice con la familia y la celda, en vez de anotarse.
    assert.throws(() => nuevo().registra({ i: 0, j: 0 }, { nucleo: [''] }), /celda 0,0/);
  });

  test('El índice de un mapa vuelve entero de su documento y abrir una celda más sigue sin repetir', async () => {
    const { mapa } = await mapaCon(TRES_CONTIGUAS);
    const doc = JSON.parse(JSON.stringify(mapa.nombres.congela()));
    assert.deepEqual(Object.keys(doc.celdas).sort(), ['0,0', '0,1', '1,0'], 'el índice serializado no trae las tres celdas');

    const vuelto = levantaIndiceDeMapa(doc, { semilla: SEMILLA_A, mapaId: mapa.id, reparto: repartoDeCelda });
    assert.deepEqual(vuelto.todos(), mapa.nombres.todos(), 'el índice no vuelve entero de su documento');
    assert.equal(JSON.stringify(vuelto.congela()), JSON.stringify(doc), 'el índice levantado no se vuelve a escribir igual');

    // Y una celda más sobre el índice cargado sigue sin repetir ninguno.
    const cuarta = await mapaCon([{ i: 1, j: 1 }]);
    const suyos = nombresDe(cuarta.mapa.celdas[0]);
    vuelto.registra({ i: 1, j: 1 }, { nucleo: suyos });
    assert.deepEqual(vuelto.todos().filter((n, i, todos) => todos.indexOf(n) !== i), [], 'la cuarta celda ha repetido un nombre del índice cargado');

    // Un documento guardado con dos celdas diciendo lo mismo es un reparto roto, y se
    // dice al abrirlo en lugar de arrastrarlo.
    const roto = { mapaId: mapa.id, celdas: { ...doc.celdas, '2,0': [doc.celdas['0,0'][0]] } };
    assert.throws(() => levantaIndiceDeMapa(roto, { semilla: SEMILLA_A, mapaId: mapa.id, reparto: repartoDeCelda }), /dos sitios llamados/);
  });

  test('Registrar dos veces la misma celda no la duplica', () => {
    const indice = nuevo();
    const reparto = repartoDeCelda({ semilla: SEMILLA_A, mapaId, celda: { i: 0, j: 0 } });
    const suyo = (() => {
      for (let k = 0; k < 4000; k++) if (reparto.acepta(`Candidato ${k}`)) return `Candidato ${k}`;
      throw new Error('sin nombre de la porción no hay caso');
    })();
    indice.registra({ i: 0, j: 0 }, { nucleo: [suyo] });
    assert.equal(indice.comprobada({ i: 0, j: 0 }), true);
    assert.deepEqual(indice.registra({ i: 0, j: 0 }, { nucleo: [suyo] }), [suyo], 'volver a registrar la celda la ha duplicado');
    assert.deepEqual(indice.todos(), [suyo]);

    // Y sin saber cómo se levanta el reparto de una celda no puede comprobar nada.
    assert.throws(() => crearIndiceDeMapa({ semilla: SEMILLA_A, mapaId }), /reparto/);
  });

  test('Un mapa de Galicia y otro del interior nombran cada uno con su paquete, celda a celda', async () => {
    const gallego = await mapaCon([{ i: 0, j: 0 }, { i: 1, j: 0 }], { nombre: 'costero' });
    const castellano = await mapaCon([{ i: 0, j: 0 }, { i: 1, j: 0 }], { nombre: 'urbano-denso' });

    for (const [mapa, idioma] of [[gallego.mapa, 'gl'], [castellano.mapa, 'es']]) {
      assert.equal(mapa.idioma, idioma, `el mapa de ${idioma} no declara su idioma`);
      for (const celda of celdasAbiertas(mapa)) {
        assert.equal(localeFor(celda.centro.lat, celda.centro.lon), idioma, `la celda ${celda.clave} sale de otro paquete de idioma`);
        assert.equal(celda.mundo.locale, idioma, `la celda ${celda.clave} se ha generado con otro paquete`);
      }
    }
  });
});
