// SPEC-002 · La generación del mundo dentro del paquete compartido.
//
// Lo que se afirma aquí es el invariante del que cuelga el proyecto: el mundo es
// una función de la semilla y de los datos de OSM, y de nada más. Los escenarios
// llevan el nombre literal de docs/testing.md; los que no salen de la batería van
// marcados como hueco en test/spec-test-map.json.
//
// Nada de esto toca la red, el reloj ni el azar del sistema: los datos vienen de
// los mundos congelados de SPEC-001 y el azar, de la semilla.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mundoCongelado } from '../dobles/mundo-congelado.mjs';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import {
  LOS_CUATRO,
  LAS_DOS_SEMILLAS,
  anclajesDelMundo,
  extraeReferencia,
  fuente,
  generaMundo,
  leeExtracto,
  modulosDelPaquete,
  nombresDelMundo,
  semillaDe,
} from './mundo-de-prueba.mjs';

import { buildWorld } from '../../packages/nucleo/world/build.js';
import { makeRng } from '../../packages/nucleo/core/rng.js';
import { parseGeo, parsePois } from '../../packages/nucleo/world/osm.js';
import { generateSettlements } from '../../packages/nucleo/world/settlements.js';
import { generateParajes } from '../../packages/nucleo/world/parajes.js';
import { buildRoutes, pegarAViario } from '../../packages/nucleo/world/routes.js';
import { vocabularioDeEscenas } from '../../packages/nucleo/world/cupos.js';
import { isSea } from '../../packages/nucleo/world/seamask.js';
import { localeFor, namesFor } from '../../packages/nucleo/names/index.js';

// Serialización completa y no campo a campo: es lo único que afirma «idéntico
// byte a byte» de verdad. Comparar los núcleos y dar el mundo por igual deja
// pasar una regresión en las polilíneas.
const serializado = (w) => JSON.stringify({ ...w, llamadas: undefined });

describe('El mundo es una función de la semilla y de los datos de OSM', () => {
  test('Dos generaciones con la misma semilla dan el mismo mundo', async () => {
    for (const nombre of LOS_CUATRO) {
      const semilla = semillaDe(nombre, '1');
      const a = await generaMundo(nombre, semilla);
      const b = await generaMundo(nombre, semilla);
      assert.equal(serializado(a), serializado(b), `${nombre}: dos generaciones con "${semilla}" no dan el mismo mundo`);
    }
  });

  test('Cambiar la semilla cambia el mundo', async () => {
    // El mundo costero es el de la coordenada 42.40,-8.81 del escenario, y es el
    // que tiene parajes con las dos semillas: sin ellos la segunda mitad del
    // escenario no se podría afirmar.
    const uno = await generaMundo('costero', semillaDe('costero', '1'));
    const dos = await generaMundo('costero', semillaDe('costero', '2'));

    const nucleos = (w) => w.settlements.map((s) => s.name);
    assert.notDeepEqual(nucleos(uno), nucleos(dos), 'ningún núcleo cambia de nombre al cambiar la semilla');

    const colocacion = (w) => w.parajes.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).sort();
    assert.ok(uno.parajes.length > 0, 'sin parajes no se puede afirmar que cambia su colocación');
    assert.notDeepEqual(colocacion(uno), colocacion(dos), 'ningún paraje cambia de sitio al cambiar la semilla');
  });

  test('No se usa ninguna fuente de azar ni de tiempo del sistema', async () => {
    // Dos comprobaciones que se necesitan: la estática ve la llamada aunque no se
    // ejecute nunca, y la dinámica ve el mundo que cambia porque cambió el reloj.
    for (const modulo of modulosDelPaquete()) {
      const texto = fuente(modulo);
      assert.equal(/\bMath\.random\s*\(/.test(texto), false, `${modulo}: usa Math.random()`);
      assert.equal(/\bDate\.now\s*\(|\bnew\s+Date\b|\bperformance\.now\s*\(/.test(texto), false, `${modulo}: lee el reloj del sistema`);
      assert.equal(/\brandomUUID\s*\(|\bcrypto\.getRandomValues\s*\(/.test(texto), false, `${modulo}: pide identificadores aleatorios al entorno`);
    }

    const DateReal = globalThis.Date;
    const performanceReal = globalThis.performance;
    const congelaReloj = (instante) => {
      class DateCongelada extends DateReal {
        constructor(...args) {
          super(...(args.length ? args : [instante]));
        }
        static now() {
          return instante;
        }
      }
      globalThis.Date = DateCongelada;
      globalThis.performance = { ...performanceReal, now: () => instante };
    };

    try {
      const mundos = {};
      for (const instante of [0, 1893456000000]) {
        congelaReloj(instante);
        for (const nombre of LOS_CUATRO) {
          for (const n of LAS_DOS_SEMILLAS) {
            const clave = `${nombre}#${n}`;
            const w = serializado(await generaMundo(nombre, semillaDe(nombre, n)));
            if (mundos[clave] === undefined) mundos[clave] = w;
            else assert.equal(w, mundos[clave], `${clave}: el mundo cambia con el reloj del sistema`);
          }
        }
      }
    } finally {
      globalThis.Date = DateReal;
      globalThis.performance = performanceReal;
    }
  });

  test('El orden de iteración no depende del orden de inserción', async () => {
    // Primero lo generado, que es donde una dependencia del orden de llegada hace
    // daño de verdad; después el mundo entero, que es lo que pide el escenario.
    for (const nombre of LOS_CUATRO) {
      const semilla = semillaDe(nombre, '1');
      const natural = await generaMundo(nombre, semilla);
      const invertido = await generaMundo(nombre, semilla, { ordenInvertido: true });
      assert.deepEqual(
        extraeReferencia(invertido),
        extraeReferencia(natural),
        `${nombre}: los elementos generados cambian si los datos de OSM llegan en otro orden`,
      );
    }

    for (const nombre of LOS_CUATRO) {
      const semilla = semillaDe(nombre, '1');
      const natural = await generaMundo(nombre, semilla);
      const invertido = await generaMundo(nombre, semilla, { ordenInvertido: true });
      assert.equal(
        serializado(invertido),
        serializado(natural),
        `${nombre}: el mundo serializado cambia si los datos de OSM llegan en otro orden`,
      );
    }
  });

  test('Cada fase usa su propio sufijo de azar', async () => {
    // Primero la enumeración: cada llamada a makeRng del paquete deriva su
    // generador de una cadena, y no puede haber dos fases con la misma.
    const cadenas = [];
    for (const modulo of modulosDelPaquete()) {
      if (modulo.endsWith('core/rng.js')) continue; // ahí se define makeRng, no se usa
      for (const m of fuente(modulo).matchAll(/makeRng\(\s*([^)]*)\)/g)) {
        const sufijo = m[1]
          .replace(/`|'|"/g, '')
          .replace(/\$\{\s*seed(Str)?\s*\}/g, '')
          .replace(/\bseed(Str)?\b/g, '')
          .replace(/\s*\+\s*/g, '')
          .replace(/\$\{[^}]*\}/g, '<variable>')
          .trim();
        cadenas.push({ modulo, sufijo });
      }
    }
    assert.ok(cadenas.length >= 4, 'no se han encontrado las cadenas de semilla de las fases');
    const vistas = new Map();
    for (const { modulo, sufijo } of cadenas) {
      assert.equal(
        vistas.has(sufijo),
        false,
        `dos fases derivan su generador de la misma cadena "<semilla>${sufijo}": ${vistas.get(sufijo)} y ${modulo}`,
      );
      vistas.set(sufijo, modulo);
    }

    // Y después el comportamiento: se cambia la fase de parajes —aquí, dándole
    // otro flujo de azar, que es lo que distingue una implementación de otra— y
    // los núcleos y las calzadas tienen que salir idénticos.
    const nombre = 'urbano-denso'; // sin costa: la tubería no da la segunda vuelta
    const semilla = semillaDe(nombre, '1');
    const real = await generaMundo(nombre, semilla);

    const congelado = mundoCongelado(nombre);
    const { lat, lon } = congelado.manifiesto.coordenada;
    const radio = congelado.manifiesto.radio_m;
    const names = namesFor(localeFor(lat, lon));
    const geo = parseGeo(congelado.geo, lat, lon);
    const anchors = parsePois(congelado.pois, lat, lon);

    const { settlements, freeAnchors } = generateSettlements(anchors, geo, radio, semilla, null, names);
    pegarAViario(settlements, geo.roads);
    const routes = buildRoutes(settlements, geo.roads, semilla, names);
    // La fase alterada: mismos datos, mismo vocabulario que usó la tubería real
    // —el del catálogo, que es el valor de arranque de `buildWorld`— y otro azar.
    // Si compartiera flujo con las demás, lo de arriba habría salido distinto.
    const parajes = generateParajes(freeAnchors, settlements, routes, geo, radio, `${semilla}:otra-implementacion`, null, names, undefined, null, null, {
      vocabulario: vocabularioDeEscenas(),
    });
    assert.notDeepEqual(
      parajes.map((p) => p.name),
      real.parajes.map((p) => p.name),
      'la fase de parajes alterada tenía que dar otros parajes; si no, no se está comparando nada',
    );

    assert.deepEqual(
      settlements.map((s) => `${s.name}|${s.type}|${Math.round(s.x)},${Math.round(s.y)}`),
      real.settlements.map((s) => `${s.name}|${s.type}|${Math.round(s.x)},${Math.round(s.y)}`),
      'los núcleos cambian al alterar la fase de parajes',
    );
    const calzadas = (rutas) => rutas.filter((r) => !r.ramal).map((r) => `${r.name}|${r.pts.length}`);
    assert.deepEqual(calzadas(routes), calzadas(real.routes), 'las calzadas cambian al alterar la fase de parajes');
  });

  test('Un mundo generado sobrevive al ida y vuelta por JSON sin perder nada colgado de un array', async () => {
    const world = await generaMundo('costero', semillaDe('costero', '1'));
    delete world.llamadas;

    // Una propiedad pegada a un array no sobrevive a JSON.stringify y desaparece
    // en silencio: el mundo se compara serializado, así que un dato invisible
    // convierte esa comparación en una mentira.
    const colgadas = [];
    const recorre = (valor, ruta) => {
      if (Array.isArray(valor)) {
        const propias = Object.keys(valor).filter((k) => !/^\d+$/.test(k));
        if (propias.length) colgadas.push(`${ruta}: ${propias.join(', ')}`);
        valor.forEach((v, i) => recorre(v, `${ruta}[${i}]`));
      } else if (valor && typeof valor === 'object') {
        for (const [k, v] of Object.entries(valor)) recorre(v, `${ruta}.${k}`);
      }
    };
    recorre(world, 'world');
    assert.deepEqual(colgadas, [], 'hay propiedades colgadas de arrays, que el ida y vuelta por JSON se lleva por delante');

    const ida = JSON.parse(JSON.stringify(world));
    assert.equal(JSON.stringify(ida), JSON.stringify(world), 'el mundo no vuelve igual de JSON');
    for (const rio of world.geo.rivers) {
      assert.equal(typeof rio.kind, 'string', 'el tipo del cauce tiene que ser un campo del objeto, no una propiedad del array de puntos');
    }
  });
});

describe('La tubería canónica, que sigue siendo una sola', () => {
  test('Hay una sola función buildWorld y vive en packages/nucleo/world/build.js', () => {
    const declaraciones = modulosDelPaquete().filter((m) => /export\s+(async\s+)?function\s+buildWorld\b/.test(fuente(m)));
    assert.deepEqual(declaraciones, ['packages/nucleo/world/build.js']);
  });

  test('Las fases se ejecutan en el orden declarado: datos, terreno, costa, máscara, núcleos, calzadas y parajes', async () => {
    const claves = [];
    await generaMundo('costero', semillaDe('costero', '1'), { onStatus: async (c) => claves.push(c) });
    assert.deepEqual(claves, ['fetch', 'terrain', 'coast', 'mask', 'settlements', 'routes', 'parajes']);
  });

  test('onStatus recibe una clave por cada fase ejecutada, en ese orden', async () => {
    const declarado = ['fetch', 'terrain', 'coast', 'mask', 'settlements', 'routes', 'parajes'];
    // Un mundo sin costa no ejecuta la segunda vuelta ni la máscara: recibe menos
    // claves, ninguna repetida, y en el orden declarado.
    const claves = [];
    await generaMundo('urbano-denso', semillaDe('urbano-denso', '1'), { onStatus: async (c) => claves.push(c) });

    assert.deepEqual([...new Set(claves)], claves, 'alguna fase avisa dos veces');
    for (const c of claves) assert.ok(declarado.includes(c), `clave de fase desconocida: ${c}`);
    assert.deepEqual(claves, declarado.filter((c) => claves.includes(c)), 'las claves no llegan en el orden declarado');
    assert.deepEqual(claves, ['fetch', 'terrain', 'settlements', 'routes', 'parajes']);
  });

  test('Generar sin onStatus termina igual y sin error', async () => {
    const conAviso = await generaMundo('costero', semillaDe('costero', '1'), { onStatus: async () => {} });
    const sinAviso = await generaMundo('costero', semillaDe('costero', '1'));
    assert.equal(serializado(sinAviso), serializado(conAviso));
  });

  test('buildWorld sin fetchData falla nombrando la dependencia que falta', async () => {
    await assert.rejects(
      () => buildWorld({ lat: 42.402, lon: -8.809, rBase: 700, seed: '42.40,-8.81#1' }),
      (e) => {
        assert.match(e.message, /fetchData/);
        return true;
      },
    );
  });

  test('Un fetchData que falla propaga el error y no devuelve ningún mundo a medias', async () => {
    const claves = [];
    await assert.rejects(
      () =>
        buildWorld({
          lat: 42.402,
          lon: -8.809,
          rBase: 700,
          seed: '42.40,-8.81#1',
          onStatus: async (c) => claves.push(c),
          fetchData: async () => {
            throw new Error('Overpass no contesta');
          },
        }),
      /Overpass no contesta/,
    );
    // La tubería no llegó a las fases de generación: si hubiera devuelto algo, ese
    // algo sería un mundo a medias.
    assert.deepEqual(claves, ['fetch']);
  });

  test('Un mundo congelado sin línea de costa no pide una segunda vuelta de datos ni construye máscara de mar', async () => {
    for (const nombre of ['urbano-denso', 'barrio-tres-calles']) {
      const w = await generaMundo(nombre, semillaDe(nombre, '1'));
      assert.equal(w.geo.coastlines.length, 0, `${nombre}: este mundo tiene costa y no sirve para el escenario`);
      assert.equal(w.llamadas.length, 1, `${nombre}: se ha pedido una segunda vuelta de datos sin costa`);
      assert.equal(w.seaMask, null, `${nombre}: se ha construido máscara de mar sin costa`);
      assert.equal(w.radius, w.baseRadius, `${nombre}: el radio de dibujo se ha movido sin costa`);
    }
  });

  test('El mundo congelado costero construye la máscara de mar y ensancha el radio de dibujo', async () => {
    const w = await generaMundo('costero', semillaDe('costero', '1'));
    assert.ok(w.geo.coastlines.length > 0, 'el mundo costero tiene que traer línea de costa');
    assert.equal(w.llamadas.length, 2, 'en costa la tubería vuelve a pedir datos con el radio ampliado');
    assert.ok(w.llamadas[1].radius > w.llamadas[0].radius, 'la segunda vuelta tiene que pedir más radio');
    assert.notEqual(w.seaMask, null, 'no se ha construido la máscara de mar');
    assert.notEqual(w.radius, w.baseRadius, 'el radio de dibujo tiene que salir del cálculo costero');
  });

  test('El mundo congelado del suelo de 250 m se construye entero, con su título y su casting', async () => {
    const w = await generaMundo('suelo-250m', semillaDe('suelo-250m', '1'));
    assert.equal(typeof w.title, 'string');
    assert.ok(w.title.length > 0, 'el mundo mínimo tiene que tener título');
    assert.ok(Array.isArray(w.casting), 'el mundo mínimo tiene que traer casting');
    assert.ok(w.casting.length > 0, 'el casting del mundo mínimo no puede venir vacío');
    assert.ok(w.settlements.length > 0, 'el mundo mínimo tiene que tener núcleos');
    assert.equal(w.radius, 250);
  });

  test('Pedir un mundo congelado que no existe falla antes de generar nada', async () => {
    await assert.rejects(
      () => generaMundo('sanxenxo-de-noche', '42.40,-8.81#1'),
      (e) => {
        assert.match(e.message, /sanxenxo-de-noche/);
        assert.match(e.message, /Disponibles/);
        return true;
      },
    );
  });

  test('El núcleo no abre ninguna conexión de red al generar un mundo entero', async () => {
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      for (const nombre of LOS_CUATRO) await generaMundo(nombre, semillaDe(nombre, '1'));
      assert.deepEqual(inspector.peticiones(), []);
    } finally {
      inspector.suelta();
    }
  });

  test('La única entrada de datos externos del núcleo son las llamadas al fetchData que recibió', async () => {
    // Se le quita al mundo congelado todo lo que no sean vías antes de servirlo:
    // si el núcleo tuviera otra puerta, los picos y los POIs seguirían apareciendo.
    const w = await generaMundo('costero', semillaDe('costero', '1'), {
      transforma: ({ geoJson, poiJson }) => ({
        geoJson: { ...geoJson, elements: geoJson.elements.filter((e) => e.tags?.highway) },
        poiJson: { ...poiJson, elements: [] },
      }),
    });

    assert.deepEqual(w.anchors, [], 'han entrado anclajes que fetchData no sirvió');
    assert.deepEqual(w.geo.peaks, [], 'han entrado picos que fetchData no sirvió');
    assert.deepEqual(w.geo.coastlines, [], 'ha entrado costa que fetchData no sirvió');
    assert.ok(w.geo.roads.length > 0, 'lo que sí sirvió fetchData tiene que llegar');
    assert.equal(w.llamadas.length, 1, 'sin costa en los datos servidos no hay segunda vuelta');
  });
});

describe('Los anclajes reales son de uso único', () => {
  test('Ningún anclaje aparece dos veces', async () => {
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, n));
        const vistos = new Map();
        for (const { osmId, de } of anclajesDelMundo(w)) {
          assert.equal(vistos.has(osmId), false, `${nombre}#${n}: ${osmId} alimenta ${vistos.get(osmId)} y ${de}`);
          vistos.set(osmId, de);
        }
      }
    }
  });

  test('Los parajes reparten lo que los núcleos no gastaron', async () => {
    let conAnclajes = 0;
    for (const nombre of LOS_CUATRO) {
      const semilla = semillaDe(nombre, '1');
      const w = await generaMundo(nombre, semilla);
      const names = namesFor(w.locale);
      const { settlements, freeAnchors } = generateSettlements(w.anchors, w.geo, w.radius, semilla, w.seaMask, names);

      // El pool de partida es el mismo que mira settlements.js: dentro del mundo
      // dibujado y en tierra. Se reproduce aquí porque el reparto solo significa
      // algo comparado contra el total del que sale.
      const utilizables = w.anchors.filter((a) => Math.hypot(a.x, a.y) < w.radius * 0.93 && !isSea(w.seaMask, a));
      const tomados = new Set();
      for (const s of settlements) {
        if (s.anchor?.osmId) tomados.add(s.anchor.osmId);
        for (const v of s.services) if (v.real?.osmId) tomados.add(v.real.osmId);
      }
      const libres = new Set(freeAnchors.map((a) => a.osmId));

      for (const id of tomados) assert.equal(libres.has(id), false, `${nombre}: ${id} lo gastó un núcleo y aun así se pasa a los parajes`);
      assert.equal(
        freeAnchors.length + tomados.size,
        utilizables.length,
        `${nombre}: los anclajes libres más los tomados no suman los utilizables`,
      );
      for (const p of w.parajes) {
        if (p.real?.osmId) assert.equal(libres.has(p.real.osmId), true, `${nombre}: el paraje ${p.name} se ancla a algo que no estaba libre`);
      }
      if (utilizables.length) conAnclajes += 1;
    }
    assert.ok(conAnclajes > 0, 'ningún mundo traía anclajes: el reparto no se ha comprobado contra nada');
  });
});

describe('Los nombres son únicos y del idioma del sitio', () => {
  test('No hay dos nombres iguales en un mundo', async () => {
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, n));
        const vistos = new Set();
        const repetidos = [];
        for (const nom of nombresDelMundo(w)) {
          if (vistos.has(nom)) repetidos.push(nom);
          vistos.add(nom);
        }
        assert.deepEqual(repetidos, [], `${nombre}#${n}: nombres repetidos en el mundo`);
      }
    }
  });

  test('El idioma sale de la ubicación', async () => {
    // Los dos ejemplos del esquema de la batería: Galicia en gallego, el resto en
    // castellano. Se comprueba en el mundo generado, no solo en localeFor, porque
    // lo que importa es de qué paquete salen los nombres que se ven.
    for (const [lat, lon, idioma] of [
      [42.4, -8.81, 'gl'],
      [39.86, -4.02, 'es'],
    ]) {
      assert.equal(localeFor(lat, lon), idioma, `${lat},${lon}: el idioma elegido no es ${idioma}`);

      const congelado = mundoCongelado('costero');
      const w = await buildWorld({
        lat,
        lon,
        rBase: 700,
        seed: `${lat},${lon}#1`,
        fetchData: async () => {
          const datos = mundoCongelado('costero');
          return { geoJson: datos.geo, poiJson: datos.pois };
        },
      });
      assert.equal(w.locale, idioma, `${lat},${lon}: el mundo no usa el paquete de idioma ${idioma}`);
      // El título es lo único del mundo que se puede recalcular desde fuera sin
      // repetir una fase entera, y por eso sirve para afirmar de qué paquete de
      // idioma salen los nombres. La derivación es la del propio build.js.
      assert.equal(
        w.title,
        namesFor(idioma).worldTitle(makeRng(`${w.seed}:title`)),
        `${lat},${lon}: el título no sale del paquete de idioma ${idioma}`,
      );
      assert.ok(congelado.manifiesto.radio_m > 0);
    }
  });
});

describe('Equivalencia con el prototipo', () => {
  test('Hay un extracto de referencia por cada mundo congelado y cada semilla', () => {
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const extracto = leeExtracto(nombre, n);
        assert.equal(extracto.cabecera.mundo_congelado, nombre);
        assert.match(extracto.cabecera.semilla, new RegExp(`#${n}$`));
      }
    }
  });

  test('Cada extracto de referencia declara de qué mundo sale, con qué semilla y contra qué revisión del prototipo', () => {
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const { cabecera } = leeExtracto(nombre, n);
        assert.equal(typeof cabecera.mundo_congelado, 'string');
        assert.match(cabecera.semilla, /^-?\d+\.\d+,-?\d+\.\d+#\d+$/);
        assert.match(cabecera.revision_prototipo, /^[0-9a-f]{7,40}$/, 'la revisión del prototipo tiene que ser un commit');
      }
    }
  });

  test('El paquete regenera cada extracto de referencia idéntico al commiteado', async () => {
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const esperado = { ...leeExtracto(nombre, n) };
        delete esperado.cabecera;
        const w = await generaMundo(nombre, semillaDe(nombre, n));
        assert.deepEqual(extraeReferencia(w), esperado, `${nombre}#${n}: el paquete no regenera el extracto del prototipo`);
      }
    }
  });

  test('Los recuentos de núcleos, servicios, parajes y calzadas son los del prototipo', async () => {
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, n));
        assert.deepEqual(extraeReferencia(w).recuentos, leeExtracto(nombre, n).recuentos, `${nombre}#${n}`);
      }
    }
  });

  test('El título del mundo y el idioma son los del prototipo', async () => {
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, n));
        const extracto = leeExtracto(nombre, n);
        assert.equal(w.title, extracto.titulo, `${nombre}#${n}: el título`);
        assert.equal(w.locale, extracto.idioma, `${nombre}#${n}: el idioma`);
      }
    }
  });

  test('Las plantillas que castean y las que no son las del prototipo', async () => {
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, n));
        assert.deepEqual(extraeReferencia(w).casting, leeExtracto(nombre, n).casting, `${nombre}#${n}`);
      }
    }
  });
});
