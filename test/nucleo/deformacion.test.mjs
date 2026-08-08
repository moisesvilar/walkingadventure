// SPEC-012 · La escalera de deformación: sus cuatro peldaños, el nivel que
// corresponde a unos saltos dados, la penalización de `fallback` frente a `cosida`,
// y la invariante de la que cuelga toda la fila — **el signo moral no se invierte**.
//
// Esa invariante se afirma aquí **sin ningún LLM delante**, y es exactamente lo que
// la spec hizo posible al dejar el signo fuera de los ejes de deformación: la
// deformación es una función sobre hechos estructurados, así que comprobar que el
// signo sobrevive es comparar dos cadenas y no leer prosa. Con la versión guardada
// como texto, esta característica de la batería solo se podría comprobar con un
// narrador delante, que es justo lo que `@nucleo` no puede tener.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás
// van declarados como huecos de la batería en test/spec-test-map.json.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../../packages/nucleo/core/rng.js';
import {
  CLAVES_DE_DETALLE,
  EJES_DEFORMABLES,
  FACTOR_DE_ABULTAMIENTO,
  IDS_DE_NIVEL,
  IDS_DE_SIGNO,
  NIVELES,
  NIVEL_MAXIMO,
  SIGNOS,
  compruebaElSigno,
  cruzaElMonte,
  deforma,
  exigeHechos,
  exigeNivel,
  exigeSigno,
  hechosFieles,
  nombreDeNivel,
  nivelDeSaltos,
} from '../../packages/nucleo/partida/deformacion.js';
import { SUPOSICIONES } from '../../packages/nucleo/world/grafo.js';
import { fuente } from './mundo-de-prueba.mjs';
import { codigoDe } from './rumor-de-prueba.mjs';

/** El módulo que entrega la escalera. Se inspecciona como texto en dos pruebas. */
const MODULO = 'packages/nucleo/partida/deformacion.js';

/** Unos hechos fieles de referencia, con los tres detalles declarados. */
function hechosDe({ asunto = 'paquete-entregado', veces = 1, con = 'herrero', lugar = 'Monfrida', motivo = 'encargo-de-la-taberna' } = {}) {
  return hechosFieles({ asunto, escala: { veces }, detalle: { con, lugar, motivo } });
}

/** El azar de un núcleo concreto: sembrado, nunca `Math.random`. */
const azar = (sufijo) => makeRng(`deformacion-de-prueba:${sufijo}`);


describe('La escalera de cuatro niveles', () => {
  test('La escalera tiene exactamente cuatro peldaños con nombre', () => {
    assert.equal(NIVELES.length, 4);
    assert.deepEqual(IDS_DE_NIVEL, ['fiel', 'abultado', 'trastocado', 'leyenda']);
    assert.deepEqual(NIVELES.map((n) => n.nivel), [0, 1, 2, 3], 'los peldaños tienen que ir de cero a tres, sin huecos');
    assert.equal(NIVEL_MAXIMO, 3);
    for (let n = 0; n <= NIVEL_MAXIMO; n++) assert.equal(nombreDeNivel(n), IDS_DE_NIVEL[n]);
  });

  test('Entre dos niveles no hay ningún valor intermedio', () => {
    // Enumerada y no continua: de la escalera cuelgan textos con fallback de
    // plantilla, y un 1,5 no tendría ninguno.
    for (const intermedio of [0.5, 1.5, 2.5, 2.999]) {
      assert.throws(() => exigeNivel(intermedio), (e) => e instanceof Error && e.message.includes(String(intermedio)));
    }
  });

  test('Un nivel fuera del rango de cero a tres falla nombrando el valor recibido', () => {
    for (const malo of [-1, 4, 10, '2', null, undefined, NaN]) {
      assert.throws(
        () => deforma({ hechos: hechosDe(), signo: SIGNOS.BUENO, nivel: malo, rng: azar('x') }),
        (e) => e instanceof Error && e.message.includes(JSON.stringify(malo) ?? String(malo)),
        `el nivel ${JSON.stringify(malo)} debería fallar nombrando lo que llegó`,
      );
    }
  });

  test('El nivel 1 cambia la escala de lo ocurrido', () => {
    const fieles = hechosDe({ veces: 1 });
    const v = deforma({ hechos: fieles, signo: SIGNOS.BUENO, nivel: 1, rng: azar('n1') });
    assert.equal(v.hechos.escala.veces, FACTOR_DE_ABULTAMIENTO, 'uno tiene que volverse tres');
    assert.deepEqual(v.ejes, ['escala']);
    assert.deepEqual(v.hechos.detalle, fieles.detalle, 'el nivel 1 todavía no toca el detalle');
    assert.deepEqual(v.hechos.protagonista, fieles.protagonista, 'el nivel 1 todavía no toca el protagonista');
  });

  test('El nivel 2 cambia además el detalle que importa', () => {
    const fieles = hechosDe();
    const v = deforma({ hechos: fieles, signo: SIGNOS.BUENO, nivel: 2, rng: azar('n2') });
    assert.deepEqual(v.ejes, ['escala', 'detalle']);
    assert.ok(CLAVES_DE_DETALLE.includes(v.hechos.trastocado), 'lo trastocado tiene que ser uno del catálogo cerrado: el motivo, el lugar o con quién');
    assert.notDeepEqual(v.hechos.detalle, fieles.detalle, 'en nivel 2 el detalle tiene que haber cambiado');
    // Acumulativa: el 2 lleva encima lo que hizo el 1.
    assert.equal(v.hechos.escala.veces, FACTOR_DE_ABULTAMIENTO);
  });

  test('El nivel 3 atribuye el hecho a otra persona o lo funde con un rumor viejo', () => {
    const fieles = hechosDe();
    const solo = deforma({ hechos: fieles, signo: SIGNOS.BUENO, nivel: 3, rng: azar('n3') });
    assert.deepEqual(solo.ejes, ['escala', 'detalle', 'protagonista']);
    assert.notEqual(solo.hechos.protagonista.tipo, 'jugadora', 'en leyenda el hecho ya no es de quien lo hizo');

    const viejo = {
      rumor: 'r0',
      hechos: { ...hechosDe({ asunto: 'otra-cosa' }), protagonista: { tipo: 'otro', ref: 'el ferreiro de antaño' } },
    };
    const fundido = deforma({ hechos: fieles, signo: SIGNOS.BUENO, nivel: 3, rng: azar('n3'), rumor: 'r1', nucleo: 'Monfrida', anteriores: [viejo] });
    assert.equal(fundido.hechos.fundidoCon, 'r0', 'con un rumor viejo en el núcleo, la leyenda se funde con él');
    assert.equal(fundido.hechos.protagonista.ref, 'el ferreiro de antaño');
  });

  test('El nivel 3 sin ningún rumor viejo se resuelve por atribución y no falla', () => {
    // Degradar el nivel haría que el estado de un núcleo dependiera de cuántos
    // rumores hubieran pasado antes por él, que es una dependencia de orden.
    const v = deforma({ hechos: hechosDe(), signo: SIGNOS.FEO, nivel: 3, rng: azar('sin-viejos'), anteriores: [] });
    assert.equal(v.nivel, 3, 'no se degrada a 2 por no tener con qué fundirse');
    assert.equal(v.hechos.fundidoCon, null);
    assert.deepEqual(v.hechos.protagonista, { tipo: 'otro', ref: null });
  });

  test('La escalera es acumulativa y monótona en los ejes que toca', () => {
    const fieles = hechosDe();
    const ejes = [0, 1, 2, 3].map((n) => deforma({ hechos: fieles, signo: SIGNOS.BUENO, nivel: n, rng: azar(`acum-${n}`) }).ejes);
    assert.deepEqual(ejes, [[], ['escala'], ['escala', 'detalle'], ['escala', 'detalle', 'protagonista']]);
    // Sin monotonía, «el primero lo recibe más deformado que el segundo» no sería
    // afirmable sin comparar textos, que es lo que `@nucleo` no puede hacer.
    for (let n = 1; n <= 3; n++) {
      assert.ok(ejes[n].length > ejes[n - 1].length, `el nivel ${n} tiene que llevar encima lo que hizo el ${n - 1}`);
      assert.deepEqual(ejes[n].slice(0, n - 1), ejes[n - 1]);
    }
  });

  test('En nivel 0 no hay ninguna deformación aplicada', () => {
    const fieles = hechosDe();
    const v = deforma({ hechos: fieles, signo: SIGNOS.BUENO, nivel: 0, rng: azar('n0') });
    assert.deepEqual(v.ejes, []);
    assert.deepEqual(v.hechos, { ...fieles, escala: { ...fieles.escala }, protagonista: { ...fieles.protagonista }, detalle: { ...fieles.detalle } });
  });

  test('Los ejes deformables son un catálogo cerrado y el signo no es uno de ellos', () => {
    assert.deepEqual(EJES_DEFORMABLES, ['escala', 'protagonista', 'detalle']);
    assert.ok(!EJES_DEFORMABLES.includes('signo'), 'esa ausencia es la invariante, no una convención');
    for (let n = 0; n <= NIVEL_MAXIMO; n++) {
      const v = deforma({ hechos: hechosDe(), signo: SIGNOS.BUENO, nivel: n, rng: azar(`ejes-${n}`) });
      for (const eje of v.ejes) assert.ok(EJES_DEFORMABLES.includes(eje), `"${eje}" no está en el catálogo cerrado`);
    }
  });

  test('Lo que se cuenta son hechos estructurados y un nivel, y el texto viaja aparte', () => {
    const v = deforma({ hechos: hechosDe(), signo: SIGNOS.BUENO, nivel: 2, rng: azar('sin-texto') });
    assert.deepEqual(Object.keys(v).sort(), ['ejes', 'escalon', 'hechos', 'nivel', 'signo']);
    assert.ok(!('texto' in v), 'la redacción viaja aparte y puede no existir todavía');
    assert.equal(typeof v.hechos.asunto, 'string');
    assert.equal(typeof v.nivel, 'number');
  });
});

describe('El nivel: saltos, no kilómetros', () => {
  test('La deformación cuenta saltos, no kilómetros', () => {
    // El esquema de la batería, con sus cinco filas. La de cinco saltos se lee como
    // **propiedad de la función de nivel** y no como una llegada: `quests.md` §6 dice
    // que el frente deja de viajar al entregar en nivel 3, y cuando un escenario y un
    // documento se contradicen manda el documento (`CLAUDE.md`). Que un núcleo a
    // cinco saltos no llegue a oírlo se afirma en rumores.test.mjs.
    for (const [saltos, nivel] of [[0, 0], [1, 1], [2, 2], [3, 3], [5, 3]]) {
      assert.equal(nivelDeSaltos(saltos), nivel, `${saltos} saltos por calzada real tienen que dar nivel ${nivel}`);
    }
    // El tope no se rebasa nunca, por muchos saltos que se cuenten.
    for (const saltos of [4, 5, 9, 40, 1000]) assert.equal(nivelDeSaltos(saltos), NIVEL_MAXIMO);
  });

  test('El nivel no depende de los kilómetros recorridos', () => {
    // La función no recibe metros: no hay ninguna manera de que la distancia entre
    // en el cálculo, y eso es más fuerte que comprobar dos casos.
    const cuerpo = codigoDe(fuente(MODULO).split('export function nivelDeSaltos')[1].split('\n}')[0]);
    assert.ok(!/metros|kil[óo]metro|distancia/i.test(cuerpo), 'el cálculo del nivel menciona una distancia');
    // Y dos núcleos a distancias muy distintas con los mismos saltos dan el mismo nivel.
    assert.equal(nivelDeSaltos(2, 0), nivelDeSaltos(2, 0));
  });

  test('El número de saltos tiene que ser un entero no negativo', () => {
    for (const malo of [-1, 1.5, '2', null, undefined]) {
      assert.throws(() => nivelDeSaltos(malo), (e) => e instanceof Error && e.message.includes(JSON.stringify(malo) ?? String(malo)));
    }
    // Y no puede haber más saltos penalizados que saltos: la penalización es por salto.
    assert.throws(() => nivelDeSaltos(1, 2), /no puede haber más penalizados que saltos/);
  });

  test('Un salto que cruza el monte suma un nivel sobre el salto', () => {
    // La mitad de «Cruzar un tramo sin calzada real cuesta un nivel más» que vive en
    // la función de nivel. El escenario con su nombre literal está en rumores.test.mjs,
    // donde el rumor de verdad recorre la calzada: aquí solo se afirma la aritmética.
    assert.equal(nivelDeSaltos(1, 1), 2);
    assert.equal(nivelDeSaltos(2, 1), 3);
    assert.equal(nivelDeSaltos(2, 2), 3, 'el tope sigue sin rebasarse');
    assert.ok(cruzaElMonte(SUPOSICIONES.FALLBACK), '`fallback` es ir por donde no hay camino que conozcamos');
  });

  test('Una arista cosida no penaliza y una fallback sí', () => {
    // La mitad que se pierde si alguien colapsa el enumerado en un booleano.
    assert.equal(cruzaElMonte(SUPOSICIONES.COSIDA), false, 'cruzar un hueco que OSM no trae es una carretera real que el dato no traía');
    assert.equal(cruzaElMonte(SUPOSICIONES.NINGUNA), false);
    assert.equal(cruzaElMonte(SUPOSICIONES.FALLBACK), true);
    // Y el nivel que sale de cada una, con un salto: cosida 1, fallback 2.
    assert.equal(nivelDeSaltos(1, cruzaElMonte(SUPOSICIONES.COSIDA) ? 1 : 0), 1);
    assert.equal(nivelDeSaltos(1, cruzaElMonte(SUPOSICIONES.FALLBACK) ? 1 : 0), 2);
  });

  test('Un tramo sin marca de suposición falla en lugar de pasar por calzada real', () => {
    // `null` **no** entra en esta lista y es a propósito: es `SUPOSICIONES.NINGUNA`,
    // el valor declarado de «esto es calzada real de OSM». Lo que falla es la marca
    // ausente o inventada, que es donde se colaría la suposición.
    assert.equal(SUPOSICIONES.NINGUNA, null);
    for (const malo of [undefined, '', 'supuesta', 'cosido', true, 0]) {
      assert.throws(
        () => cruzaElMonte(malo, 'el tramo 3 de "Camiño do Norte"'),
        (e) => e instanceof Error && e.message.includes('el tramo 3 de "Camiño do Norte"'),
        `la marca ${JSON.stringify(malo)} debería fallar nombrando el tramo`,
      );
    }
  });
});

describe('El signo moral no se invierte nunca', () => {
  test('La deformación no invierte el signo moral', () => {
    // La garantía central de la fila, y se afirma con números: 2 signos × 4 niveles
    // × 10 siembras × 8 formas de los hechos = **640 casos**. Cero inversiones se
    // admiten, y ninguno de los 640 pasa por un narrador.
    const formas = [
      hechosDe(),
      hechosDe({ veces: 4 }),
      hechosDe({ con: null }),
      hechosDe({ lugar: null, motivo: null }),
      hechosDe({ con: null, lugar: null }),
      hechosDe({ asunto: 'zagal-rescatado', motivo: 'desaparicion-al-alba' }),
      hechosDe({ asunto: 'culpable-senalado', veces: 12, con: 'culpable' }),
      hechosDe({ asunto: 'ronda-cumplida', con: 'vigia', lugar: 'O Paso do Demo', motivo: 'emboscada-en-o-paso' }),
    ];
    const anteriores = [{ rumor: 'r0', hechos: { ...hechosDe({ asunto: 'viejo' }), protagonista: { tipo: 'otro', ref: 'a costureira' } } }];

    let casos = 0;
    let inversiones = 0;
    for (const signo of IDS_DE_SIGNO) {
      for (let nivel = 0; nivel <= NIVEL_MAXIMO; nivel++) {
        for (let s = 0; s < 10; s++) {
          for (let f = 0; f < formas.length; f++) {
            const v = deforma({
              hechos: formas[f],
              signo,
              nivel,
              rng: azar(`${signo}:${nivel}:${s}:${f}`),
              rumor: `r-${f}`,
              nucleo: `nucleo-${s}`,
              // La mitad de las siembras con un rumor viejo con el que fundirse, para
              // que la leyenda pase por sus dos formas.
              anteriores: s % 2 === 0 ? anteriores : [],
            });
            casos += 1;
            if (v.signo !== signo) inversiones += 1;
            // Y el signo tampoco se cuela dentro de los hechos por la puerta de atrás.
            assert.ok(!JSON.stringify(v.hechos).includes('"signo"'), 'los hechos de la versión llevan un campo "signo"');
          }
        }
      }
    }
    assert.equal(casos, 640, 'la afirmación es sobre 640 casos y no sobre los que salgan');
    assert.equal(inversiones, 0, 'la deformación ha invertido el signo moral en algún caso');
  });

  test('La versión de nivel 3 de un acto bueno sigue siendo de un acto bueno', () => {
    const fieles = hechosDe({ asunto: 'zagal-rescatado' });
    const v = deforma({ hechos: fieles, signo: SIGNOS.BUENO, nivel: 3, rng: azar('bueno-3') });
    assert.equal(v.signo, SIGNOS.BUENO);
    // Pero pueden haber cambiado la escala, el protagonista o el detalle.
    assert.notEqual(v.hechos.escala.veces, fieles.escala.veces);
    assert.notDeepEqual(v.hechos.protagonista, fieles.protagonista);
    assert.ok(v.ejes.length === 3);
  });

  test('La versión de nivel 3 de un acto feo sigue siendo de un acto feo', () => {
    const v = deforma({ hechos: hechosDe({ asunto: 'promesa-rota' }), signo: SIGNOS.FEO, nivel: 3, rng: azar('feo-3') });
    assert.equal(v.signo, SIGNOS.FEO, 'la regla protege contra invertir el signo, no contra propagar lo que se hizo');
  });

  test('El signo es un enumerado cerrado de dos valores', () => {
    assert.deepEqual(IDS_DE_SIGNO, ['bueno', 'feo']);
    assert.deepEqual(Object.values(SIGNOS).sort(), IDS_DE_SIGNO);
    for (const malo of [undefined, null, '', 'neutro', 'BUENO', 0, 1, -1, true]) {
      assert.throws(
        () => exigeSigno(malo, 'el signo del desenlace'),
        (e) => e instanceof Error && e.message.includes(JSON.stringify(malo) ?? String(malo)),
        `el signo ${JSON.stringify(malo)} debería fallar nombrando lo que llegó`,
      );
    }
  });

  test('No existe ninguna operación que cambie el signo de un rumor ya nacido', () => {
    const v = deforma({ hechos: hechosDe(), signo: SIGNOS.BUENO, nivel: 2, rng: azar('inmutable') });
    // De solo lectura de verdad: la versión viene congelada y escribir encima no hace nada.
    assert.ok(Object.isFrozen(v));
    assert.throws(() => { 'use strict'; v.signo = SIGNOS.FEO; }, TypeError);
    assert.equal(v.signo, SIGNOS.BUENO);
    // Y el texto del módulo no deriva el signo de los hechos en ningún sitio.
    const texto = fuente(MODULO);
    assert.ok(!/signo\s*=\s*(?!s\b)[^;]*hechos/.test(texto), 'el signo se copia del origen y nunca se calcula');
  });

  test('Una versión con el signo cambiado se rechaza nombrando el rumor y el núcleo', () => {
    assert.throws(
      () => compruebaElSigno({ version: { signo: SIGNOS.FEO, hechos: hechosDe() }, signo: SIGNOS.BUENO, rumor: 'r7', nucleo: 'Monfrida' }),
      (e) => e instanceof Error && e.message.includes('"r7"') && e.message.includes('"Monfrida"'),
    );
  });

  test('La comprobación del signo se resuelve sobre los datos y sin red, narrador ni texto', () => {
    // Se mira el **código**, no los comentarios: el módulo nombra al narrador para
    // decir que no depende de ninguno, y castigar esa frase sería castigar la
    // convención de explicar decisiones que pide `CLAUDE.md`.
    const texto = fuente(MODULO);
    const codigo = codigoDe(texto).toLowerCase();
    for (const prohibido of ['fetch(', 'xmlhttprequest', 'websocket', 'process.env', 'narrador', 'prompt', 'llm', 'openai', 'anthropic']) {
      assert.ok(!codigo.includes(prohibido), `la escalera usa "${prohibido}": tiene que resolverse sin narrador delante`);
    }
    // Y sus dos únicas dependencias son congelar y el enumerado de marcas de SPEC-007.
    const imports = [...texto.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort();
    assert.deepEqual(imports, ['../core/congelar.js', '../world/grafo.js']);
  });
});

describe('Los hechos fieles y su forma', () => {
  test('Los hechos fieles salen de la semilla declarada por la plantilla', () => {
    const h = hechosFieles({ asunto: 'paquete-entregado', escala: { veces: 1 }, detalle: { con: 'herrero', motivo: 'encargo' } }, { lugar: 'Monfrida' });
    assert.equal(h.asunto, 'paquete-entregado');
    assert.deepEqual(h.escala, { veces: 1 });
    assert.deepEqual(h.protagonista, { tipo: 'jugadora', ref: null }, 'el protagonista fiel es siempre quien lo hizo');
    assert.deepEqual(h.detalle, { con: 'herrero', lugar: 'Monfrida', motivo: 'encargo' });
    assert.equal(h.trastocado, null);
    assert.equal(h.fundidoCon, null);
    assert.ok(Object.isFrozen(h));
  });

  test('Una semilla sin asunto o mal formada falla diciendo qué le falta', () => {
    assert.throws(() => hechosFieles(null), /se espera la semilla estructurada/);
    assert.throws(() => hechosFieles({}), /no declara "asunto"/);
    assert.throws(() => hechosFieles({ asunto: 'x', escala: { veces: 0 } }), /escala/);
    assert.throws(() => hechosFieles({ asunto: 'x', detalle: { pueblo: 'Monfrida' } }), /catálogo cerrado/);
    assert.throws(() => exigeHechos({ asunto: 'x' }), /no declaran su escala/);
  });

  test('Unos hechos que llevan el signo dentro se rechazan', () => {
    // Si el signo viviera en los hechos, una transformación podría cambiarlo sin que
    // la comprobación de la versión se enterara.
    assert.throws(() => hechosFieles({ asunto: 'x', signo: 'bueno' }), /"signo"/);
    assert.throws(() => hechosFieles({ asunto: 'x', detalle: { motivo: { signo: 'feo' } } }), /"signo"/);
  });

  test('El detalle que importa son el motivo, el lugar y con quién', () => {
    assert.deepEqual(CLAVES_DE_DETALLE, ['con', 'lugar', 'motivo']);
  });

  test('Con un solo detalle conocido el nivel 2 lo pierde en lugar de fallar', () => {
    const h = hechosFieles({ asunto: 'x', detalle: { motivo: 'el único' } }, { lugar: null });
    const v = deforma({ hechos: h, signo: SIGNOS.BUENO, nivel: 2, rng: azar('un-detalle') });
    assert.equal(v.hechos.trastocado, 'motivo');
    assert.equal(v.hechos.detalle.motivo, null, 'sin otro detalle con el que cambiarlo, se pierde');
    assert.equal(v.signo, SIGNOS.BUENO);
  });

  test('Deformar dos veces con la misma siembra da exactamente lo mismo', () => {
    const h = hechosDe();
    for (let nivel = 0; nivel <= NIVEL_MAXIMO; nivel++) {
      const a = deforma({ hechos: h, signo: SIGNOS.BUENO, nivel, rng: azar(`det-${nivel}`), nucleo: 'Monfrida' });
      const b = deforma({ hechos: h, signo: SIGNOS.BUENO, nivel, rng: azar(`det-${nivel}`), nucleo: 'Monfrida' });
      assert.equal(JSON.stringify(a), JSON.stringify(b), `el nivel ${nivel} no es reproducible con la misma siembra`);
    }
  });

  test('Los módulos de la escalera no usan azar del sistema ni el reloj', () => {
    const texto = fuente(MODULO);
    for (const prohibido of ['Math.random', 'Date.now', 'new Date']) {
      assert.ok(!texto.includes(prohibido), `la escalera usa ${prohibido}`);
    }
  });
});
