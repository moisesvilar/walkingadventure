// SPEC-017 · El catálogo de treinta plantillas-arquetipo, la afinidad de oficio y
//            las reglas de lenguaje que lo gobiernan.
//
// El catálogo es a la vez **contenido y contrato**, y esta es la mitad contrato: lo
// que cada plantilla tiene que traer para que los mecanismos que ya existen —casting
// (SPEC-010), rumores (SPEC-012), caras (SPEC-014), oro y objetos (SPEC-015)— tengan
// de qué tirar. Lo que no se puede afirmar con una aserción —si el chiste tiene
// gracia y a costa de qué— es `@manual` y vive en la fila de revisión de cada
// plantilla, que aquí solo se comprueba que exista.
//
// Tres cosas se afirman con número, y las tres eran promesas hasta ahora:
//
//   · **Las treinta cierran su lazo**, una por una, sobre la batería de mundos. El
//     precedente del repo es «tres pistas», que no cerraba: se corrigió la
//     plantilla, no el test.
//   · **La cobertura por oficio** en un barrio de tres calles, que `personaje.md` §3
//     fija en diez esqueletos jugables. **Hoy no se cumple**, está declarado como
//     hueco de diseño en `pipeline/decisiones-orquestador.md` §6s, y el caso va
//     escrito con la exigencia real: un criterio se rebaja cuando deja de mentir, no
//     cuando incomoda (§6m).
//   · **Cero infracciones de lenguaje** sobre las cadenas del catálogo, con la
//     prueba de que el filtro muerde.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. El resto
// van marcados como hueco de batería en test/spec-test-map.json.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema: los mundos salen de
// test/fixtures/osm/ por el doble de siempre.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { LOS_CUATRO, LAS_DOS_SEMILLAS, fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';

import {
  CATALOGO,
  DECISIONES_PROHIBIDAS,
  MEDIA_DE_AFINIDADES,
  REPUESTOS,
  TAMANO_DEL_CATALOGO,
  TOPES_DE_TEXTO,
  aperturaDeGancho,
  beatsConObjeto,
  compruebaCatalogo,
  compruebaCoberturaDeEscenas,
  rolesDeParajeDe,
  textosDelCatalogo,
  tiposDeRolDe,
  vocabularioDeEscenas,
} from '../../packages/nucleo/quests/catalogo.js';
import {
  OFICIOS,
  SERVICIO_ANCLA_DE_OFICIO,
  coberturaPorOficio,
  exclusivasDeOficio,
  mediaDeAfinidades,
  plantillasDeOficio,
} from '../../packages/nucleo/quests/oficios.js';
import {
  FAMILIAS_DE_REGLA,
  GENERO_POR_DEFECTO,
  IDIOMAS_CON_REGLAS,
  RANURAS,
  infraccionesDeTexto,
  ranurasDeTexto,
  resuelveConcordancia,
} from '../../packages/nucleo/names/lenguaje.js';
import { TIPOS_DE_ROL } from '../../packages/nucleo/quests/aventura.js';
import { IDS_DE_TAMANO, RANGO_DE_BEATS } from '../../packages/nucleo/partida/salida.js';
import { IDS_DE_GENERO } from '../../packages/nucleo/partida/puestos.js';
import {
  CERCA_DE_LA_PARTIDA_EN_TRAMOS,
  casteaCatalogo,
  exigeEncuadre,
  medidorDeTrechos,
} from '../../packages/nucleo/quests/casting.js';
import { CLAVES_DE_MOTIVO } from '../../packages/nucleo/quests/motivos.js';
import { PARAJE_INFO } from '../../packages/nucleo/world/parajes.js';
import { ESCENAS_POR_PARAJE } from '../../packages/nucleo/world/escenas.js';
import { escenasPedidasPorElCatalogo, sueloDeParajes } from '../../packages/nucleo/world/cupos.js';
import { SERVICES } from '../../packages/nucleo/world/settlements.js';

/** La batería: los cuatro mundos congelados por sus dos semillas de referencia. */
const LOS_OCHO = LOS_CUATRO.flatMap((nombre) => LAS_DOS_SEMILLAS.map((semilla) => ({ nombre, semilla, clave: `${nombre}#${semilla}` })));

// Un mundo por clave: generar los ocho cuesta unos tres segundos y aquí se miran
// muchas veces. La caché no toca el determinismo —el mundo es función de la semilla
// y del fixture— y ningún caso muta lo que recibe.
const MUNDOS = new Map();
async function mundoDe(nombre, semilla) {
  const clave = `${nombre}#${semilla}`;
  if (!MUNDOS.has(clave)) MUNDOS.set(clave, await generaMundo(nombre, `${semillaDe(nombre, '1').split('#')[0]}#${semilla}`));
  return MUNDOS.get(clave);
}

/** Los ocho mundos de la batería con su casting ya hecho por la tubería. */
async function laBateria() {
  const out = [];
  for (const { nombre, semilla, clave } of LOS_OCHO) out.push({ clave, nombre, mundo: await mundoDe(nombre, semilla) });
  return out;
}

/**
 * Las seis plantillas que vienen del prototipo. Conservan su identificador —vive en
 * partidas guardadas y en el informe— reescritas en cómico-cálido.
 */
const LAS_SEIS_PORTADAS = ['entrega-sospechosa', 'cita-en-la-fuente', 'tres-pistas', 'ronda-del-vigia', 'peregrinaje', 'rescate-en-la-granja'];

/** Los tipos de servicio que el mundo sabe generar, sin repetir y en orden. */
const TIPOS_DE_SERVICIO = [...new Set(Object.values(SERVICES).flatMap((d) => [...d.fixed, ...d.extra]))].sort();

/** Una copia profunda y editable de una plantilla del catálogo. */
const copiaDe = (id) => JSON.parse(JSON.stringify(CATALOGO.find((t) => t.id === id)));

/** El catálogo con una plantilla sustituida por otra cosa, para probar la carga. */
const conPlantilla = (plantilla) => CATALOGO.map((p) => (p.id === plantilla.id ? plantilla : p));

// ── El catálogo: cuántas, cómo son y qué se comprueba al cargarlo ───────────────

describe('El catálogo de plantillas-arquetipo se comprueba entero al cargarse', () => {
  test('El catálogo trae entre 24 y 30 plantillas, con identificadores únicos y los tres tamaños', () => {
    assert.ok(
      CATALOGO.length >= TAMANO_DEL_CATALOGO.minimo && CATALOGO.length <= TAMANO_DEL_CATALOGO.maximo,
      `el catálogo trae ${CATALOGO.length} plantillas y el rango declarado es ${TAMANO_DEL_CATALOGO.minimo}-${TAMANO_DEL_CATALOGO.maximo}`,
    );
    assert.equal(CATALOGO.length, 30, 'el objetivo de SPEC-017 son las treinta con las que `personaje.md` §3 hace su cuenta');
    const ids = CATALOGO.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `el catálogo repite algún identificador: ${ids.join(', ')}`);

    // Los tres tamaños representados: un catálogo sin jornadas ofrece paseos y llama
    // jornada a lo que nunca sale.
    for (const tamano of IDS_DE_TAMANO) {
      const suyas = CATALOGO.filter((p) => p.tamano === tamano);
      assert.ok(suyas.length > 0, `ninguna plantilla declara el tamaño "${tamano}"`);
      for (const p of suyas) {
        const rango = RANGO_DE_BEATS[tamano];
        assert.ok(
          p.beats.length >= rango.minimo && p.beats.length <= rango.maximo,
          `"${p.id}" declara "${tamano}" y escribe ${p.beats.length} beats, fuera de ${rango.minimo}-${rango.maximo}`,
        );
      }
    }

    // Las seis del prototipo conservan su identificador: vive en partidas guardadas
    // y en el informe, y cambiarlo sería una migración gratuita.
    for (const id of LAS_SEIS_PORTADAS) {
      assert.ok(ids.includes(id), `la plantilla portada "${id}" ha desaparecido del catálogo`);
    }
  });

  test('Una plantilla mal declarada hace fallar la carga nombrando la plantilla y el campo', () => {
    // La validación es **al cargarse** y no en el primer casteo que use la plantilla:
    // con validación perezosa, una plantilla mal declarada aparece meses después, en
    // el mundo de alguien y no en la batería.
    const casos = [
      ['sin afinidad de oficio', (p) => { delete p.oficios; }, /oficios/],
      ['un oficio fuera del enumerado', (p) => { p.oficios = ['herrería']; }, /herrería/],
      ['sin desenlace de repuesto', (p) => { delete p.repuesto.sinTi; }, /sinTi/],
      ['notable sin semilla de rumor', (p) => { delete p.rumor.semilla; }, /semilla/],
      ['un mote redactado', (p) => { p.mote = 'la que no preguntó'; }, /redactado/],
      ['un objeto sin clase', (p) => { p.desenlace.objetos = [{ id: 'x', clase: 'talisman', procedencia: { plantilla: p.id } }]; }, /talisman/],
      ['un efecto sobre un rol huérfano', (p) => { p.relacion = [{ rol: 'nadie', signo: 'feo', beat: 1, decision: 'algo' }]; }, /nadie/],
      ['un acto que cuelga de no haber llegado', (p) => { p.relacion = [{ ...p.relacion[0], decision: 'plantarse' }]; }, /plantarse/],
      ['un texto vacío', (p) => { p.gancho = '   '; }, /gancho/],
      ['sin fila de revisión', (p) => { delete p.revision; }, /revisi/],
    ];
    for (const [que, rompe, espera] of casos) {
      const rota = copiaDe('entrega-sospechosa');
      rompe(rota);
      assert.throws(
        () => compruebaCatalogo(conPlantilla(rota)),
        (e) => {
          assert.ok(e.message.includes('entrega-sospechosa'), `${que}: el error no nombra la plantilla — ${e.message}`);
          assert.match(e.message, espera, `${que}: el error no nombra el campo — ${e.message}`);
          return true;
        },
        `una plantilla con ${que} se ha cargado igual`,
      );
    }

    // Y las propiedades del conjunto: identificador repetido —sin salirse del rango,
    // que si no salta primero la otra guarda— y tamaño fuera de rango.
    const conRepetido = [...CATALOGO.slice(0, CATALOGO.length - 1), copiaDe('peregrinaje')];
    assert.equal(conRepetido.length, CATALOGO.length, 'el catálogo de prueba se ha salido del rango y la guarda que salta no es la del identificador');
    assert.throws(() => compruebaCatalogo(conRepetido), /peregrinaje/);
    assert.throws(() => compruebaCatalogo(CATALOGO.slice(0, 5)), (e) => e.message.includes('5') && e.message.includes(String(TAMANO_DEL_CATALOGO.minimo)));
  });

  test('El catálogo es datos y validación: ni azar, ni reloj, ni ningún módulo de mundo', () => {
    // El orden es el declarado en la lista y no el de ninguna estructura con orden
    // de inserción, y el azar es de quien castea.
    for (const modulo of ['packages/nucleo/quests/templates.js', 'packages/nucleo/quests/catalogo.js', 'packages/nucleo/quests/oficios.js']) {
      const codigo = fuente(modulo).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
      assert.equal(/\bMath\.random\s*\(/.test(codigo), false, `${modulo}: usa Math.random()`);
      assert.equal(/\bDate\.now\s*\(|\bnew\s+Date\b|\bperformance\.now\s*\(/.test(codigo), false, `${modulo}: lee el reloj del sistema`);
      assert.equal(/makeRng\s*\(/.test(codigo), false, `${modulo}: siembra azar, y el azar es de quien castea`);
      // La dirección de la dependencia es la mitad del diseño de SPEC-006: el
      // vocabulario sale de aquí hacia fuera y nunca al revés.
      assert.equal(/from '\.\.\/world\//.test(codigo), false, `${modulo}: importa un módulo de mundo, y el vocabulario va en el otro sentido`);
    }
    assert.ok(Array.isArray(CATALOGO), 'el catálogo no es una lista y por tanto no tiene orden declarado');
    assert.deepEqual(compruebaCatalogo(CATALOGO).map((p) => p.id), CATALOGO.map((p) => p.id), 'comprobar el catálogo lo reordena');
  });
});

// ── La afinidad de oficio ──────────────────────────────────────────────────────

describe('Una quest se castea contra el mundo o no se ofrece', () => {
  test('El oficio filtra el catálogo', () => {
    // El escenario de la batería: quien juega con oficio «buhonera» —la forma en
    // femenino de la clave `mercado` en el paquete castellano— solo ve plantillas
    // que declaran afinidad con ese oficio, y hay al menos una que no verá nunca.
    assert.ok(OFICIOS.length >= 3 && OFICIOS.length <= 4, `el enumerado de oficios tiene ${OFICIOS.length} entradas y el criterio son tres o cuatro`);
    for (const oficio of OFICIOS) {
      // La clave no lleva género: la palabra la pone el paquete de idioma.
      assert.match(oficio, /^[a-z]+$/, `la clave de oficio "${oficio}" no es una clave desnuda`);
      // Y cada una sale de un tipo de servicio que el mundo sabe generar, «para que
      // siempre exista un sitio donde te reconozcan» (`personaje.md` §3).
      assert.ok(
        TIPOS_DE_SERVICIO.includes(SERVICIO_ANCLA_DE_OFICIO[oficio]),
        `el oficio "${oficio}" ancla en el servicio "${SERVICIO_ANCLA_DE_OFICIO[oficio]}", que el mundo no sabe generar: los que genera son ${TIPOS_DE_SERVICIO.join(', ')}`,
      );

      const suyas = plantillasDeOficio(oficio, CATALOGO);
      assert.ok(suyas.length > 0, `el catálogo filtrado por "${oficio}" está vacío`);
      for (const p of suyas) assert.ok(p.oficios.includes(oficio), `"${p.id}" aparece con "${oficio}" sin declararlo`);
      // Existe al menos una plantilla que este oficio no ve nunca: sin eso el filtro
      // solo cambiaría la voz.
      assert.ok(suyas.length < CATALOGO.length, `el oficio "${oficio}" ve el catálogo entero: no filtra nada`);
      // El orden es el declarado del catálogo y no depende del oficio.
      assert.deepEqual(suyas.map((p) => p.id), CATALOGO.filter((p) => p.oficios.includes(oficio)).map((p) => p.id), `el filtro por "${oficio}" reordena el catálogo`);
      // Y sus exclusivas, que son las que hacen que elegir signifique algo.
      assert.ok(exclusivasDeOficio(oficio, CATALOGO).length > 0, `el oficio "${oficio}" no tiene ninguna plantilla exclusiva`);
    }

    // Las dos cotas de la media: por debajo de 1,5 el catálogo por oficio se queda
    // corto, por encima de 2 el oficio deja de filtrar.
    const media = mediaDeAfinidades(CATALOGO);
    assert.ok(
      media >= MEDIA_DE_AFINIDADES.minima && media <= MEDIA_DE_AFINIDADES.maxima,
      `la media de oficios por plantilla es ${media.toFixed(2)} y tiene que estar entre ${MEDIA_DE_AFINIDADES.minima} y ${MEDIA_DE_AFINIDADES.maxima}`,
    );
    const exclusivas = OFICIOS.reduce((n, o) => n + exclusivasDeOficio(o, CATALOGO).length, 0);
    assert.ok(exclusivas <= Math.floor(CATALOGO.length / 3), `${exclusivas} exclusivas sobre ${CATALOGO.length}: cada oficio acaba con su rincón privado`);

    // El filtro **no castea**: devuelve plantillas, y quien las castea es SPEC-010.
    for (const p of plantillasDeOficio('mercado', CATALOGO)) {
      assert.equal(p.beats !== undefined && p.ok === undefined && p.asignacion === undefined, true, `el filtro ha devuelto un casteo en vez de la plantilla "${p.id}"`);
    }

    // Entradas inválidas: un oficio que no existe y la ausencia de oficio fallan
    // nombrando lo recibido y enumerando los válidos, en vez de devolver el catálogo.
    for (const malo of ['buhonera', 'panadería', '', null, undefined]) {
      assert.throws(
        () => plantillasDeOficio(malo, CATALOGO),
        (e) => OFICIOS.every((o) => e.message.includes(o)),
        `el filtro ha aceptado el oficio ${JSON.stringify(malo)}`,
      );
    }
  });

  test('Todo lazo casteado se cierra', async () => {
    // Por el lado que es de la plantilla, que es el que SPEC-017 cierra: **cada una
    // de las treinta** castea con lazo cerrado en al menos un mundo de la batería.
    // Que el lazo cierre de verdad se remide sobre el grafo, aquí, en vez de creerle
    // al presupuesto. El precedente es «tres pistas», que no cerraba: se corrigió la
    // plantilla, no el test.
    const cierran = new Map();
    for (const { clave, mundo } of await laBateria()) {
      const { tramoM, partida } = exigeEncuadre(mundo);
      const medida = medidorDeTrechos(mundo.viario, []);
      for (const c of mundo.casting.filter((x) => x.ok)) {
        const ida = medida.metros(partida, c.beats[0].lugar);
        const vuelta = medida.metros(c.beats[c.beats.length - 1].lugar, partida);
        const cerca = CERCA_DE_LA_PARTIDA_EN_TRAMOS * tramoM;
        assert.notEqual(ida, null, `${clave} · ${c.plantilla}: no hay camino del punto de partida al primer beat`);
        assert.notEqual(vuelta, null, `${clave} · ${c.plantilla}: no hay camino del último beat al punto de partida`);
        assert.ok(ida <= cerca && vuelta <= cerca, `${clave} · ${c.plantilla}: el lazo no cierra cerca del punto de partida`);
        cierran.set(c.plantilla, [...(cierran.get(c.plantilla) ?? []), clave]);
      }
    }
    const nunca = CATALOGO.filter((p) => !cierran.has(p.id)).map((p) => p.id);
    assert.deepEqual(
      nunca,
      [],
      `${nunca.length} plantillas no cierran lazo en ningún mundo de la batería: ${nunca.join(', ')}. ` +
      'El defecto es de la plantilla y no del mundo, y una plantilla que no cierra no entra (precedente: «tres pistas»)',
    );
    assert.equal(cierran.size, CATALOGO.length, 'no se han comprobado las treinta');

    // Y el lazo por el lado de la declaración: primero y último beat comparten rol o
    // caen los dos en el mismo tipo de sitio del que se sale.
    for (const p of CATALOGO) {
      const primero = p.beats[0].rol;
      const ultimo = p.beats[p.beats.length - 1].rol;
      assert.ok(
        primero === ultimo || p.roles[primero].tipo === p.roles[ultimo].tipo,
        `"${p.id}" abre en "${primero}" y cierra en "${ultimo}", que no comparten ni rol ni tipo de sitio`,
      );
    }
  });

  test('El catálogo varía los roles que pide, que es lo que ataca el cuello de botella', () => {
    // El cuello de botella medido no es el catálogo, es el barrio: los fallos del
    // informe dicen todos lo mismo, «sin candidatos para un paraje con escena X».
    // Estos números son lo que convierte «variar los roles» en una comprobación.
    const sinParaje = CATALOGO.filter((p) => rolesDeParajeDe(p).length === 0);
    assert.ok(sinParaje.length >= Math.ceil(CATALOGO.length / 3), `solo ${sinParaje.length} plantillas no piden ningún paraje y hace falta un tercio`);
    const conMuchos = CATALOGO.filter((p) => rolesDeParajeDe(p).length > 2);
    assert.ok(conMuchos.length <= Math.floor(CATALOGO.length / 4), `${conMuchos.length} plantillas piden más de dos parajes y el tope es un cuarto: ${conMuchos.map((p) => p.id).join(', ')}`);

    // Los cuatro tipos de rol se usan, y ninguna forma monopoliza el catálogo.
    for (const tipo of TIPOS_DE_ROL) {
      assert.ok(CATALOGO.some((p) => tiposDeRolDe(p).includes(tipo)), `ninguna plantilla pide un rol de tipo "${tipo}"`);
    }
    const porCombinacion = new Map();
    for (const p of CATALOGO) {
      const clave = [...tiposDeRolDe(p)].sort().join('+');
      porCombinacion.set(clave, (porCombinacion.get(clave) ?? 0) + 1);
    }
    for (const [clave, cuantas] of porCombinacion) {
      assert.ok(cuantas <= Math.floor(CATALOGO.length / 3), `${cuantas} plantillas piden la misma combinación (${clave}) y el tope es un tercio`);
    }

    // Y todo tipo de servicio que el mundo sabe generar lo pide alguien: un servicio
    // que ninguna plantilla usa es un servicio que el juego coloca y nadie visita.
    const pedidos = new Set(CATALOGO.flatMap((p) => Object.values(p.roles).filter((r) => r.tipo === 'servicio').flatMap((r) => (Array.isArray(r.kind) ? r.kind : [r.kind]))));
    for (const kind of TIPOS_DE_SERVICIO) {
      assert.ok(pedidos.has(kind), `ninguna plantilla pide el servicio "${kind}", que el mundo sí genera`);
    }
  });
});

// ── El suelo de casteo por oficio ──────────────────────────────────────────────

describe('El suelo de casteo por oficio, que se mide y no se estima', () => {
  test('Cada oficio conserva al menos diez plantillas casteables en un barrio de tres calles', async () => {
    // **Este caso está rojo, y va escrito con la exigencia real a propósito.**
    //
    // `personaje.md` §3 fija el suelo en «diez esqueletos jugables en un barrio de
    // tres calles», y `pipeline/decisiones-orquestador.md` §6s lo declara como hueco
    // **de diseño**: `barrio-tres-calles` no tiene ni un servicio y 20 de las 30
    // plantillas piden uno, así que cada oficio se queda en 3-5 casteables (#1:
    // taberna 5, botica 3, forja 5, mercado 4; #2: 4, 3, 3, 3). La cuenta del
    // documento asumía tasas del 77-82 % en el caso pequeño, que son las del
    // prototipo antiguo y no las de hoy.
    //
    // No se ablanda a lo medido y no se marca como pendiente: un criterio se rebaja
    // cuando deja de mentir, no cuando incomoda (§6m), y aquí sigue diciendo la
    // verdad —lo que el diseño pide— sobre un mundo que todavía no la cumple. La
    // corrección, si toca, es del diseño (`personaje.md` §3) y no de este caso.
    const SUELO_DE_DISENO = 10;
    const flojos = [];
    for (const semilla of LAS_DOS_SEMILLAS) {
      const mundo = await mundoDe('barrio-tres-calles', semilla);
      const cobertura = coberturaPorOficio({ resultados: mundo.casting, catalogo: CATALOGO });
      for (const oficio of OFICIOS) {
        const { casteables, total, noCasteables } = cobertura[oficio];
        assert.equal(casteables + noCasteables.length, total, `barrio-tres-calles#${semilla}/${oficio}: la cobertura pierde plantillas por el camino`);
        // Y cada una que no castea trae su motivo estructurado: la medida sale de las
        // declaraciones y del catálogo cerrado de motivos, sin parsear ninguna frase.
        for (const { plantilla, motivo } of noCasteables) {
          assert.ok(CLAVES_DE_MOTIVO.includes(motivo.clave), `${plantilla}: motivo fuera del catálogo cerrado (${motivo.clave})`);
          assert.ok(motivo.roles.length > 0, `${plantilla}: el motivo no nombra ningún rol`);
          assert.equal(typeof motivo.requisito, 'object', `${plantilla}: el requisito del motivo no es un dato estructurado`);
        }
        if (casteables < SUELO_DE_DISENO) flojos.push(`barrio-tres-calles#${semilla}/${oficio} ${casteables}/${total}`);
      }
    }
    assert.deepEqual(
      flojos,
      [],
      `estos oficios no llegan a los ${SUELO_DE_DISENO} esqueletos jugables que pide personaje.md §3 en un barrio de tres calles: ${flojos.join(', ')}. ` +
      'Es el hueco de diseño declarado en §6s: ese mundo no tiene ni un servicio y dos tercios del catálogo piden uno',
    );
  });

  test('Ningún oficio se queda a cero en ningún mundo de la batería', async () => {
    // El suelo que sí se cumple hoy, y que es distinto del anterior: que un oficio
    // no llegue a diez es un hueco de diseño; que se quede a cero sería un día sin
    // nada que hacer, y eso es pendiente 1 de `personaje.md`, todavía sin ratificar.
    for (const { clave, mundo } of await laBateria()) {
      const cobertura = coberturaPorOficio({ resultados: mundo.casting, catalogo: CATALOGO });
      for (const oficio of OFICIOS) {
        assert.ok(cobertura[oficio].casteables > 0, `${clave}/${oficio}: ni una plantilla casteable`);
      }
    }
    // Y la medida la calcula una función del paquete, no el script que la imprime:
    // `test/**` lo escribe solo wa-qa-dev, así que exigir el suelo por oficio no
    // puede obligar al implementador a tocar un directorio ajeno.
    assert.equal(typeof coberturaPorOficio, 'function');
    assert.equal(/coberturaPorOficio/.test(fuente('test/casting-report.mjs')), true, 'el informe recalcula la cobertura por su cuenta en vez de pedírsela al paquete');
  });
});

// ── El catálogo como fuente del vocabulario de escenas ─────────────────────────

describe('El mundo de una celda es jugable por construcción', () => {
  test('El suelo de parajes cubre el vocabulario de escenas', () => {
    // Por el lado que SPEC-017 cierra: **el catálogo es el productor**. SPEC-006
    // recibe el vocabulario inyectado y no conoce al catálogo; aquí se comprueba el
    // otro extremo del cable, que es lo que enciende la propiedad viva que pide
    // `parajes.md`: al ensanchar el catálogo el suelo sube solo.
    const vocabulario = vocabularioDeEscenas(CATALOGO);
    assert.ok(vocabulario.length > 0, 'el catálogo no pide ni una escena de paraje');
    assert.deepEqual(vocabulario.map((e) => e.escena), [...vocabulario.map((e) => e.escena)].sort(), 'el vocabulario no sale en orden estable');
    assert.deepEqual(
      vocabulario.map((e) => e.escena),
      escenasPedidasPorElCatalogo(CATALOGO),
      'el vocabulario que produce el catálogo y el que consume la tubería no son el mismo',
    );

    // La aritmética del suelo: escenas distintas ÷ escenas por paraje, hacia arriba.
    const { suelo } = sueloDeParajes(CATALOGO);
    assert.equal(suelo, Math.ceil(vocabulario.length / ESCENAS_POR_PARAJE), 'el suelo no es el cociente del vocabulario');

    // Y es **superconjunto** del que daban las seis portadas: ampliar el catálogo
    // nunca estrecha lo que el mundo tiene que saber decir. Es el hueco 8 de la spec
    // —la batería comprobaba la aritmética, no esto— y aquí se cierra.
    const seis = CATALOGO.filter((p) => LAS_SEIS_PORTADAS.includes(p.id));
    const viejas = new Set(vocabularioDeEscenas(seis).map((e) => e.escena));
    const nuevas = new Set(vocabulario.map((e) => e.escena));
    for (const escena of viejas) assert.ok(nuevas.has(escena), `la escena "${escena}" que pedían las seis portadas ha desaparecido del vocabulario`);
    assert.ok(nuevas.size > viejas.size, `el catálogo de treinta pide ${nuevas.size} escenas y las seis pedían ${viejas.size}: ampliarlo no ha ensanchado el vocabulario`);
    assert.ok(sueloDeParajes(CATALOGO).suelo > sueloDeParajes(seis).suelo, 'ensanchar el catálogo no ha subido el suelo de parajes');

    // Un rol con escenas alternativas aporta **las dos**: son dos escenas distintas
    // que el mundo tiene que saber decir, y contar una sola dejaría medio vocabulario
    // sin cubrir el día que el casting eligiera la otra.
    const alternativas = CATALOGO.flatMap((p) => Object.values(p.roles).filter((r) => r.tipo === 'paraje' && Array.isArray(r.escena)));
    assert.ok(alternativas.length > 0, 'ningún rol del catálogo declara escenas alternativas: la comprobación siguiente no mide nada');
    for (const rol of alternativas) for (const escena of rol.escena) assert.ok(nuevas.has(escena), `la alternativa "${escena}" no está en el vocabulario`);

    // Toda escena que el catálogo pide la cubre algún tipo de paraje con peso
    // suficiente, y una que no la cubriera nadie hace fallar la carga nombrando la
    // plantilla, el rol y la escena.
    assert.equal(compruebaCoberturaDeEscenas({ catalogo: CATALOGO, taxonomia: PARAJE_INFO }), true);
    const inventada = copiaDe('entrega-sospechosa');
    inventada.roles.riesgo = { tipo: 'paraje', escena: 'naufragio' };
    assert.throws(
      () => compruebaCoberturaDeEscenas({ catalogo: [inventada], taxonomia: PARAJE_INFO }),
      (e) => e.message.includes('entrega-sospechosa') && e.message.includes('riesgo') && e.message.includes('naufragio'),
      'una escena que ningún tipo de paraje cubre se ha cargado en silencio',
    );
  });
});

// ── Lo que declara un desenlace, y los actos de relación ───────────────────────

describe('El catálogo declara lo que los mecanismos de otras filas consumen', () => {
  test('Cada desenlace declara su rumor, su mote, su oro y sus objetos', () => {
    let notables = 0;
    for (const p of CATALOGO) {
      // Si es notable sale de la **declaración** y no se deduce del texto ni de la
      // recompensa.
      assert.equal(typeof p.rumor.notable, 'boolean', `"${p.id}" no declara si su desenlace es notable`);
      assert.ok(Number.isInteger(p.desenlace.oro) && p.desenlace.oro >= 0, `"${p.id}" declara el oro como ${JSON.stringify(p.desenlace.oro)} y tiene que ser un entero no negativo`);
      if (!p.rumor.notable) { assert.equal(p.mote ?? null, null, `"${p.id}" no es notable y declara mote`); continue; }
      notables += 1;
      assert.ok(p.rumor.signo, `"${p.id}" es notable y no trae signo`);
      for (const campo of ['asunto', 'escala', 'detalle']) {
        assert.ok(p.rumor.semilla[campo] !== undefined, `la semilla de "${p.id}" no declara "${campo}"`);
      }
      assert.equal(typeof p.rumor.semilla.escala, 'object', `la escala de "${p.id}" es prosa y tiene que ser un hecho estructurado`);
      assert.equal(typeof p.rumor.semilla.detalle, 'object', `el detalle de "${p.id}" es prosa y tiene que ser un hecho estructurado`);
      // El mote es una **clave** y nunca un texto redactado.
      assert.match(p.mote, /^[a-záéíóúüñ0-9]+(-[a-záéíóúüñ0-9]+)*$/, `el mote de "${p.id}" está redactado: "${p.mote}"`);
    }
    // Al menos dos no notables: un mundo donde todo lo que haces se cuenta por los
    // caminos es un mundo sin volumen, y con una sola, retirarla deja sin caso el
    // escenario «El rumor solo aparece si el desenlace era notable».
    assert.ok(CATALOGO.length - notables >= 2, `solo ${CATALOGO.length - notables} plantillas tienen desenlace no notable y hacen falta dos`);

    // Cero oro es una declaración legítima, y el catálogo de hoy no la usa: todas
    // pagan algo. No se exige que exista —el criterio dice que cero *vale*, no que
    // haga falta—, pero sí que la validación la acepte, que es lo que hace que el
    // día que alguien escriba una aventura sin paga no tenga que tocar el motor.
    const sinPaga = { ...copiaDe('peregrinaje'), desenlace: { ...copiaDe('peregrinaje').desenlace, oro: 0 } };
    assert.doesNotThrow(() => compruebaCatalogo(conPlantilla(sinPaga)), 'un desenlace que no paga oro hace fallar la carga, y cero es una declaración legítima');

    // Las llaves: ninguna puerta declarada sin nadie que entregue una llave, y
    // ningún beat que solo se pueda resolver llevando el objeto.
    const puertas = beatsConObjeto(CATALOGO);
    assert.ok(puertas.length > 0, 'ningún beat del catálogo dispara con objeto: la comprobación no mide nada');
    for (const { plantilla, beat } of puertas) {
      const b = CATALOGO.find((p) => p.id === plantilla).beats[beat - 1];
      assert.ok(b.disparador.viaAlternativa?.texto, `el beat ${beat} de "${plantilla}" dispara con objeto y no declara vía alternativa con texto`);
    }
  });

  test('Los actos que rompen y los que reparan cuelgan de una decisión, nunca de no haber llegado', () => {
    const conActo = (signo) => CATALOGO.filter((p) => (p.relacion ?? []).some((e) => e.signo === signo));
    assert.ok(conActo('feo').length >= 3, `solo ${conActo('feo').length} plantillas declaran algún acto feo y hacen falta tres`);
    assert.ok(conActo('reparador').length >= 3, `solo ${conActo('reparador').length} plantillas declaran algún acto reparador y hacen falta tres`);

    for (const p of CATALOGO) {
      for (const efecto of p.relacion ?? []) {
        const rol = p.roles[efecto.rol];
        assert.ok(rol, `"${p.id}" declara un efecto sobre el rol huérfano "${efecto.rol}"`);
        assert.ok(['nucleo', 'servicio', 'humano'].includes(rol.tipo), `"${p.id}" declara un efecto sobre "${efecto.rol}", que es de tipo "${rol.tipo}" y no tiene cara`);
        assert.ok(['feo', 'reparador'].includes(efecto.signo), `el signo "${efecto.signo}" de "${p.id}" no está en el enumerado de dos valores`);
        assert.ok(Number.isInteger(efecto.beat) && efecto.beat >= 1 && efecto.beat <= p.beats.length, `el acto de "${p.id}" cuelga del beat ${efecto.beat}, que no existe`);
        // `quests.md` decisión 4: no se penaliza la ausencia. Un acto feo que se
        // disparase por plantarse sería reprochar por la puerta de atrás.
        assert.equal(
          DECISIONES_PROHIBIDAS.includes(efecto.decision),
          false,
          `el acto de "${p.id}" se dispara con "${efecto.decision}", que es una manera de no llegar (${DECISIONES_PROHIBIDAS.join(', ')})`,
        );
      }
    }
    // Y una plantilla sin ningún efecto no es un error: hay aventuras que no mueven
    // ninguna relación y eso es legítimo.
    const sinEfectos = CATALOGO.filter((p) => (p.relacion ?? []).length === 0);
    assert.ok(sinEfectos.length >= 0);
  });

  test('Los textos de fallback y los dos desenlaces de repuesto están completos y no reprochan nada', () => {
    for (const p of CATALOGO) {
      for (const cual of REPUESTOS) {
        assert.ok(typeof p.repuesto[cual] === 'string' && p.repuesto[cual].trim(), `"${p.id}" no declara el desenlace de repuesto "${cual}"`);
      }
      // Ningún texto del catálogo comenta que quien juega no fuese, no llegase o se
      // volviese: `quests.md` decisión 4 otra vez, por el lado de la prosa.
      for (const { donde, texto } of textosDelCatalogo([p])) {
        assert.equal(
          /no (fuiste|llegaste|apareciste|viniste)|te (rajaste|echaste atrás)|abandonaste|te volviste sin/i.test(texto),
          false,
          `el texto de ${donde} de "${p.id}" reprocha no haber ido: «${texto}»`,
        );
      }
    }

    // Los disparadores que traen texto propio: la franja, con la variante de llegar
    // dentro de ella, y el objeto, con el texto de la vía alternativa. Sin ellos la
    // aventura se queda muda justo por el lado que no es el camino previsto.
    let franjas = 0, puertas = 0;
    for (const p of CATALOGO) {
      p.beats.forEach((b, i) => {
        if (b.disparador.tipo === 'franja') { assert.ok(b.disparador.variante, `el beat ${i + 1} de "${p.id}" dispara en franja y no trae variante`); franjas += 1; }
        if (b.disparador.tipo === 'con_objeto') { assert.ok(b.disparador.viaAlternativa?.texto, `el beat ${i + 1} de "${p.id}" dispara con objeto y su vía alternativa no trae texto`); puertas += 1; }
      });
    }
    assert.ok(franjas > 0 && puertas > 0, `el catálogo no escribe ni franjas (${franjas}) ni puertas (${puertas}): las dos comprobaciones anteriores no miden nada`);

    // Todos los textos, no vacíos y dentro del tope de su clase.
    const textos = textosDelCatalogo(CATALOGO);
    assert.ok(textos.length > 0);
    for (const t of textos) {
      assert.ok(t.texto.trim().length > 0, `el texto de ${t.donde} de "${t.plantilla}" está vacío`);
      assert.ok(t.texto.length <= TOPES_DE_TEXTO[t.clase], `el texto de ${t.donde} de "${t.plantilla}" ocupa ${t.texto.length} y el tope de "${t.clase}" es ${TOPES_DE_TEXTO[t.clase]}`);
    }

    // Y no hay dos plantillas que abran el gancho con la misma fórmula: en voz alta
    // sonarían a la misma aventura.
    const aperturas = CATALOGO.map((p) => aperturaDeGancho(p.gancho));
    assert.equal(new Set(aperturas).size, aperturas.length, `dos ganchos abren igual: ${aperturas.filter((a, i) => aperturas.indexOf(a) !== i).join(', ')}`);
  });
});

// ── Las reglas de lenguaje ─────────────────────────────────────────────────────

describe('El lenguaje es inclusivo y el sesgo va hacia el femenino', () => {
  test('No se usa masculino genérico en fórmulas frecuentes', () => {
    // Cero infracciones sobre las cadenas del catálogo, familia por familia.
    const infracciones = [];
    for (const t of textosDelCatalogo(CATALOGO)) {
      for (const i of infraccionesDeTexto(t.texto, { locale: 'es' })) {
        if (i.familia !== 'masculinoGenerico' && i.familia !== 'desdoblamiento') continue;
        infracciones.push(`${t.plantilla} · ${t.donde}: ${i.formula} → «${i.fragmento}»`);
      }
    }
    assert.deepEqual(infracciones, [], `el catálogo usa masculino genérico o desdobla en vez de reformular:\n${infracciones.join('\n')}`);

    // **Y el filtro muerde.** Sin esto, un cero sería indistinguible de una lista de
    // reglas que no casan con nada.
    const cazadas = infraccionesDeTexto('Todos los vecinos salieron, y los vecinos y las vecinas lo cuentan.', { locale: 'es' });
    assert.ok(cazadas.some((i) => i.familia === 'masculinoGenerico'), 'el filtro de masculino genérico no caza «los vecinos»');
    assert.ok(cazadas.some((i) => i.familia === 'desdoblamiento'), 'el filtro no caza el desdoblamiento «los vecinos y las vecinas»');

    // La lista vive en el paquete de idioma y no dentro del catálogo, porque el mismo
    // filtro lo usará después el texto que escriba el LLM (fila 18).
    assert.equal(/masculinoGenerico|MASCULINO_GENERICO/.test(fuente('packages/nucleo/quests/templates.js')), false, 'las fórmulas viven dentro del catálogo');
    assert.ok(IDIOMAS_CON_REGLAS.includes('es') && IDIOMAS_CON_REGLAS.includes('gl'), 'los dos paquetes de idioma vivos no declaran reglas');
    assert.ok(FAMILIAS_DE_REGLA.includes('masculinoGenerico'));
  });

  test('No se usa morfología inventada', () => {
    const infracciones = [];
    for (const t of textosDelCatalogo(CATALOGO)) {
      for (const i of infraccionesDeTexto(t.texto, { locale: 'es' })) {
        if (i.familia !== 'morfologiaInventada') continue;
        infracciones.push(`${t.plantilla} · ${t.donde}: ${i.formula} → «${i.fragmento}»`);
      }
    }
    assert.deepEqual(infracciones, [], `el catálogo usa morfología inventada, que choca de frente con leerse en voz alta:\n${infracciones.join('\n')}`);
    for (const muestra of ['Bienvenides todes', 'les amigues del camino', 'l@s vecin@s']) {
      assert.ok(infraccionesDeTexto(muestra, { locale: 'es' }).some((i) => i.familia === 'morfologiaInventada'), `el filtro no caza «${muestra}»`);
    }

    // La forma que sí usa el proyecto: una **ranura** de un catálogo cerrado, que
    // resuelve el paquete de idioma contra el género gramatical de quien juega. Ni
    // dos textos, ni una barra.
    const conRanura = textosDelCatalogo(CATALOGO).filter((t) => ranurasDeTexto(t.texto).length > 0);
    assert.ok(conRanura.length > 0, 'ningún texto del catálogo usa ranuras: el mecanismo no lo prueba nadie');
    for (const t of conRanura) {
      for (const ranura of ranurasDeTexto(t.texto)) {
        assert.ok(RANURAS.includes(ranura), `el texto de ${t.donde} de "${t.plantilla}" usa la ranura "${ranura}", que no está en el catálogo cerrado`);
      }
      // Y se resuelve en los dos idiomas y en los dos géneros, sin dejar marcador.
      for (const locale of ['es', 'gl']) {
        for (const genero of IDS_DE_GENERO) {
          const resuelto = resuelveConcordancia(t.texto, { locale, genero });
          assert.equal(/\{[a-záéíóúüñ]+\}/.test(resuelto), false, `${t.plantilla} · ${t.donde} en ${locale}/${genero} deja un marcador en el texto`);
        }
      }
      // Sin género inyectado, femenino: es la decisión declarada del proyecto y no un
      // valor por defecto silencioso.
      assert.equal(resuelveConcordancia(t.texto, { locale: 'es' }), resuelveConcordancia(t.texto, { locale: 'es', genero: GENERO_POR_DEFECTO }));
      assert.equal(GENERO_POR_DEFECTO, 'femenino');
    }
    // Una ranura que el paquete de idioma no conoce falla nombrándola, en vez de
    // dejar la costura a la vista.
    assert.throws(() => resuelveConcordancia('Ven {valiente}.', { locale: 'es' }), (e) => e.message.includes('valiente') && e.message.includes('es'));
  });

  test('Ningún texto depende de un número que solo existe en la maqueta', async () => {
    // Ni una cifra escrita a mano, ni una unidad de esfuerzo, ni un recuento del
    // mundo: el juego no enseña distancia, tiempo, ritmo ni progreso, y la cantidad
    // de oro la pone el desenlace en ejecución y nunca está dentro del texto.
    const infracciones = [];
    for (const t of textosDelCatalogo(CATALOGO)) {
      for (const i of infraccionesDeTexto(t.texto, { locale: 'es' })) {
        if (i.familia !== 'cifras') continue;
        infracciones.push(`${t.plantilla} · ${t.donde}: ${i.formula} → «${i.fragmento}»`);
      }
    }
    assert.deepEqual(infracciones, [], `el catálogo escribe cifras dentro de sus textos:\n${infracciones.join('\n')}`);
    for (const muestra of ['Quedan 3 leguas', 'Camina veinte minutos', 'los tres núcleos del valle']) {
      assert.ok(infraccionesDeTexto(muestra, { locale: 'es' }).some((i) => i.familia === 'cifras'), `el filtro no caza «${muestra}»`);
    }

    // Y una cifra escrita a mano hace fallar la carga nombrando la plantilla y el
    // texto, en vez de dejarlo a una revisión humana: RF-LANG-003 es Must y el caso
    // que lo destapó —«hoy solo son dos nombres en un mapa»— pasó una revisión sin
    // que nadie lo viera.
    const conCifra = copiaDe('peregrinaje');
    conCifra.gancho = 'Quedan doce leguas hasta el alto, y el camino no perdona.';
    assert.throws(
      () => compruebaCatalogo(conPlantilla(conCifra)),
      (e) => e.message.includes('peregrinaje') && e.message.includes('gancho'),
      'una cifra escrita a mano se ha cargado en silencio',
    );

    // La otra mitad del escenario: sobre diez mundos distintos, ningún texto cambia
    // ni se vuelve falso, porque **ninguno depende del mundo**. Cada texto que la
    // aventura lleva encima es el mismo objeto de cadena que trae la plantilla.
    const vistos = new Map();
    let mundos = 0;
    for (const nombre of LOS_CUATRO) {
      const base = semillaDe(nombre, '1').split('#')[0];
      for (const n of ['1', '2', '3']) {
        const mundo = await generaMundo(nombre, `${base}#${n}`);
        mundos += 1;
        for (const c of mundo.casting.filter((x) => x.ok)) {
          const suyos = [c.aventura.titulo, c.aventura.gancho, ...c.beats.map((b) => b.escena.texto)].join(' ');
          const ya = vistos.get(c.plantilla);
          if (ya === undefined) { vistos.set(c.plantilla, suyos); continue; }
          assert.equal(suyos, ya, `"${c.plantilla}" cuenta cosas distintas en ${nombre}#${n} que en otro mundo: el texto depende de la maqueta`);
        }
      }
    }
    assert.ok(mundos >= 10, `solo se han generado ${mundos} mundos y el escenario pide diez`);
    assert.ok(vistos.size >= 20, `solo se han comprobado los textos de ${vistos.size} plantillas`);
  });

  test('Ningún texto del catálogo nombra el sitio real ni una categoría de OpenStreetMap', () => {
    // La mitad automatizable de «el chiste nunca es a costa del sitio real»: si el
    // texto no puede nombrar el sitio, la mitad fea del riesgo desaparece sin
    // depender de que alguien lo lea. La otra mitad —si tiene gracia y a costa de
    // qué— es `@manual`, y aquí solo se comprueba que cada plantilla traiga su fila.
    const infracciones = [];
    for (const t of textosDelCatalogo(CATALOGO)) {
      for (const i of infraccionesDeTexto(t.texto, { locale: 'es' })) {
        if (i.familia !== 'registroDeHoy') continue;
        infracciones.push(`${t.plantilla} · ${t.donde}: «${i.fragmento}»`);
      }
    }
    assert.deepEqual(infracciones, [], `el catálogo nombra el mundo de hoy en vez de nombrarlo en su propio registro:\n${infracciones.join('\n')}`);
    for (const muestra of ['El chiringuito de la playa', 'Te esperan en la farmacia', 'un bar con wifi']) {
      assert.ok(infraccionesDeTexto(muestra, { locale: 'es' }).some((i) => i.familia === 'registroDeHoy'), `el filtro no caza «${muestra}»`);
    }
    // Una plantilla sin revisar no entra: es la mitad del tono que ninguna aserción
    // captura, y dejarla como intención es como se pierde.
    for (const p of CATALOGO) {
      assert.ok(typeof p.revision === 'string' && p.revision.trim().length > 20, `"${p.id}" no trae su fila de revisión a mano`);
    }
  });
});

// ── Determinismo y estabilidad del catálogo ────────────────────────────────────

describe('El mundo es una función de la semilla y de los datos de OSM · el catálogo', () => {
  test('Ampliar el catálogo no resiembra el reparto de las demás plantillas', async () => {
    const mundo = await mundoDe('costero', '1');
    const encuadre = exigeEncuadre(mundo);
    const esqueleto = (c) => (!c.ok ? { ok: false, motivo: c.motivo } : { ok: true, beats: c.beats.map((b) => `${b.n}:${b.rol}:${b.lugar.nombre}`) });

    // Y lo generado no se resiembra: ampliar el catálogo no mueve ni un byte del
    // mundo, que es la mitad del contrato con SPEC-006 —el vocabulario se inyecta al
    // generar la celda, y una celda ya abierta se queda con el suyo congelado—.
    const antes = JSON.stringify({ settlements: mundo.settlements, parajes: mundo.parajes, routes: mundo.routes, seed: mundo.seed });

    const entero = casteaCatalogo({ ...encuadre, mundo, catalogo: CATALOGO, semilla: mundo.seed });
    // Una plantilla nueva al final: el reparto de las demás no se mueve ni un beat.
    const nueva = { ...copiaDe('peregrinaje'), id: 'plantilla-anadida-al-final' };
    const conUnaMas = casteaCatalogo({ ...encuadre, mundo, catalogo: [...CATALOGO, nueva], semilla: mundo.seed });
    for (const c of entero) {
      assert.deepEqual(esqueleto(conUnaMas.find((x) => x.plantilla === c.plantilla)), esqueleto(c), `${c.plantilla}: añadir una plantilla al final ha movido su reparto`);
    }
    // Y recibir el catálogo en otro orden tampoco.
    const alReves = casteaCatalogo({ ...encuadre, mundo, catalogo: [...CATALOGO].reverse(), semilla: mundo.seed });
    for (const c of entero) {
      assert.deepEqual(esqueleto(alReves.find((x) => x.plantilla === c.plantilla)), esqueleto(c), `${c.plantilla}: el orden del catálogo cambia su reparto`);
    }
    // Dos casteos del mismo catálogo sobre el mismo mundo dan lo mismo.
    assert.deepEqual(
      casteaCatalogo({ ...encuadre, mundo, catalogo: CATALOGO, semilla: mundo.seed }).map(esqueleto),
      entero.map(esqueleto),
      'dos casteos del mismo catálogo dan repartos distintos',
    );
    assert.equal(
      JSON.stringify({ settlements: mundo.settlements, parajes: mundo.parajes, routes: mundo.routes, seed: mundo.seed }),
      antes,
      'castear el catálogo ampliado ha movido algo del mundo ya generado',
    );
  });
});
