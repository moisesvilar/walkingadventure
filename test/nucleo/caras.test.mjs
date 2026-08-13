// SPEC-051 · **Los beats con cara**: la regla del sitio, las dos cláusulas que eligen qué
//            beats se dicen en voz de alguien, y lo que de ahí cuelga hasta la escena
//            compuesta y el desenlace.
//
// El área es `packages/nucleo/quests/caras.js` y no la spec: la regla del sitio la piden el
// catálogo, el casting, los recursos, el arranque, el guiado, el narrador y el desenlace, y
// atar el fichero a la fila que la escribió lo dejaría inservible a las tres iteraciones.
//
// Cinco decisiones de este fichero que no son de estilo:
//
// - **La comparación que sostiene la fila es contra el mismo catálogo sin caras.** Poner un
//   beat encima de un rol humano no puede cambiar ni un reparto, y eso no se afirma mirando
//   los números de después: se afirma casteando las dos versiones de cada plantilla sobre el
//   mismo mundo y comparando la cadena de sitios beat a beat, que es más estricto que
//   comparar el reparto. Son 120 plantillas-mundo y se comparan las 120.
// - **Las dos cláusulas se afirman por ida y vuelta, no por su resultado.** `conCaras` sobre
//   la plantilla resuelta a sus sitios tiene que devolver **exactamente** la del catálogo:
//   eso dice a la vez que las reglas eligen esos beats y que no tocan nada más —ni la
//   escena, ni el disparador, ni el resultado, ni el orden—.
// - **La tabla de los 21 va escrita a mano.** Es el resultado de aplicar las reglas al
//   catálogo de hoy y no la definición del alcance, pero un recuento sin la lista deja pasar
//   que una plantilla pierda su cara y otra gane una. Si la tabla se mueve, se mira por qué.
// - **El caso que hoy reventaba se afirma en verde y con su contraste.** `componeElDesenlace`
//   lanzaba al aplicar un acto de relación cuyo rol no puso cara en la cadena; aquí se
//   compone entero **y** se comprueba que sin la cara sigue lanzando, que es lo que separa
//   «la fila lo cerró» de «el caso no llegaba a pasar por ahí».
// - **Ni red, ni reloj, ni azar.** Los mundos salen de los fixtures congelados por el mismo
//   camino que el resto de la batería y el azar viene de la semilla.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «El casting es
// determinista», «Todo lazo casteado se cierra», «No se usa masculino genérico en fórmulas
// frecuentes», «No se usa morfología inventada», «Ningún texto depende de un número que solo
// existe en la maqueta» y «El juego habla como mundo». Lo demás va declarado como hueco de
// batería en `test/spec-test-map.json`: la batería describe qué hace el juego, y la regla del
// sitio es la mecánica con la que se cumple lo que ya describía.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { namesFor } from '../../packages/nucleo/names/index.js';
import { infraccionesDeTexto } from '../../packages/nucleo/names/lenguaje.js';
import { pasaPorNucleo } from '../../packages/nucleo/partida/arranque.js';
import { identidadDeCara } from '../../packages/nucleo/partida/npcs.js';
import { lugaresParaIlustrar, queFaltaParaJugarSinRed } from '../../packages/nucleo/partida/recursos.js';
import { SIN_OBJETOS } from '../../packages/nucleo/partida/objetos.js';
import { ROTULOS_DE_PUESTO, rotuloDePuesto } from '../../packages/nucleo/partida/puestos.js';
import { validaPlantilla } from '../../packages/nucleo/quests/aventura.js';
import { beatsConCara, conCaras, sitioDelLugar, sitioDelRol } from '../../packages/nucleo/quests/caras.js';
import { castTemplate } from '../../packages/nucleo/quests/casting.js';
import { CATALOGO, TOPES_DE_TEXTO, compruebaCatalogo } from '../../packages/nucleo/quests/catalogo.js';
import { componeElDesenlace, carasDelDesenlace, lugarDelDesenlace } from '../../packages/nucleo/quests/desenlace.js';
import {
  componeEscena,
  componeLoQueTeLlevas,
  formaDelCuerpo,
  infraccionesDeLecturaEnVozAlta,
} from '../../packages/nucleo/quests/escena.js';
import { relojDePared } from '../dobles/reloj-de-pared.mjs';
import { celdaDeFixture } from './partida-de-prueba.mjs';
import { LOS_CUATRO, fuente } from './mundo-de-prueba.mjs';

/**
 * Lo que `componeEscena` **exige** y no supone, inyectado igual en todos los casos: el minuto
 * del día para los beats de franja y la vista de tenencia para los de objeto.
 *
 * Fijos y no del reloj del sistema: un beat de franja compuesto con la hora de la máquina
 * diría una cosa por la mañana y otra por la tarde, que es exactamente lo que el paquete
 * evita al pedir el reloj inyectado.
 */
const MEDIODIA = 12 * 60;
const CONTEXTO = { reloj: relojDePared(MEDIODIA), tenencia: SIN_OBJETOS };

/** Los cuatro mundos de referencia, con su casting ya hecho. Uno por nombre y no uno por caso. */
const CELDAS = new Map();
async function mundoDeReferencia(nombre) {
  if (!CELDAS.has(nombre)) CELDAS.set(nombre, (await celdaDeFixture(nombre)).mundo);
  return CELDAS.get(nombre);
}

/** Las casteadas de un mundo de referencia, con su plantilla del catálogo al lado. */
const casteadasDe = (mundo) => (mundo.casting ?? []).filter((c) => c.ok);

/**
 * La misma plantilla **sin ninguna cara**: cada beat resuelto al sitio donde ocurre.
 *
 * Es la versión de antes de esta fila, reconstruida con la propia regla del sitio en vez de
 * escrita a mano — si se escribiera a mano, dejaría de ser la misma plantilla el día que
 * alguien tocara un beat, y la comparación pasaría a medir dos cadenas distintas.
 */
const sinCaras = (plantilla) => ({
  ...plantilla,
  beats: plantilla.beats.map((b) => ({ ...b, rol: sitioDelRol(plantilla, b.rol) })),
});

/** Dónde ocurre cada beat de una aventura casteada, por su nombre y en orden. */
const cadenaDeSitios = (c) => c.beats.map((b) => sitioDelLugar(b.lugar)?.nombre ?? null);

/**
 * Quien habla en un beat, resuelto **por la misma función pura con la que el casting resolvió
 * el rol humano**: la cara de la escena y la del reparto son la misma y no una parecida.
 *
 * Es exactamente lo que hace `app/marcha/aventura.js`. La cara viaja dentro del beat sin su
 * nombre propio —cómo se la nombra depende de si ya la has conocido— así que el nombre se pide
 * aquí, contra la misma semilla y el mismo mundo.
 */
function caraDeBeat(mundo, beat) {
  if (beat?.lugar?.tipo !== 'humano') return null;
  const suya = beat.lugar.cara;
  const identidad = identidadDeCara({ mundo, semilla: mundo.seed, idioma: namesFor(mundo.locale), sitio: suya.sitio, puesto: suya.puesto });
  return { nombre: identidad.nombre, puesto: identidad.puesto };
}

/** Los roles humanos de una plantilla, en el orden declarado. */
const humanosDe = (p) => (p.orden ?? []).filter((rid) => p.roles?.[rid]?.tipo === 'humano');

/**
 * Los 21 beats que las dos cláusulas eligen sobre el catálogo de hoy, en el orden en que
 * salen: primero la cláusula 1 —el beat que la `relacion` ya nombraba— y luego la 2 —el
 * último beat del sitio, para la cara con acto declarado que la primera dejó sin él—.
 *
 * Es el resultado de aplicar las reglas y no el alcance: si esta tabla se mueve, lo que hay
 * que mirar es si las reglas siguen diciendo lo que decían, no si la tabla está al día.
 */
const LOS_VEINTIUNO = [
  ['entrega-sospechosa', 4, 'quien_encarga'],
  ['tres-pistas', 6, 'quien_pregunta'],
  ['la-cuenta-pendiente', 3, 'quien_debe'],
  ['la-cuenta-pendiente', 4, 'quien_cobra'],
  ['el-encargo-de-la-forja', 2, 'quien_forja'],
  ['la-receta-perdida', 5, 'quien_atiende'],
  ['la-posada-sin-sitio', 4, 'quien_regenta'],
  ['el-inventario-del-mercado', 4, 'quien_pesa'],
  ['el-libro-que-no-se-presta', 2, 'quien_guarda'],
  ['la-visita-que-toca', 3, 'quien_espera'],
  ['el-relevo-de-la-guardia', 3, 'quien_falta'],
  ['el-relevo-de-la-guardia', 4, 'quien_guarda'],
  ['el-recado-que-crece', 6, 'quien_manda'],
  ['el-arreglo-de-la-fuente', 3, 'quien_forja'],
  ['la-apuesta-de-la-taberna', 4, 'quien_sirve'],
  ['el-ungüento-que-huele-mal', 4, 'quien_prepara'],
  ['la-guarida-de-nadie', 7, 'quien_manda'],
  ['la-feria-que-no-cabe', 7, 'quien_organiza'],
  ['la-vigilia-del-monasterio', 7, 'quien_cuida'],
  ['el-camino-de-la-sal', 11, 'quien_pesa'],
  ['el-refugio-de-la-tormenta', 4, 'quien_avisa'],
];

// ── La regla del sitio ─────────────────────────────────────────────────────────

describe('Un beat sobre un rol humano ocurre donde esa persona trabaja', () => {
  test('El sitio de un rol es el propio rol, y el sitio donde trabaja cuando el rol es humano', () => {
    const plantilla = {
      id: 'de-laboratorio',
      roles: {
        taberna: { tipo: 'servicio', kind: 'taberna' },
        quien_sirve: { tipo: 'humano', en: 'taberna', puesto: 'sala' },
        cima: { tipo: 'paraje', escena: 'vigilancia' },
      },
    };
    assert.equal(sitioDelRol(plantilla, 'taberna'), 'taberna');
    assert.equal(sitioDelRol(plantilla, 'cima'), 'cima');
    assert.equal(sitioDelRol(plantilla, 'quien_sirve'), 'taberna', 'la cara no ocurre en el sitio donde trabaja');

    // Un rol que la plantilla no declara falla **nombrando la plantilla y el rol**: es un
    // error de construcción y no un motivo del catálogo, y decirlo aquí es lo que evita que
    // la avería salga tres capas más allá como un `TypeError` del recorrido.
    assert.throws(() => sitioDelRol(plantilla, 'nadie'), (e) => /de-laboratorio/.test(e.message) && /nadie/.test(e.message));
  });

  test('El sitio de un lugar casteado es el propio lugar, y el portal donde trabaja cuando es una cara', () => {
    const taberna = { tipo: 'servicio', nombre: 'A Cunca Torta', x: 10, y: 20 };
    const cara = { tipo: 'humano', nombre: 'A Cunca Torta', x: 10, y: 20, trabajaEn: taberna };
    assert.equal(sitioDelLugar(taberna), taberna, 'un lugar de sitio se ha resuelto a otra cosa');
    assert.equal(sitioDelLugar(cara), taberna, 'una cara no se resuelve al portal donde trabaja');
    assert.equal(sitioDelLugar(null), null);
    assert.equal(sitioDelLugar(undefined), null);
  });

  test('Un rol humano que dice trabajar donde no hay rol de sitio falla nombrando plantilla, rol y sitio', () => {
    // **El lugar existe cuando las reglas se comprueban.** Hasta esta fila el sitio de un rol
    // humano se buscaba al final del reparto, así que durante todo el backtracking su lugar
    // no existía: el chequeo de trecho y el del lazo se lo saltaban en silencio y la avería
    // salía como `TypeError` desde el cálculo del recorrido. Ahora se exige al validar.
    const rota = {
      id: 'la-que-cuelga-de-la-nada',
      titulo: 'x',
      tamano: 'paseo',
      orden: ['origen', 'quien_manda'],
      roles: {
        origen: { tipo: 'nucleo', types: ['pueblo'] },
        quien_manda: { tipo: 'humano', en: 'no-existe', puesto: 'regencia' },
      },
      beats: [{ rol: 'origen', escena: 'encargo', texto: 'x', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } }],
    };
    assert.throws(
      () => validaPlantilla(rota),
      (e) => /la-que-cuelga-de-la-nada/.test(e.message) && /quien_manda/.test(e.message) && /no-existe/.test(e.message),
      'un rol humano colgado de la nada no falla nombrando la plantilla, el rol y el sitio que dice ser el suyo',
    );
  });

  test('Ninguna comprobación del casting se salta un beat humano por no encontrar su lugar', async () => {
    // **La medida que originó el criterio, puesta en verde.** Sobre las 20 plantillas con rol
    // humano por los cuatro mundos de referencia, resolver el lugar después del backtracking
    // daba **70 excepciones** —`TypeError: Cannot read properties of undefined` desde
    // `recorridoDe`—, y no un motivo. Aquí ninguna lanza: o castean, o traen motivo
    // estructurado. Una comprobación que al no poder correr no protesta es §6h en versión
    // validación, y esto es lo que la pone roja si vuelve.
    const conRolHumano = CATALOGO.filter((p) => humanosDe(p).length > 0);
    assert.equal(conRolHumano.length, 20, `${conRolHumano.length} plantillas declaran rol humano y se midieron 20`);

    let mirados = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const plantilla of conRolHumano) {
        const c = castTemplate(mundo, plantilla);
        mirados += 1;
        if (c.ok) {
          // Cada beat trae su lugar resuelto, también los humanos: el sitio existe y es el
          // que el rol de sitio asignó, así que trecho, lazo y recorrido lo pudieron medir.
          for (const b of c.beats) {
            const sitio = sitioDelLugar(b.lugar);
            assert.ok(sitio?.nombre, `${nombre} · ${plantilla.id} beat ${b.n}: el beat no dice en qué sitio ocurre`);
            assert.equal(sitio, c.asignacion[sitioDelRol(plantilla, b.rol)], `${nombre} · ${plantilla.id} beat ${b.n}: el sitio del beat no es el que su rol de sitio asignó`);
          }
        } else {
          assert.ok(c.motivo?.clave, `${nombre} · ${plantilla.id}: no castea y no explica por qué`);
        }
      }
    }
    assert.equal(mirados, 80, `se han mirado ${mirados} plantillas-mundo con rol humano y son 20 × 4`);
  });

  test('Dos roles humanos del mismo sitio caen en el mismo lugar y eso no impide castear', async () => {
    // Es el pendiente 1 de `game-design/npcs.md`, ratificado: dos caras del mismo sitio son
    // el mismo lugar. Si contaran como dos lugares distintos, la regla que impide que dos
    // roles compartan sitio las tumbaría — y una aventura mandaría dos veces al mismo portal
    // disfrazando el segundo viaje de persona distinta.
    const mundo = await mundoDeReferencia('costero');
    const dos = {
      id: 'dos-caras-del-mismo-portal',
      titulo: 'x',
      tamano: 'paseo',
      orden: ['posada', 'quien_regenta', 'quien_limpia', 'cima', 'lejos'],
      roles: {
        posada: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad', 'granja'] },
        quien_regenta: { tipo: 'humano', en: 'posada', puesto: 'regencia' },
        quien_limpia: { tipo: 'humano', en: 'posada', puesto: 'vecindad' },
        cima: { tipo: 'paraje', escena: 'vigilancia' },
        lejos: { tipo: 'paraje', escena: 'encuentro' },
      },
      beats: [
        { rol: 'quien_regenta', escena: 'encargo', texto: 'x', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
        { rol: 'cima', escena: 'vigilancia', texto: 'x', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
        { rol: 'lejos', escena: 'encuentro', texto: 'x', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
        { rol: 'quien_limpia', escena: 'recompensa', texto: 'x', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      ],
    };

    const c = castTemplate(mundo, dos);
    assert.equal(c.ok, true, `dos caras del mismo portal no castean: ${c.motivo?.clave}`);
    assert.equal(c.asignacion.quien_regenta.trabajaEn, c.asignacion.posada, 'la primera cara no cuelga del sitio');
    assert.equal(c.asignacion.quien_limpia.trabajaEn, c.asignacion.posada, 'la segunda cara no cuelga del mismo sitio');
    assert.equal(sitioDelLugar(c.beats[0].lugar), sitioDelLugar(c.beats[3].lugar), 'las dos caras no caen en el mismo lugar');
    // Y son dos caras distintas: el mismo portal, dos personas.
    assert.notDeepEqual(c.asignacion.quien_regenta.cara, c.asignacion.quien_limpia.cara, 'las dos caras del portal son la misma persona');
  });

  test('Un beat pegado al beat de su propio sitio no cae en trecho-por-debajo-del-minimo', async () => {
    // El par «la cara y su portal» queda exento igual que dos beats sobre el mismo rol: el
    // trecho es cero porque **es el mismo sitio**, no porque se haya hecho una excepción para
    // el caso humano. La contraprueba es la de al lado: dos sitios distintos sí se miden.
    const mundo = await mundoDeReferencia('costero');
    const pegados = {
      id: 'la-cara-y-su-portal',
      titulo: 'x',
      tamano: 'paseo',
      orden: ['taberna', 'quien_sirve', 'cima', 'lejos'],
      roles: {
        taberna: { tipo: 'nucleo', types: ['pueblo', 'aldea', 'ciudad', 'granja'] },
        quien_sirve: { tipo: 'humano', en: 'taberna', puesto: 'regencia' },
        cima: { tipo: 'paraje', escena: 'vigilancia' },
        lejos: { tipo: 'paraje', escena: 'encuentro' },
      },
      beats: [
        { rol: 'taberna', escena: 'encargo', texto: 'x', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
        { rol: 'quien_sirve', escena: 'trato', texto: 'x', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
        { rol: 'cima', escena: 'vigilancia', texto: 'x', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
        { rol: 'lejos', escena: 'encuentro', texto: 'x', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
      ],
    };

    const c = castTemplate(mundo, pegados);
    assert.equal(c.ok, true, `un beat pegado al de su propio sitio no castea: ${c.motivo?.clave}`);
    assert.notEqual(c.motivo?.clave, 'trecho-por-debajo-del-minimo');
    // El trecho entre los dos cuenta como cero: el recorrido no crece por poner la cara
    // encima, y el guiado del segundo no dibuja ni un metro de calzada.
    assert.deepEqual(c.beats[1].guiado.calzadas, [], 'se dibuja calzada entre una cara y el portal donde trabaja');

    // Y la misma plantilla sin la cara —el beat 2 sobre el propio sitio— da el mismo
    // presupuesto: es lo que dice que el trecho es cero por el sitio y no por una excepción.
    const sinLaCara = castTemplate(mundo, sinCaras(pegados));
    assert.equal(sinLaCara.ok, true);
    assert.deepEqual(c.presupuesto, sinLaCara.presupuesto, 'poner la cara encima ha cambiado el presupuesto del recorrido');
  });

  test('Todo lazo casteado se cierra', async () => {
    // El escenario de la batería, por el lado que esta fila mueve: doce plantillas terminan
    // sobre la cara del sitio donde abrieron, y el lazo cierra en la misma puerta. Se compara
    // **dónde ocurre** cada beat y no la identidad del lugar que lo firma.
    let conCaraAlFinal = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const c of casteadasDe(mundo)) {
        const beats = c.aventura.beats;
        const primero = sitioDelLugar(beats[0].lugar);
        const ultimo = sitioDelLugar(beats[beats.length - 1].lugar);
        assert.ok(primero?.nombre && ultimo?.nombre, `${nombre} · ${c.plantilla}: un extremo del lazo no dice dónde ocurre`);
        if (beats[beats.length - 1].lugar?.tipo === 'humano') conCaraAlFinal += 1;
        assert.ok(
          primero === ultimo || primero.tipo === ultimo.tipo,
          `${nombre} · ${c.plantilla}: el lazo abre en "${primero.nombre}" y cierra en "${ultimo.nombre}", que no comparten ni sitio ni tipo`,
        );
      }
    }
    assert.ok(conCaraAlFinal > 0, 'ninguna aventura de los cuatro mundos termina sobre una cara: el caso no mide lo que dice');
  });
});

// ── Las dos cláusulas ──────────────────────────────────────────────────────────

describe('Los beats que ganan cara salen de dos reglas del catálogo', () => {
  test('Las dos cláusulas eligen los veintiún beats medidos, en diecinueve plantillas', () => {
    const elegidos = CATALOGO.flatMap((p) => beatsConCara(sinCaras(p)).map((e) => [p.id, e.beat, e.rol]));
    assert.deepEqual(
      [...elegidos].sort(),
      [...LOS_VEINTIUNO].sort(),
      'las dos cláusulas ya no eligen los 21 beats medidos: si las reglas cambiaron, se mira por qué antes de tocar la tabla',
    );
    assert.equal(elegidos.length, 21);
    assert.equal(new Set(elegidos.map(([id]) => id)).size, 19, 'los 21 beats no se reparten en 19 plantillas');
  });

  test('Poner las caras no toca ni la escena, ni el disparador, ni el resultado, ni el orden', () => {
    // Ida y vuelta: la plantilla del catálogo resuelta a sus sitios y vuelta a pasar por las
    // dos cláusulas tiene que dar **exactamente** la del catálogo. Es lo que afirma a la vez
    // que las reglas eligen esos beats y que lo único que cambia es sobre qué rol cae cada uno.
    for (const p of CATALOGO) {
      assert.deepEqual(conCaras(sinCaras(p)), p, `"${p.id}" no sale igual al aplicarle las dos cláusulas desde su versión sin caras`);
      for (const [i, b] of p.beats.entries()) {
        const antes = sinCaras(p).beats[i];
        assert.deepEqual({ ...b, rol: null }, { ...antes, rol: null }, `"${p.id}" beat ${i + 1}: poner la cara ha movido algo que no es el rol`);
      }
    }
  });

  test('Las dos cláusulas eligen los mismos beats en dos pasadas, y son idempotentes', () => {
    // `@determinismo`, bloqueante, por el lado de las cláusulas: aplicarlas dos veces sobre
    // las mismas plantillas elige los mismos beats. Recorren `plantilla.orden` y la lista de
    // beats escrita, nunca una iteración de orden libre, y por eso «el último beat de su
    // sitio» es el mismo siempre.
    for (const p of CATALOGO) {
      assert.deepEqual(beatsConCara(p), beatsConCara(p), `"${p.id}" elige beats distintos en dos pasadas`);
      // Y es idempotente: sobre la plantilla que ya tiene sus caras puestas elige lo mismo,
      // porque lo que mira es el sitio donde ocurre cada beat y no el rol que lo firma.
      assert.deepEqual(beatsConCara(p), beatsConCara(sinCaras(p)), `"${p.id}" elige otros beats según se le dé con caras o sin ellas`);
    }
    // El orden con el que se eligen **existe**: los 22 roles humanos del catálogo están en
    // `plantilla.orden`, así que no hay que inventarse ninguno.
    const humanos = CATALOGO.flatMap((p) => Object.entries(p.roles ?? {}).filter(([, r]) => r.tipo === 'humano').map(([rid]) => `${p.id}::${rid}`));
    assert.equal(humanos.length, 22, `el catálogo declara ${humanos.length} roles humanos y se midieron 22`);
    const enOrden = CATALOGO.flatMap((p) => humanosDe(p).map((rid) => `${p.id}::${rid}`));
    assert.deepEqual([...enOrden].sort(), [...humanos].sort(), 'algún rol humano no está en plantilla.orden, y entonces el orden de las cláusulas no existe');
  });

  test('Toda cara con acto de relación declarado pone al menos una cara en la cadena', () => {
    // Es lo que cierra la cláusula 2, y lo que impide que el desenlace reviente al aplicar un
    // acto cuyo rol no puso cara. Se cuentan los roles con acto y se exige que **todos** la
    // pongan; el único rol humano sin acto declarado no toma beat, y también se nombra.
    const conActo = [];
    const sinActo = [];
    for (const p of CATALOGO) {
      const actos = new Set((p.relacion ?? []).map((e) => e.rol));
      const conCara = new Set(p.beats.filter((b) => p.roles[b.rol]?.tipo === 'humano').map((b) => b.rol));
      for (const rid of humanosDe(p)) {
        if (actos.has(rid)) {
          conActo.push(`${p.id}::${rid}`);
          assert.ok(conCara.has(rid), `"${p.id}"::${rid} tiene acto de relación declarado y no pone ninguna cara en la cadena: el desenlace reventaría al aplicarlo`);
        } else {
          sinActo.push(`${p.id}::${rid}`);
          assert.ok(!conCara.has(rid), `"${p.id}"::${rid} no tiene acto declarado y ha tomado beat: la regla no se estira para llegar al cero`);
        }
      }
    }
    assert.equal(conActo.length, 21, `${conActo.length} roles humanos tienen acto declarado y se midieron 21`);
    assert.deepEqual(sinActo, ['la-carta-sin-remite::quien_recibe'], 'el único rol humano sin acto declarado ha dejado de ser el que se midió');
  });

  test('Las diez plantillas sin ningún rol humano no tienen ni un beat con cara', async () => {
    const sinGente = CATALOGO.filter((p) => humanosDe(p).length === 0);
    assert.equal(sinGente.length, 10, `${sinGente.length} plantillas no declaran ningún rol humano y se midieron 10`);
    for (const p of sinGente) {
      assert.deepEqual(beatsConCara(p), [], `"${p.id}" no declara gente y las cláusulas le han puesto una cara`);
    }

    // Y sobre el mundo: sus escenas siguen siendo párrafo entero.
    const ids = new Set(sinGente.map((p) => p.id));
    let miradas = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const c of casteadasDe(mundo).filter((x) => ids.has(x.plantilla))) {
        for (const b of c.aventura.beats) {
          assert.notEqual(b.lugar?.tipo, 'humano', `${nombre} · ${c.plantilla} beat ${b.n}: una plantilla sin gente ha casteado una cara`);
          assert.equal(componeEscena({ beat: b, ...CONTEXTO }).cuerpo.forma, 'parrafo');
          miradas += 1;
        }
      }
    }
    assert.ok(miradas > 0, 'ninguna plantilla sin gente castea en los cuatro mundos: el caso no mide nada');
  });

  test('Una plantilla que abre y cierra en sitios de tipo distinto no carga, y lo dice nombrando los dos roles', () => {
    // El otro lado de la comprobación del lazo, y el que no tiene dato real: con el primer
    // beat sobre un paraje y el último sobre la cara de un núcleo, el catálogo **no carga** y
    // lo dice nombrando la plantilla y los dos roles. Es el mismo mecanismo que tumbó a «tres
    // pistas» en su día: el defecto es de la plantilla y no del mundo.
    const rota = CATALOGO.map((p) => (p.id !== 'entrega-sospechosa' ? p : {
      ...p,
      beats: p.beats.map((b, i) => (i === 0 ? { ...b, rol: 'riesgo' } : b)),
    }));
    assert.throws(
      () => compruebaCatalogo(rota),
      (e) => /entrega-sospechosa/.test(e.message) && /riesgo/.test(e.message) && /quien_encarga/.test(e.message),
      'una plantilla que abre y cierra en sitios de tipo distinto carga igual, o no dice cuáles son',
    );
    // Y el catálogo de verdad carga: sin este contraste, el caso pasaría con la comprobación
    // rota en la otra dirección.
    assert.doesNotThrow(() => compruebaCatalogo(CATALOGO));
  });

  test('Una plantilla con dos caras de sitios distintos pone las dos, y son distintas', () => {
    // `la-cuenta-pendiente` es la que lo tiene medido: `quien_debe` en la casa por la
    // cláusula 1 y `quien_cobra` en la plaza por la 2.
    const p = CATALOGO.find((x) => x.id === 'la-cuenta-pendiente');
    const suyos = p.beats.map((b, i) => [i + 1, b.rol]).filter(([, rol]) => p.roles[rol]?.tipo === 'humano');
    assert.deepEqual(suyos, [[3, 'quien_debe'], [4, 'quien_cobra']]);
    assert.notEqual(p.roles.quien_debe.en, p.roles.quien_cobra.en, 'las dos caras del caso trabajan en el mismo sitio y no habría contraste');
  });
});

// ── La casteabilidad no baja ───────────────────────────────────────────────────

describe('Poner beats sobre las caras no cambia ni un reparto', () => {
  test('El catálogo con caras castea exactamente igual que el mismo catálogo sin ellas', async () => {
    // El criterio duro de la fila, y el más estricto que se puede escribir: se castean las
    // dos versiones de cada plantilla sobre cada mundo y se compara **la cadena de sitios
    // beat a beat**, no solo el veredicto. Son 120 plantillas-mundo.
    let comparadas = 0;
    let castean = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const p of CATALOGO) {
        const con = castTemplate(mundo, p);
        const sin = castTemplate(mundo, sinCaras(p));
        comparadas += 1;
        assert.equal(con.ok, sin.ok, `${nombre} · ${p.id}: poner las caras ha cambiado el veredicto (${sin.ok ? 'casteaba' : 'no casteaba'} y ahora ${con.ok ? 'castea' : 'no castea'})`);
        if (!con.ok) {
          assert.equal(con.motivo.clave, sin.motivo.clave, `${nombre} · ${p.id}: el motivo de fallo ha cambiado de clave`);
          continue;
        }
        castean += 1;
        assert.deepEqual(cadenaDeSitios(con), cadenaDeSitios(sin), `${nombre} · ${p.id}: la cadena de sitios difiere beat a beat`);
        // Y el reparto de los roles de sitio, uno a uno: la cara no entra en el pool ni en
        // la baraja, así que poner un beat encima **no consume azar**.
        for (const rid of Object.keys(p.roles).filter((r) => p.roles[r].tipo !== 'humano')) {
          assert.equal(con.asignacion[rid].nombre, sin.asignacion[rid].nombre, `${nombre} · ${p.id}: el rol de sitio "${rid}" ha cambiado de candidato`);
        }
        assert.deepEqual(con.presupuesto, sin.presupuesto, `${nombre} · ${p.id}: el recorrido presupuestado ha cambiado`);
      }
    }
    assert.equal(comparadas, 120, `se han comparado ${comparadas} plantillas-mundo y son 30 × 4`);
    assert.equal(castean, 103, `castean ${castean} de ${comparadas} y se midieron 103: la casteabilidad no puede bajar ni una`);
  });

  test('Una cara no pide ilustración aparte y la aventura sigue pasando por el mismo núcleo', async () => {
    // Los otros dos consumidores de la regla. `claveDeElemento('humano', nombre)` pediría una
    // ilustración que nadie tiene para un sitio cuya ilustración ya está —y `queFalta…` diría
    // que falta algo que no falta—; y un beat sobre la cara de un **servicio** trae en `en` el
    // nombre del servicio, así que preguntar sin resolver el sitio dejaría de ver un núcleo
    // por el que la aventura sí pasa.
    let mirados = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const c of casteadasDe(mundo)) {
        if (!c.aventura.beats.some((b) => b.lugar?.tipo === 'humano')) continue;
        mirados += 1;
        const faltan = queFaltaParaJugarSinRed({ aventura: c.aventura, recursos: null });
        for (const falta of faltan.faltan.filter((f) => f.familia === 'ilustracion')) {
          assert.ok(!falta.clave.startsWith('humano:'), `${nombre} · ${c.plantilla}: se pide una ilustración de persona (${falta.clave}) y una cara no se ilustra aparte`);
        }
        // Dos beats del mismo portal, uno con cara y otro sin ella, son **un solo lugar que
        // ilustrar** y no dos que se coman el tope.
        const { lote } = lugaresParaIlustrar({ aventura: c.aventura });
        assert.equal(new Set(lote.map((l) => l.clave)).size, lote.length, `${nombre} · ${c.plantilla}: la lista de lugares que ilustrar repite uno`);
        for (const l of lote) assert.notEqual(l.tipo, 'humano', `${nombre} · ${c.plantilla}: se pide la ilustración de una persona (${l.clave})`);

        // Y «pasa por este núcleo» responde lo mismo con la cara que con su sitio.
        const sinLaCara = castTemplate(mundo, sinCaras(CATALOGO.find((p) => p.id === c.plantilla)));
        if (!sinLaCara.ok) continue;
        const nucleos = new Set(c.aventura.beats.map((b) => sitioDelLugar(b.lugar)).filter((s) => s.tipo === 'nucleo' || s.en).map((s) => (s.tipo === 'nucleo' ? s.nombre : s.en)));
        for (const n of nucleos) {
          assert.equal(pasaPorNucleo(c.aventura, n), pasaPorNucleo(sinLaCara.aventura, n), `${nombre} · ${c.plantilla}: poner la cara ha cambiado si la aventura pasa por "${n}"`);
        }
      }
    }
    assert.ok(mirados > 0, 'ninguna aventura de los cuatro mundos trae cara: el caso no mide nada');
  });

  test('La marca del mapa, la ilustración y el núcleo por el que pasa una aventura son los del sitio', async () => {
    // Los tres consumidores que verían una persona donde antes veían un portal. Ninguno
    // estrena nada: la marca cae en las coordenadas del sitio y con su tipo, y ni el mapa ni
    // el inventario de ficción saben que ahí hay alguien hablando.
    let humanos = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const c of casteadasDe(mundo)) {
        for (const b of c.aventura.beats.filter((x) => x.lugar?.tipo === 'humano')) {
          const sitio = sitioDelLugar(b.lugar);
          humanos += 1;
          assert.deepEqual(b.guiado.marca, { x: sitio.x, y: sitio.y, tipo: sitio.tipo, nombre: sitio.nombre }, `${nombre} · ${c.plantilla} beat ${b.n}: la marca no es la del sitio`);
          assert.notEqual(b.guiado.marca.tipo, 'humano', `${nombre} · ${c.plantilla} beat ${b.n}: el mapa estrena una marca de tipo humano`);
          assert.equal(b.guiado.destino, sitio.nombre, `${nombre} · ${c.plantilla} beat ${b.n}: el guiado no manda al portal`);
        }
      }
    }
    assert.equal(humanos, 69, `${humanos} beats con cara en los cuatro mundos y se midieron 69`);
  });
});

// ── La cara llega a la escena, y se compone entera ─────────────────────────────

describe('La cara llega a la escena compuesta', () => {
  test('Un beat con cara compone su escena con quien habla, en parlamento y con el rótulo del puesto', async () => {
    let compuestas = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const c of casteadasDe(mundo)) {
        for (const b of c.aventura.beats) {
          const cara = caraDeBeat(mundo, b);
          const escena = componeEscena({ beat: b, ...CONTEXTO, ...(cara ? { cara } : {}) });
          if (!cara) {
            assert.equal(escena.cara, null, `${nombre} · ${c.plantilla} beat ${b.n}: una escena sin cara la ha compuesto igual`);
            assert.equal(escena.cuerpo.forma, 'parrafo');
            continue;
          }
          compuestas += 1;
          assert.ok(escena.cara, `${nombre} · ${c.plantilla} beat ${b.n}: el beat tiene cara y la escena la compone sin nadie`);
          assert.equal(typeof escena.cara.nombre, 'string');
          assert.ok(escena.cara.nombre.length > 0, `${nombre} · ${c.plantilla} beat ${b.n}: la cara llega sin nombre resuelto`);
          assert.equal(escena.cuerpo.forma, 'parlamento', `${nombre} · ${c.plantilla} beat ${b.n}: el cuerpo de un beat con cara no es parlamento`);
          // El **rótulo de mundo** y nunca la clave: la traducción vive en la declaración de
          // puestos y llega ya hecha a la escena.
          assert.equal(escena.cara.puesto, rotuloDePuesto(b.lugar.cara.puesto), `${nombre} · ${c.plantilla} beat ${b.n}: el puesto no llega como rótulo`);
          assert.ok(Object.values(ROTULOS_DE_PUESTO).includes(escena.cara.puesto));
        }
      }
    }
    assert.equal(compuestas, 69, `se han compuesto ${compuestas} escenas con cara y se midieron 69`);
  });

  test('Una cara sin nombre o sin puesto no compone una escena a medias', async () => {
    const mundo = await mundoDeReferencia('costero');
    const beat = casteadasDe(mundo)[0].aventura.beats[0];
    assert.throws(() => componeEscena({ beat, ...CONTEXTO, cara: { nombre: 'Sabela' } }), /nombre y su puesto/);
    assert.throws(() => componeEscena({ beat, ...CONTEXTO, cara: { puesto: 'regencia' } }), /nombre y su puesto/);
    // Y un puesto sin rótulo declarado tampoco cae a la clave: revienta nombrándolo.
    assert.throws(() => componeEscena({ beat, ...CONTEXTO, cara: { nombre: 'Sabela', puesto: 'la que reparte el correo' } }), /la que reparte el correo/);
  });

  test('Una aventura que termina sobre una cara pone el desenlace en el portal y recuerda a quien estaba', async () => {
    let miradas = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const c of casteadasDe(mundo)) {
        const beats = c.aventura.beats;
        const ultimo = beats[beats.length - 1];
        if (ultimo.lugar?.tipo !== 'humano') continue;
        miradas += 1;
        // El desenlace ocurre **donde esa persona trabaja**, no en una persona.
        const lugar = lugarDelDesenlace(beats);
        assert.equal(lugar.id === sitioDelLugar(ultimo.lugar).nombre || lugar.tipo === 'nucleo', true, `${nombre} · ${c.plantilla}: el desenlace no ocurre en el portal donde acabó`);
        // Y esa cara está entre las que recuerdan lo que pasó, una sola vez aunque haya
        // puesto dos beats.
        const caras = carasDelDesenlace(beats);
        assert.ok(caras.some((x) => x.sitio === ultimo.lugar.cara.sitio && x.puesto === ultimo.lugar.cara.puesto), `${nombre} · ${c.plantilla}: la cara del último beat no recuerda lo que pasó`);
        const claves = caras.map((x) => `${x.sitio}·${x.puesto}`);
        assert.equal(new Set(claves).size, claves.length, `${nombre} · ${c.plantilla}: una cara aparece dos veces entre las del desenlace`);
      }
    }
    assert.ok(miradas > 0, 'ninguna aventura de los cuatro mundos termina sobre una cara: el caso no mide nada');
  });

  test('Una decisión con acto de relación sobre una cara compone el desenlace entero', async () => {
    // **El caso que hoy reventaba**, afirmado en verde y no cerrado de rebote:
    // `componeElDesenlace` resuelve la cara del acto con `carasDelDesenlace`, que solo
    // devuelve caras de beats humanos, y lanzaba si no encontraba ninguna. No había saltado
    // porque las decisiones dentro de una aventura son hoy siempre ninguna.
    let aplicados = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const c of casteadasDe(mundo)) {
        const plantilla = CATALOGO.find((p) => p.id === c.plantilla);
        const conCara = (plantilla.relacion ?? []).filter((e) => plantilla.roles[e.rol]?.tipo === 'humano');
        if (!conCara.length) continue;
        const desenlace = componeElDesenlace({
          plantilla,
          aventura: c.aventura,
          salida: 'casa/s1',
          decisiones: conCara.map((e) => e.decision),
        });
        assert.equal(desenlace.efectos.length, conCara.length, `${nombre} · ${c.plantilla}: no se han aplicado todos los actos declarados sobre caras`);
        for (const efecto of desenlace.efectos) {
          assert.ok(efecto.cara, `${nombre} · ${c.plantilla}: el acto "${efecto.decision}" se ha aplicado sin cara`);
          aplicados += 1;
        }
        // Y el desenlace se compone **entero**: no uno a medias con los campos que se pudieron.
        assert.ok(desenlace.lugar?.id, `${nombre} · ${c.plantilla}: el desenlace no dice dónde acabó`);
        assert.ok(desenlace.caras.length > 0, `${nombre} · ${c.plantilla}: el desenlace no recuerda a nadie`);

        // El contraste, que es lo que separa «la fila lo cerró» de «no se pasaba por ahí»:
        // con la misma aventura casteada **sin caras**, el mismo acto sigue lanzando.
        const sin = castTemplate(mundo, sinCaras(plantilla));
        if (sin.ok) {
          assert.throws(
            () => componeElDesenlace({ plantilla, aventura: sin.aventura, salida: 'casa/s1', decisiones: conCara.map((e) => e.decision) }),
            /no puso ninguna cara en la cadena/,
            `${nombre} · ${c.plantilla}: sin caras el acto se resuelve igual, así que el caso no mide lo que dice`,
          );
        }
      }
    }
    assert.ok(aplicados >= 20, `solo se han aplicado ${aplicados} actos sobre una cara y se midieron 25 en costero: el caso apenas está midiendo`);
  });
});

// ── Las dos mitades del paso ───────────────────────────────────────────────────

describe('La forma del cuerpo la decide la escena y las dos mitades del paso la heredan', () => {
  test('Con cara las dos mitades dicen parlamento, y sin ella las dos dicen párrafo', async () => {
    const mundo = await mundoDeReferencia('costero');
    let conCara = 0;
    let sinCara = 0;
    for (const c of casteadasDe(mundo)) {
      const beats = c.aventura.beats;
      for (const [i, b] of beats.entries()) {
        const cara = caraDeBeat(mundo, b);
        const escena = componeEscena({ beat: b, ...CONTEXTO, ...(cara ? { cara } : {}) });
        const llevas = componeLoQueTeLlevas({ beat: b, siguiente: beats[i + 1] ?? null, cara });
        const esperada = cara ? 'parlamento' : 'parrafo';
        assert.equal(escena.cuerpo.forma, esperada, `${c.plantilla} beat ${b.n}: la escena no dice ${esperada}`);
        assert.equal(llevas.forma, esperada, `${c.plantilla} beat ${b.n}: lo que te llevas no hereda la forma de la escena`);
        assert.equal(llevas.forma, escena.cuerpo.forma, `${c.plantilla} beat ${b.n}: las dos mitades del paso dicen el texto con formas distintas`);
        if (cara) conCara += 1; else sinCara += 1;
      }
    }
    assert.equal(conCara, 21, `${conCara} pasos con cara en costero y se midieron 21`);
    assert.equal(sinCara, 126, `${sinCara} pasos sin cara en costero y se midieron 126`);
  });

  test('La regla de la forma se declara una vez y ninguna de las dos composiciones la reescribe', () => {
    assert.equal(formaDelCuerpo({ nombre: 'x', puesto: 'regencia' }), 'parlamento');
    assert.equal(formaDelCuerpo(null), 'parrafo');

    // Con la regla escrita en dos sitios, la incoherencia solo tardaría en volver: se
    // comprueba que `cara ? 'parlamento' : 'parrafo'` aparece **una sola vez** en el módulo,
    // que es dentro de `formaDelCuerpo`.
    const codigo = fuente('packages/nucleo/quests/escena.js');
    const veces = [...codigo.matchAll(/'parlamento'\s*:\s*'parrafo'/g)].length;
    assert.equal(veces, 1, `la regla de la forma está escrita ${veces} veces en quests/escena.js y se declara una`);
    assert.match(codigo, /export function formaDelCuerpo/);
    assert.match(codigo, /forma: formaDelCuerpo\(cara\)/g, 'alguna composición decide la forma por su cuenta');
  });

  test('A4P4 pinta el empuje a través de la misma forma que A4P3, y la cara se resuelve una vez', () => {
    // Las comillas las pone quien pinta y en un solo sitio: `enSuForma`. Si A4P4 pintara el
    // empuje en crudo, el mismo parlamento se leería entrecomillado arriba y como narración
    // un toque después, en la pantalla que lo repite.
    const pantalla = fuente('app/pantallas/escena.js');
    assert.match(pantalla, /function enSuForma\(forma, texto\)/, 'la pantalla no declara en un solo sitio cómo se dice un texto en su forma');
    assert.match(pantalla, /enSuForma\(loQueTeLlevas\.forma, loQueTeLlevas\.empuje\)/, 'A4P4 pinta el empuje en crudo y no con la forma que decidió la escena');
    assert.match(pantalla, /enSuForma\(escena\.cuerpo\.forma, escena\.cuerpo\.texto\)/, 'A4P3 ha dejado de pintar el cuerpo con su forma');
    // Y las comillas se escriben **una sola vez** en toda la pantalla, dentro de `enSuForma`:
    // dos entrecomillados escritos por separado acabarían siendo distintos.
    assert.equal([...pantalla.matchAll(/«\$\{/g)].length, 1, 'la pantalla entrecomilla en más de un sitio, o ha dejado de entrecomillar');
    const enSuForma = pantalla.slice(pantalla.indexOf('function enSuForma'), pantalla.indexOf('function enSuForma') + 200);
    assert.match(enSuForma, /«\$\{texto\}»/, 'las comillas no viven dentro de enSuForma');

    // Y **la misma cara para las dos mitades**: montarlas con caras distintas es exactamente
    // la forma en que esto volvería a divergir.
    const motor = fuente('app/marcha/aventura.js');
    assert.match(motor, /const cara = caraDe\(beat\);/, 'el motor de la aventura no resuelve la cara una sola vez');
    assert.match(motor, /componeLoQueTeLlevas\(\{[^}]*cara[,\s}]/, 'a lo que te llevas no se le pasa la cara, así que decidiría su forma por su cuenta');
    assert.equal([...motor.matchAll(/caraDe\(beat\)/g)].length, 1, 'la cara se resuelve más de una vez por paso, y las dos mitades podrían recibir caras distintas');
  });

  test('La herencia lleva la forma y no el texto, y hoy ningún paso que difiera tiene cara', async () => {
    // **El borde declarado.** Lo que se hereda es la forma; en un beat de franja o de objeto
    // las dos mitades no dicen el mismo **texto**, porque la escena resuelve su variante y el
    // empuje es el texto base del beat. Hoy no ocurre con ninguna cara —los 21 beats con cara
    // son todos de `llegada`— y este caso lo fija: el día que una plantilla ponga una cara
    // sobre un beat de franja, esto se pone rojo y alguien decide si el empuje también toma
    // la variante.
    const mundo = await mundoDeReferencia('costero');
    let pasos = 0;
    let difieren = 0;
    for (const c of casteadasDe(mundo)) {
      const beats = c.aventura.beats;
      for (const [i, b] of beats.entries()) {
        const cara = caraDeBeat(mundo, b);
        const escena = componeEscena({ beat: b, ...CONTEXTO, ...(cara ? { cara } : {}) });
        const llevas = componeLoQueTeLlevas({ beat: b, siguiente: beats[i + 1] ?? null, cara });
        pasos += 1;
        if (escena.cuerpo.texto === llevas.empuje) continue;
        difieren += 1;
        assert.equal(cara, null, `${c.plantilla} beat ${b.n}: un paso con cara dice textos distintos en sus dos mitades, y la herencia solo lleva la forma`);
      }
    }
    assert.equal(pasos, 147, `${pasos} pasos en costero y se midieron 147`);
    assert.equal(difieren, 5, `${difieren} pasos dicen textos distintos en sus dos mitades y se midieron 5, ninguno con cara`);
  });

  test('Una cara sobre un beat de franja o de objeto no se come la variante ni la vía alternativa', async () => {
    // **El beat de este caso se fabrica, y hay que decir por qué**: los 21 beats con cara del
    // catálogo son todos de `llegada`, así que sobre dato real este criterio no se puede
    // afirmar. Lo que se prueba es que la cara **no interfiere** con lo que ya decidía el
    // disparador: la escena de franja sigue trayendo su variante y la del objeto sigue
    // resolviendo su vía, y la cara solo cambia la forma con la que se dicen.
    const mundo = await mundoDeReferencia('costero');
    const conFranja = casteadasDe(mundo).flatMap((c) => c.aventura.beats).find((b) => b.disparador?.tipo === 'franja');
    const conObjeto = casteadasDe(mundo).flatMap((c) => c.aventura.beats).find((b) => b.disparador?.tipo === 'con_objeto');
    assert.ok(conFranja && conObjeto, 'costero no castea ni un beat de franja ni uno de objeto y el caso no mediría nada');
    const cara = { nombre: 'Sabela', puesto: 'regencia' };

    for (const beat of [conFranja, conObjeto]) {
      const sin = componeEscena({ beat, ...CONTEXTO });
      const con = componeEscena({ beat, ...CONTEXTO, cara });
      assert.equal(con.situacion, sin.situacion, `la cara ha cambiado la línea que sitúa de un beat de ${beat.disparador.tipo}`);
      assert.equal(con.cuerpo.texto, sin.cuerpo.texto, `la cara ha cambiado el texto de un beat de ${beat.disparador.tipo}: solo decide la forma`);
      assert.equal(con.cuerpo.forma, 'parlamento');
      assert.equal(sin.cuerpo.forma, 'parrafo');
      // Y la escena no anuncia que faltara nada: la vía alternativa es un camino, no una
      // degradación que haya que disculpar.
      assert.ok(!/falta|no tienes|sin el/i.test(con.cuerpo.texto), `la escena de un beat de ${beat.disparador.tipo} se disculpa por la vía que tomó`);
    }
  });
});

// ── El rótulo del puesto, y su fuente única ────────────────────────────────────

describe('El puesto se dice con palabras del mundo', () => {
  test('La declaración de rótulos es la fuente única, y A4P3 es hoy el único sitio que enseña un puesto', () => {
    // Medido y no supuesto: en `partida/diario.js`, `memoria.js`, `relacion.js`,
    // `capitulos.js` y `triangulacion.js` el puesto viaja **solo como parte de la clave de
    // una cara** y ninguna pantalla lo pinta. El criterio queda escrito para quien venga
    // después: cualquier sitio que enseñe el puesto de alguien lo saca de esta declaración y
    // no de una segunda traducción.
    const pantallas = ['escena', 'diario', 'triangulacion', 'ficha', 'lo-que-se-cuenta', 'telon'];
    const pintan = pantallas.filter((p) => {
      for (const ext of ['.js', '.jsx']) {
        try {
          if (/cara\.puesto|\.puesto\}/.test(fuente(`app/pantallas/${p}${ext}`))) return true;
        } catch { /* la pantalla no existe con esa extensión */ }
      }
      return false;
    });
    assert.deepEqual(pintan, ['escena'], `estas pantallas enseñan el puesto de una cara: ${pintan.join(', ')}. Hoy solo A4P3 lo hace, y quien se sume lo saca de ROTULOS_DE_PUESTO`);

    // Y la traducción vive en un solo módulo: nadie más declara rótulos de puesto.
    const declara = ['packages/nucleo/quests/escena.js', 'packages/nucleo/partida/npcs.js', 'app/pantallas/escena.js']
      .filter((r) => /ROTULOS_DE_PUESTO\s*=/.test(fuente(r)));
    assert.deepEqual(declara, [], `${declara.join(', ')} declara su propia tabla de rótulos, y la fuente única es partida/puestos.js`);
  });
});

// ── Determinismo ───────────────────────────────────────────────────────────────

describe('El casting con caras es determinista', () => {
  test('El casting es determinista', async () => {
    // `@determinismo`, bloqueante. El escenario de la batería con las caras dentro: dos
    // pasadas sobre el mismo mundo dan las mismas plantillas, el mismo reparto **y las mismas
    // caras**, con su identificador, su sitio y su puesto.
    const mundo = await mundoDeReferencia('costero');
    const foto = (c) => (!c.ok ? { plantilla: c.tpl.id, motivo: c.motivo.clave } : {
      plantilla: c.plantilla,
      beats: c.beats.map((b) => `${b.n}:${b.rol}:${b.lugar.nombre}:${b.lugar.cara?.id ?? ''}:${b.lugar.cara?.puesto ?? ''}`),
    });
    const una = CATALOGO.map((p) => foto(castTemplate(mundo, p)));
    const otra = CATALOGO.map((p) => foto(castTemplate(mundo, p)));
    assert.equal(JSON.stringify(una), JSON.stringify(otra), 'dos pasadas del casting sobre el mismo mundo dan repartos o caras distintos');
    assert.ok(JSON.stringify(una).includes('regencia') || JSON.stringify(una).includes('vecindad'), 'ninguna foto lleva cara: el caso no comprueba lo que dice');
  });

  test('La cara que resuelve el casting y la que resuelve la capa de la app son la misma', async () => {
    // `@determinismo`. Las dos vías pasan por la **misma función pura** sobre la misma semilla
    // y el mismo mundo: `caraDeSitio` desde el casting e `identidadDeCara` desde la app. Que
    // den «una parecida» sería que el nombre dependiera del orden en que se pidió.
    let miradas = 0;
    for (const nombre of LOS_CUATRO) {
      const mundo = await mundoDeReferencia(nombre);
      for (const c of casteadasDe(mundo)) {
        for (const b of c.aventura.beats.filter((x) => x.lugar?.tipo === 'humano')) {
          const suya = b.lugar.cara;
          const identidad = identidadDeCara({ mundo, semilla: mundo.seed, idioma: namesFor(mundo.locale), sitio: suya.sitio, puesto: suya.puesto });
          miradas += 1;
          assert.equal(identidad.id, suya.id, `${nombre} · ${c.plantilla} beat ${b.n}: las dos vías dan caras con identificador distinto`);
          assert.equal(identidad.puesto, suya.puesto, `${nombre} · ${c.plantilla} beat ${b.n}: el puesto no coincide entre las dos vías`);
          assert.equal(identidad.genero, suya.genero, `${nombre} · ${c.plantilla} beat ${b.n}: el género no coincide entre las dos vías`);
          // Y pedirla otra vez da lo mismo: la clave es el sitio y el puesto, nunca el orden.
          assert.equal(identidadDeCara({ mundo, semilla: mundo.seed, idioma: namesFor(mundo.locale), sitio: suya.sitio, puesto: suya.puesto }).nombre, identidad.nombre);
        }
      }
    }
    assert.equal(miradas, 69, `se han cruzado ${miradas} caras y se midieron 69`);
  });
});

// ── Los textos que pasan a decirse en voz de alguien ───────────────────────────

describe('Los textos de los beats con cara se dicen en voz de alguien', () => {
  /** Los 21 textos que esta fila movió, con su plantilla y su número de beat. */
  const losTextos = () => CATALOGO.flatMap((p) => p.beats
    .map((b, i) => ({ plantilla: p.id, n: i + 1, rol: b.rol, texto: b.texto, tipo: p.roles[b.rol]?.tipo }))
    .filter((x) => x.tipo === 'humano'));

  test('No se usa masculino genérico en fórmulas frecuentes', () => {
    const textos = losTextos();
    assert.equal(textos.length, 21, `${textos.length} textos de beat caen sobre una cara y se midieron 21`);
    for (const { plantilla, n, texto } of textos) {
      assert.deepEqual(infraccionesDeTexto(texto, { locale: 'es' }).filter((i) => i.familia === 'formula'), [], `"${plantilla}" beat ${n} usa una fórmula de masculino genérico evitable: "${texto}"`);
    }
  });

  test('No se usa morfología inventada', () => {
    for (const { plantilla, n, texto } of losTextos()) {
      assert.deepEqual(infraccionesDeTexto(texto, { locale: 'es' }).filter((i) => i.familia === 'morfologia'), [], `"${plantilla}" beat ${n} usa morfología inventada: "${texto}"`);
    }
  });

  test('El juego habla como mundo', () => {
    // Ninguno nombra la aplicación, la red, un permiso, un ajuste ni una pantalla: son cosas
    // que dice alguien del mundo, y el mundo no sabe que existe un móvil.
    const deAplicacion = /\b(app|aplicaci[oó]n|pantalla|men[uú]|ajuste|permiso|notificaci[oó]n|conexi[oó]n|internet|red|bater[ií]a|GPS|wifi|servidor|bot[oó]n|pulsa|toca la)\b/i;
    for (const { plantilla, n, texto } of losTextos()) {
      assert.equal(deAplicacion.test(texto), false, `"${plantilla}" beat ${n} habla como aplicación: "${texto}"`);
    }
  });

  test('Ningún texto depende de un número que solo existe en la maqueta', () => {
    // Ninguno de los 21 lleva una cifra ni una unidad: nada que se pueda volver falso al
    // generar otro mundo, que es lo que el escenario de la batería pide.
    for (const { plantilla, n, texto } of losTextos()) {
      assert.equal(/\d/.test(texto), false, `"${plantilla}" beat ${n} lleva una cifra: "${texto}"`);
    }
  });

  test('Los veintiún textos se leen en voz alta y caben en el tope de su clase', () => {
    for (const { plantilla, n, texto } of losTextos()) {
      assert.deepEqual([...infraccionesDeLecturaEnVozAlta(texto)], [], `"${plantilla}" beat ${n} no se puede leer en voz alta: "${texto}"`);
      assert.ok(texto.length <= TOPES_DE_TEXTO.beat, `"${plantilla}" beat ${n} son ${texto.length} caracteres y el tope de la clase beat es ${TOPES_DE_TEXTO.beat}`);
    }
  });
});
