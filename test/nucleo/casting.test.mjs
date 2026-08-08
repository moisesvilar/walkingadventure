// SPEC-002 · El casting sobre el mundo que genera el paquete compartido.
// SPEC-010 · El casting de aventuras contra el mundo: reparto, presupuesto, lazo,
//            cadena de beats y **el motivo del fallo como dato**.
//
// El porte de SPEC-002 no cambió ni una decisión de casting: lo que se afirmaba
// allí es que seguía siendo determinista, y ese caso sigue vivo abajo, ampliado.
//
// Lo que SPEC-010 añade se mide con números y no con adjetivos, porque el casting
// es lo único de este repo que ya tiene un indicador de salud: sobre los ocho
// extractos de referencia castean **30 lazos de 48**, todos cierran, ninguno de sus
// trechos pasa de un tramo **medido sobre el grafo**, y los 18 que no castean
// reparten su motivo en un histograma que se cuenta sin parsear ni una frase.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Cuatro
// no lo son y van marcados como hueco en test/spec-test-map.json: el motivo
// estructurado, la franja que no bloquea (RF-QUEST-004, ⚠ sin escenario en el PRD),
// el guiado por nombres y la validación de la plantilla. La propia spec los declara
// en su sección de huecos.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema: los mundos salen de
// test/fixtures/osm/ por el doble de siempre.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import {
  CERCA_DE_LA_PARTIDA_EN_TRAMOS,
  MINIMO_DE_TRECHO_EN_TRAMOS,
  TOPE_DE_TRECHO_EN_TRAMOS,
  castAll,
  casteaCatalogo,
  casteaPlantilla,
  castTemplate,
  candidatosDeRol,
  exigeEncuadre,
  medidorDeTrechos,
  requisitoDeRol,
} from '../../packages/nucleo/quests/casting.js';
import { CLAVES_DE_MOTIVO, MOTIVOS_DE_CASTING, claveDeMotivo, motivoDeCasting } from '../../packages/nucleo/quests/motivos.js';
import { DISPARADORES, FRANJA_DIURNA, IDS_DE_FRANJA, RESULTADOS, TIPOS_DE_ROL, franjaDe, guiadoDeBeat } from '../../packages/nucleo/quests/aventura.js';
import { TEMPLATES } from '../../packages/nucleo/quests/templates.js';
import { IDS_DE_TAMANO, RANGO_DE_BEATS } from '../../packages/nucleo/partida/salida.js';
import { PESO_MINIMO_DE_ESCENA } from '../../packages/nucleo/world/escenas.js';
import { SUFIJOS_DE_FASE } from '../../packages/nucleo/core/semilla.js';

const LOS_OCHO = ['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso']
  .flatMap((nombre) => ['1', '2'].map((semilla) => ({ nombre, semilla, clave: `${nombre}#${semilla}` })));

// Un mundo por clave y no uno por caso: generar los ocho cuesta unos tres segundos
// y aquí se miran ocho veces. La caché no toca el determinismo —el mundo es función
// de la semilla y del fixture— y ningún caso muta lo que recibe.
const MUNDOS = new Map();
async function mundoDe(nombre, semilla) {
  const clave = `${nombre}#${semilla}`;
  if (!MUNDOS.has(clave)) MUNDOS.set(clave, await generaMundo(nombre, semillaDe(nombre, semilla)));
  return MUNDOS.get(clave);
}

/** Los ocho mundos con su casting ya hecho por la tubería. */
async function losOchoCasteados() {
  const out = [];
  for (const { nombre, semilla, clave } of LOS_OCHO) {
    const mundo = await mundoDe(nombre, semilla);
    out.push({ clave, mundo, casting: mundo.casting });
  }
  return out;
}

/** El reparto de un casteo, en la forma comparable que ya usaba SPEC-002. */
const reparto = (casting) =>
  casting.map((c) => ({
    plantilla: c.tpl.id,
    castea: c.ok,
    motivo: c.motivo ?? null,
    beats: c.ok ? c.beats.map((b) => `${b.n}:${b.rol}:${b.lugar.nombre}`) : null,
  }));

/** La estructura entera de una aventura **sin un solo texto**: es lo que el código fija. */
const esqueleto = (c) => (!c.ok ? { castea: false, motivo: c.motivo } : {
  castea: true,
  plantilla: c.plantilla,
  tamano: c.aventura.tamano,
  dador: { rol: c.aventura.dador.rol, lugar: c.aventura.dador.lugar.nombre },
  beats: c.beats.map((b) => ({
    n: b.n,
    rol: b.rol,
    lugar: `${b.lugar.tipo}|${b.lugar.nombre}|${Math.round(b.lugar.x)},${Math.round(b.lugar.y)}`,
    disparador: b.disparador.tipo,
    franja: b.disparador.franja ?? null,
    objeto: b.disparador.objeto ?? null,
    escena: b.escena.tipo,
    afinidadUsada: b.escena.afinidadUsada,
    resultado: b.resultado.tipo,
    siguienteBeat: b.resultado.siguienteBeat,
    destino: b.guiado.destino,
    calzadas: b.guiado.calzadas,
    marca: b.guiado.marca,
  })),
  presupuesto: c.presupuesto,
});

/** Una copia profunda y editable de una plantilla del catálogo. */
const copiaDe = (id) => JSON.parse(JSON.stringify(TEMPLATES.find((t) => t.id === id)));

/** El código de un módulo del paquete sin sus comentarios: lo que se afirma es el código. */
function codigoSinComentarios(ruta) {
  return fuente(ruta).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Todo par clave/valor de un dato, a cualquier profundidad. */
function recorre(valor, visita, ruta = '') {
  if (Array.isArray(valor)) valor.forEach((v, i) => recorre(v, visita, `${ruta}[${i}]`));
  else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) { visita(k, v, `${ruta}.${k}`); recorre(v, visita, `${ruta}.${k}`); }
  }
}

// ── El reparto y su motivo ─────────────────────────────────────────────────────

describe('Una quest se castea contra el mundo o no se ofrece', () => {
  test('El casting es determinista', async () => {
    const world = await mundoDe('costero', '1');
    assert.deepEqual(reparto(castAll(world)), reparto(castAll(world)), 'dos casteos del mismo catálogo dan repartos distintos');
    // Y el que trae el mundo generado es el mismo: la tubería no castea aparte.
    assert.deepEqual(reparto(world.casting), reparto(castAll(world)));

    // SPEC-010 · El azar se siembra **por plantilla**, con `:cast:<id>`, y de ahí
    // salen las tres afirmaciones que siguen: castear una sola da lo mismo que
    // castear el catálogo entero, recibirlo en otro orden no mueve nada, y añadir
    // una plantilla al catálogo no puede desplazar el reparto de las demás.
    const encuadre = exigeEncuadre(world);
    const entero = casteaCatalogo({ ...encuadre, mundo: world, catalogo: TEMPLATES, semilla: world.seed });
    for (const plantilla of TEMPLATES) {
      const sola = castTemplate(world, plantilla);
      const delCatalogo = entero.find((c) => c.plantilla === plantilla.id);
      assert.deepEqual(esqueleto(sola), esqueleto(delCatalogo), `${plantilla.id}: castear una sola no da el mismo reparto que castear el catálogo`);
    }
    const alReves = casteaCatalogo({ ...encuadre, mundo: world, catalogo: [...TEMPLATES].reverse(), semilla: world.seed });
    for (const c of alReves) {
      assert.deepEqual(esqueleto(c), esqueleto(entero.find((e) => e.plantilla === c.plantilla)), `${c.plantilla}: el orden del catálogo cambia su reparto`);
    }

    // Ninguna fuente de azar ni de tiempo del sistema en toda el área de quests.
    for (const modulo of ['packages/nucleo/quests/casting.js', 'packages/nucleo/quests/aventura.js', 'packages/nucleo/quests/motivos.js', 'packages/nucleo/quests/templates.js']) {
      const codigo = codigoSinComentarios(modulo);
      assert.equal(/\bMath\.random\s*\(/.test(codigo), false, `${modulo}: usa Math.random()`);
      assert.equal(/\bDate\.now\s*\(|\bnew\s+Date\b|\bperformance\.now\s*\(/.test(codigo), false, `${modulo}: lee el reloj del sistema`);
    }

    // Y castear no resiembra ni toca el mundo: ni un byte distinto después.
    const antes = JSON.stringify({ settlements: world.settlements, parajes: world.parajes, routes: world.routes, seed: world.seed });
    castAll(world);
    assert.equal(JSON.stringify({ settlements: world.settlements, parajes: world.parajes, routes: world.routes, seed: world.seed }), antes, 'castear ha movido algo del mundo');

    // El azar sale de `makeRng` con el sufijo de fase del casting y el identificador
    // de la plantilla, y no de otra siembra: es lo que hace que crecer a treinta
    // plantillas no resiembre el reparto de las seis de hoy.
    assert.equal(SUFIJOS_DE_FASE.casting, ':cast');
    assert.match(
      codigoSinComentarios('packages/nucleo/quests/casting.js'),
      /makeRng\(\s*semilla \+ SUFIJOS_DE_FASE\.casting \+ ':' \+ plantilla\.id\s*\)/,
      'la siembra del casting ha dejado de ser por plantilla con el sufijo de fase',
    );

    // El orden de resolución de los roles **se declara**: cambiar el orden de
    // escritura del objeto de roles no mueve el reparto, y una plantilla sin
    // `orden` no se castea a ciegas.
    const original = copiaDe('tres-pistas');
    const permutada = { ...original, roles: Object.fromEntries(Object.entries(original.roles).reverse()) };
    assert.notDeepEqual(Object.keys(permutada.roles), Object.keys(original.roles), 'la permutación no ha cambiado nada: el caso no comprueba nada');
    assert.deepEqual(esqueleto(castTemplate(world, permutada)), esqueleto(castTemplate(world, original)), 'el reparto depende del orden de escritura del objeto de roles');
    const sinOrden = { ...original };
    delete sinOrden.orden;
    assert.throws(() => castTemplate(world, sinOrden), /orden de resolución/, 'una plantilla sin orden declarado se ha casteado igual');
  });

  test('Una plantilla sin candidatos no se ofrece', async () => {
    // El mundo del escenario: `suelo-250m` no tiene ni un paraje, así que ninguno
    // cubre la escena de guarida que pide `entrega-sospechosa`.
    const mundo = await mundoDe('suelo-250m', '1');
    assert.deepEqual(
      mundo.parajes.filter((p) => (p.scenes.guarida ?? 0) > 0).map((p) => p.name),
      [],
      'el mundo mínimo ha empezado a tener parajes con escena de guarida: el escenario ya no mide lo que dice',
    );
    const guarida = TEMPLATES.find((t) => t.id === 'entrega-sospechosa');
    assert.deepEqual(candidatosDeRol(mundo, guarida.roles.riesgo), [], 'hay candidatos para la guarida: el caso no comprueba nada');

    const c = castTemplate(mundo, guarida);
    assert.equal(c.ok, false, 'una plantilla sin ni un candidato para uno de sus roles se ha ofrecido igual');
    assert.equal(c.aventura, undefined, 'una plantilla que no castea entrega aventura');
    // Y el motivo queda explicado: clave del catálogo, el rol que no se pudo
    // resolver y el requisito que ese rol pedía, los tres como dato.
    assert.equal(c.motivo.clave, MOTIVOS_DE_CASTING.SIN_CANDIDATOS);
    assert.deepEqual([...c.motivo.roles], ['riesgo'], 'el motivo no nombra el rol que no se pudo resolver');
    assert.deepEqual(c.motivo.requisito, requisitoDeRol(guarida.roles.riesgo), 'el motivo no lleva dentro el requisito que el rol pedía');
    assert.deepEqual(c.motivo.requisito.escenas, ['guarida']);

    // El catálogo entero sobre el mundo mínimo: una entrada por plantilla, castee o
    // no, y ninguna se omite de la lista.
    const catalogo = castAll(mundo);
    assert.deepEqual(catalogo.map((x) => x.plantilla), TEMPLATES.map((t) => t.id), 'el resultado no trae una entrada por plantilla, en el orden del catálogo');
    for (const x of catalogo) {
      if (x.ok) assert.equal(x.motivo, undefined, `${x.plantilla}: una plantilla que castea trae motivo`);
      else assert.ok(CLAVES_DE_MOTIVO.includes(x.motivo.clave), `${x.plantilla}: no trae motivo de catálogo`);
    }

    // Un mundo sin **nada**: ninguna se ofrece y cada una trae su motivo.
    const vacio = { ...mundo, settlements: [], parajes: [] };
    const sinNada = casteaCatalogo({ ...exigeEncuadre(mundo), mundo: vacio, grafo: mundo.viario, catalogo: TEMPLATES, semilla: mundo.seed });
    assert.equal(sinNada.length, TEMPLATES.length);
    for (const x of sinNada) {
      assert.equal(x.ok, false, `${x.plantilla}: castea en un mundo sin núcleos, servicios ni parajes`);
      assert.equal(x.motivo.clave, MOTIVOS_DE_CASTING.SIN_CANDIDATOS);
    }

    // Y un catálogo vacío devuelve una lista vacía, no un error.
    assert.deepEqual(casteaCatalogo({ ...exigeEncuadre(mundo), mundo, catalogo: [], semilla: mundo.seed }), []);
  });

  test('El casting no mira lo descubierto', async () => {
    const mundo = await mundoDe('costero', '1');

    // Los dos estados de conocimiento del escenario: nada pisado y todo pisado. Se
    // marcan sobre copias del mundo porque la capa de descubrimiento todavía no
    // existe; lo que se afirma es que **ninguna marca de este tipo puede cambiar
    // nada**, hoy ni cuando la capa llegue.
    const conMarca = (mundo, visitado) => ({
      ...mundo,
      settlements: mundo.settlements.map((s) => ({ ...s, visitado, descubierto: visitado, services: s.services.map((v) => ({ ...v, visitado, descubierto: visitado })) })),
      parajes: mundo.parajes.map((p) => ({ ...p, visitado, descubierto: visitado })),
    });
    const encuadre = exigeEncuadre(mundo);
    const sinPisar = casteaCatalogo({ ...encuadre, mundo: conMarca(mundo, false), grafo: mundo.viario, catalogo: TEMPLATES, semilla: mundo.seed });
    const todoPisado = casteaCatalogo({ ...encuadre, mundo: conMarca(mundo, true), grafo: mundo.viario, catalogo: TEMPLATES, semilla: mundo.seed });
    assert.deepEqual(sinPisar.map(esqueleto), todoPisado.map(esqueleto), 'castea distinto según lo que el jugador haya pisado');
    assert.deepEqual(sinPisar.map(esqueleto), castAll(mundo).map(esqueleto), 'el casting de la tubería no coincide con el de un mundo sin nada pisado');
    assert.ok(sinPisar.some((c) => c.ok), 'no castea ninguna plantilla: el caso no comprueba nada');

    // Los parajes sin pisar son candidatos igual que los demás: el pool de un rol
    // de paraje es todo el que cubre la escena, sin excepción.
    const rol = { tipo: 'paraje', escena: 'guarida' };
    const candidatos = candidatosDeRol(mundo, rol);
    assert.ok(candidatos.length > 0, 'ningún paraje cubre la guarida en el costero: el caso no comprueba nada');
    assert.deepEqual(
      candidatos.map((c) => c.nombre).sort(),
      mundo.parajes.filter((p) => (p.scenes.guarida ?? 0) >= 0.2).map((p) => p.name).sort(),
      'el pool de candidatos no son todos los parajes que cubren la escena',
    );
    // Y a un sitio al que te mandan te lo nombran aunque no hayas ido.
    for (const c of candidatos) assert.equal(typeof c.nombre === 'string' && c.nombre.length > 0, true, 'un candidato viaja sin nombre propio');
    for (const c of castAll(mundo).filter((x) => x.ok)) {
      for (const b of c.beats) assert.ok(b.lugar.nombre && b.guiado.destino === b.lugar.nombre, `${c.plantilla} beat ${b.n}: el lugar no viaja con su nombre propio`);
    }

    // El estado de conocimiento no está entre las entradas del motor, y el motor no
    // lo consulta en ningún punto. Se mira el **código**, sin comentarios: los de
    // casting.js hablan de lo descubierto a propósito, para decir que no está.
    const params = casteaPlantilla.toString().slice(0, casteaPlantilla.toString().indexOf('}'));
    assert.equal(/descubiert|visitad|pisad|conocid|explorad|niebla/i.test(params), false, `el casting recibe el conocimiento del mapa entre sus entradas: ${params}`);
    for (const modulo of ['packages/nucleo/quests/casting.js', 'packages/nucleo/quests/aventura.js']) {
      const codigo = codigoSinComentarios(modulo);
      assert.equal(/\.(descubiert|visitad|pisad|conocid|explorad)/i.test(codigo), false, `${modulo}: consulta el nivel de conocimiento de un elemento del mundo`);
      assert.equal(/from '\.\.\/partida\/mapa\.js'/.test(codigo), false, `${modulo}: importa el mapa, que es donde vive lo descubierto`);
    }
  });

  test('Todo lazo casteado se cierra', async () => {
    let lazos = 0;
    for (const { clave, mundo, casting } of await losOchoCasteados()) {
      const { tramoM, partida } = exigeEncuadre(mundo);
      const medida = medidorDeTrechos(mundo.viario, []);
      for (const c of casting.filter((x) => x.ok)) {
        const primero = c.beats[0].lugar;
        const ultimo = c.beats[c.beats.length - 1].lugar;
        // Se remide sobre el grafo, aquí, en vez de creerle al presupuesto: si el
        // motor midiera de otra manera que la que dice, esto es lo que lo vería.
        const ida = medida.metros(partida, primero);
        const vuelta = medida.metros(ultimo, partida);
        assert.notEqual(ida, null, `${clave} · ${c.plantilla}: no hay camino en el grafo del punto de partida al primer beat`);
        assert.notEqual(vuelta, null, `${clave} · ${c.plantilla}: no hay camino en el grafo del último beat al punto de partida`);
        const cerca = CERCA_DE_LA_PARTIDA_EN_TRAMOS * tramoM;
        assert.ok(ida <= cerca, `${clave} · ${c.plantilla}: el primer beat está a ${(ida / tramoM).toFixed(2)} tramos del punto de partida, y el tope es ${CERCA_DE_LA_PARTIDA_EN_TRAMOS}`);
        assert.ok(vuelta <= cerca, `${clave} · ${c.plantilla}: el último beat está a ${(vuelta / tramoM).toFixed(2)} tramos del punto de partida, y el tope es ${CERCA_DE_LA_PARTIDA_EN_TRAMOS}`);
        // Y el presupuesto dice lo mismo que la remedida, en tramos.
        assert.ok(Math.abs(c.presupuesto.enTramos.ida - ida / tramoM) < 1e-9, `${clave} · ${c.plantilla}: el presupuesto declara otra ida`);
        assert.ok(Math.abs(c.presupuesto.enTramos.vuelta - vuelta / tramoM) < 1e-9, `${clave} · ${c.plantilla}: el presupuesto declara otra vuelta`);
        // El recorrido incluye la ida y la vuelta: un lazo medido solo entre beats
        // esconde justo los dos trechos que decide el punto de partida.
        assert.ok(c.presupuesto.metros.recorrido >= ida + vuelta - 1e-9, `${clave} · ${c.plantilla}: el recorrido total no incluye la ida y la vuelta`);
        lazos += 1;
      }
    }
    // Sin excepciones por tamaño y con número: son los 30 lazos que castean sobre
    // los ocho extractos de referencia, el suelo que dictaminó §6m.
    assert.equal(lazos, 30, `han cerrado ${lazos} lazos y sobre los ocho extractos castean 30: el indicador de salud del casting se ha movido`);
  });

  test('El presupuesto de beats sale del tamaño declarado', async () => {
    // Los tres rangos son los del esquema de la batería —paseo 4-6, aventura 6-10,
    // jornada 10-14— y salen del módulo de tamaños de salida: el casting no puede
    // tener su propia tabla, que es como se desincronizan dos tablas del mismo dato.
    assert.deepEqual(RANGO_DE_BEATS, {
      paseo: { minimo: 4, maximo: 6 },
      aventura: { minimo: 6, maximo: 10 },
      jornada: { minimo: 10, maximo: 14 },
    });
    assert.deepEqual([...IDS_DE_TAMANO], ['paseo', 'aventura', 'jornada']);

    let lazos = 0, trechos = 0;
    for (const { clave, mundo, casting } of await losOchoCasteados()) {
      const { tramoM } = exigeEncuadre(mundo);
      const medida = medidorDeTrechos(mundo.viario, []);
      for (const c of casting.filter((x) => x.ok)) {
        const rango = RANGO_DE_BEATS[c.tpl.tamano];
        assert.equal(c.aventura.tamano, c.tpl.tamano, `${clave} · ${c.plantilla}: el tamaño de la aventura no es el que declaró la plantilla`);
        assert.equal(c.presupuesto.tamano, c.tpl.tamano, `${clave} · ${c.plantilla}: el presupuesto deduce el tamaño en vez de leerlo`);
        assert.ok(
          c.beats.length >= rango.minimo && c.beats.length <= rango.maximo,
          `${clave} · ${c.plantilla}: ${c.beats.length} beats para un "${c.tpl.tamano}", que admite entre ${rango.minimo} y ${rango.maximo}`,
        );

        // Ningún trecho supera un tramo, **medido sobre el grafo** y no en línea
        // recta por un factor de rodeo. Se remide aquí por lo mismo que el lazo.
        for (let i = 0; i < c.beats.length - 1; i++) {
          if (c.beats[i].rol === c.beats[i + 1].rol) continue; // el mismo sitio: no hay trecho
          const m = medida.metros(c.beats[i].lugar, c.beats[i + 1].lugar);
          assert.notEqual(m, null, `${clave} · ${c.plantilla}: no hay camino en el grafo entre los beats ${i + 1} y ${i + 2}`);
          assert.ok(m <= TOPE_DE_TRECHO_EN_TRAMOS * tramoM, `${clave} · ${c.plantilla}: el trecho ${i + 1}→${i + 2} son ${(m / tramoM).toFixed(2)} tramos y el tope es ${TOPE_DE_TRECHO_EN_TRAMOS}`);
          assert.ok(m >= MINIMO_DE_TRECHO_EN_TRAMOS * tramoM, `${clave} · ${c.plantilla}: el trecho ${i + 1}→${i + 2} son ${(m / tramoM).toFixed(3)} tramos y dos beats no pueden caer pegados`);
          trechos += 1;
        }
        assert.ok(c.presupuesto.enTramos.trechoMasLargo <= TOPE_DE_TRECHO_EN_TRAMOS + 1e-9, `${clave} · ${c.plantilla}: el trecho más largo del presupuesto pasa del tope`);
        assert.ok(c.presupuesto.enTramos.recorrido <= c.presupuesto.enTramos.alcance + 1e-9, `${clave} · ${c.plantilla}: el recorrido no cabe en el alcance de su tamaño`);
        lazos += 1;
      }
    }
    assert.equal(lazos, 30, `${lazos} lazos casteados y sobre los ocho extractos son 30`);
    assert.ok(trechos >= 60, `solo se han medido ${trechos} trechos: el tope apenas se está verificando`);

    // El tope se expresa en **tramos**, y el casting no tiene ni un metro ni un
    // ritmo escrito a mano: el prototipo codificaba MIN_LEG, MAX_LEG, DETOUR = 1,35
    // y M_PER_MIN = 72, que eran un jugador de dos kilómetros por media hora.
    assert.equal(TOPE_DE_TRECHO_EN_TRAMOS, 1, 'el tope de trecho ha dejado de ser un tramo, que es media hora al ritmo de quien juega');
    const codigo = codigoSinComentarios('packages/nucleo/quests/casting.js');
    assert.equal(/\bMIN_LEG\b|\bMAX_LEG\b|\bDETOUR\b|\bM_PER_MIN\b/.test(codigo), false, 'el casting conserva alguna constante en metros o en minutos del prototipo');
    const gordos = (codigo.match(/\b\d+(\.\d+)?\b/g) ?? []).map(Number).filter((n) => n >= 60);
    assert.deepEqual(gordos, [], `el casting lleva cifras escritas a mano a escala de metros o de minutos: ${gordos.join(', ')}`);

    // Y una plantilla cuyo número de beats no cabe en su tamaño no se ofrece, con
    // su motivo; una que declara un tamaño que no existe hace fallar la entrega.
    const mundo = await mundoDe('costero', '1');
    const enorme = { ...copiaDe('entrega-sospechosa'), tamano: 'jornada' };
    const fallo = castTemplate(mundo, enorme);
    assert.equal(fallo.ok, false);
    assert.equal(fallo.motivo.clave, MOTIVOS_DE_CASTING.BEATS_FUERA_DEL_TAMANO);
    assert.deepEqual(fallo.motivo.requisito, { tamano: 'jornada', beats: 4, minimo: 10, maximo: 14 });
    assert.throws(
      () => castTemplate(mundo, { ...copiaDe('entrega-sospechosa'), tamano: 'excursion' }),
      (e) => /"excursion"/.test(e.message) && IDS_DE_TAMANO.every((id) => e.message.includes(id)),
      'un tamaño que no existe no hace fallar la entrega nombrándolo y enumerando los tres válidos',
    );
  });

  test('Fallar por no llegar es casi imposible', async () => {
    // No hay tiempos límite en ninguna parte de ninguna aventura casteada, y no los
    // hay **por estructura**: se recorre el dato entero buscando cualquier campo por
    // el que una regla pudiera dar un beat por perdido, y cualquier fecha u hora del
    // reloj real. Lo único temporal que sobrevive son las franjas, que son minutos
    // desde medianoche del mundo y no cancelan nada.
    const prohibidos = /limite|l[ií]mite|plazo|caduc|expir|deadline|vence|cronom|temporizador|cuenta ?atr[áa]s|fallid/i;
    const fechaReal = /\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}|GMT|UTC|\bZ$/;

    let aventuras = 0, conFranja = 0;
    for (const { clave, casting } of await losOchoCasteados()) {
      for (const c of casting.filter((x) => x.ok)) {
        recorre(c.aventura, (campo, valor, ruta) => {
          assert.equal(prohibidos.test(campo), false, `${clave} · ${c.plantilla}: la aventura lleva el campo "${campo}" en ${ruta}, por el que un beat se podría perder sin decisión del jugador`);
          if (typeof valor === 'string') {
            assert.equal(fechaReal.test(valor), false, `${clave} · ${c.plantilla}: ${ruta} lleva una fecha o una hora del reloj real: «${valor}»`);
          }
        });
        for (const b of c.beats) {
          // Los únicos minutos que un beat puede llevar son los de su franja, y son
          // del mundo: minutos desde medianoche, no un instante del reloj.
          if (b.disparador.tipo === 'franja') {
            assert.ok(IDS_DE_FRANJA.includes(b.disparador.franja.id));
            assert.ok(Number.isInteger(b.disparador.franja.desdeMin) && Number.isInteger(b.disparador.franja.hastaMin));
            conFranja += 1;
          }
        }
        // La estimación de tiempo es informativa: va en tramos —medias horas al
        // ritmo de quien juega— y ninguna regla bifurca por ella. Se comprueba
        // tardando el triple: la aventura es la misma, beat a beat.
        assert.equal(c.presupuesto.estimacionEnTramos, c.presupuesto.enTramos.recorrido, 'la estimación no es el recorrido en tramos');
        const alTriple = { ...c.aventura, presupuesto: { ...c.presupuesto, estimacionEnTramos: c.presupuesto.estimacionEnTramos * 3 } };
        assert.deepEqual(alTriple.beats, c.aventura.beats, `${clave} · ${c.plantilla}: tardar el triple pierde algún beat`);
        aventuras += 1;
      }
    }
    assert.equal(aventuras, 30, `${aventuras} aventuras casteadas y sobre los ocho extractos son 30`);
    assert.ok(conFranja > 0, 'ninguna aventura casteada lleva franja: la parte que más se podría parecer a un tiempo límite no se está mirando');
  });
});

// ── El motivo del fallo, y el histograma que lo cuenta ──────────────────────────

describe('El motivo del fallo es un dato, no una frase', () => {
  test('El motivo del fallo es un dato y el histograma se agrega sin parsear ninguna frase', async () => {
    const histograma = new Map();
    let ok = 0, fallos = 0;
    const idiomas = new Set();

    for (const { clave, mundo, casting } of await losOchoCasteados()) {
      idiomas.add(mundo.locale);
      for (const c of casting) {
        if (c.ok) { ok += 1; assert.equal(c.motivo, undefined, `${clave} · ${c.plantilla}: una plantilla que castea trae motivo`); continue; }
        fallos += 1;
        const m = c.motivo;
        // Clave de un catálogo cerrado y enumerable, contada tal cual: si esto
        // hubiera que parsearlo, el informe de salud sería una lectura y no una
        // medida.
        assert.ok(CLAVES_DE_MOTIVO.includes(m.clave), `${clave} · ${c.plantilla}: motivo fuera del catálogo cerrado (${m.clave})`);
        assert.equal(claveDeMotivo(m), m.clave);
        histograma.set(m.clave, (histograma.get(m.clave) ?? 0) + 1);

        // Nombra el rol o los roles implicados y el requisito que pedían, y ninguna
        // de sus cadenas es una frase redactada: identificadores, no prosa.
        assert.ok(m.roles.length > 0, `${clave} · ${c.plantilla}: el motivo no nombra ningún rol`);
        for (const rol of m.roles) assert.ok(Object.prototype.hasOwnProperty.call(c.tpl.roles, rol), `${clave} · ${c.plantilla}: el motivo nombra el rol "${rol}", que no es de la plantilla`);
        assert.equal(typeof m.requisito, 'object', `${clave} · ${c.plantilla}: el requisito del motivo no es un dato estructurado`);
        recorre(m, (campo, valor, ruta) => {
          if (typeof valor !== 'string') return;
          assert.equal(/\s/.test(valor), false, `${clave} · ${c.plantilla}: ${ruta} lleva una frase redactada dentro del motivo: «${valor}»`);
        });
        // Y el trecho que no casó nombra **los dos** roles, no uno.
        if (m.clave === MOTIVOS_DE_CASTING.TRECHO_FUERA_DEL_TOPE || m.clave === MOTIVOS_DE_CASTING.TRECHO_POR_DEBAJO_DEL_MINIMO) {
          assert.equal(m.roles.length, 2, `${clave} · ${c.plantilla}: un motivo por trechos tiene que nombrar los dos roles`);
        }
      }
    }

    // El histograma, con número. Es la medida de salud del generador que este
    // proyecto sí lleva, y sale de contar claves.
    assert.equal(ok, 30, `castean ${ok} de 48 y el suelo dictaminado en §6m es 30`);
    assert.equal(ok + fallos, 48, 'los ocho extractos por seis plantillas son 48 entradas, castee o no');
    assert.deepEqual(
      Object.fromEntries([...histograma].sort()),
      { 'lazo-que-no-cierra': 1, 'sin-candidatos': 17 },
      'el histograma de motivos de fallo se ha movido',
    );

    // La clave no cambia con el idioma del mundo: los ocho extractos incluyen
    // mundos en gallego y en castellano y reparten las mismas claves.
    assert.ok(idiomas.size > 1, `los ocho extractos son todos del mismo idioma (${[...idiomas]}): la afirmación sobre el idioma no mide nada`);

    // El catálogo es enumerable y cubre al menos las seis causas que la spec pide.
    assert.deepEqual(
      [
        MOTIVOS_DE_CASTING.SIN_CANDIDATOS,
        MOTIVOS_DE_CASTING.TRECHO_FUERA_DEL_TOPE,
        MOTIVOS_DE_CASTING.RECORRIDO_FUERA_DEL_TAMANO,
        MOTIVOS_DE_CASTING.BEATS_FUERA_DEL_TAMANO,
        MOTIVOS_DE_CASTING.LAZO_QUE_NO_CIERRA,
        MOTIVOS_DE_CASTING.FRANJA_INCOMPATIBLE,
      ].filter((k) => !CLAVES_DE_MOTIVO.includes(k)),
      [],
      'el catálogo de motivos ha dejado fuera alguna de las seis causas que la spec enumera',
    );
    // Y las claves son identificadores, no texto redactado: no cambian con el idioma.
    for (const k of CLAVES_DE_MOTIVO) assert.match(k, /^[a-z]+(-[a-z]+)*$/, `la clave "${k}" no es un identificador`);

    // Una causa que no está en el catálogo hace fallar la entrega nombrándola, en
    // vez de salir con una clave genérica que enmascare el caso.
    assert.throws(
      () => motivoDeCasting({ clave: 'no-le-gusta-el-sitio', roles: ['origen'] }),
      (e) => e.message.includes('no-le-gusta-el-sitio') && CLAVES_DE_MOTIVO.every((k) => e.message.includes(k)),
      'una causa desconocida se entrega con una clave genérica',
    );
    // Y ninguna clave del catálogo habla de la falta de gente: lo que estrecha el
    // casting son los lugares, porque un rol humano lo produce el sitio.
    for (const k of CLAVES_DE_MOTIVO) {
      assert.equal(/npc|gente|persona|humano|habitante|vecin/i.test(k), false, `el catálogo de motivos tiene una clave sobre la falta de gente: ${k}`);
    }
  });
});

// ── La frontera con el LLM ─────────────────────────────────────────────────────

describe('El árbitro es el código y el narrador es el LLM', () => {
  test('Con LLM y sin LLM la estructura es idéntica', async () => {
    // Sin LLM no hay más textos que los de plantilla; con LLM los textos cambian y
    // **nada más**. Se comprueba por el reverso, que es el que de verdad muerde:
    // se le quitan al catálogo todos los textos —título, gancho, el texto de cada
    // beat, la variante de franja y el de la vía alternativa— y el reparto, los
    // beats y el lazo salen exactamente iguales.
    const desnudo = TEMPLATES.map((t) => {
      const c = copiaDe(t.id);
      delete c.titulo;
      delete c.gancho;
      for (const b of c.beats) {
        delete b.texto;
        if (b.disparador.variante) delete b.disparador.variante;
        if (b.disparador.viaAlternativa) b.disparador.viaAlternativa = {};
      }
      return c;
    });

    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const mundo = await mundoDe(nombre, semilla);
      const conTextos = mundo.casting;
      const sinTextos = casteaCatalogo({ ...exigeEncuadre(mundo), mundo, catalogo: desnudo, semilla: mundo.seed });
      assert.deepEqual(sinTextos.map(esqueleto), conTextos.map(esqueleto), `${clave}: quitar los textos ha cambiado la estructura de la aventura`);
      // Y los textos sí difieren, que es lo que hace que lo anterior afirme algo.
      for (const c of conTextos.filter((x) => x.ok)) {
        const gemela = sinTextos.find((x) => x.plantilla === c.plantilla);
        assert.notDeepEqual(c.beats.map((b) => b.escena.texto), gemela.beats.map((b) => b.escena.texto), `${clave} · ${c.plantilla}: los textos no difieren`);
      }
    }

    // El motor no llama al LLM ni recibe ningún texto suyo entre sus entradas.
    const params = casteaPlantilla.toString().slice(0, casteaPlantilla.toString().indexOf('}'));
    assert.equal(/llm|modelo|prompt|texto|narrad/i.test(params), false, `el casting recibe algo del narrador entre sus entradas: ${params}`);
    for (const modulo of ['packages/nucleo/quests/casting.js', 'packages/nucleo/quests/aventura.js']) {
      const codigo = codigoSinComentarios(modulo);
      assert.equal(/\bfetch\s*\(|XMLHttpRequest|https?:\/\//.test(codigo), false, `${modulo}: sale a la red`);
    }

    // Y no redacta ninguno: cada texto que la aventura lleva encima es **el mismo
    // objeto de cadena** que trae la plantilla, y cada nombre del guiado es uno del
    // mundo. Se afirma sobre el dato y no leyendo el código, que es lo que de verdad
    // cierra la frontera árbitro/narrador: componer una frase aquí se vería porque
    // dejaría de ser idéntica a su origen.
    const mundo = await mundoDe('costero', '1');
    // Todo nombre que el mundo lleva encima: los de fantasía que produjo su paquete
    // de idioma —núcleos, servicios, parajes, calzadas y sus ramales— y los reales
    // del callejero de OSM, que son los que el guiado nombra al recorrer una calle
    // que existe. Ningún otro sitio de donde pueda salir una cadena.
    const nombresDelMundo = new Set([
      ...mundo.settlements.map((s) => s.name),
      ...mundo.settlements.flatMap((s) => s.services).map((v) => v.name),
      ...mundo.parajes.map((p) => p.name),
      ...mundo.routes.map((r) => r.name),
      ...mundo.routes.flatMap((r) => (r.tramos ?? []).map((t) => t.nombre)),
      ...(mundo.geo.roads ?? []).map((c) => c.name),
      ...(mundo.geo.callejero ?? []).map((c) => c.name),
    ].filter((n) => n != null));
    let textos = 0;
    for (const c of mundo.casting.filter((x) => x.ok)) {
      assert.equal(c.aventura.titulo, c.tpl.titulo, `${c.plantilla}: el título no es el de la plantilla`);
      assert.equal(c.aventura.gancho, c.tpl.gancho, `${c.plantilla}: el gancho no es el de la plantilla`);
      c.beats.forEach((b, i) => {
        assert.equal(b.escena.texto, c.tpl.beats[i].texto, `${c.plantilla} beat ${b.n}: el texto de la escena no es el de la plantilla, tal cual`);
        assert.equal(b.escena.tipo, c.tpl.beats[i].escena, `${c.plantilla} beat ${b.n}: el tipo de escena no es el que declara la plantilla`);
        if (b.disparador.viaAlternativa) {
          assert.equal(b.disparador.viaAlternativa.texto, c.tpl.beats[i].disparador.viaAlternativa.texto, `${c.plantilla} beat ${b.n}: la vía alternativa se ha reescrito`);
        }
        assert.ok(nombresDelMundo.has(b.guiado.destino), `${c.plantilla} beat ${b.n}: el destino del guiado no es un nombre del mundo`);
        for (const calzada of b.guiado.calzadas) {
          assert.ok(nombresDelMundo.has(calzada), `${c.plantilla} beat ${b.n}: la calzada "${calzada}" del guiado no es un nombre del mundo`);
        }
        // Y el guiado no lleva ni una cifra: ni distancia, ni tiempo, ni ritmo, ni
        // progreso (`quests.md` decisión 2, el texto ambienta y el mapa confirma).
        assert.equal(/\d/.test([b.guiado.destino, ...b.guiado.calzadas].join(' ')), false, `${c.plantilla} beat ${b.n}: el guiado lleva una cifra`);
        textos += 1;
      });
    }
    assert.ok(textos >= 20, `solo se han comprobado ${textos} beats: la frontera con el narrador apenas se está mirando`);
  });
});

// ── Los objetos, las franjas y la cadena de beats ──────────────────────────────

describe('Los objetos son llaves, no requisitos', () => {
  test('Sin el objeto hay otro camino al mismo beat', async () => {
    let conObjeto = 0;
    for (const { clave, casting } of await losOchoCasteados()) {
      for (const c of casting.filter((x) => x.ok)) {
        for (const b of c.beats) {
          // La cadena, de paso: lineal, con los cuatro campos y sin bifurcaciones.
          assert.ok(DISPARADORES.includes(b.disparador.tipo), `${clave} · ${c.plantilla} beat ${b.n}: disparador "${b.disparador.tipo}"`);
          assert.ok(RESULTADOS.includes(b.resultado.tipo), `${clave} · ${c.plantilla} beat ${b.n}: resultado "${b.resultado.tipo}"`);
          assert.equal(b.resultado.siguienteBeat, b.n === c.beats.length ? null : b.n + 1, `${clave} · ${c.plantilla} beat ${b.n}: la cadena no es lineal`);
          if (b.disparador.tipo !== 'con_objeto') continue;
          // Un objeto es una llave y no un requisito: el beat declara siempre otra
          // manera de resolverse sin llevarlo, y la vía alternativa lleva **al mismo
          // beat**, no a otro — el resultado que empuja al siguiente es el mismo.
          assert.ok(b.disparador.objeto, `${clave} · ${c.plantilla} beat ${b.n}: dispara con objeto y no dice cuál`);
          assert.equal(typeof b.disparador.viaAlternativa, 'object', `${clave} · ${c.plantilla} beat ${b.n}: no declara otra manera de resolverse sin el objeto`);
          assert.notEqual(b.disparador.viaAlternativa, null, `${clave} · ${c.plantilla} beat ${b.n}: la vía alternativa llega vacía`);
          conObjeto += 1;
        }
      }
    }
    assert.ok(conObjeto > 0, 'ninguna aventura casteada tiene un beat con objeto: el caso no comprueba nada');

    // Y si la plantilla no declara esa otra manera, no se ofrece: la garantía es de
    // la estructura y no de que quien escriba cada plantilla se acuerde.
    const mundo = await mundoDe('costero', '1');
    const sinVia = copiaDe('entrega-sospechosa');
    const beat = sinVia.beats.find((b) => b.disparador.tipo === 'con_objeto');
    delete beat.disparador.viaAlternativa;
    assert.throws(
      () => castTemplate(mundo, sinVia),
      (e) => /una llave y no un requisito/.test(e.message) && e.message.includes(beat.disparador.objeto),
      'una plantilla con un beat con_objeto sin salida alternativa se ha ofrecido igual',
    );
  });
});

describe('Las franjas ambientan y no cancelan', () => {
  test('Llegar fuera de la franja resuelve el beat igual y solo cambia la variante de escena', async () => {
    const mundo = await mundoDe('costero', '1');
    const c = castTemplate(mundo, TEMPLATES.find((t) => t.id === 'cita-en-la-fuente'));
    assert.equal(c.ok, true, 'la plantilla con franja no castea en el costero: el caso no comprueba nada');
    const beat = c.beats.find((b) => b.disparador.tipo === 'franja');
    assert.ok(beat, 'ningún beat de la aventura tiene disparador de franja');

    // La franja es propiedad **del beat** y no de nadie del reparto: ni el lugar ni
    // el rol la llevan. Nadie ficha ni se va a dormir.
    assert.ok(beat.disparador.franja.id, 'el beat no lleva su franja');
    assert.equal(beat.lugar.franja, undefined, 'la franja se ha colado en el lugar del reparto');
    assert.equal(beat.lugar.horario, undefined, 'el lugar del reparto declara horario');

    // Llegar dentro y llegar fuera: el beat se resuelve igual y el resultado que
    // empuja al siguiente beat es el mismo. Lo único que cambia es la variante de
    // escena. Se resuelve leyendo solo lo que la aventura lleva encima.
    const resuelve = (b, minutoDeLlegada) => {
      const { desdeMin, hastaMin } = b.disparador.franja;
      const dentro = hastaMin > desdeMin
        ? minutoDeLlegada >= desdeMin && minutoDeLlegada < hastaMin
        : minutoDeLlegada >= desdeMin || minutoDeLlegada < hastaMin;
      return { resuelto: true, resultado: b.resultado, variante: dentro ? b.disparador.variantes.dentro : b.disparador.variantes.fuera };
    };
    const dentro = resuelve(beat, beat.disparador.franja.desdeMin + 1);
    const fuera = resuelve(beat, (beat.disparador.franja.desdeMin + 12 * 60) % (24 * 60));
    assert.equal(dentro.resuelto, true);
    assert.equal(fuera.resuelto, true, 'llegar fuera de la franja no resuelve el beat');
    assert.deepEqual(fuera.resultado, dentro.resultado, 'llegar fuera de la franja cambia el resultado del beat');
    assert.equal(fuera.resultado.siguienteBeat, dentro.resultado.siguienteBeat, 'llegar fuera de la franja no empuja al mismo beat siguiente');
    assert.notEqual(fuera.variante, dentro.variante, 'la franja no cambia ni la variante de escena: entonces no ambienta nada');
    // Y el beat no lleva ninguna manera de darse por perdido por llegar tarde.
    assert.equal(beat.disparador.obligatoria, undefined);
    assert.equal(beat.disparador.espera, undefined);

    // Con el horario diurno activo —y viene activado de origen— una franja que cae
    // fuera no se recorta ni se ignora: la plantilla no se ofrece, con su motivo.
    assert.deepEqual(FRANJA_DIURNA, { desdeMin: 6 * 60, hastaMin: 22 * 60 });
    const nocturna = copiaDe('cita-en-la-fuente');
    nocturna.beats.find((b) => b.disparador.tipo === 'franja').disparador.franja = 'noche';
    const denoche = castTemplate(mundo, nocturna);
    assert.equal(denoche.ok, false, 'una plantilla con franja nocturna castea con el horario diurno activo');
    assert.equal(denoche.motivo.clave, MOTIVOS_DE_CASTING.FRANJA_INCOMPATIBLE);
    assert.deepEqual([...denoche.motivo.roles], ['cita'], 'el motivo de franja no nombra el rol del beat');
    assert.equal(denoche.motivo.requisito.franja, 'noche');

    // Y con el horario diurno desactivado, esa misma plantilla castea con su franja
    // intacta: el ajuste llega como franja permitida y no como un booleano con la
    // hora escondida dentro.
    const sinAjuste = casteaPlantilla({ ...exigeEncuadre(mundo), mundo, plantilla: nocturna, franjaPermitida: null, semilla: mundo.seed });
    assert.equal(sinAjuste.ok, true, 'con el horario diurno desactivado la plantilla nocturna sigue sin castear');
    assert.equal(sinAjuste.beats.find((b) => b.disparador.tipo === 'franja').disparador.franja.id, 'noche', 'la franja se ha recortado en vez de quedarse intacta');
    assert.deepEqual(sinAjuste.beats.map((b) => b.lugar.nombre), c.beats.map((b) => b.lugar.nombre), 'el ajuste de horario ha cambiado el reparto');

    // Con el ajuste puesto, ninguna franja de ninguna aventura casteada se sale de
    // él, en ninguno de los ocho extractos.
    for (const { clave, casting } of await losOchoCasteados()) {
      for (const x of casting.filter((y) => y.ok)) {
        for (const b of x.beats.filter((b) => b.disparador.tipo === 'franja')) {
          const f = franjaDe(b.disparador.franja.id);
          assert.ok(
            f.desdeMin >= FRANJA_DIURNA.desdeMin && f.hastaMin <= FRANJA_DIURNA.hastaMin && f.hastaMin > f.desdeMin,
            `${clave} · ${x.plantilla}: la franja "${f.id}" se sale del horario diurno`,
          );
        }
      }
    }
  });
});

// ── El reparto, los topes y las entradas inválidas ─────────────────────────────

/**
 * Un mundo sintético con lo justo para castear, y un medidor **inyectado** con una
 * tabla de distancias.
 *
 * El medidor es un parámetro del motor y no un detalle interno, así que doblarlo es
 * pasar otro argumento: es la única manera de poner un trecho exactamente en el tope
 * —o exactamente uno por encima— sin buscar dos calles reales que casualmente
 * disten eso.
 */
function mundoDeMesa(distancias) {
  const mundo = {
    seed: '42.40,-8.81#1',
    settlements: [
      { name: 'Vilanova', type: 'pueblo', x: 0, y: 0, anchor: { osmId: 'node/1' }, services: [
        { kind: 'taberna', name: 'A Pinga', x: 10, y: 0, real: { osmId: 'node/2', kind: 'pub' } },
        { kind: 'armeria', name: 'O Fol', x: 20, y: 0, real: { osmId: 'node/3', kind: 'shop' } },
      ] },
      { name: 'Ribeira', type: 'aldea', x: 30, y: 0, anchor: { osmId: 'node/4' }, services: [] },
    ],
    parajes: [
      { name: 'A Furna', type: 'cova', x: 40, y: 0, real: { osmId: 'node/5' }, scenes: { guarida: 0.5, emboscada: 0.1 } },
      { name: 'O Penedo', type: 'penedo', x: 50, y: 0, real: { osmId: 'node/6' }, scenes: { emboscada: 0.4 } },
    ],
  };
  const clave = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const medidor = {
    metros: (a, b) => {
      if (clave(a) === clave(b)) return 0;
      const d = distancias[`${clave(a)}|${clave(b)}`] ?? distancias[`${clave(b)}|${clave(a)}`];
      return d === undefined ? null : d;
    },
    tramos: () => [],
    criterios: [],
  };
  return { mundo, medidor };
}

/** Una plantilla de mesa de cuatro beats cuyo primer y último rol coinciden. */
const PLANTILLA_DE_MESA = Object.freeze({
  id: 'de-mesa',
  titulo: 'La plantilla de mesa',
  gancho: 'Un gancho.',
  tamano: 'paseo',
  orden: ['origen', 'riesgo', 'destino'],
  roles: {
    origen: { tipo: 'servicio', kind: 'taberna' },
    riesgo: { tipo: 'paraje', escena: 'guarida' },
    destino: { tipo: 'servicio', kind: 'armeria' },
  },
  beats: [
    { rol: 'origen', escena: 'encargo', texto: 'Uno.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
    { rol: 'riesgo', escena: 'guarida', texto: 'Dos.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
    { rol: 'destino', escena: 'entrega', texto: 'Tres.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'informacion' } },
    { rol: 'origen', escena: 'recompensa', texto: 'Cuatro.', disparador: { tipo: 'llegada' }, resultado: { tipo: 'estado' } },
  ],
});

/**
 * La distancia de fondo del reparto de mesa: corta pero por encima del trecho
 * mínimo (0,03 tramos = 30 m con el tramo de 1000 m que usan estos casos).
 *
 * Se deja tan corta a propósito: así el único trecho que decide es el que cada caso
 * pone a mano, y ni el lazo ni el alcance del tamaño se meten por medio.
 */
const CERCA = 40;
const casteaDeMesa = ({ distancias, plantilla = PLANTILLA_DE_MESA, tramoM = 1000, ...resto }) => {
  const { mundo, medidor } = mundoDeMesa(distancias);
  return casteaPlantilla({ mundo, plantilla, tramoM, partida: { x: 0, y: 0 }, medidor, semilla: mundo.seed, ...resto });
};

/** Todas las parejas del reparto de mesa a la misma distancia. */
function todasA(m) {
  const puntos = ['0,0', '10,0', '20,0', '30,0', '40,0', '50,0'];
  const out = {};
  for (const a of puntos) for (const b of puntos) if (a !== b) out[`${a}|${b}`] = m;
  return out;
}

describe('El reparto resuelve los roles contra el mundo', () => {
  test('Cada rol cae en un lugar del mundo que cumple su requisito, y dos roles nunca en el mismo', async () => {
    const mundo = await mundoDe('costero', '1');

    // Los candidatos de cada tipo de rol son exactamente los que el mundo tiene.
    const servicios = candidatosDeRol(mundo, { tipo: 'servicio', kind: 'taberna' });
    assert.ok(servicios.length > 0, 'el costero no tiene tabernas: el caso no comprueba nada');
    for (const c of servicios) {
      assert.equal(c.kind, 'taberna');
      // Con su núcleo anotado: es lo que permite decir «la taberna de Vilanova».
      assert.ok(mundo.settlements.some((s) => s.name === c.en && s.services.some((v) => v.name === c.nombre)), `el servicio "${c.nombre}" no anota el núcleo al que pertenece`);
    }
    const nucleos = candidatosDeRol(mundo, { tipo: 'nucleo', types: ['aldea', 'granja'] });
    assert.deepEqual(nucleos.map((c) => c.nombre).sort(), mundo.settlements.filter((s) => ['aldea', 'granja'].includes(s.type)).map((s) => s.name).sort());
    for (const c of nucleos) assert.ok(['aldea', 'granja'].includes(c.kind), `el núcleo "${c.nombre}" es de tipo ${c.kind}, que no estaba entre los pedidos`);

    // Un rol de paraje con peso mínimo: solo los que lo alcanzan.
    const conPeso = candidatosDeRol(mundo, { tipo: 'paraje', escena: 'emboscada', minPeso: 0.3 });
    assert.deepEqual(conPeso.map((c) => c.nombre).sort(), mundo.parajes.filter((p) => (p.scenes.emboscada ?? 0) >= 0.3).map((p) => p.name).sort());
    // Y con escenas alternativas basta con cubrir una; la aventura anota cuál.
    const alternativas = candidatosDeRol(mundo, { tipo: 'paraje', escena: ['vigilancia', 'revelación'] });
    assert.ok(alternativas.length > 0, 'ningún paraje del costero cubre vigilancia ni revelación');
    for (const c of alternativas) {
      assert.ok(['vigilancia', 'revelación'].includes(c.escena), `el candidato "${c.nombre}" no anota cuál de las escenas alternativas cubre`);
      assert.ok((mundo.parajes.find((p) => p.name === c.nombre).scenes[c.escena] ?? 0) >= PESO_MINIMO_DE_ESCENA);
    }

    for (const c of mundo.casting.filter((x) => x.ok)) {
      // Cada rol, a un lugar concreto que cumple su requisito.
      for (const [rid, req] of Object.entries(c.tpl.roles)) {
        const lugar = c.asignacion[rid];
        assert.ok(lugar, `${c.plantilla}: el rol "${rid}" ha quedado sin asignar`);
        if (req.tipo === 'humano') continue;
        assert.ok(
          candidatosDeRol(mundo, req).some((cand) => cand.nombre === lugar.nombre && Math.round(cand.x) === Math.round(lugar.x)),
          `${c.plantilla}: el rol "${rid}" ha caído en "${lugar.nombre}", que no cumple su requisito`,
        );
      }
      // Dos roles de sitio distintos nunca en el mismo lugar: un anclaje real
      // alimenta un elemento del mundo y un elemento del mundo alimenta un rol.
      const sitios = Object.entries(c.tpl.roles).filter(([, r]) => r.tipo !== 'humano').map(([rid]) => `${Math.round(c.asignacion[rid].x)},${Math.round(c.asignacion[rid].y)}`);
      assert.equal(new Set(sitios).size, sitios.length, `${c.plantilla}: dos roles distintos han caído en el mismo lugar`);
      // Y dos beats sobre el mismo rol caen en el mismo lugar, que es lo que deja
      // que un lazo vuelva a la taberna donde empezó.
      const porRol = new Map();
      for (const b of c.beats) {
        if (porRol.has(b.rol)) assert.deepEqual(b.lugar, porRol.get(b.rol), `${c.plantilla}: dos beats del rol "${b.rol}" caen en sitios distintos`);
        porRol.set(b.rol, b.lugar);
      }

      // El lugar de un beat es una referencia a una localización del mundo con
      // nombre propio y anclaje real, nunca unas coordenadas sueltas. Y los cuatro
      // campos del beat están siempre.
      for (const b of c.beats) {
        assert.ok(b.lugar && b.disparador && b.escena && b.resultado, `${c.plantilla} beat ${b.n}: le falta alguno de los cuatro campos`);
        assert.equal(typeof b.lugar.nombre, 'string');
        assert.ok(['servicio', 'nucleo', 'paraje', 'humano'].includes(b.lugar.tipo), `${c.plantilla} beat ${b.n}: el lugar no dice qué es`);
        // Es una referencia a una localización del mundo, no unas coordenadas
        // sueltas: existe con ese nombre y en ese sitio, y arrastra el anclaje real
        // que ese elemento tenga. Se dice «el que tenga» y no «uno» a propósito: un
        // paraje nacido de un cruce del grafo no consume anclaje —lo declara con
        // `origin: 'grafo'`— y exigirle uno sería exigirle al mundo algo que
        // `game-design/parajes.md` no promete.
        const delMundo = [
          ...mundo.settlements.map((s) => ({ nombre: s.name, x: s.x, y: s.y, real: s.anchor ?? null })),
          ...mundo.settlements.flatMap((s) => s.services).map((v) => ({ nombre: v.name, x: v.x, y: v.y, real: v.real ?? null })),
          ...mundo.parajes.map((p) => ({ nombre: p.name, x: p.x, y: p.y, real: p.real ?? null })),
        ].find((e) => e.nombre === b.lugar.nombre && Math.round(e.x) === Math.round(b.lugar.x) && Math.round(e.y) === Math.round(b.lugar.y));
        assert.ok(delMundo, `${c.plantilla} beat ${b.n}: el lugar "${b.lugar.nombre}" no es ninguna localización de este mundo`);
        assert.deepEqual(b.lugar.real ?? null, delMundo.real, `${c.plantilla} beat ${b.n}: el lugar no arrastra el anclaje del elemento del mundo`);
        // Un beat resuelto sobre un paraje anota la afinidad que sostiene su escena,
        // y ese paraje la cubre con peso suficiente.
        if (b.lugar.tipo === 'paraje') {
          const paraje = mundo.parajes.find((p) => p.name === b.lugar.nombre);
          assert.ok(b.escena.afinidadUsada, `${c.plantilla} beat ${b.n}: un beat sobre paraje no anota la afinidad usada`);
          assert.ok((paraje.scenes[b.escena.afinidadUsada] ?? 0) >= PESO_MINIMO_DE_ESCENA, `${c.plantilla} beat ${b.n}: el paraje no cubre "${b.escena.afinidadUsada}" con peso suficiente`);
        }
      }
    }
  });

  test('Con candidatos de sobra pero sin ninguna combinación que quepa, el motivo distingue el caso', () => {
    // Hay candidatos para los tres roles y ninguno casa, porque todo está al doble
    // del tope de trecho. El motivo **no** puede ser «sin candidatos».
    const c = casteaDeMesa({ distancias: todasA(2000), tramoM: 1000 });
    assert.equal(c.ok, false);
    assert.notEqual(c.motivo.clave, MOTIVOS_DE_CASTING.SIN_CANDIDATOS, 'con candidatos de sobra el motivo dice que no los hay');
    assert.ok([MOTIVOS_DE_CASTING.LAZO_QUE_NO_CIERRA, MOTIVOS_DE_CASTING.TRECHO_FUERA_DEL_TOPE].includes(c.motivo.clave), `motivo inesperado: ${c.motivo.clave}`);
  });
});

describe('Los topes del presupuesto se expresan en tramos', () => {
  test('Un trecho en el tope se acepta, uno por encima se descarta y uno pegado también', () => {
    // Exactamente un tramo: se acepta, porque el tope es media hora andando y no
    // menos de media hora. Con el lazo cómodo para que lo único que decida sea el
    // trecho del medio.
    const enElTope = { ...todasA(CERCA), '10,0|40,0': 1000 };
    const justo = casteaDeMesa({ distancias: enElTope, tramoM: 1000 });
    assert.equal(justo.ok, true, `un trecho de exactamente un tramo se ha descartado: ${justo.motivo?.clave}`);
    assert.equal(justo.presupuesto.enTramos.trechoMasLargo, 1);

    // Un metro por encima: se descarta, con el motivo del trecho y los dos roles.
    const pasado = casteaDeMesa({ distancias: { ...enElTope, '10,0|40,0': 1001 }, tramoM: 1000 });
    assert.equal(pasado.ok, false, 'un trecho por encima del tope se ha aceptado');
    assert.equal(pasado.motivo.clave, MOTIVOS_DE_CASTING.TRECHO_FUERA_DEL_TOPE);
    assert.deepEqual([...pasado.motivo.roles], ['origen', 'riesgo'], 'el motivo por trechos no nombra los dos roles cuyo trecho no casó');
    assert.equal(pasado.motivo.requisito.topeEnTramos, TOPE_DE_TRECHO_EN_TRAMOS);

    // Y por debajo del mínimo: dos beats pegados no hacen un lazo, hacen una vuelta
    // a la manzana.
    const pegado = casteaDeMesa({ distancias: { ...todasA(CERCA), '10,0|40,0': 1 }, tramoM: 1000 });
    assert.equal(pegado.ok, false, 'dos beats pegados han casteado');
    assert.equal(pegado.motivo.clave, MOTIVOS_DE_CASTING.TRECHO_POR_DEBAJO_DEL_MINIMO);
    assert.equal(pegado.motivo.requisito.minimoEnTramos, MINIMO_DE_TRECHO_EN_TRAMOS);

    // Sin ninguna ruta en el grafo la pareja no casa, y **no** se sustituye por una
    // distancia en línea recta: lo que nos inventamos no se promete.
    const sinRuta = { ...todasA(CERCA) };
    delete sinRuta['10,0|40,0'];
    delete sinRuta['40,0|10,0'];
    const roto = casteaDeMesa({ distancias: sinRuta, tramoM: 1000 });
    assert.equal(roto.ok, false, 'una pareja sin camino en el grafo ha casado igual');
    assert.equal(roto.motivo.clave, MOTIVOS_DE_CASTING.SIN_RUTA_EN_EL_GRAFO);
  });

  test('El lazo que no cierra y el recorrido que no cabe se descartan con su motivo', () => {
    // El primer beat a más de medio tramo del punto de partida: no hay lazo.
    const lejos = { ...todasA(CERCA), '0,0|10,0': 900 };
    const c = casteaDeMesa({ distancias: lejos, tramoM: 1000 });
    assert.equal(c.ok, false, 'un lazo que empieza lejos de casa se ha ofrecido');
    assert.equal(c.motivo.clave, MOTIVOS_DE_CASTING.LAZO_QUE_NO_CIERRA);
    // Nombra el rol del beat que quedó lejos, que es lo que distingue si falla la
    // plantilla o falla el mundo.
    assert.deepEqual([...c.motivo.roles], ['origen']);
    assert.equal(c.motivo.requisito.extremo, 'primer-beat');
    assert.equal(c.motivo.requisito.topeEnTramos, CERCA_DE_LA_PARTIDA_EN_TRAMOS);

    // Y un recorrido que cabe trecho a trecho —cada uno a medio tramo, dentro del
    // tope— y aun así no cabe en el alcance del tamaño: un paseo alcanza dos tramos
    // y aquí se suman 2,3 con los tres trechos más la ida y la vuelta.
    const largo = casteaDeMesa({ distancias: { ...todasA(500), '0,0|10,0': 400 }, tramoM: 1000 });
    assert.equal(largo.ok, false, 'un recorrido que no cabe en el alcance del tamaño se ha ofrecido');
    assert.equal(largo.motivo.clave, MOTIVOS_DE_CASTING.RECORRIDO_FUERA_DEL_TAMANO);
    assert.equal(largo.motivo.requisito.tamano, 'paseo');
  });

  test('Dos jugadores con tramos distintos no reciben ningún trecho de más de media hora a su propio ritmo', async () => {
    // El mismo mundo y la misma plantilla con dos tramos muy distintos: el tope se
    // mueve con quien juega, que es toda la diferencia entre un tope en tramos y un
    // tope en metros absolutos.
    const mundo = await mundoDe('urbano-denso', '1');
    const { partida } = exigeEncuadre(mundo);
    const medidor = medidorDeTrechos(mundo.viario, []);
    for (const tramoM of [700, 2500]) {
      let lazos = 0;
      for (const plantilla of TEMPLATES) {
        const c = casteaPlantilla({ mundo, plantilla, tramoM, partida, medidor, semilla: mundo.seed });
        if (!c.ok) continue;
        lazos += 1;
        assert.ok(c.presupuesto.enTramos.trechoMasLargo <= TOPE_DE_TRECHO_EN_TRAMOS + 1e-9, `tramo ${tramoM}: ${c.plantilla} recibe un trecho de ${c.presupuesto.enTramos.trechoMasLargo.toFixed(2)} tramos`);
        assert.ok(c.presupuesto.metros.trechoMasLargo <= tramoM + 1e-6, `tramo ${tramoM}: ${c.plantilla} recibe un trecho de ${Math.round(c.presupuesto.metros.trechoMasLargo)} m, más de media hora a su ritmo`);
      }
      assert.ok(lazos > 0, `con un tramo de ${tramoM} m no castea nada: el caso no comprueba nada`);
    }

    // Y el presupuesto viene en tramos, con los metros del trazado **al lado** como
    // dato del recorrido y no como unidad de la regla.
    const c = mundo.casting.find((x) => x.ok);
    const { tramoM } = exigeEncuadre(mundo);
    for (const campo of ['recorrido', 'trechoMasLargo', 'ida', 'vuelta']) {
      assert.ok(Math.abs(c.presupuesto.enTramos[campo] - c.presupuesto.metros[campo] / tramoM) < 1e-9, `el presupuesto no dice lo mismo en tramos y en metros para "${campo}"`);
    }
  });
});

describe('Los roles humanos no hacen fallar el casting', () => {
  test('Un rol humano lo produce el sitio donde trabaja y no consume anclaje propio', async () => {
    const mundo = await mundoDe('costero', '1');
    const conGente = {
      ...copiaDe('entrega-sospechosa'),
      orden: ['origen', 'riesgo', 'destino', 'tabernero'],
      roles: {
        origen: { tipo: 'servicio', kind: 'taberna' },
        riesgo: { tipo: 'paraje', escena: 'guarida' },
        destino: { tipo: 'servicio', kind: 'armeria' },
        tabernero: { tipo: 'humano', en: 'origen', puesto: 'tabernero' },
      },
    };
    // El mundo no tiene ni una persona generada: la capa de NPCs es de otra fila.
    assert.equal(mundo.npcs, undefined, 'el mundo ya trae personas: el caso deja de medir lo que dice');

    const c = castTemplate(mundo, conGente);
    assert.equal(c.ok, true, `una plantilla con rol humano no castea: ${c.motivo?.clave}`);
    const persona = c.asignacion.tabernero;
    assert.ok(persona, 'el rol humano ha quedado sin resolver');
    assert.equal(persona.tipo, 'humano');
    // Hereda el anclaje del sitio donde trabaja y no consume uno propio.
    assert.deepEqual(persona.real, c.asignacion.origen.real, 'el rol humano no hereda el anclaje del sitio donde trabaja');
    assert.equal(persona.x, c.asignacion.origen.x);
    assert.equal(persona.y, c.asignacion.origen.y);

    // Y añadir el rol humano no cambia nada del reparto de los lugares: si lo
    // estrechara, una plantilla con gente castearía menos que la misma sin ella.
    const sinGente = castTemplate(mundo, copiaDe('entrega-sospechosa'));
    for (const rid of ['origen', 'riesgo', 'destino']) {
      assert.deepEqual(c.asignacion[rid], sinGente.asignacion[rid], `el rol humano ha movido el reparto del rol "${rid}"`);
    }

    // Y un rol humano que dice trabajar en un sitio que no es rol de la plantilla es
    // un error de construcción, no un motivo del catálogo.
    const huerfano = { ...conGente, roles: { ...conGente.roles, tabernero: { tipo: 'humano', en: 'no-existe' } } };
    assert.throws(() => castTemplate(mundo, huerfano), /no es un rol de sitio/, 'un rol humano colgado de la nada se ha resuelto igual');
  });
});

describe('El guiado nombra el destino y las calzadas del trecho', () => {
  test('El guiado nombra lo que tiene nombre, no inventa lo que no lo tiene y trae la marca del mapa', async () => {
    // Un tramo sin nombre propio simplemente no se nombra, y los que sí lo tienen
    // salen **en el orden en que se recorren**, sin repetir el mismo dos veces
    // seguidas: inventarle un nombre sería prometer un camino que nadie ha
    // comprobado (`accesibilidad.md` §2).
    const destino = { nombre: 'A Furna', x: 12, y: -3, tipo: 'paraje' };
    const guiado = guiadoDeBeat({
      destino,
      tramos: [{ nombre: 'Rúa Longa' }, { nombre: 'Rúa Longa' }, { nombre: null }, { nombre: undefined }, { nombre: 'Camiño do Muíño' }],
    });
    assert.deepEqual(guiado.calzadas, ['Rúa Longa', 'Camiño do Muíño'], 'el guiado no nombra las calzadas del trecho en el orden en que se recorren');
    assert.equal(guiado.destino, 'A Furna');
    assert.deepEqual(guiado.marca, { x: 12, y: -3, tipo: 'paraje', nombre: 'A Furna' }, 'el guiado no trae la marca del destino para que el mapa la pinte');
    // Un trecho entero sin nombre no nombra nada, y no inventa un «un tramo del
    // camino» que rellene el hueco.
    assert.deepEqual(guiadoDeBeat({ destino, tramos: [{ nombre: null }, { nombre: null }] }).calzadas, []);
    assert.deepEqual(guiadoDeBeat({ destino, tramos: [] }).calzadas, []);

    // Sobre dato real: en un mundo en gallego los nombres del guiado son los que
    // produjo su paquete de idioma, y la marca cae donde el lugar.
    const mundo = await mundoDe('costero', '1');
    assert.equal(mundo.locale, 'gl', 'el mundo del caso ha dejado de ser gallego');
    let conCalzadas = 0;
    for (const c of mundo.casting.filter((x) => x.ok)) {
      for (const b of c.beats) {
        assert.equal(b.guiado.destino, b.lugar.nombre, `${c.plantilla} beat ${b.n}: el guiado no nombra el destino con su nombre propio`);
        assert.deepEqual(b.guiado.marca, { x: b.lugar.x, y: b.lugar.y, tipo: b.lugar.tipo, nombre: b.lugar.nombre }, `${c.plantilla} beat ${b.n}: la marca no cae en el lugar`);
        assert.deepEqual(b.guiado.calzadas.filter((n, i) => b.guiado.calzadas[i - 1] === n), [], `${c.plantilla} beat ${b.n}: el guiado repite una calzada seguida`);
        if (b.guiado.calzadas.length) conCalzadas += 1;
      }
    }
    assert.ok(conCalzadas > 0, 'ningún guiado del mundo real nombra una sola calzada: el caso no comprueba nada');
  });
});

describe('Entradas inválidas, dependencias que faltan y plantillas mal escritas', () => {
  test('Sin tramo, sin punto de partida o con la plantilla mal escrita, la entrega falla nombrando qué le pasa', async () => {
    const mundo = await mundoDe('costero', '1');
    const { tramoM, partida } = exigeEncuadre(mundo);
    const plantilla = TEMPLATES[0];

    // Las dos dependencias que el casting **recibe** y no supone. Sin ellas la
    // llamada falla nombrando la que falta, en vez de suponer un ritmo o el centro
    // de la celda.
    assert.throws(
      () => casteaPlantilla({ mundo, plantilla, partida, semilla: mundo.seed }),
      /tramo/i,
      'sin el tramo del jugador el casting se ha inventado un ritmo',
    );
    assert.throws(
      () => casteaPlantilla({ mundo, plantilla, tramoM, semilla: mundo.seed }),
      /punto de partida/i,
      'sin punto de partida el casting ha supuesto el centro de la celda',
    );
    // Y el punto de partida está entre sus entradas, declarado.
    const params = casteaPlantilla.toString().slice(0, casteaPlantilla.toString().indexOf('}'));
    assert.match(params, /\bpartida\b/, 'el casting no recibe el punto de partida entre sus entradas');
    assert.match(params, /\btramoM\b/, 'el casting no recibe el tramo del jugador entre sus entradas');

    // Un tipo de rol desconocido: falla nombrando el recibido y enumerando los
    // válidos, que es lo que deja arreglar la plantilla sin abrir el motor.
    const rolRaro = copiaDe('entrega-sospechosa');
    rolRaro.roles.riesgo = { tipo: 'gremio' };
    assert.throws(
      () => castTemplate(mundo, rolRaro),
      (e) => e.message.includes('"gremio"') && TIPOS_DE_ROL.every((t) => e.message.includes(t)),
      'un tipo de rol desconocido no hace fallar la entrega nombrándolo y enumerando los válidos',
    );

    // Un disparador que no es ninguno de los tres.
    const disparadorRaro = copiaDe('entrega-sospechosa');
    disparadorRaro.beats[1].disparador = { tipo: 'al-anochecer' };
    assert.throws(
      () => castTemplate(mundo, disparadorRaro),
      (e) => e.message.includes('"al-anochecer"') && DISPARADORES.every((d) => e.message.includes(d)),
      'un disparador desconocido no hace fallar la entrega nombrándolo y enumerando los tres válidos',
    );

    // Un beat cuyo rol no está declarado en los roles de la plantilla.
    const huerfano = copiaDe('entrega-sospechosa');
    huerfano.beats[2].rol = 'cofrade';
    assert.throws(() => castTemplate(mundo, huerfano), /cofrade/, 'un beat con rol huérfano se ha casteado igual');

    // Y un resultado fuera de los tres.
    const resultadoRaro = copiaDe('entrega-sospechosa');
    resultadoRaro.beats[0].resultado = { tipo: 'oro' };
    assert.throws(
      () => castTemplate(mundo, resultadoRaro),
      (e) => e.message.includes('"oro"') && RESULTADOS.every((r) => e.message.includes(r)),
      'un resultado desconocido se ha aceptado',
    );
  });

  test('Sobre el mundo mínimo de 250 m ninguna plantilla queda fuera del resultado', async () => {
    for (const semilla of ['1', '2']) {
      const mundo = await mundoDe('suelo-250m', semilla);
      const casting = mundo.casting;
      assert.deepEqual(casting.map((c) => c.plantilla), TEMPLATES.map((t) => t.id), `suelo-250m#${semilla}: falta alguna plantilla en el resultado`);
      for (const c of casting) {
        if (c.ok) continue;
        assert.ok(CLAVES_DE_MOTIVO.includes(c.motivo.clave), `suelo-250m#${semilla} · ${c.plantilla}: no trae motivo del catálogo`);
        assert.ok(c.motivo.roles.length > 0 || c.motivo.clave === MOTIVOS_DE_CASTING.BEATS_FUERA_DEL_TAMANO);
      }
      // Y el mundo mínimo sigue casteando algo: es lo que la fila 6 vino a
      // garantizar y lo que esta spec consume sin poder contradecir.
      assert.ok(casting.some((c) => c.ok), `suelo-250m#${semilla}: el mundo mínimo no castea ni un lazo`);
    }
  });
});
