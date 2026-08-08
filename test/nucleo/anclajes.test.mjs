// SPEC-005 · El pool de anclajes reales de una celda y sus filtros.
//
// Lo que se afirma aquí es de dónde sale la materia prima del mundo: qué lugar
// real entra en el juego, cuál se cae por no ser apto o por no aportar
// reconocimiento, y que ninguno se gasta dos veces. Los escenarios que existen en
// docs/testing.md llevan su nombre literal; el resto va marcado como hueco en
// test/spec-test-map.json.
//
// Los números grandes son del dato y no de una opinión: el mundo congelado urbano
// denso trae a propósito 769 locales de adultos y 86 fuentes de agua potable, y es
// contra ese dato contra el que se mide el filtro. Nada de aquí toca la red, el
// reloj ni el azar del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mundoCongelado } from '../dobles/mundo-congelado.mjs';
import {
  LOS_CUATRO,
  LAS_DOS_SEMILLAS,
  anclajesDelMundo,
  fuente,
  generaMundo,
  semillaDe,
} from './mundo-de-prueba.mjs';

import { buildWorld } from '../../packages/nucleo/world/build.js';
import {
  CATALOGO_ADMISION,
  ENTRADAS_PARA_EXIGIR_NOMBRE,
  ETIQUETAS_SIN_RECONOCIMIENTO,
  FRACCION_NOMBRADAS_MINIMA,
  RADIO_DEDUPLICACION_M,
  ROLES_CONSUMIDORES,
  TIPOS_PROBLEMATICOS,
  construyePool,
  creaPool,
  entradaDeAdmision,
  familiaProblematica,
  puntuaCandidatos,
} from '../../packages/nucleo/world/anclajes.js';
import { isSea } from '../../packages/nucleo/world/seamask.js';
import { SUFIJOS_DE_FASE } from '../../packages/nucleo/core/semilla.js';

const URBANO = 'urbano-denso';
const COSTERO = 'costero';
const POBRE = 'barrio-tres-calles';

/** Un elemento de OSM con la forma en que llega de Overpass. */
const nodo = (id, tags, dx = 0, dy = 0) => ({ type: 'node', id, tags, lat: 42.4 + dx, lon: -8.81 + dy });

/** El pool de un mundo congelado, construido sin radio ni máscara: solo los filtros de etiqueta. */
function poolDe(nombre, opciones = {}) {
  const d = mundoCongelado(nombre);
  return construyePool({
    poiJson: d.pois,
    lat0: d.manifiesto.coordenada.lat,
    lon0: d.manifiesto.coordenada.lon,
    semilla: `${d.manifiesto.coordenada.lat},${d.manifiesto.coordenada.lon}#1`,
    ...opciones,
  });
}

/** Cuántos elementos crudos de un mundo congelado cumplen un predicado sobre sus tags. */
function cuentaEnElDato(nombre, predicado) {
  return (mundoCongelado(nombre).pois.elements ?? []).filter((e) => predicado(e.tags ?? {}, e)).length;
}

const idsDe = (pool) => new Set(pool.anclajes.map((a) => a.osmId));

describe('La admisión al pool', () => {
  test('Cada anclaje admitido lleva identificador, fuente, posición, nombre, etiqueta, kind y peso', () => {
    const pool = poolDe(COSTERO);
    assert.ok(pool.anclajes.length > 0, 'el mundo costero tenía que traer anclajes: no se está comprobando nada');
    for (const a of pool.anclajes) {
      assert.equal(typeof a.osmId, 'string', 'un anclaje sin identificador estable');
      assert.equal(a.fuente, 'osm');
      assert.equal(Number.isFinite(a.x) && Number.isFinite(a.y), true, `${a.osmId}: la posición no está en metros`);
      // La ausencia de nombre se declara: `null`, no un campo que falta. Es lo que
      // permite contar cuántas entradas de una etiqueta tienen nombre.
      assert.equal('name' in a, true, `${a.osmId}: no declara si tiene nombre`);
      assert.equal(a.name === null || typeof a.name === 'string', true);
      assert.match(a.etiqueta, /^[a-z_:]+=[a-z_]+$/, `${a.osmId}: la etiqueta que lo admitió no es clave=valor`);
      assert.equal(typeof a.kind, 'string');
      assert.equal(Number.isFinite(a.weight), true, `${a.osmId}: sin peso`);
    }
  });

  test('El identificador de un anclaje es el del elemento real de OSM y no su posición en la lista', () => {
    const elementos = [
      nodo(662618011, { amenity: 'cafe', name: 'A' }),
      nodo(5323981960, { historic: 'ruins', name: 'B' }, 0.001),
    ];
    const pool = construyePool({ poiJson: { elements: elementos }, lat0: 42.4, lon0: -8.81, semilla: 's' });
    assert.deepEqual([...idsDe(pool)].sort(), ['node/5323981960', 'node/662618011']);
    // Y con los mismos elementos en otro orden de llegada, los identificadores son
    // los mismos: si fuesen índices, se habrían intercambiado.
    const alReves = construyePool({ poiJson: { elements: [...elementos].reverse() }, lat0: 42.4, lon0: -8.81, semilla: 's' });
    assert.deepEqual(alReves.anclajes.map((a) => a.osmId), pool.anclajes.map((a) => a.osmId));
  });

  test('Lo que no está en el catálogo de admisión no entra', () => {
    const pool = construyePool({
      poiJson: { elements: [nodo(1, { amenity: 'cafe', name: 'sí' }), nodo(2, { amenity: 'bicycle_parking' }, 0.001), nodo(3, { barrier: 'gate' }, 0.002)] },
      lat0: 42.4,
      lon0: -8.81,
      semilla: 's',
    });
    assert.deepEqual([...idsDe(pool)], ['node/1']);
    assert.equal(pool.resumen().descartes.fueraDelCatalogo, 2);
  });

  test('El catálogo de admisión es una lista cerrada de etiquetas clave=valor, sin comodines', () => {
    assert.ok(CATALOGO_ADMISION.length > 0);
    for (const entrada of CATALOGO_ADMISION) {
      assert.match(entrada.etiqueta, /^[a-z_:]+=[a-z_]+$/, `"${entrada.etiqueta}" no es una etiqueta clave=valor`);
      assert.equal(entrada.etiqueta.includes('*'), false, `"${entrada.etiqueta}" admite una clave entera`);
      assert.ok(['emplazamiento', 'local'].includes(entrada.cat), `"${entrada.etiqueta}" sin categoría declarada`);
      assert.equal(Number.isFinite(entrada.weight), true, `"${entrada.etiqueta}" sin peso`);
    }
    // Y el que decide es el catálogo y no una clave suelta: `historic=*` no admite.
    assert.equal(entradaDeAdmision({ historic: 'lo_que_osm_invente_mañana' }), null);
  });

  test('Un elemento sin coordenada utilizable se descarta sin interrumpir la construcción', () => {
    const pool = construyePool({
      poiJson: {
        elements: [
          { type: 'way', id: 10, tags: { amenity: 'cafe', name: 'sin coordenada' } },
          { type: 'way', id: 11, tags: { leisure: 'park', name: 'con centro' }, center: { lat: 42.401, lon: -8.811 } },
        ],
      },
      lat0: 42.4,
      lon0: -8.81,
      semilla: 's',
    });
    assert.deepEqual([...idsDe(pool)], ['way/11']);
    assert.equal(pool.resumen().descartes.sinCoordenada, 1);
  });

  test('Ningún anclaje admitido cae fuera del radio de la celda', () => {
    const radio = mundoCongelado(URBANO).manifiesto.radio_m;
    const conRadio = poolDe(URBANO, { radio });
    assert.ok(conRadio.anclajes.length > 0);
    for (const a of conRadio.anclajes) {
      assert.ok(Math.hypot(a.x, a.y) <= radio, `${a.osmId} cae a ${Math.round(Math.hypot(a.x, a.y))} m, fuera del radio ${radio}`);
    }
    // Y el radio recorta de verdad: sin él entran más, así que el filtro no es un adorno.
    assert.ok(conRadio.anclajes.length < poolDe(URBANO).anclajes.length, 'el radio no ha dejado fuera a nadie');
    assert.equal(conRadio.resumen().descartes.fueraDelRadio > 0, true);
  });

  test('Ningún anclaje admitido cae en mar', async () => {
    const w = await generaMundo(COSTERO, semillaDe(COSTERO, '1'));
    assert.ok(w.seaMask, 'el mundo costero tenía que traer máscara tierra/mar');
    assert.ok(w.anchors.length > 0);
    for (const a of w.anchors) assert.equal(isSea(w.seaMask, a), false, `${a.osmId} está admitido y cae en el mar`);
  });
});

describe('El juego es apto por diseño y no distingue a un menor', () => {
  test('Los anclajes de adultos se excluyen del pool', async () => {
    // El dato trae los locales de adultos a propósito: si el fixture dejara de
    // traerlos, esta prueba pasaría sin medir nada y hay que enterarse.
    const enElDato = cuentaEnElDato(URBANO, (t) => familiaProblematica(t) === 'adultos');
    assert.equal(enElDato, 769, 'el mundo congelado urbano denso ya no trae los 769 locales de adultos con los que se escribió el filtro');

    const pool = poolDe(URBANO);
    const idsProblematicos = new Set(
      (mundoCongelado(URBANO).pois.elements ?? [])
        .filter((e) => familiaProblematica(e.tags ?? {}) === 'adultos')
        .map((e) => `${e.type}/${e.id}`),
    );
    const colados = pool.anclajes.filter((a) => idsProblematicos.has(a.osmId));
    assert.deepEqual(colados.map((a) => a.osmId), [], `${colados.length} locales de adultos en el pool`);
    assert.equal(pool.resumen().descartes.problematicos.adultos, 769);

    // Y en el mundo entero, que es donde el jugador lo vería: ningún núcleo,
    // servicio ni paraje anclado a uno de ellos, en los cuatro mundos congelados.
    for (const nombre of LOS_CUATRO) {
      const malos = new Set(
        (mundoCongelado(nombre).pois.elements ?? [])
          .filter((e) => familiaProblematica(e.tags ?? {}))
          .map((e) => `${e.type}/${e.id}`),
      );
      for (const semilla of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, semilla));
        for (const { osmId, de } of anclajesDelMundo(w)) {
          assert.equal(malos.has(osmId), false, `${nombre}#${semilla}: ${de} está anclado al elemento problemático ${osmId}`);
        }
      }
    }
  });

  test('Las cuatro familias del filtro se caen: adultos, industria, obras y propiedad privada', () => {
    const casos = [
      ['amenity=bar', 'adultos'], ['amenity=pub', 'adultos'], ['amenity=nightclub', 'adultos'],
      ['amenity=stripclub', 'adultos'], ['amenity=casino', 'adultos'], ['amenity=gambling', 'adultos'],
      ['amenity=brothel', 'adultos'], ['leisure=adult_gaming_centre', 'adultos'],
      ['shop=erotic', 'adultos'], ['shop=alcohol', 'adultos'], ['shop=tobacco', 'adultos'], ['shop=bookmaker', 'adultos'],
      ['landuse=industrial', 'industria'], ['landuse=quarry', 'industria'], ['man_made=works', 'industria'],
      ['man_made=wastewater_plant', 'industria'], ['man_made=silo', 'industria'], ['man_made=chimney', 'industria'],
      ['amenity=fuel', 'industria'],
      ['landuse=construction', 'obras'], ['building=construction', 'obras'], ['highway=construction', 'obras'],
      ['access=private', 'privado'], ['access=no', 'privado'],
      ['building=house', 'privado'], ['building=residential', 'privado'], ['building=apartments', 'privado'],
    ];
    // Cada uno lleva encima `historic=ruins`, que sí está en el catálogo de
    // admisión, y un nombre: así se comprueba de paso que el filtro manda sobre la
    // admisión y no al revés. La etiqueta del catálogo es de otra clave a propósito,
    // para que no pise a la problemática dentro del mismo objeto de tags.
    const elementos = casos.map(([etiqueta], i) => {
      const [clave, valor] = [etiqueta.slice(0, etiqueta.indexOf('=')), etiqueta.slice(etiqueta.indexOf('=') + 1)];
      return nodo(1000 + i, { [clave]: valor, historic: 'ruins', name: `local ${i}` }, i * 1e-4);
    });
    elementos.push(nodo(2000, { 'demolished:amenity': 'cafe', historic: 'ruins', name: 'demolido' }, 0.01));

    for (const [etiqueta, familia] of casos) {
      const [clave, valor] = [etiqueta.slice(0, etiqueta.indexOf('=')), etiqueta.slice(etiqueta.indexOf('=') + 1)];
      assert.equal(familiaProblematica({ [clave]: valor }), familia, `${etiqueta} no se reconoce como ${familia}`);
    }
    assert.equal(familiaProblematica({ 'demolished:amenity': 'cafe' }), 'obras', 'demolished:* no se reconoce como obras');

    const pool = construyePool({ poiJson: { elements: elementos }, lat0: 42.4, lon0: -8.81, semilla: 's' });
    assert.deepEqual(pool.anclajes.map((a) => a.osmId), [], 'algo problemático ha entrado en el pool pese a casar con el catálogo');
    assert.deepEqual(
      TIPOS_PROBLEMATICOS.map((f) => f.familia).sort(),
      ['adultos', 'industria', 'obras', 'privado'],
      'las familias del filtro han cambiado sin que el criterio de aceptación lo diga',
    );
  });

  test('Lo abandonado entra porque es material de ruina y lo demolido no', () => {
    const pool = construyePool({
      poiJson: {
        elements: [
          nodo(1, { 'abandoned:amenity': 'cafe', historic: 'ruins', name: 'A Casa Vella' }),
          nodo(2, { 'demolished:building': 'yes', historic: 'ruins', name: 'La que ya no está' }, 0.001),
        ],
      },
      lat0: 42.4,
      lon0: -8.81,
      semilla: 's',
    });
    assert.deepEqual([...idsDe(pool)], ['node/1']);
  });

  test('Una entrada de Places que es un local de adultos se descarta con el mismo filtro', () => {
    const places = [
      { place_id: 'ChIJ-bar', types: ['bar'], name: 'Copas', location: { lat: 42.401, lng: -8.811 } },
      { place_id: 'ChIJ-strip', types: ['strip_club'], name: 'X', location: { lat: 42.402, lng: -8.811 } },
      { place_id: 'ChIJ-cafe', types: ['cafe'], name: 'Café', location: { lat: 42.403, lng: -8.811 } },
    ];
    const pool = construyePool({ poiJson: { elements: [] }, lat0: 42.4, lon0: -8.81, semilla: 's', demanda: { total: 9, suelo: 4 }, places });
    assert.deepEqual([...idsDe(pool)], ['places:ChIJ-cafe'], 'un local de adultos ha entrado por la puerta de Places');
    assert.equal(pool.resumen().descartes.problematicos.adultos, 2);
  });

  test('El filtro se aplica al construir el pool y no depende de que la consulta evitara pedir esas etiquetas', () => {
    // La demostración es el propio dato: el fixture pide bares y agua potable a
    // propósito, así que la consulta NO los está evitando y aun así no entran. Si
    // la garantía viviese en la consulta, aquí habría 769 anclajes de más.
    assert.ok(cuentaEnElDato(URBANO, (t) => familiaProblematica(t) === 'adultos') > 0);
    assert.ok(cuentaEnElDato(URBANO, (t) => t.amenity === 'drinking_water') > 0);
    const pool = poolDe(URBANO);
    for (const a of pool.anclajes) {
      assert.equal(a.etiqueta === 'amenity=drinking_water', false);
      assert.equal(TIPOS_PROBLEMATICOS.some((f) => f.etiquetas.includes(a.etiqueta)), false, `${a.osmId} entró con una etiqueta problemática`);
    }
  });
});

describe('El mundo de una celda es jugable por construcción', () => {
  test('Un tag masivo no monopoliza un tipo de paraje', async () => {
    // Primera mitad del escenario: las fuentes de agua potable no se usan como
    // anclaje. El fixture trae 86, más de las cincuenta del escenario.
    const fuentes = cuentaEnElDato(URBANO, (t) => t.amenity === 'drinking_water');
    assert.equal(fuentes, 86, 'el mundo congelado urbano denso ya no trae las 86 fuentes de agua potable con las que se midió la regla');
    const pool = poolDe(URBANO);
    assert.equal(pool.anclajes.filter((a) => a.etiqueta === 'amenity=drinking_water').length, 0, 'una fuente de agua potable ha entrado en el pool');
    assert.equal(ETIQUETAS_SIN_RECONOCIMIENTO.includes('amenity=drinking_water'), true, 'amenity=drinking_water ha vuelto al pool: la medición que lo sacó sigue en pie');

    // Y la regla general, que es la que evita tener que descubrir a mano el
    // próximo tag masivo: una etiqueta con más de veinte entradas de las que menos
    // del 10 % tiene nombre se cae entera.
    const masivas = [];
    for (let i = 0; i < 50; i++) masivas.push(nodo(3000 + i, { amenity: 'fountain' }, i * 1e-5));
    for (let i = 0; i < 30; i++) masivas.push(nodo(4000 + i, { amenity: 'restaurant', name: `Casa ${i}` }, i * 1e-5, 1e-4));
    const sintetico = construyePool({ poiJson: { elements: masivas }, lat0: 42.4, lon0: -8.81, semilla: 's' });
    assert.equal(sintetico.anclajes.filter((a) => a.etiqueta === 'amenity=fountain').length, 0, 'una etiqueta masiva sin nombre sigue aportando anclajes');
    assert.deepEqual(sintetico.resumen().descartes.etiquetasSinNombre, [{ etiqueta: 'amenity=fountain', entradas: 50, nombradas: 0 }]);
    assert.equal(sintetico.anclajes.length, 30, 'la etiqueta que sí aporta reconocimiento también se ha caído');

    // Segunda mitad: los tipos de paraje siguen repartidos y ninguno se lleva más
    // de la mitad.
    for (const semilla of LAS_DOS_SEMILLAS) {
      const w = await generaMundo(URBANO, semillaDe(URBANO, semilla));
      assert.ok(w.parajes.length > 0, `${URBANO}#${semilla}: sin parajes no hay reparto que medir`);
      const porTipo = new Map();
      for (const p of w.parajes) porTipo.set(p.type, (porTipo.get(p.type) ?? 0) + 1);
      for (const [tipo, n] of porTipo) {
        assert.ok(n <= w.parajes.length / 2, `${URBANO}#${semilla}: el tipo "${tipo}" se lleva ${n} de ${w.parajes.length} parajes`);
      }
    }
  });

  test('Una etiqueta masiva pero nombrada no se descarta: las fuentes ornamentales se quedan', () => {
    const total = cuentaEnElDato(URBANO, (t) => t.amenity === 'fountain');
    const nombradas = cuentaEnElDato(URBANO, (t) => t.amenity === 'fountain' && !!t.name);
    assert.equal(total, 78, 'el mundo congelado urbano denso ya no trae las 78 fuentes con las que se calibró el umbral');
    assert.equal(nombradas, 27);
    assert.ok(total > ENTRADAS_PARA_EXIGIR_NOMBRE, 'la etiqueta ni siquiera llega al umbral de entradas: no se está probando el corte');
    assert.ok(nombradas / total >= FRACCION_NOMBRADAS_MINIMA, 'el fixture ya no está por encima del corte del 10 %');

    const pool = poolDe(URBANO);
    assert.ok(
      pool.anclajes.filter((a) => a.etiqueta === 'amenity=fountain').length > 0,
      'amenity=fountain se ha caído por la regla del reconocimiento pese a tener el 35 % nombradas',
    );
    assert.deepEqual(
      pool.resumen().descartes.etiquetasSinNombre.map((d) => d.etiqueta),
      [],
      'la regla del reconocimiento está descartando etiquetas del mundo denso que no debería',
    );
  });
});

describe('Los anclajes reales son de uso único', () => {
  test('Tomar dos veces el mismo anclaje falla nombrando el anclaje y a quién lo tenía', () => {
    const pool = creaPool({ anclajes: [{ osmId: 'node/1', x: 0, y: 0, name: 'Casa Manuela', etiqueta: 'amenity=cafe', kind: 'cafetería' }] });
    assert.equal(pool.tomar('node/1', 'nucleo', 'Vilanova'), true);
    assert.throws(
      () => pool.tomar('node/1', 'paraje', 'A Ruína'),
      (e) => {
        assert.match(e.message, /node\/1/, 'el error no nombra el anclaje');
        assert.match(e.message, /nucleo/, 'el error no dice quién lo tenía');
        assert.match(e.message, /Vilanova/);
        return true;
      },
      'tomar dos veces el mismo anclaje ha sido un no-op silencioso',
    );
    // Y no se puede tomar sin identificador: sin él no hay uso único que garantizar.
    assert.throws(() => pool.tomar({ x: 0, y: 0 }, 'paraje'), /identificador/);
  });

  test('Un anclaje tomado deja de estar libre y consta quién lo consumió', () => {
    const anclajes = [
      { osmId: 'node/1', x: 0, y: 0, name: 'A', etiqueta: 'amenity=cafe', kind: 'cafetería' },
      { osmId: 'node/2', x: 10, y: 0, name: 'B', etiqueta: 'amenity=cafe', kind: 'cafetería' },
    ];
    const pool = creaPool({ anclajes, demanda: { total: 2, suelo: 1 } });
    assert.equal(pool.libres().length, 2);
    pool.tomar('node/1', 'servicio', 'A Taberna');
    assert.deepEqual(pool.libres().map((a) => a.osmId), ['node/2'], 'el anclaje tomado sigue entre los libres');
    assert.equal(pool.estaTomado('node/1'), true);
    assert.deepEqual(pool.consumidoPor('node/1'), { rol: 'servicio', nombre: 'A Taberna' });
    assert.deepEqual(pool.resumen().tomados, [{ osmId: 'node/1', rol: 'servicio', nombre: 'A Taberna' }]);
    assert.deepEqual(ROLES_CONSUMIDORES, ['nucleo', 'servicio', 'paraje']);
  });

  test('Un NPC no consume anclaje propio', () => {
    // Los NPC todavía no existen en el paquete, así que lo que se afirma es el
    // contrato del pool del que el escenario depende: heredar la ficha del sitio
    // real no pasa por `tomar`, y «npc» no es un rol consumidor declarado.
    const pool = creaPool({ anclajes: [{ osmId: 'node/7', x: 0, y: 0, name: 'Casa Manuela', etiqueta: 'amenity=cafe', kind: 'cafetería' }] });
    pool.tomar('node/7', 'servicio', 'A Taberna do Corvo');
    const antes = pool.resumen().tomados.length;

    const taberna = { name: 'A Taberna do Corvo', real: pool.anclajes[0] };
    const tabernera = { nombre: 'Manuela', trabajaEn: taberna, real: taberna.real }; // hereda, no consume
    assert.equal(tabernera.real.osmId, 'node/7', 'la tabernera no hereda el anclaje de su taberna');
    assert.equal(pool.resumen().tomados.length, antes, 'heredar el anclaje ha movido el número de tomados');

    assert.equal(ROLES_CONSUMIDORES.includes('npc'), false);
    assert.throws(() => pool.tomar('node/8', 'npc'), /rol consumidor desconocido/, 'un NPC puede consumir anclaje por su cuenta');
  });

  test('Excluir un anclaje por su identificador lo saca del reparto sin resembrar nada', () => {
    const anclajes = [
      { osmId: 'node/1', x: 0, y: 0, name: 'A', etiqueta: 'amenity=cafe', kind: 'cafetería' },
      { osmId: 'node/2', x: 10, y: 0, name: 'B', etiqueta: 'amenity=cafe', kind: 'cafetería' },
    ];
    const pool = creaPool({ anclajes });
    pool.tomar('node/1', 'nucleo', 'Vilanova');
    const yaColocado = pool.resumen().tomados;

    pool.excluir('node/2');
    assert.equal(pool.estaExcluido('node/2'), true);
    assert.deepEqual(pool.libres().map((a) => a.osmId), [], 'el anclaje excluido sigue disponible para el reparto');
    assert.deepEqual(pool.resumen().tomados, yaColocado, 'excluir ha tocado lo que ya estaba colocado');
    assert.deepEqual(pool.resumen().excluidos, ['node/2']);
  });

  test('Un cruce o un puente derivado del grafo no toma ningún anclaje', async () => {
    let conGrafo = 0;
    for (const nombre of LOS_CUATRO) {
      for (const semilla of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, semilla));
        const delGrafo = w.parajes.filter((p) => p.origin === 'grafo');
        for (const p of delGrafo) assert.equal(p.real, null, `${nombre}#${semilla}: el paraje de grafo ${p.name} trae anclaje`);
        conGrafo += delGrafo.length;
        // Los tomados son exactamente los consumidores con anclaje, ni uno más.
        assert.equal(w.pool.tomados.length, anclajesDelMundo(w).length, `${nombre}#${semilla}: los tomados no cuadran con lo que consume el mundo`);
      }
    }
    assert.ok(conGrafo > 0, 'ningún mundo colocó parajes de grafo: no se ha comprobado nada');
  });
});

describe('La puntuación de candidatos', () => {
  const cand = (id, name, x, y, desempate = 0) => ({ osmId: `node/${id}`, x, y, name, etiqueta: 'amenity=cafe', kind: 'cafetería', desempate });
  const calzada = { name: 'Camiño do Corvo', pts: [{ x: -1000, y: 0 }, { x: 1000, y: 0 }] };
  const puntosDe = (lista, mundo) => new Map(puntuaCandidatos(lista, mundo).map((c) => [c.a.osmId, c.puntos]));

  test('Cerca de una calzada suma más que lejos', () => {
    const p = puntosDe([cand(1, 'cerca', 0, 50), cand(2, 'lejos', 0, 350)], { settlements: [], routes: [calzada], radius: 1000 });
    assert.ok(p.get('node/1') > p.get('node/2'), 'estar a menos de 100 m de una calzada no puntúa más que estar a más de 300 m');
  });

  test('Estar dentro del radio urbano de un núcleo penaliza pero no excluye', () => {
    const nucleo = { type: 'aldea', x: 0, y: 500 };
    const dentro = cand(1, 'dentro', 0, 505);
    const fuera = cand(2, 'fuera', 0, 50);
    const p = puntosDe([dentro, fuera], { settlements: [nucleo], routes: [calzada], radius: 1000 });
    assert.ok(p.get('node/1') < p.get('node/2'), 'caer dentro del radio urbano no penaliza');

    // Y siendo el único candidato, sigue estando: la penalización ordena, no excluye.
    const solo = puntuaCandidatos([dentro], { settlements: [nucleo], routes: [calzada], radius: 1000 });
    assert.equal(solo.length, 1, 'el candidato dentro del radio urbano ha desaparecido en vez de bajar de orden');
    assert.equal(solo[0].dentroDeNucleo, true);
  });

  test('A igualdad de distancias, el que tiene nombre propio va por delante', () => {
    const orden = puntuaCandidatos([cand(1, null, 0, 50), cand(2, 'A Fonte Vella', 0, 50)], { settlements: [], routes: [calzada], radius: 1000 });
    assert.deepEqual(orden.map((c) => c.a.osmId), ['node/2', 'node/1'], 'el anclaje sin nombre adelanta al que tiene nombre');
  });

  test('Una celda sin ninguna calzada trazada se puntúa sin fallar y la distancia a ruta no aporta nada', () => {
    const lista = [cand(1, 'A', 0, 50), cand(2, null, 0, 350)];
    const sinRutas = puntuaCandidatos(lista, { settlements: [], routes: [], radius: 1000 });
    assert.equal(sinRutas.length, 2);
    for (const c of sinRutas) assert.equal(c.dRuta, Infinity, 'sin calzadas trazadas alguien tiene distancia a ruta finita');
    // Solo el nombre separa a los dos: la distancia a ruta no ha aportado nada.
    assert.equal(sinRutas[0].puntos - sinRutas[1].puntos, 1);

    // Una calzada de recta de emergencia tampoco cuenta como trazada.
    const soloFallback = puntuaCandidatos(lista, { settlements: [], routes: [{ fallback: true, pts: [{ x: 0, y: 0 }, { x: 0, y: 60 }] }], radius: 1000 });
    for (const c of soloFallback) assert.equal(c.dRuta, Infinity);
  });

  test('Puntuar dos veces el mismo pool da exactamente el mismo orden', async () => {
    const w = await generaMundo(URBANO, semillaDe(URBANO, '1'));
    const mundo = { settlements: w.settlements, routes: w.routes, radius: w.radius };
    const una = puntuaCandidatos(w.anchors, mundo).map((c) => `${c.a.osmId}:${c.puntos}`);
    const otra = puntuaCandidatos([...w.anchors].reverse(), mundo).map((c) => `${c.a.osmId}:${c.puntos}`);
    assert.deepEqual(otra, una, 'el orden de la puntuación depende del orden de llegada de los anclajes');
  });
});

describe('Google Places como relleno', () => {
  const enBruto = (id, tipos, name, dx, dy) => ({ place_id: id, types: tipos, name, location: { lat: 42.4 + dx, lng: -8.81 + dy } });
  const osmConUnCafe = { elements: [nodo(1, { amenity: 'cafe', name: 'O Café' })] };

  test('Sin fuente de Places el pool se construye solo con OSM y no falla', () => {
    const pool = construyePool({ poiJson: osmConUnCafe, lat0: 42.4, lon0: -8.81, semilla: 's', demanda: { total: 9, suelo: 4 } });
    assert.deepEqual([...idsDe(pool)], ['node/1']);
    assert.deepEqual(pool.resumen().relleno, { fuente: null, admitidos: 0, sinRelleno: true });
    assert.equal(pool.deficit, 8, 'el déficit no se declara con su número');
  });

  test('Con Places disponible pero sin déficit que cubrir, la celda sale idéntica a la generada sin Places', () => {
    const places = [enBruto('ChIJ-1', ['restaurant'], 'Casa Manuela', 0.001, 0.001)];
    const comun = { poiJson: osmConUnCafe, lat0: 42.4, lon0: -8.81, semilla: 's', demanda: { total: 1, suelo: 1 } };
    const sin = construyePool(comun);
    const con = construyePool({ ...comun, places });
    assert.deepEqual(con.anclajes, sin.anclajes, 'Places ha entrado sin que hubiera déficit que cubrir');
    assert.equal(con.resumen().relleno.admitidos, 0);
    assert.equal(con.resumen().relleno.sinRelleno, true);
  });

  test('Places entra como mucho hasta cubrir el déficit', () => {
    const places = [
      enBruto('ChIJ-1', ['restaurant'], 'Uno', 0.001, 0.001),
      enBruto('ChIJ-2', ['cafe'], 'Dos', 0.002, 0.001),
      enBruto('ChIJ-3', ['park'], 'Tres', 0.003, 0.001),
    ];
    const pool = construyePool({ poiJson: osmConUnCafe, lat0: 42.4, lon0: -8.81, semilla: 's', demanda: { total: 3, suelo: 1 }, places });
    assert.equal(pool.anclajes.length, 3, 'el relleno no se ha detenido en la demanda');
    assert.equal(pool.resumen().dePlaces, 2);
    assert.equal(pool.deficit, 0);
  });

  test('Una entrada de Places viaja con su place_id y con su contenido refrescable fechado', async () => {
    const d = mundoCongelado('suelo-250m');
    const { lat, lon } = d.manifiesto.coordenada;
    const genera = (nombre) => buildWorld({
      lat,
      lon,
      rBase: d.manifiesto.radio_m,
      seed: 'places#1',
      fetchData: async () => ({ geoJson: d.geo, poiJson: d.pois }),
      demanda: { total: 40, suelo: 4 },
      places: {
        capturado: '2026-08-01',
        resultados: [
          { place_id: 'ChIJ-A', types: ['restaurant'], name: nombre, location: { lat: lat + 0.001, lng: lon + 0.001 } },
          { place_id: 'ChIJ-B', types: ['park'], name: `${nombre} II`, location: { lat: lat - 0.001, lng: lon - 0.001 } },
        ],
      },
    });

    const antes = await genera('Casa Manuela');
    assert.ok(antes.pool.dePlaces > 0, 'no ha entrado ninguna entrada de Places: no se está comprobando nada');
    const dePlaces = antes.anchors.filter((a) => a.fuente === 'places');
    for (const a of dePlaces) {
      assert.equal(a.osmId, `places:${a.placeId}`, 'el identificador del anclaje de Places no es su place_id');
      assert.equal(typeof a.placeId, 'string');
      assert.equal(a.refrescable.capturado, '2026-08-01', 'el contenido refrescable no lleva la fecha en que se capturó');
      assert.equal(typeof a.refrescable.nombre, 'string');
      assert.equal(Number.isFinite(a.refrescable.lat) && Number.isFinite(a.refrescable.lon), true);
    }
    // Sobrevive al ida y vuelta por JSON: es lo que se persiste de la partida.
    assert.deepEqual(JSON.parse(JSON.stringify(dePlaces)), dePlaces);

    // Y refrescar el lado real no mueve la capa de ficción.
    const despues = await genera('Otro Nombre Completamente Distinto');
    const ficcion = (w) => JSON.stringify({
      titulo: w.title,
      nucleos: w.settlements.map((s) => [s.name, s.type, Math.round(s.x), Math.round(s.y)]),
      parajes: w.parajes.map((p) => [p.name, p.type, Math.round(p.x), Math.round(p.y)]),
      calzadas: w.routes.map((r) => r.name),
    });
    assert.equal(ficcion(despues), ficcion(antes), 'refrescar el nombre real de un sitio de Places ha movido la capa de ficción');
  });

  test('Una entrada de Places a menos de 25 m de un anclaje de OSM compatible no entra dos veces', () => {
    const comun = { poiJson: osmConUnCafe, lat0: 42.4, lon0: -8.81, semilla: 's', demanda: { total: 4, suelo: 1 } };
    // ~10 m al norte del café de OSM, y del mismo tipo: es el mismo sitio.
    const mismo = construyePool({ ...comun, places: [enBruto('ChIJ-dup', ['cafe'], 'O Café', 9e-5, 0)] });
    assert.deepEqual([...idsDe(mismo)], ['node/1'], 'el mismo sitio ha entrado por las dos fuentes');
    assert.equal(mismo.resumen().descartes.duplicadosDePlaces, 1);

    // ~100 m: ya son dos sitios distintos.
    const otro = construyePool({ ...comun, places: [enBruto('ChIJ-otro', ['cafe'], 'Outro Café', 9e-4, 0)] });
    assert.equal(otro.anclajes.length, 2, `dos sitios a más de ${RADIO_DEDUPLICACION_M} m se han fundido en uno`);
  });

  test('Una fuente de Places que falla o llega vacía deja la celda generada sin relleno', () => {
    const comun = { poiJson: osmConUnCafe, lat0: 42.4, lon0: -8.81, semilla: 's', demanda: { total: 9, suelo: 4 } };
    for (const [caso, places] of [['vacía', []], ['sin resultados', { resultados: [] }], ['rota', { error: 'timeout' }]]) {
      const pool = construyePool({ ...comun, places });
      assert.deepEqual([...idsDe(pool)], ['node/1'], `Places ${caso}: el mundo no se ha generado con el pool de OSM`);
      assert.equal(pool.resumen().relleno.sinRelleno, true, `Places ${caso}: la celda no queda registrada como generada sin relleno`);
    }
  });

  test('Una entrada de Places sin place_id se descarta', () => {
    const places = [
      { types: ['cafe'], name: 'Sin identificador', location: { lat: 42.401, lng: -8.811 } },
      enBruto('ChIJ-ok', ['cafe'], 'Con identificador', 0.002, 0.001),
    ];
    const pool = construyePool({ poiJson: { elements: [] }, lat0: 42.4, lon0: -8.81, semilla: 's', demanda: { total: 4, suelo: 1 }, places });
    assert.deepEqual([...idsDe(pool)], ['places:ChIJ-ok']);
    assert.equal(pool.resumen().descartes.placesSinIdentificador, 1);
  });
});

describe('El pool es una función de los datos y de la semilla', () => {
  test('Construir el pool dos veces con los mismos datos y la misma semilla da el mismo pool', () => {
    const serializa = (p) => JSON.stringify(p.anclajes);
    for (const nombre of LOS_CUATRO) assert.equal(serializa(poolDe(nombre)), serializa(poolDe(nombre)), `${nombre}: dos construcciones dan pools distintos`);
  });

  test('El orden de llegada de los elementos no cambia el pool', () => {
    for (const nombre of LOS_CUATRO) {
      const d = mundoCongelado(nombre);
      const alReves = mundoCongelado(nombre, { ordenInvertido: true });
      const comun = { lat0: d.manifiesto.coordenada.lat, lon0: d.manifiesto.coordenada.lon, semilla: 's' };
      assert.equal(
        JSON.stringify(construyePool({ ...comun, poiJson: alReves.pois }).anclajes),
        JSON.stringify(construyePool({ ...comun, poiJson: d.pois }).anclajes),
        `${nombre}: el pool depende del orden en que llegaron los elementos`,
      );
    }
  });

  test('Dos semillas distintas admiten el mismo conjunto y solo cambia el desempate', () => {
    const d = mundoCongelado(COSTERO);
    const comun = { poiJson: d.pois, lat0: d.manifiesto.coordenada.lat, lon0: d.manifiesto.coordenada.lon };
    const una = construyePool({ ...comun, semilla: '42.40,-8.81#1' });
    const otra = construyePool({ ...comun, semilla: '42.40,-8.81#2' });
    assert.deepEqual(otra.anclajes.map((a) => a.osmId), una.anclajes.map((a) => a.osmId), 'cambiar la semilla ha cambiado qué anclajes se admiten');
    assert.notDeepEqual(otra.anclajes.map((a) => a.desempate), una.anclajes.map((a) => a.desempate), 'el desempate no depende de la semilla');
    const sinCampoDesempate = (p) => JSON.stringify(p.anclajes.map(({ desempate, ...resto }) => resto));
    assert.equal(sinCampoDesempate(otra), sinCampoDesempate(una));
  });

  test('El pool no usa ninguna fuente de azar ni de tiempo del sistema y siembra con su propio sufijo de fase', () => {
    const texto = fuente('packages/nucleo/world/anclajes.js');
    for (const prohibido of ['Math.random', 'Date.now', 'new Date(', 'performance.now']) {
      assert.equal(texto.includes(prohibido), false, `anclajes.js usa ${prohibido}`);
    }
    assert.match(texto, /makeRng\(\s*semilla\s*\+\s*SUFIJOS_DE_FASE\.anclajes\s*\)/, 'el pool no siembra con el sufijo de su fase');
    assert.equal(SUFIJOS_DE_FASE.anclajes, ':anclajes');
    const sufijos = Object.entries(SUFIJOS_DE_FASE).filter(([fase]) => fase !== 'anclajes').map(([, s]) => s);
    assert.equal(sufijos.includes(SUFIJOS_DE_FASE.anclajes), false, 'el pool comparte sufijo de azar con otra fase');
  });
});

describe('El mundo se congela entero', () => {
  test('El mundo no depende de OSM después de generarse', async () => {
    // Se captura lo que la tubería recibió de la capa de datos y, con el mundo ya
    // generado, se cambia por completo. Si el mundo guardara referencias vivas a los
    // datos de OSM en vez de haberlos congelado, aquí se movería algo.
    const d = mundoCongelado(URBANO);
    let crudo = null;
    const w = await generaMundo(URBANO, semillaDe(URBANO, '1'), {
      transforma: (datos) => { crudo = datos; return datos; },
    });
    const antes = JSON.stringify({ ...w, llamadas: undefined });

    crudo.poiJson.elements.length = 0;
    crudo.geoJson.elements.length = 0;
    crudo.poiJson.elements.push({ type: 'node', id: 1, tags: { amenity: 'cafe', name: 'Otro mundo' }, lat: 0, lon: 0 });

    assert.equal(JSON.stringify({ ...w, llamadas: undefined }), antes, 'el mundo generado ha cambiado al cambiar los datos de OSM');
    assert.equal(w.pool.admitidos, poolDe(URBANO).anclajes.length, 'el resumen del pool congelado ya no cuadra con lo que se admitió');
    assert.ok(d.pois.elements.length > 0, 'el mundo congelado se ha quedado sin datos: la comprobación anterior no medía nada');
  });
});

describe('Escasez, déficit y celdas pobres', () => {
  test('Un mundo sin ningún POI admisible da un pool vacío y no falla', () => {
    const pool = poolDe(POBRE);
    assert.deepEqual(pool.anclajes, []);
    assert.deepEqual(pool.libres(), [], 'pedir los anclajes libres de un pool vacío no devuelve una lista vacía');
    assert.deepEqual(pool.tomados(), []);
    assert.equal(pool.resumen().admitidos, 0);
  });

  test('El pool declara el déficit con su número en vez de esconderlo', () => {
    const pool = poolDe(POBRE, { demanda: { total: 7, suelo: 4 } });
    assert.equal(pool.deficit, 7);
    assert.equal(pool.resumen().deficit, 7);
    assert.deepEqual(pool.resumen().demanda, { total: 7, suelo: 4 });
    // Y con la demanda cubierta, el déficit es cero y no un número negativo.
    assert.equal(poolDe(COSTERO, { demanda: { total: 3, suelo: 2 } }).deficit, 0);
  });

  test('Una fuente vacía o sin campo de elementos da un pool vacío en lugar de una excepción', () => {
    for (const poiJson of [{}, { elements: [] }, null, undefined, { elements: null }]) {
      const pool = construyePool({ poiJson, lat0: 42.4, lon0: -8.81, semilla: 's' });
      assert.deepEqual(pool.anclajes, [], `la fuente ${JSON.stringify(poiJson)} no ha dado un pool vacío`);
    }
  });

  test('Una fuente malformada falla nombrando la fuente y el primer elemento inválido', () => {
    const elementos = [nodo(1, { amenity: 'cafe', name: 'válido' }), { tags: { amenity: 'cafe', name: 'sin tipo ni id' } }];
    assert.throws(
      () => construyePool({ poiJson: { elements: elementos }, lat0: 42.4, lon0: -8.81, semilla: 's' }),
      (e) => {
        assert.match(e.message, /OSM/, 'el error no nombra la fuente');
        assert.match(e.message, /posición 1/, 'el error no señala el primer elemento inválido');
        return true;
      },
    );
    assert.throws(() => construyePool({ poiJson: { elements: [null] }, lat0: 42.4, lon0: -8.81 }), /OSM/);
  });
});
