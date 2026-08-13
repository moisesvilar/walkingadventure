// SPEC-014 · La capa de NPCs: los sitios de un mapa, la plantilla de puestos de cada
// tipo, la cara titular que existe desde el día 1, las que despiertan al pedirlas, el
// anclaje que se hereda y no se consume, y el reparto de género sobre el mapa entero.
//
// Los números son medidos sobre los ocho extractos de referencia y no opinados. Los
// que esta suite fija, y que se moverán si la capa cambia de comportamiento:
//
//   · **anclajes tomados, antes y después de despertar el mapa entero**: 0, 0, 22,
//     23, 8, 8, 24 y 26, y el resumen del pool idéntico byte a byte en los ocho.
//   · **el casting con gente y sin ella**: 210 lazos de 240 en los dos casos, 905 de
//     905 roles humanos resueltos y ni una clave del histograma que hable de gente.
//     El caso **no puede ser vacuo** y lo demuestra dentro: con un resolutor ingenuo
//     —el que solo sabe resolver un puesto que ya esté en la plantilla— los mismos
//     905 roles caen a 529, y esas 376 caras que faltan son las que RF-NPC-002 exige.
//   · **el género**: diferencia de uno como mucho dentro de cada uno de los nueve
//     puestos, desempate femenino y **cero oficios monocolor** con dos caras o más.
//
// Cuatro casos llevan el nombre literal de su escenario de `docs/testing.md`; el
// resto va declarado como hueco de la batería en `test/spec-test-map.json`, y son
// huecos de verdad: RF-NPC-002 y RF-NPC-004 están marcados «⚠ sin escenario» en el
// PRD, y la propia spec enumera otros cinco.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: los mundos salen de
// test/fixtures/osm/ por el doble de siempre.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../../packages/nucleo/core/rng.js';
import { namesFor } from '../../packages/nucleo/names/index.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import {
  FAMILIAS_DE_SITIO,
  caraDeSitio,
  creaCapaDeNpcs,
  identidadDeCara,
  repartoPotencial,
  sitiosDeMapa,
} from '../../packages/nucleo/partida/npcs.js';
import {
  GENEROS,
  IDS_DE_GENERO,
  PUESTOS,
  PUESTOS_POR_TIPO,
  ROTULOS_DE_PUESTO,
  SUFIJO_DE_NPCS,
  TIPOS_DE_SITIO,
  claveDeCara,
  plantillaDePuestos,
  puestoTitular,
  repartoDeGenero,
  rotuloDePuesto,
} from '../../packages/nucleo/partida/puestos.js';
import { infraccionesDeTexto } from '../../packages/nucleo/names/lenguaje.js';
import { infraccionesDeLecturaEnVozAlta } from '../../packages/nucleo/quests/escena.js';
import { casteaCatalogo, exigeEncuadre } from '../../packages/nucleo/quests/casting.js';
import { TEMPLATES } from '../../packages/nucleo/quests/templates.js';
import { anclajesDelMundo, fuente } from './mundo-de-prueba.mjs';
import {
  LA_TABERNERA,
  MAPA,
  capaSobre,
  codigoDe,
  copiaDelMundo,
  idiomaDe,
  losOcho,
  mundoDe,
  mundoDeMesa,
} from './npc-de-prueba.mjs';
import { celdaDeFixture } from './partida-de-prueba.mjs';

/** Los cuatro módulos de la entrega, que se inspeccionan como texto varias veces. */
const MODULOS = [
  'packages/nucleo/partida/npcs.js',
  'packages/nucleo/partida/puestos.js',
  'packages/nucleo/partida/memoria.js',
  'packages/nucleo/partida/relacion.js',
];

/** Todas las caras potenciales de un mundo, ya despiertas, con su capa. */
function capaDespierta(mundo, opciones = {}) {
  const montaje = capaSobre(mundo, opciones);
  const reparto = repartoPotencial({ mundo, semilla: montaje.semilla, idioma: montaje.idioma });
  for (const cara of reparto.caras) montaje.capa.despierta({ sitio: cara.sitio, puesto: cara.puesto });
  return { ...montaje, reparto };
}

/** El sitio tal y como se lo pasa el casting a la resolución de rol humano. */
const sitioDelCasting = (sitio) => ({ nombre: sitio.id, x: sitio.x, y: sitio.y, real: sitio.anclaje, tipo: sitio.tipo });

describe('El sitio y su plantilla de puestos', () => {
  test('Los sitios de una celda son sus núcleos y sus servicios, y ninguna otra cosa', async () => {
    for (const { clave, mundo } of await losOcho()) {
      const sitios = sitiosDeMapa(mundo);
      const esperados = mundo.settlements.length + mundo.settlements.reduce((n, s) => n + (s.services?.length ?? 0), 0);
      assert.equal(sitios.length, esperados, `${clave}: los sitios no son los núcleos más sus servicios`);
      assert.ok(esperados > 0, `${clave}: el mundo no trae ni un sitio y el caso no comprueba nada`);

      const nombresDeParaje = new Set((mundo.parajes ?? []).map((p) => p.name));
      for (const sitio of sitios) {
        assert.ok(FAMILIAS_DE_SITIO.includes(sitio.familia), `${clave}: "${sitio.id}" declara la familia "${sitio.familia}"`);
        assert.equal(nombresDeParaje.has(sitio.id), false, `${clave}: el paraje "${sitio.id}" se ha colado entre los sitios`);
      }
      // Un paraje no es un sitio: no tiene plantilla y no puede tener caras.
      for (const paraje of mundo.parajes ?? []) {
        assert.equal(sitios.some((s) => s.id === paraje.name), false, `${clave}: "${paraje.name}" es paraje y aparece como sitio`);
      }
    }
  });

  test('La plantilla de un tipo de sitio es cerrada, ordenada, con el titular primero y sin género en sus claves', () => {
    assert.deepEqual(TIPOS_DE_SITIO.slice().sort(), Object.keys(PUESTOS_POR_TIPO).slice().sort());
    for (const tipo of TIPOS_DE_SITIO) {
      const plantilla = plantillaDePuestos(tipo);
      assert.ok(Array.isArray(plantilla) && plantilla.length > 0, `la plantilla de "${tipo}" está vacía`);
      assert.equal(Object.isFrozen(plantilla), true, `la plantilla de "${tipo}" se puede modificar desde fuera`);
      assert.equal(new Set(plantilla).size, plantilla.length, `la plantilla de "${tipo}" repite un puesto`);
      assert.equal(plantilla[0], puestoTitular(tipo), `el primer puesto de "${tipo}" no es el titular`);
      // La lista es la misma llamada tras llamada: es catálogo, no una tirada.
      assert.deepEqual(plantillaDePuestos(tipo), plantilla);
    }
    // Los cuatro tipos de núcleo y los seis de servicio que produce la generación.
    for (const tipo of ['ciudad', 'pueblo', 'aldea', 'granja', 'taberna', 'posada', 'boticario', 'armeria', 'conjureria', 'mercado']) {
      assert.ok(TIPOS_DE_SITIO.includes(tipo), `el catálogo no declara plantilla para "${tipo}"`);
    }
    // Ninguna clave nombra un género: ni la forma de quien ejerce el oficio, ni una
    // marca gramatical. Con la clave marcada, el reparto se colaría por detrás.
    for (const puesto of PUESTOS) {
      assert.doesNotMatch(puesto, /(ero|era|eros|eras|esa|esas|ista|istas|izo|iza|dor|dora)$/, `el puesto "${puesto}" está escrito como se llama a quien ejerce el oficio`);
      for (const genero of IDS_DE_GENERO) assert.equal(puesto.includes(genero), false, `el puesto "${puesto}" nombra un género`);
    }
  });

  test('Cada puesto se dice en pantalla con un rótulo de mundo, y un puesto sin él revienta', () => {
    // SPEC-051, decidido por el dueño el 13-ago-2026: **nada de `REGENCIA` en pantalla**. La
    // clave es de dentro —es la de la partida y la de la memoria— y lo que se enseña es un
    // rótulo de mundo. Los nueve van escritos aquí uno a uno y no derivados de la
    // declaración: una comprobación que se leyera a sí misma pasaría con cualquier cosa.
    assert.deepEqual({ ...ROTULOS_DE_PUESTO }, {
      regencia: 'al frente',
      vigilancia: 'de guardia',
      vecindad: 'del vecindario',
      cocina: 'en la cocina',
      sala: 'en la sala',
      cuadra: 'en la cuadra',
      limpieza: 'al cuidado de la casa',
      aprendizaje: 'en el aprendizaje',
      acarreo: 'en el acarreo',
    });

    // Los nueve puestos que existen tienen el suyo, y ninguno es la clave repetida.
    assert.equal(PUESTOS.length, 9, `hay ${PUESTOS.length} puestos y se midieron nueve`);
    for (const puesto of PUESTOS) {
      const rotulo = rotuloDePuesto(puesto);
      assert.equal(typeof rotulo, 'string');
      assert.ok(rotulo.trim().length > 0, `el rótulo de "${puesto}" está vacío`);
      assert.notEqual(rotulo, puesto, `el rótulo de "${puesto}" es la propia clave`);
    }

    // **Un puesto sin rótulo es error de construcción y nunca un respaldo a la clave**:
    // pintar `REGENCIA` en silencio es exactamente la degradación que esta declaración
    // existe para no cometer, y es el mismo mecanismo que los `exige*` del telón.
    assert.throws(() => rotuloDePuesto('mayordomia'), (e) => /mayordomia/.test(e.message) && PUESTOS.every((p) => e.message.includes(p)));
    assert.throws(() => rotuloDePuesto(null), /no tiene rótulo/);
  });

  test('No se usa masculino genérico en fórmulas frecuentes', () => {
    // Los nueve rótulos son **sintagmas de tarea y no nombres de persona**, y de ahí les viene
    // todo lo que cumplen: no hay género que elegir, así que no hay masculino genérico que
    // evitar ni morfología que inventar, y nombran lo que se hace y no a quien lo hace, así
    // que ningún oficio arrastra estereotipo (`game-design/lenguaje.md`). Se revisan **los
    // nueve** y no una muestra: son nueve.
    for (const puesto of PUESTOS) {
      const rotulo = rotuloDePuesto(puesto);
      assert.deepEqual([...infraccionesDeTexto(rotulo, { locale: 'es' })], [], `el rótulo de "${puesto}" —«${rotulo}»— infringe una regla de lenguaje`);
      assert.deepEqual([...infraccionesDeLecturaEnVozAlta(rotulo)], [], `el rótulo de "${puesto}" —«${rotulo}»— no se puede leer en voz alta`);
      assert.equal(/\d/.test(rotulo), false, `el rótulo de "${puesto}" lleva una cifra`);
    }
  });

  test('El tope de caras de un sitio es la longitud de su plantilla, y ni una más', async () => {
    const mundo = mundoDeMesa();
    const { capa } = capaSobre(mundo);
    const plantilla = capa.plantillaDe('Casa Manuela');
    assert.deepEqual(plantilla, PUESTOS_POR_TIPO.taberna, 'la taberna del mundo de mesa no usa la plantilla de las tabernas');

    const reparto = repartoPotencial({ mundo, semilla: mundo.seed, idioma: idiomaDe(mundo) });
    const suyas = reparto.caras.filter((c) => c.sitio === 'Casa Manuela');
    assert.equal(suyas.length, plantilla.length, 'la taberna puede tener más caras que puestos declara su plantilla');

    // Con todas despiertas, pedir un puesto más no crea ninguna cara nueva.
    for (const cara of suyas) capa.despierta({ sitio: cara.sitio, puesto: cara.puesto });
    const antes = capa.despiertas().length;
    const sitio = sitioDelCasting(capa.sitios().find((s) => s.id === 'Casa Manuela'));
    const resuelta = capa.resuelveRolHumano({ sitio, rol: { tipo: 'humano', puesto: 'trovador' } });
    assert.ok(plantilla.includes(resuelta.cara.puesto), 'se ha inventado un puesto fuera de la plantilla');
    assert.equal(capa.despiertas().length, antes, 'pedir un puesto de más ha hecho nacer una cara nueva');

    // Y sobre dato real: ningún sitio de los ocho extractos pasa de su plantilla.
    for (const { clave, mundo: real } of await losOcho()) {
      const rep = repartoPotencial({ mundo: real, semilla: real.seed, idioma: idiomaDe(real) });
      const porSitio = new Map();
      for (const cara of rep.caras) porSitio.set(cara.sitio, (porSitio.get(cara.sitio) ?? 0) + 1);
      for (const sitio of sitiosDeMapa(real)) {
        assert.equal(porSitio.get(sitio.id), plantillaDePuestos(sitio.tipo).length, `${clave}: "${sitio.id}" no tiene exactamente los puestos de su plantilla`);
      }
    }
  });

  test('Una aldea sin ningún servicio es un sitio y tiene su plantilla de puestos', () => {
    const mundo = {
      title: 'Tierras Vacías',
      seed: '42.40,-8.81#1',
      settlements: [{ name: 'Ourela', type: 'aldea', x: 0, y: 0, anchor: null, services: [] }],
      parajes: [],
      routes: [],
    };
    const sitios = sitiosDeMapa(mundo);
    assert.equal(sitios.length, 1);
    assert.equal(sitios[0].familia, 'nucleo');
    assert.deepEqual(plantillaDePuestos(sitios[0].tipo), PUESTOS_POR_TIPO.aldea);
    const { capa } = capaSobre(mundo, { idioma: namesFor('es') });
    assert.equal(capa.titular('Ourela').puesto, puestoTitular('aldea'), 'la aldea sin servicios se ha quedado sin cara titular');
  });

  test('Un mapa sin ningún núcleo enumera cero sitios y no falla', () => {
    assert.deepEqual(sitiosDeMapa({ settlements: [] }), []);
    assert.deepEqual(sitiosDeMapa({}), []);
    const { capa } = capaSobre({ seed: '42.40,-8.81#1', settlements: [], parajes: [], routes: [] }, { idioma: namesFor('es') });
    assert.deepEqual(capa.sitios(), []);
    assert.deepEqual(capa.despiertas(), []);
  });
});

describe('La cara titular y las caras que despiertan', () => {
  test('La cara titular existe desde el día 1 y su nombre no se entrega hasta conocerla', async () => {
    const mundo = await mundoDe('costero', '1');
    const { capa } = capaSobre(mundo);
    for (const sitio of capa.sitios()) {
      const titular = capa.titular(sitio.id);
      assert.equal(titular.titular, true, `"${sitio.id}": su cara titular no se declara titular`);
      assert.equal(titular.puesto, puestoTitular(sitio.tipo));
      assert.equal(capa.estaDespierta(titular), true, `"${sitio.id}": su cara titular no está desde el principio`);
      assert.ok(typeof titular.nombre === 'string' && titular.nombre.length > 0, `"${sitio.id}": la titular no tiene nombre desde el día 1`);
    }
    assert.ok(capa.sitios().length > 0, 'el mundo del caso no trae sitios');

    const sitio = capa.sitios()[0];
    const cara = { sitio: sitio.id, puesto: puestoTitular(sitio.tipo) };
    const sinConocer = capa.comoNombrar(cara);
    assert.equal(sinConocer.conocida, false);
    assert.equal(sinConocer.nombre, null, 'se entrega el nombre propio de quien no se ha conocido');
    assert.equal(sinConocer.puesto, cara.puesto, 'no se la nombra por su puesto');

    capa.conoce(cara);
    const conocida = capa.comoNombrar(cara);
    assert.equal(conocida.conocida, true);
    assert.equal(conocida.nombre, capa.titular(sitio.id).nombre, 'tras hablar con ella no se entrega su nombre propio');
  });

  test('Una cara despierta al pedirla, se queda despierta y no nace ninguna nueva', async () => {
    const mundo = await mundoDe('costero', '1');
    const { capa } = capaSobre(mundo);
    const sitio = capa.sitios().find((s) => plantillaDePuestos(s.tipo).length >= 3);
    const plantilla = plantillaDePuestos(sitio.tipo);
    assert.equal(capa.despiertas().filter((c) => c.sitio === sitio.id).length, 1, 'el sitio empieza con más caras que la titular');

    const segunda = capa.resuelveRolHumano({ sitio: sitioDelCasting(sitio), rol: { tipo: 'humano', puesto: plantilla[1] } });
    assert.equal(segunda.cara.puesto, plantilla[1]);
    assert.equal(capa.estaDespierta(segunda.cara), true, 'la cara pedida no se ha quedado despierta');

    const yaDespiertas = capa.despiertas();
    const otraVez = capa.resuelveRolHumano({ sitio: sitioDelCasting(sitio), rol: { tipo: 'humano', puesto: plantilla[1] } });
    assert.deepEqual(otraVez.cara, segunda.cara, 'pedir la misma cara otra vez ha devuelto otra');
    assert.deepEqual(capa.despiertas(), yaDespiertas, 'pedir la misma cara otra vez ha hecho nacer alguna');

    // Despertar una cara más no toca ninguna de las ya despiertas.
    const antes = yaDespiertas.map((c) => capa.cara(c));
    capa.despierta({ sitio: sitio.id, puesto: plantilla[2] });
    for (const cara of antes) assert.deepEqual(capa.cara({ sitio: cara.sitio, puesto: cara.puesto }), cara, `"${cara.sitio}/${cara.puesto}" ha cambiado al despertar otra`);
  });

  test('El nombre de una cara es único en todo el mapa', async () => {
    for (const { clave, mundo } of await losOcho()) {
      const reparto = repartoPotencial({ mundo, semilla: mundo.seed, idioma: idiomaDe(mundo) });
      const usados = new Map();
      const anota = (nombre, de) => {
        assert.equal(usados.has(nombre), false, `${clave}: "${nombre}" lo llevan ${usados.get(nombre)} y ${de}`);
        usados.set(nombre, de);
      };
      if (mundo.title) anota(mundo.title, 'el título del mundo');
      for (const s of mundo.settlements) {
        anota(s.name, 'un núcleo');
        for (const v of s.services ?? []) anota(v.name, 'un servicio');
      }
      for (const p of mundo.parajes ?? []) anota(p.name, 'un paraje');
      for (const r of mundo.routes ?? []) if (r?.name && !usados.has(r.name)) usados.set(r.name, 'una calzada');
      for (const cara of reparto.caras) anota(cara.nombre, `la cara "${cara.puesto}" de "${cara.sitio}"`);
      assert.ok(reparto.caras.length > 0, `${clave}: el mundo no produce ni una cara`);
    }
  });
});

describe('La clave de una cara no depende del orden', () => {
  test('Tres órdenes de despertar dan las mismas caras en los ocho extractos', async () => {
    for (const { clave, mundo } of await losOcho()) {
      const idioma = idiomaDe(mundo);
      // La copia del mundo tiene identidad nueva a propósito: así el reparto se
      // recalcula entero en cada orden y no sale memorizado del anterior.
      const base = repartoPotencial({ mundo: copiaDelMundo(mundo), semilla: mundo.seed, idioma });
      const claves = base.caras.map((c) => ({ sitio: c.sitio, puesto: c.puesto }));
      assert.ok(claves.length > 0, `${clave}: no hay caras que despertar`);

      const ordenes = [
        claves,
        claves.slice().reverse(),
        claves.slice().sort((a, b) => (a.puesto < b.puesto ? -1 : a.puesto > b.puesto ? 1 : a.sitio < b.sitio ? -1 : 1)),
      ];
      const fotos = ordenes.map((orden) => {
        const capa = creaCapaDeNpcs({ semilla: mundo.seed, mapaId: MAPA, mundo: copiaDelMundo(mundo), idioma });
        return orden
          .map((c) => capa.despierta(c))
          .map((c) => `${c.sitio}|${c.puesto}|${c.genero}|${c.nombre}`)
          .sort();
      });
      assert.deepEqual(fotos[1], fotos[0], `${clave}: despertar al revés cambia las caras`);
      assert.deepEqual(fotos[2], fotos[0], `${clave}: despertar por puesto cambia las caras`);
    }
  });

  test('Despertar el tercer puesto antes que el segundo da exactamente las mismas dos caras', async () => {
    const mundo = await mundoDe('urbano-denso', '1');
    const idioma = idiomaDe(mundo);
    const sitio = sitiosDeMapa(mundo).find((s) => plantillaDePuestos(s.tipo).length >= 3);
    const [, segundo, tercero] = plantillaDePuestos(sitio.tipo);

    const enOrden = (puestos) => {
      const capa = creaCapaDeNpcs({ semilla: mundo.seed, mapaId: MAPA, mundo: copiaDelMundo(mundo), idioma });
      const salida = {};
      for (const puesto of puestos) {
        const cara = capa.despierta({ sitio: sitio.id, puesto });
        salida[puesto] = `${cara.genero}|${cara.nombre}`;
      }
      return salida;
    };
    assert.deepEqual(enOrden([tercero, segundo]), enOrden([segundo, tercero]), 'el orden de despertar ha cambiado quién es quién');
  });

  test('La identidad de una cara sale de la semilla, del sitio y del puesto, y de nada más', async () => {
    const mundo = mundoDeMesa();
    const idioma = idiomaDe(mundo);
    const cara = identidadDeCara({ mundo, semilla: mundo.seed, idioma, ...LA_TABERNERA });

    // El azar sale de `makeRng` con un sufijo propio que lleva dentro el sitio y el
    // puesto: se recompone aquí desde fuera y tiene que dar el mismo nombre.
    const rng = makeRng(`${mundo.seed}${SUFIJO_DE_NPCS}:${LA_TABERNERA.sitio}:${LA_TABERNERA.puesto}`);
    assert.equal(cara.nombre, idioma.personName(rng, cara.genero), 'el nombre no sale de makeRng con el sufijo del sitio y el puesto');

    // Cambiar cualquiera de los tres cambia la cara; no cambiar ninguno la repite.
    const otraSemilla = identidadDeCara({ mundo: copiaDelMundo(mundo), semilla: '42.40,-8.81#2', idioma, ...LA_TABERNERA });
    assert.notEqual(`${otraSemilla.genero}|${otraSemilla.nombre}`, `${cara.genero}|${cara.nombre}`, 'otra semilla da la misma cara');
    const otroPuesto = identidadDeCara({ mundo, semilla: mundo.seed, idioma, sitio: LA_TABERNERA.sitio, puesto: 'cocina' });
    assert.notEqual(otroPuesto.nombre, cara.nombre, 'dos puestos del mismo sitio son la misma persona');
    assert.deepEqual(identidadDeCara({ mundo: copiaDelMundo(mundo), semilla: mundo.seed, idioma, ...LA_TABERNERA }), cara, 'la misma cara en otra instalación sale distinta');

    // Ni el mapa activo, ni haberla conocido, ni cuántas veces se pida intervienen.
    const enCasa = capaSobre(mundo, { mapaId: 'casa' });
    const fuera = capaSobre(mundo, { mapaId: 'fuera' });
    enCasa.capa.conoce(LA_TABERNERA);
    for (let k = 0; k < 5; k++) enCasa.capa.despierta(LA_TABERNERA);
    assert.equal(enCasa.capa.cara(LA_TABERNERA).nombre, fuera.capa.cara(LA_TABERNERA).nombre, 'conocerla o pedirla varias veces ha cambiado su identidad');

    // Y en el código no hay contador de aparición, fecha ni lista de conocidos de
    // la que colgar el azar.
    const codigo = codigoDe(fuente('packages/nucleo/partida/npcs.js'));
    for (const prohibido of ['Math.random', 'Date.now', 'new Date', 'performance.now']) {
      assert.equal(codigo.includes(prohibido), false, `npcs.js usa ${prohibido} en la generación de una cara`);
    }
    assert.doesNotMatch(codigo, /makeRng\([^)]*conocid/i, 'el azar de una cara cuelga de la lista de conocidas');
    assert.doesNotMatch(codigo, /makeRng\([^)]*\bn\b\s*[+`]/, 'el azar de una cara cuelga de un contador de pasos');
  });
});

describe('Los anclajes reales son de uso único', () => {
  test('Un NPC no consume anclaje propio', async () => {
    // La taberna del escenario, anclada al bar «Casa Manuela»: la tabernera hereda
    // su ficha, con el mismo identificador nativo, y el pool no se mueve.
    const mesa = mundoDeMesa();
    const taberna = sitiosDeMapa(mesa).find((s) => s.id === 'Casa Manuela');
    const tabernera = identidadDeCara({ mundo: mesa, semilla: mesa.seed, idioma: idiomaDe(mesa), ...LA_TABERNERA });
    assert.deepEqual(tabernera.anclaje, taberna.anclaje, 'la tabernera no hereda el anclaje de la taberna');
    assert.equal(tabernera.anclaje.osmId, 'node/3');
    assert.equal(tabernera.anclado, 'Casa Manuela', 'la cara no declara de qué sitio cuelga');

    // Cuatro caras del mismo sitio llevan el mismo identificador nativo, el suyo.
    const posada = { ...mesa, settlements: mesa.settlements.map((s) => (s.name === 'Vilanova' ? { ...s, services: [{ kind: 'posada', name: 'A Pousada', x: 1030, y: 0, real: { osmId: 'node/9', kind: 'hotel' } }] } : s)) };
    const suyas = repartoPotencial({ mundo: posada, semilla: posada.seed, idioma: idiomaDe(posada) }).caras.filter((c) => c.sitio === 'A Pousada');
    assert.equal(suyas.length, PUESTOS_POR_TIPO.posada.length);
    for (const cara of suyas) assert.equal(cara.anclaje.osmId, 'node/9', 'dos caras del mismo sitio no llevan el mismo identificador nativo');

    // Y sobre los ocho extractos: despertar el mapa entero no mueve ni un tomado.
    const tomados = [];
    for (const { clave, mundo } of await losOcho()) {
      const antes = JSON.stringify(mundo.pool);
      const { reparto } = capaDespierta(mundo);
      const despues = JSON.stringify(mundo.pool);
      assert.equal(despues, antes, `${clave}: despertar todas las caras ha movido el resumen del pool`);
      assert.ok(reparto.caras.length > 0, `${clave}: no se ha despertado ni una cara`);
      tomados.push(`${JSON.parse(antes).tomados.length}→${JSON.parse(despues).tomados.length}`);
    }
    // Remedido con SPEC-017: los ocho extractos se regeneraron —nombrar todo tramo
    // difícil al construir el grafo reserva esos nombres en el índice del mundo
    // antes que las calzadas, así que el sorteo de nombres cambia— y `costero#2`
    // pasa de 24 anclajes tomados a 23. Lo que este caso afirma no es el número:
    // es que **poblar el mapa entero no mueve ni uno**, y eso sigue siendo cierto
    // en los ocho, que es lo que dicen las ocho igualdades.
    assert.deepEqual(tomados, ['0→0', '0→0', '22→22', '23→23', '8→8', '8→8', '24→24', '26→26'], 'el número de anclajes tomados se ha movido al poblar los mundos');

    // Y en el código no hay ni una toma: búscalo, no está.
    const codigo = codigoDe(fuente('packages/nucleo/partida/npcs.js'));
    for (const prohibido of ['.tomar(', '.libres(', 'freeAnchors', 'construyePool', 'creaPool']) {
      assert.equal(codigo.includes(prohibido), false, `npcs.js llama a ${prohibido}: la capa está tocando el pool`);
    }
    assert.doesNotMatch(codigo, /from '.*anclajes\.js'/, 'la capa de NPCs importa el pool de anclajes');
  });

  test('Ningún anclaje aparece dos veces', async () => {
    for (const { clave, mundo } of await losOcho()) {
      const { reparto } = capaDespierta(mundo);
      const vistos = new Map();
      for (const { osmId, de } of anclajesDelMundo(mundo)) {
        assert.equal(vistos.has(osmId), false, `${clave}: ${osmId} alimenta ${vistos.get(osmId)} y ${de}`);
        vistos.set(osmId, de);
      }
      // Con el mapa entero poblado, el identificador de cada cara es el de su sitio
      // y por eso no añade ninguno nuevo al recuento.
      const deLasCaras = new Set(reparto.caras.filter((c) => c.anclaje?.osmId).map((c) => c.anclaje.osmId));
      for (const id of deLasCaras) assert.equal(vistos.has(id), true, `${clave}: la cara ancla en ${id}, que no es de ningún sitio del mapa`);
      assert.ok(vistos.size > 0 || clave.startsWith('barrio'), `${clave}: no hay anclajes que comprobar`);
    }
  });

  test('Un núcleo sin anclaje real tiene cara igualmente y un servicio sin él falla nombrándose', async () => {
    // Veredicto §6p de pipeline/decisiones-orquestador.md: manda RF-NPC-002. Los
    // núcleos colocados por geometría no tienen ficha de OSM, y hacerlos fallar
    // dejaría al mundo mínimo sin una sola cara — el casting fallando por gente.
    const barrio = await mundoDe('barrio-tres-calles', '1');
    const { capa } = capaSobre(barrio);
    const sinAnclaje = capa.sitiosSinAnclajeReal();
    assert.equal(sinAnclaje.length, 5, 'los cinco núcleos por geometría del barrio de tres calles se han movido');
    for (const s of sinAnclaje) assert.equal(s.familia, 'nucleo', `"${s.sitio}" es un ${s.familia} sin anclaje y aun así tiene caras`);
    const cara = capa.titular(sinAnclaje[0].sitio);
    assert.equal(cara.anclaje, null, 'la cara de un núcleo sin ficha se inventa un anclaje');
    assert.equal(cara.anclado, sinAnclaje[0].sitio, 'la cara de un núcleo sin ficha no queda anclada al sitio');

    // En un servicio el anclaje es constitutivo, y sin él la cara no se entrega.
    const mesa = mundoDeMesa();
    const roto = { ...mesa, settlements: mesa.settlements.map((s) => (s.name === 'Vilanova' ? { ...s, services: s.services.map((v) => ({ ...v, real: null })) } : s)) };
    assert.throws(
      () => identidadDeCara({ mundo: roto, semilla: roto.seed, idioma: idiomaDe(roto), ...LA_TABERNERA }),
      (e) => e.message.includes('Casa Manuela'),
      'un servicio sin anclaje entrega cara igualmente',
    );
  });
});

describe('El casting no falla por gente', () => {
  test('Un rol humano siempre devuelve una cara y ningún motivo de fallo habla de gente', async () => {
    // Cada rol de sitio del catálogo gana dos roles humanos: uno con un puesto que
    // está en la plantilla y otro con uno que no lo está en ninguna. El segundo es
    // el que RF-NPC-002 obliga a resolver con la cara titular.
    const conGente = TEMPLATES.map((t) => {
      const roles = { ...t.roles };
      const orden = [...t.orden];
      for (const rid of t.orden) {
        if (!['nucleo', 'servicio'].includes(t.roles[rid].tipo)) continue;
        roles[`${rid}-regencia`] = { tipo: 'humano', en: rid, puesto: 'regencia' };
        roles[`${rid}-artesano`] = { tipo: 'humano', en: rid, puesto: 'artesano' };
        orden.push(`${rid}-regencia`, `${rid}-artesano`);
      }
      return { ...t, roles, orden };
    });
    const humanosDe = (plantilla) => Object.keys(plantilla.roles).filter((rid) => plantilla.roles[rid].tipo === 'humano');

    let sinGente = 0;
    let gente = 0;
    let humanos = 0;
    let resueltos = 0;
    let titulares = 0;
    const motivos = new Map();
    for (const { clave, mundo } of await losOcho()) {
      const encuadre = exigeEncuadre(mundo);
      sinGente += casteaCatalogo({ ...encuadre, mundo, catalogo: TEMPLATES, semilla: mundo.seed }).filter((c) => c.ok).length;
      const con = casteaCatalogo({ ...encuadre, mundo, catalogo: conGente, semilla: mundo.seed });
      for (const c of con) {
        if (!c.ok) {
          motivos.set(c.motivo.clave, (motivos.get(c.motivo.clave) ?? 0) + 1);
          assert.deepEqual(c.motivo.roles?.filter((rid) => rid.endsWith('-regencia') || rid.endsWith('-artesano')) ?? [], [], `${clave}/${c.plantilla}: el motivo del fallo culpa a un rol humano`);
          continue;
        }
        gente += 1;
        const plantilla = conGente.find((t) => t.id === c.plantilla);
        for (const rid of humanosDe(plantilla)) {
          humanos += 1;
          const persona = c.asignacion[rid];
          assert.ok(persona && persona.cara, `${clave}/${c.plantilla}: el rol humano "${rid}" ha quedado sin cara`);
          assert.equal(persona.tipo, 'humano');
          assert.equal(persona.motivo, undefined, 'un rol humano ha devuelto un motivo de fallo');
          // El puesto que no está en ninguna plantilla se resuelve con la titular.
          if (rid.endsWith('-artesano')) {
            assert.equal(persona.cara.titular, true, `${clave}/${c.plantilla}: "${rid}" no se ha resuelto con la cara titular`);
            titulares += 1;
          }
          resueltos += 1;
        }
      }
    }
    // Las cuatro cifras, en la escala de treinta plantillas reequilibradas (§6s). La
    // que de verdad afirma algo es la igualdad entre las dos primeras: añadir gente a
    // cada rol de sitio del catálogo entero **no estrecha el casting ni en una
    // plantilla**. Las otras dos son el denominador, y suben con el catálogo: más
    // plantillas que castean son más roles de sitio, y cada rol de sitio son dos
    // roles humanos más que hay que resolver.
    assert.equal(sinGente, 210, `sin gente castean ${sinGente} de 240 y el suelo remedido son 210`);
    assert.equal(gente, 210, `con gente castean ${gente} de 240: añadir personas ha estrechado el casting`);
    assert.equal(resueltos, humanos, `${humanos - resueltos} roles humanos sin cara`);
    assert.equal(humanos, 905, `los roles humanos de los ocho extractos son 905 y han salido ${humanos}`);
    assert.equal(titulares, 376, 'los puestos afines fuera de plantilla no son los 376 que se resuelven con la titular');
    for (const clave of motivos.keys()) {
      assert.doesNotMatch(clave, /gente|persona|humano|npc|cara/i, `el histograma de fallos habla de gente: "${clave}"`);
    }

    // **Y la prueba no puede ser vacua.** Con un resolutor ingenuo —el que solo sabe
    // resolver un puesto que ya esté en la plantilla del sitio— 376 de los mismos 905
    // roles se quedan sin cara, y este mismo caso se pondría rojo. Lo que RF-NPC-002
    // exige es exactamente esas 376 caras que el ingenuo no da.
    const ingenuo = ({ sitio, rol, mundo }) => {
      const suyo = sitiosDeMapa(mundo).find((s) => s.id === sitio.nombre);
      if (!suyo || !rol?.puesto || !plantillaDePuestos(suyo.tipo).includes(rol.puesto)) return null;
      return { tipo: 'humano', nombre: sitio.nombre, x: sitio.x, y: sitio.y, real: sitio.real, cara: { sitio: suyo.id, puesto: rol.puesto, titular: rol.puesto === puestoTitular(suyo.tipo) } };
    };
    let conIngenuo = 0;
    let sinCara = 0;
    for (const { mundo } of await losOcho()) {
      for (const c of casteaCatalogo({ ...exigeEncuadre(mundo), mundo, catalogo: conGente, semilla: mundo.seed, resuelveRolHumano: ingenuo })) {
        if (!c.ok) continue;
        for (const rid of humanosDe(conGente.find((t) => t.id === c.plantilla))) {
          conIngenuo += 1;
          if (!c.asignacion[rid]?.cara) sinCara += 1;
        }
      }
    }
    assert.equal(conIngenuo, humanos, 'el resolutor ingenuo no ha mirado los mismos roles');
    assert.equal(sinCara, 376, `con el resolutor ingenuo quedan ${sinCara} roles sin cara y la medida son 376: si esto llega a cero, el caso de arriba ya no comprueba nada`);
  });

  test('Dos caras del mismo sitio declaran el mismo lugar y ninguna cara despierta hace falta antes', async () => {
    const mundo = await mundoDe('costero', '1');
    const sitio = sitiosDeMapa(mundo).find((s) => s.familia === 'servicio');
    const delCasting = sitioDelCasting(sitio);
    const plantilla = plantillaDePuestos(sitio.tipo);

    // Sin partida y sin nadie despierto: la resolución por defecto del casting es
    // función pura y resuelve igual.
    const una = caraDeSitio({ mundo, semilla: mundo.seed, sitio: delCasting, rol: { tipo: 'humano', puesto: plantilla[0] }, idioma: idiomaDe(mundo) });
    const otra = caraDeSitio({ mundo, semilla: mundo.seed, sitio: delCasting, rol: { tipo: 'humano', puesto: plantilla[1] }, idioma: idiomaDe(mundo) });
    assert.equal(una.nombre, otra.nombre, 'dos caras del mismo sitio no declaran el mismo lugar');
    assert.equal(una.x, otra.x);
    assert.equal(una.y, otra.y);
    assert.deepEqual(una.real, otra.real, 'dos caras del mismo sitio no declaran el mismo anclaje');
    assert.notDeepEqual(una.cara, otra.cara, 'dos puestos distintos han dado la misma persona');
    assert.notEqual(una.kind, otra.kind, 'las dos caras dicen ocupar el mismo puesto');
  });
});

describe('El lenguaje es inclusivo y el sesgo va hacia el femenino', () => {
  test('El reparto de NPCs se equilibra por generación', async () => {
    // Los puestos que en algún extracto llegan a tener dos caras o más: es sobre
    // ellos sobre los que «ningún oficio monocolor» dice algo, y al final tienen que
    // estar los nueve. Si un puesto no apareciera nunca poblado, el caso lo estaría
    // dando por bueno sin haberlo mirado.
    const poblados = new Set();
    for (const { clave, mundo } of await losOcho()) {
      const reparto = repartoPotencial({ mundo, semilla: mundo.seed, idioma: idiomaDe(mundo) });
      assert.equal(reparto.estratos.length, PUESTOS.length, `${clave}: los estratos no son los nueve puestos declarados`);
      let conDosOMas = 0;
      for (const estrato of reparto.estratos) {
        const suma = estrato.femeninas + estrato.masculinos;
        assert.equal(suma, estrato.caras.length, `${clave}/${estrato.puesto}: las caras contadas no cuadran`);
        assert.ok(Math.abs(estrato.femeninas - estrato.masculinos) <= 1, `${clave}/${estrato.puesto}: ${estrato.femeninas} femeninas y ${estrato.masculinos} masculinos`);
        // Con número impar, la que desempata es femenina.
        if (suma % 2 === 1) assert.equal(estrato.femeninas, estrato.masculinos + 1, `${clave}/${estrato.puesto}: el desempate no es femenino`);
        // Y ningún oficio queda poblado siempre por el mismo género.
        if (suma >= 2) {
          conDosOMas += 1;
          poblados.add(estrato.puesto);
          assert.ok(estrato.femeninas > 0 && estrato.masculinos > 0, `${clave}/${estrato.puesto}: el oficio es monocolor`);
        }
      }
      assert.ok(conDosOMas >= 3, `${clave}: solo ${conDosOMas} puestos tienen dos caras o más y el caso apenas comprueba nada`);

      // El total del mapa también sale equilibrado, que es lo que se percibe: la
      // diferencia no puede pasar del número de puestos, y con nueve es de una por
      // cada uno como mucho.
      const femeninas = reparto.caras.filter((c) => c.genero === GENEROS.FEMENINO).length;
      assert.ok(femeninas >= reparto.caras.length / 2, `${clave}: el reparto total no favorece el desempate femenino`);
    }
    assert.deepEqual([...poblados].sort(), PUESTOS.slice().sort(), 'algún puesto no llega a tener dos caras en ningún extracto: sobre él no se ha comprobado que no sea monocolor');
  });

  test('Ni la clave del puesto ni los datos de una cara arrastran el género', async () => {
    const mundo = await mundoDe('urbano-denso', '1');
    const reparto = repartoPotencial({ mundo, semilla: mundo.seed, idioma: idiomaDe(mundo) });

    // El género no se deduce de la clave del puesto: cada puesto con dos caras o más
    // tiene los dos, así que ninguna clave predice ninguno.
    for (const estrato of reparto.estratos) {
      if (estrato.caras.length < 2) continue;
      const generos = new Set(estrato.caras.map((c) => c.genero));
      assert.equal(generos.size, 2, `el puesto "${estrato.puesto}" predice el género de quien lo ocupa`);
    }

    // Y una cara no lleva rasgos de carácter: lo que hay es sitio, puesto, género,
    // nombre y el anclaje que hereda. Ni un adjetivo, ni un temperamento.
    const campos = new Set();
    for (const cara of reparto.caras) for (const k of Object.keys(cara)) campos.add(k);
    assert.deepEqual([...campos].sort(), ['anclado', 'anclaje', 'genero', 'id', 'nombre', 'puesto', 'sitio', 'titular', 'trabajaEn']);
    for (const prohibido of ['rasgos', 'caracter', 'carácter', 'temperamento', 'humor', 'personalidad']) {
      assert.equal(campos.has(prohibido), false, `una cara lleva "${prohibido}"`);
    }

    // El reparto de género se puede pedir aparte y no mira nada más que la semilla y
    // los sitios: los mismos sitios en otro orden siguen dando un reparto válido.
    const sitios = sitiosDeMapa(mundo);
    const alReves = repartoDeGenero(mundo.seed, sitios.slice().reverse());
    for (const estrato of alReves.estratos) {
      assert.ok(Math.abs(estrato.femeninas - estrato.masculinos) <= 1, `con los sitios al revés el puesto "${estrato.puesto}" se desequilibra`);
    }
    assert.throws(() => repartoDeGenero('', sitios), /semilla/, 'el reparto de género se hace sin semilla');
  });
});

describe('Lo generado no se resiembra jamás', () => {
  test('Despertar todas las caras del mapa deja el documento de la celda idéntico byte a byte', async () => {
    for (const nombre of ['costero', 'barrio-tres-calles']) {
      const registro = await celdaDeFixture(nombre);
      const mundo = registro.mundo;
      const antes = textoDeCelda(registro);
      const { capa, reparto } = capaDespierta(mundo, { semilla: mundo.seed });
      assert.ok(reparto.caras.length > 0, `${nombre}: no hay caras que despertar`);
      capa.conoce({ sitio: reparto.caras[0].sitio, puesto: reparto.caras[0].puesto });
      assert.equal(textoDeCelda(registro), antes, `${nombre}: el documento de la celda ha cambiado al poblarla de caras`);
      assert.equal(antes.includes('"despiertas"'), false, `${nombre}: el documento del mundo trae estado de caras`);
      assert.equal(antes.includes('"conocidas"'), false, `${nombre}: el documento del mundo trae caras conocidas`);
    }
  });

  test('La capa no se registra como productor de paso ni importa ninguna fase de la generación', () => {
    for (const ruta of MODULOS) {
      const codigo = codigoDe(fuente(ruta));
      for (const prohibido of ['buildWorld', 'generateSettlements', 'generateParajes', 'buildRoutes', 'fetchData', 'generaCelda']) {
        assert.equal(codigo.includes(prohibido), false, `${ruta} importa o llama a ${prohibido}: la capa es sobre el mundo ya congelado`);
      }
      assert.doesNotMatch(codigo, /from '\.\.\/world\/(build|settlements|parajes|routes)\.js'/, `${ruta} importa una fase de la tubería`);
      // Ni azar del sistema, ni reloj.
      for (const prohibido of ['Math.random', 'Date.now', 'new Date', 'performance.now']) {
        assert.equal(codigo.includes(prohibido), false, `${ruta} usa ${prohibido}`);
      }
      // Y ninguna lectura cuyo resultado dependa del orden de inserción: las claves
      // de un objeto o de un registro se ordenan antes de recorrerlas.
      assert.doesNotMatch(codigo, /\.(keys|values|entries)\(\)(?!\s*\.sort\(\))/, `${ruta} recorre claves sin ordenarlas`);
      assert.doesNotMatch(codigo, /\[\.\.\.\s*(vistos|usados|porClave|porSemilla|asignado|consumidos)/, `${ruta} vuelca un conjunto en el orden en que se insertó`);
    }

    // La prueba estructural: ninguno de los cuatro módulos declara identidad de
    // productor ni exporta `produce`, que es lo que el motor de SPEC-011 exige para
    // enganchar algo a un paso. Sin eso, el tiempo no tiene por dónde entrar.
    for (const ruta of MODULOS) {
      const codigo = codigoDe(fuente(ruta));
      assert.equal(codigo.includes('ID_DEL_PRODUCTOR'), false, `${ruta} declara identidad de productor de paso`);
      assert.doesNotMatch(codigo, /\bproduce\s*[(:]/, `${ruta} expone un produce(n, rng) y el motor podría engancharlo`);
      assert.equal(codigo.includes('creaMotorDePasos'), false, `${ruta} se cuelga del motor de pasos`);
    }
    // Y no es vacuo: el que sí es productor lo declara, y se ve la diferencia.
    assert.equal(codigoDe(fuente('packages/nucleo/partida/rumores.js')).includes('ID_DEL_PRODUCTOR'), true, 'la propagación ya no declara identidad de productor y la comparación deja de significar nada');
  });
});

describe('Vacíos, entradas inválidas y errores de la capa de NPCs', () => {
  test('Un sitio que no existe, un puesto fuera de plantilla o un tipo sin plantilla fallan nombrando qué les pasa', async () => {
    const mundo = mundoDeMesa();
    const { capa } = capaSobre(mundo);

    assert.throws(() => capa.titular('A Taberna Que No Existe'), (e) => e.message.includes('"A Taberna Que No Existe"'), 'un sitio inventado entrega cara igualmente');
    assert.throws(() => capa.cara({ sitio: 'A Taberna Que No Existe', puesto: 'regencia' }), (e) => e.message.includes('"A Taberna Que No Existe"'));
    assert.throws(
      () => capa.despierta({ sitio: 'Casa Manuela', puesto: 'herreria' }),
      (e) => e.message.includes('"herreria"') && e.message.includes('taberna'),
      'un puesto fuera de la plantilla despierta igualmente',
    );
    assert.throws(() => plantillaDePuestos('faro'), (e) => e.message.includes('"faro"'), 'un tipo de sitio sin plantilla se supone vacío');
    const conTipoNuevo = { ...mundo, settlements: [...mundo.settlements, { name: 'O Faro', type: 'faro', x: 5, y: 5, anchor: { osmId: 'node/8' }, services: [] }] };
    assert.throws(() => sitiosDeMapa(conTipoNuevo), (e) => e.message.includes('"faro"'), 'un tipo de sitio nuevo aparece sin caras y sin que nadie se entere');

    // Dos sitios con el mismo nombre comparten clave: se rechaza nombrándolo.
    const repetido = { ...mundo, settlements: [...mundo.settlements, { name: 'Ourela', type: 'aldea', x: 9, y: 9, anchor: null, services: [] }] };
    assert.throws(() => sitiosDeMapa(repetido), (e) => e.message.includes('"Ourela"'));

    // Y una cara de otro mapa no se crea aquí: se rechaza nombrando el mapa.
    const otroMundo = await mundoDe('costero', '1');
    const ajena = sitiosDeMapa(otroMundo)[0].id;
    assert.throws(() => capa.cara({ sitio: ajena, puesto: 'regencia' }), (e) => e.message.includes(ajena));
  });

  test('Un paquete de idioma sin repertorio del género pedido falla nombrando el idioma y el género', () => {
    for (const locale of ['es', 'gl']) {
      const pack = namesFor(locale);
      assert.equal(typeof pack.personName, 'function', `el paquete "${locale}" no implementa personName y deja de cumplir la interfaz`);
      assert.throws(
        () => pack.personName(makeRng('x'), 'neutro'),
        (e) => e.message.includes(`"${locale}"`) && e.message.includes('neutro'),
        `el paquete "${locale}" cae en el otro repertorio en lugar de fallar`,
      );
      // Y con los dos géneros del enumerado sí hay repertorio, en los dos paquetes.
      for (const genero of IDS_DE_GENERO) {
        assert.ok(typeof pack.personName(makeRng(`${locale}:${genero}`), genero) === 'string');
      }
    }
    // Un paquete que no la traiga no puede levantar la capa.
    const mundo = mundoDeMesa();
    assert.throws(
      () => repartoPotencial({ mundo, semilla: mundo.seed, idioma: { locale: 'xx' } }),
      (e) => e.message.includes('"xx"') && e.message.includes('personName'),
      'un idioma sin nombres de persona levanta la capa igualmente',
    );
    assert.throws(() => repartoPotencial({ mundo, semilla: '', idioma: idiomaDe(mundo) }), /semilla/);
  });
});
