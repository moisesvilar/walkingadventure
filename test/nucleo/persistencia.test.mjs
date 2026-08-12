// SPEC-009 · El mundo congelado: qué entra en el documento de una celda, qué no,
// y que congelarlo y volver a levantarlo no pierde ni un dato.
//
// La afirmación central de esta capa es una igualdad de textos, no de objetos:
// «byte a byte» solo se puede decir comparando el documento entero, y por eso
// casi todo lo de aquí compara `textoDeCelda` con `textoDeCelda`. Los casos con
// nombre de escenario son los de docs/testing.md, literales, afirmados aquí
// **sobre el documento** y no sobre la memoria, que es lo que esta spec estrena.
//
// Nada toca la red, ni el reloj del sistema, ni ninguna variable de entorno: los
// datos de OSM salen de los cuatro mundos congelados y la fecha de captura de
// Places entra inyectada.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  CAMPOS_DEL_MUNDO,
  congelaCelda,
  levantaCelda,
  parteCongelada,
  textoDeCelda,
} from '../../packages/nucleo/partida/mundo.js';
import {
  CLASES,
  ESQUEMA_CELDA,
  VERSION_FORMATO,
  VERSION_GENERADOR,
  esquemaDe,
  escribe,
  lee,
  texto,
} from '../../packages/nucleo/partida/formato.js';
import { castAll } from '../../packages/nucleo/quests/casting.js';
import { PRECISION_M } from '../../packages/nucleo/core/geo.js';
import { limitesDeCelda } from '../../packages/nucleo/world/rejilla.js';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { SEMILLA_A, SEMILLA_B, serializado } from './celda-de-prueba.mjs';
import {
  DOS_CELDAS,
  LOS_CUATRO,
  MB,
  KB,
  bytesDe,
  canoniza,
  celdaConMundoAlterado,
  celdaDeFixture,
  diferencias,
  modificable,
  placesDePrueba,
  recorreDocumento,
  rejillaDe,
  textosDe,
} from './partida-de-prueba.mjs';

const RAIZ = new URL('../../', import.meta.url).pathname;

/** El documento de un mundo congelado, ya levantado como objeto. */
const documentoDe = async (nombre, opciones) => congelaCelda(await celdaDeFixture(nombre, opciones));

/** Una copia modificable de un documento congelado. */
const copia = (doc) => JSON.parse(JSON.stringify(doc));

describe('El mundo se congela entero', () => {
  test('El mundo no depende de OSM después de generarse', async () => {
    // Se congela un mundo, se cambian por completo los datos de OSM de la zona
    // —se sirve otro fixture entero— y se levanta el documento: el mundo que sale
    // es el guardado y no el que dirían los datos nuevos.
    const registro = await celdaDeFixture('costero');
    const guardado = textoDeCelda(registro);

    const levantado = levantaCelda(guardado, { semilla: SEMILLA_A });
    assert.equal(textoDeCelda(levantado), guardado, 'el mundo levantado no es el que se guardó');

    // Que la comparación diga algo: con otros datos de OSM, la misma celda del
    // mismo mapa y con la misma semilla da un mundo distinto.
    const conOtrosDatos = await celdaDeFixture('urbano-denso');
    assert.notEqual(
      serializado(conOtrosDatos.mundo.settlements.map((s) => s.name)),
      serializado(registro.mundo.settlements.map((s) => s.name)),
      'los dos fixtures dan el mismo mundo: el caso no compara nada',
    );
    assert.equal(textoDeCelda(levantado), guardado, 'generar otro mundo ha tocado el documento guardado');
  });

  test('Levantar un mundo no necesita ninguna fuente de datos inyectada', async () => {
    // Ni `consultaOsm`, ni `fetchData`, ni nada: el documento es todo lo que hace
    // falta, y lo único que entra por fuera es la semilla de la partida, que no
    // viaja en ningún documento del mundo.
    const guardado = textoDeCelda(await celdaDeFixture('suelo-250m'));
    const levantado = levantaCelda(guardado, { semilla: SEMILLA_A });

    assert.ok(levantado.mundo.settlements.length > 0, 'el mundo levantado no tiene núcleos');
    assert.ok(levantado.mundo.routes.length > 0, 'el mundo levantado no tiene calzadas');
    assert.equal(levantado.semillaPartida, SEMILLA_A);
    assert.throws(() => levantaCelda(guardado, {}), /semilla/i, 'se ha levantado una celda sin semilla de partida');
  });

  test('El documento de una celda lleva el terreno, los núcleos con sus servicios, los parajes, las calzadas, los ramales, el callejero, la máscara de mar, los nombres y el título', async () => {
    const doc = await documentoDe('costero');
    const m = doc.mundo;

    assert.ok(m.geo.coastlines.length > 0, 'la costa no está en el documento');
    assert.ok(m.geo.forests.length > 0, 'los bosques no están en el documento');
    assert.ok(m.geo.roads.length > 0, 'las carreteras no están en el documento');
    assert.ok(m.geo.callejero.length > 0, 'el callejero no está en el documento');
    assert.ok(m.settlements.length > 0, 'los núcleos no están en el documento');
    assert.ok(m.settlements.some((s) => s.services.length > 0), 'ningún núcleo lleva sus servicios');
    assert.ok(m.parajes.length > 0, 'los parajes no están en el documento');
    assert.ok(m.routes.some((r) => !r.ramal), 'las calzadas no están en el documento');
    assert.ok(m.routes.some((r) => r.ramal), 'los ramales no están en el documento');
    assert.ok(m.seaMask && typeof m.seaMask.bits === 'string', 'la máscara de mar no está en el documento');
    assert.ok(m.viario.nodos.length > 0, 'el grafo viario no está en el documento');
    assert.equal(typeof m.title, 'string');
    assert.ok(m.title.length > 0, 'el mundo congelado no lleva su título');
    for (const s of m.settlements) assert.equal(typeof s.name, 'string', 'un núcleo llega sin nombre');
    for (const p of m.parajes) assert.equal(typeof p.name, 'string', 'un paraje llega sin nombre');
    for (const r of m.routes) assert.ok(r.name === null || typeof r.name === 'string');
    assert.ok(m.routes.some((r) => typeof r.name === 'string' && r.name.length > 0), 'ninguna calzada lleva nombre');

    // Y el terreno de los demás fixtures, que traen lo que este no tiene.
    const barrio = (await documentoDe('barrio-tres-calles')).mundo;
    assert.ok(barrio.geo.lakes.length > 0, 'los lagos no están en el documento');
    assert.ok(barrio.geo.rivers.length > 0, 'los ríos no están en el documento');
  });

  test('Cada núcleo, servicio o paraje anclado lleva el identificador nativo de su anclaje', async () => {
    // La forma es la que fijó SPEC-005: la clave nativa de OSM (`node/123456`,
    // `way/…`) o `places:<place_id>`. Un identificador propio derivado de la
    // posición haría indistinguibles dos sitios distintos del mismo portal.
    const NATIVO = /^(node|way|relation|geom)\/|^places:/;
    const conAnclaje = [];
    for (const nombre of ['costero', 'urbano-denso']) {
      const m = (await documentoDe(nombre)).mundo;
      for (const s of m.settlements) {
        if (s.anchor) conAnclaje.push([`${nombre} núcleo ${s.name}`, s.anchor]);
        for (const v of s.services) if (v.real) conAnclaje.push([`${nombre} servicio ${v.name}`, v.real]);
      }
      for (const p of m.parajes) if (p.real) conAnclaje.push([`${nombre} paraje ${p.name}`, p.real]);
    }
    assert.ok(conAnclaje.length > 0, 'ningún elemento de los dos mundos está anclado: no se está comprobando nada');
    for (const [donde, ficha] of conAnclaje) {
      assert.match(ficha.osmId ?? '', NATIVO, `${donde}: el identificador del anclaje no es el nativo (${ficha.osmId})`);
      assert.equal(typeof ficha.kind, 'string', `${donde}: el anclaje no declara su tipo real`);
    }

    // Y el anclaje de Places, con su identificador y su capa refrescable fechada.
    const conPlaces = (await documentoDe('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles'), demanda: { total: 40, suelo: 4 } })).mundo;
    const dePlaces = [...conPlaces.settlements.map((s) => s.anchor), ...conPlaces.parajes.map((p) => p.real)].filter((f) => f && f.placeId);
    assert.ok(dePlaces.length > 0, 'no ha entrado ningún anclaje de Places: no se está comprobando nada');
    for (const f of dePlaces) {
      assert.equal(f.osmId, `places:${f.placeId}`, 'el identificador del anclaje de Places no es su place_id');
      assert.equal(f.refrescable.capturado, '2026-08-01', 'el contenido refrescable de Places no lleva la fecha en que se capturó');
    }
  });

  test('Lo cosido y lo inventado queda marcado', async () => {
    // Aquí el escenario se afirma sobre el documento: la marca de suposición de
    // SPEC-007 sobrevive al ida y vuelta con el mismo valor, y al levantar **no se
    // cose ni un hueco más**, porque lo cosido llega congelado como dato.
    const MARCAS = [null, 'cosida', 'fallback'];
    let cosidasVistas = 0;
    for (const nombre of LOS_CUATRO) {
      const registro = await celdaDeFixture(nombre);
      const doc = congelaCelda(registro);
      const levantado = levantaCelda(textoDeCelda(registro), { semilla: SEMILLA_A });

      for (const ruta of doc.mundo.routes) {
        for (const t of ruta.tramos) {
          assert.ok(MARCAS.includes(t.suposicion), `${nombre}: marca de suposición desconocida en un tramo: ${JSON.stringify(t.suposicion)}`);
        }
      }
      for (const via of [...doc.mundo.geo.roads, ...doc.mundo.geo.callejero]) {
        assert.ok(Object.prototype.hasOwnProperty.call(via, 'rasgo'), `${nombre}: una vía del documento no declara su rasgo`);
      }

      // El grafo: cada arista lleva su marca, y las cosidas son las mismas.
      const marcasDe = (mundo) => {
        const out = [];
        for (const id of mundo.viario.nodeIds) {
          for (const a of mundo.viario.adj.get(id)) out.push(`${id}→${a.hasta}|${a.suposicion ?? 'ninguna'}`);
        }
        return out.sort();
      };
      const antes = marcasDe(registro.mundo);
      const despues = marcasDe(levantado.mundo);
      assert.deepEqual(despues, antes, `${nombre}: las marcas de suposición del grafo cambian al levantar el documento`);
      assert.equal(
        levantado.mundo.viario.informe.cosidas,
        registro.mundo.viario.informe.cosidas,
        `${nombre}: el grafo levantado declara otro número de aristas cosidas`,
      );
      const cosidas = antes.filter((m) => m.endsWith('|cosida')).length;
      cosidasVistas += cosidas;
      assert.equal(
        despues.filter((m) => m.endsWith('|cosida')).length,
        cosidas,
        `${nombre}: levantar el mundo ha cosido huecos que ya venían cosidos`,
      );
    }
    assert.ok(cosidasVistas > 0, 'ningún fixture trae aristas cosidas: el escenario no está comprobando nada');
  });

  test('Los tres valores de la marca de suposición sobreviven al ida y vuelta', async () => {
    // Ningún fixture produce hoy un tramo `'fallback'` —lo comprueba el caso de
    // arriba, que solo encuentra `'cosida'`—, así que el tercer valor se ejercita
    // marcando un tramo a mano sobre un mundo ya generado. Es la codificación lo
    // que se prueba: la marca va al documento como número y tiene que volver.
    const registro = await celdaDeFixture('barrio-tres-calles');
    const marcado = celdaConMundoAlterado(registro, {
      routes: registro.mundo.routes.map((r, i) => (i === 0
        ? modificable(r, { tramos: r.tramos.map((t, j) => (j === 0 ? modificable(t, { suposicion: 'fallback' }) : t)) })
        : r)),
    });
    const doc = congelaCelda(marcado);
    assert.equal(doc.mundo.routes[0].tramos[0].suposicion, 'fallback', 'la marca "fallback" no ha llegado al documento');
    const levantado = levantaCelda(texto(doc), { semilla: SEMILLA_A });
    assert.equal(levantado.mundo.routes[0].tramos[0].suposicion, 'fallback', 'la marca "fallback" no ha vuelto del documento');

    // Y una marca que no es ninguna de las tres no se escribe en silencio.
    const inventada = celdaConMundoAlterado(registro, {
      viario: { ...registro.mundo.viario, adj: new Map([...registro.mundo.viario.adj].map(([id, aristas], k) => [id, k === 0 ? aristas.map((a) => ({ ...a, suposicion: 'a-ojo' })) : aristas])) },
    });
    assert.throws(() => congelaCelda(inventada), /marca de suposición desconocida/, 'una marca inventada se ha escrito sin protestar');
  });

  test('La cabecera del documento declara el mapa, la celda, el lado, el tramo y el idioma', async () => {
    const registro = await celdaDeFixture('costero', { celda: { i: 1, j: -2 } });
    const doc = congelaCelda(registro);

    assert.equal(doc.clase, CLASES.CELDA);
    assert.equal(doc.mapa.id, registro.mapaId, 'la cabecera no declara el identificador del mapa');
    assert.deepEqual(doc.mapa.anclaje, { lat: registro.anclaje.lat, lon: registro.anclaje.lon });
    assert.deepEqual({ i: doc.celda.i, j: doc.celda.j }, { i: 1, j: -2 }, 'la cabecera no declara el índice de la celda');
    assert.equal(doc.celda.clave, '1,-2');
    assert.equal(doc.celda.ladoM, registro.ladoM, 'la cabecera no declara el lado de la celda');
    assert.equal(doc.celda.tramoM, registro.tramoM, 'la cabecera no declara el tramo con el que se dimensionó');
    assert.equal(doc.celda.radioInscritoM, registro.radioInscritoM);
    assert.equal(doc.mapa.idioma, registro.mundo.locale, 'la cabecera no declara el idioma del que salieron los nombres');
    assert.ok(['es', 'gl'].includes(doc.mapa.idioma), `idioma desconocido en la cabecera: ${doc.mapa.idioma}`);

    // Y el marco métrico, que es lo que hace que las coordenadas signifiquen algo.
    assert.equal(doc.marco.unidad, 'm');
    assert.equal(doc.marco.relativoA, 'anclaje-del-mapa');
    assert.deepEqual(doc.marco.origenM, [1 * registro.ladoM, -2 * registro.ladoM]);
  });

  test('La máscara de mar entra en el documento y no se recalcula al cargar', async () => {
    const registro = await celdaDeFixture('costero');
    assert.ok(registro.mundo.seaMask, 'el fixture costero no ha producido máscara de mar: no se está comprobando nada');
    const doc = congelaCelda(registro);

    assert.ok(doc.mundo.seaMask, 'la máscara de mar no ha entrado en el documento');
    assert.equal(typeof doc.mundo.seaMask.bits, 'string', 'la máscara no va en rejilla de bits');
    assert.equal(doc.mundo.seaMask.n, registro.mundo.seaMask.n);
    assert.equal(doc.mundo.seaMask.cell, registro.mundo.seaMask.cell);
    assert.equal(doc.mundo.seaMask.extent, registro.mundo.seaMask.extent);

    // Un bit por celda y no un byte: es lo que hace asumible congelarla.
    const celdas = registro.mundo.seaMask.state.length;
    assert.ok(doc.mundo.seaMask.bits.length < celdas / 2, `la máscara ocupa ${doc.mundo.seaMask.bits.length} caracteres para ${celdas} celdas: no va en rejilla de bits`);

    // Y vuelve celda a celda, sin recalcular nada desde las costas.
    const levantado = levantaCelda(textoDeCelda(registro), { semilla: SEMILLA_A });
    assert.deepEqual(
      Array.from(levantado.mundo.seaMask.state),
      Array.from(registro.mundo.seaMask.state),
      'la máscara de mar levantada no es la que se congeló',
    );
    assert.ok(levantado.mundo.seaMask.state.some((v) => v === 2), 'la máscara levantada no tiene ni una celda de mar');

    // Un mundo sin costa no inventa máscara.
    const sinCosta = await documentoDe('urbano-denso');
    assert.equal(sinCosta.mundo.seaMask, null, 'un mundo sin costa ha guardado una máscara de mar');
  });

  test('En el documento no aparece la respuesta cruda de Overpass ni ningún texto de consulta', async () => {
    for (const nombre of LOS_CUATRO) {
      const crudo = textoDeCelda(await celdaDeFixture(nombre));
      for (const marca of ['[out:json]', 'out geom', 'overpass', 'nwr[', 'around:', '"elements"', 'interpreter']) {
        assert.equal(crudo.includes(marca), false, `${nombre}: el documento lleva "${marca}", que es texto de la consulta a Overpass`);
      }
      const claves = new Set();
      recorreDocumento(JSON.parse(crudo), (ruta) => {
        const ultima = ruta.split('.').pop();
        if (ultima && !ultima.includes('[')) claves.add(ultima);
      });
      for (const prohibida of ['elements', 'crudo', 'consulta', 'query', 'ql', 'respuesta', 'tags']) {
        assert.equal(claves.has(prohibida), false, `${nombre}: el documento tiene un campo "${prohibida}"`);
      }
    }
  });

  test('Ningún anclaje aparece dos veces', async () => {
    // El escenario, afirmado sobre el mundo **levantado**: el registro de uso
    // único viaja congelado, así que sigue siendo comprobable un año después.
    for (const nombre of LOS_CUATRO) {
      const levantado = levantaCelda(textoDeCelda(await celdaDeFixture(nombre)), { semilla: SEMILLA_A });
      const m = levantado.mundo;
      const ids = [];
      for (const s of m.settlements) {
        if (s.anchor?.osmId) ids.push(s.anchor.osmId);
        for (const v of s.services) if (v.real?.osmId) ids.push(v.real.osmId);
      }
      for (const p of m.parajes) if (p.real?.osmId) ids.push(p.real.osmId);
      assert.deepEqual(
        ids.filter((id, i) => ids.indexOf(id) !== i),
        [],
        `${nombre}: hay identificadores de anclaje repetidos en el mundo levantado`,
      );
      assert.deepEqual(
        m.pool.tomados.map((t) => t.osmId).filter((id, i, l) => l.indexOf(id) !== i),
        [],
        `${nombre}: el registro de anclajes tomados que se congeló tiene repetidos`,
      );
    }
  });
});

describe('El ida y vuelta', () => {
  test('Congelar, levantar y volver a congelar da el mismo documento byte a byte', async () => {
    for (const nombre of LOS_CUATRO) {
      for (const celda of DOS_CELDAS) {
        const registro = await celdaDeFixture(nombre, { celda });
        const donde = `${nombre} celda ${celda.i},${celda.j}`;

        const primero = textoDeCelda(registro);
        const levantado = levantaCelda(primero, { semilla: SEMILLA_A });
        const segundo = textoDeCelda(levantado);
        assert.equal(segundo, primero, `${donde}: el documento cambia al levantarlo y volver a congelarlo`);

        // Y una tercera vuelta, que es donde se ven las pérdidas que solo ocurren
        // sobre un mundo levantado y no sobre uno recién generado.
        assert.equal(textoDeCelda(levantaCelda(segundo, { semilla: SEMILLA_A })), primero, `${donde}: el documento cambia en la segunda vuelta`);

        // Congelar dos veces el mismo mundo da el mismo texto.
        assert.equal(textoDeCelda(registro), primero, `${donde}: dos congelaciones del mismo mundo dan documentos distintos`);
      }
    }
  });

  test('La máscara de mar y el grafo viario vuelven enteros del documento', async () => {
    // Los dos bultos que tienen codificación propia —la máscara en rejilla de bits
    // y el grafo con sus tres Maps— y por tanto los dos sitios donde una pérdida no
    // se vería comparando el resto del mundo.
    for (const nombre of LOS_CUATRO) {
      const registro = await celdaDeFixture(nombre);
      const levantado = levantaCelda(textoDeCelda(registro), { semilla: SEMILLA_A });
      const a = registro.mundo.viario;
      const b = levantado.mundo.viario;

      assert.deepEqual(b.nodeIds, a.nodeIds, `${nombre}: los nodos del grafo no vuelven en el mismo orden`);
      assert.equal(b.umbralM, a.umbralM);
      assert.equal(b.mayor, a.mayor);
      assert.deepEqual(canoniza(b.informe), canoniza(a.informe), `${nombre}: el informe del grafo cambia al levantarlo`);
      for (const id of a.nodeIds) {
        assert.deepEqual(canoniza(b.coord.get(id)), canoniza(a.coord.get(id)), `${nombre}: la coordenada del nodo ${id} cambia`);
        assert.deepEqual(b.capas.get(id), a.capas.get(id), `${nombre}: las capas del nodo ${id} cambian`);
        assert.equal(b.de.get(id), a.de.get(id), `${nombre}: la componente del nodo ${id} cambia`);
        assert.deepEqual(canoniza(b.adj.get(id)), canoniza(a.adj.get(id)), `${nombre}: las adyacencias del nodo ${id} cambian`);
        // El orden de cada lista de adyacencia decide los empates de Dijkstra: si
        // se reordenara, el trazado de un lazo cambiaría sin cambiar ni un dato.
        assert.deepEqual(
          b.adj.get(id).map((x) => x.hasta),
          a.adj.get(id).map((x) => x.hasta),
          `${nombre}: las adyacencias del nodo ${id} vuelven en otro orden`,
        );
      }

      // La coordenada de un nodo es **el mismo punto** que el de la vía de la que
      // nació, igual que en el grafo recién construido: se cita, no se copia.
      const puntosDeVias = new Set();
      for (const via of [...levantado.mundo.geo.roads, ...levantado.mundo.geo.callejero]) for (const p of via.pts) puntosDeVias.add(p);
      const citados = b.nodeIds.filter((id) => puntosDeVias.has(b.coord.get(id))).length;
      assert.ok(citados > 0, `${nombre}: ningún nodo del grafo levantado cita el punto de su vía`);

      if (a.seaMask || registro.mundo.seaMask) {
        assert.deepEqual(
          Array.from(levantado.mundo.seaMask.state),
          Array.from(registro.mundo.seaMask.state),
          `${nombre}: la máscara de mar no vuelve entera`,
        );
      }
    }
  });

  test('El mundo levantado no difiere del recién generado en ningún campo', async () => {
    for (const nombre of LOS_CUATRO) {
      const registro = await celdaDeFixture(nombre);
      const levantado = levantaCelda(textoDeCelda(registro), { semilla: SEMILLA_A });

      assert.deepEqual(
        Object.keys(parteCongelada(levantado.mundo)).sort(),
        Object.keys(parteCongelada(registro.mundo)).sort(),
        `${nombre}: el mundo levantado no tiene los mismos campos`,
      );
      const dif = diferencias(canoniza(parteCongelada(registro.mundo)), canoniza(parteCongelada(levantado.mundo)));
      assert.deepEqual(dif, [], `${nombre}: el mundo levantado difiere del generado:\n  ${dif.join('\n  ')}`);

      // Y el registro de la celda alrededor del mundo, que es lo que la partida
      // vuelve a tener delante al abrir el mapa.
      for (const campo of ['clave', 'ladoM', 'radioInscritoM', 'mapaId', 'motivo', 'tramoM', 'sinContenidoJugable']) {
        if (campo === 'motivo') continue; // el motivo de apertura es dato de la partida, y vive en el índice
        assert.deepEqual(levantado[campo], registro[campo], `${nombre}: el campo "${campo}" de la celda cambia al levantarla`);
      }
      assert.deepEqual(canoniza(levantado.limites), canoniza(registro.limites), `${nombre}: los límites de la celda cambian`);
      assert.deepEqual(canoniza(levantado.cupos), canoniza(registro.cupos), `${nombre}: los cupos de la celda cambian`);
    }
  });

  test('Ningún número cambia de valor al pasar por el documento', async () => {
    for (const nombre of LOS_CUATRO) {
      const registro = await celdaDeFixture(nombre);
      const levantado = levantaCelda(textoDeCelda(registro), { semilla: SEMILLA_A });

      const numeros = (valor, ruta, out) => {
        recorreDocumento(valor, (r, v) => {
          if (typeof v === 'number') out.push([r, v]);
        }, ruta);
        return out;
      };
      const a = numeros(canoniza(parteCongelada(registro.mundo)), 'mundo', []);
      const b = numeros(canoniza(parteCongelada(levantado.mundo)), 'mundo', []);
      assert.equal(b.length, a.length, `${nombre}: el mundo levantado tiene ${b.length} números y el generado ${a.length}`);
      assert.ok(a.length > 1000, `${nombre}: solo se han comparado ${a.length} números`);
      for (let i = 0; i < a.length; i++) {
        assert.ok(Object.is(a[i][1], b[i][1]), `${nombre}: ${a[i][0]} valía ${a[i][1]} y vuelve como ${b[i][1]}`);
      }
    }
  });

  test('Cada río conserva su tipo al congelar y levantar', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles');
    assert.ok(registro.mundo.geo.rivers.length > 0, 'el fixture no trae ríos: no se está comprobando nada');
    const doc = congelaCelda(registro);
    const levantado = levantaCelda(texto(doc), { semilla: SEMILLA_A });

    assert.deepEqual(
      doc.mundo.geo.rivers.map((r) => r.kind),
      registro.mundo.geo.rivers.map((r) => r.kind),
      'el tipo de algún río no ha llegado al documento',
    );
    assert.deepEqual(
      levantado.mundo.geo.rivers.map((r) => r.kind),
      registro.mundo.geo.rivers.map((r) => r.kind),
      'el tipo de algún río se ha perdido al levantarlo',
    );
    for (const r of levantado.mundo.geo.rivers) assert.equal(typeof r.kind, 'string');
  });

  test('Los nombres acentuados y en gallego vuelven idénticos, carácter a carácter', async () => {
    const registro = await celdaDeFixture('costero');
    assert.equal(registro.mundo.locale, 'gl', 'el fixture costero no está en gallego: el caso no comprueba lo que dice');
    const levantado = levantaCelda(textoDeCelda(registro), { semilla: SEMILLA_A });

    const nombres = (mundo) => [
      mundo.title,
      ...mundo.settlements.map((s) => s.name),
      ...mundo.settlements.flatMap((s) => s.services.map((v) => v.name)),
      ...mundo.parajes.map((p) => p.name),
      ...mundo.routes.map((r) => r.name),
    ];
    const antes = nombres(registro.mundo);
    const despues = nombres(levantado.mundo);
    assert.deepEqual(despues, antes, 'algún nombre no vuelve idéntico del documento');

    const conAcento = antes.filter((n) => typeof n === 'string' && /[áéíóúñüÁÉÍÓÚÑ]/.test(n));
    assert.ok(conAcento.length > 0, 'ningún nombre del mundo lleva acentos: el caso no comprueba nada');
    for (const n of conAcento) {
      const igual = despues[antes.indexOf(n)];
      assert.equal([...igual].map((c) => c.codePointAt(0)).join(','), [...n].map((c) => c.codePointAt(0)).join(','), `el nombre "${n}" vuelve con otros caracteres`);
    }
  });

  test('El casting sale igual contra el mundo generado y contra el levantado', async () => {
    for (const nombre of LOS_CUATRO) {
      const registro = await celdaDeFixture(nombre);
      const levantado = levantaCelda(textoDeCelda(registro), { semilla: SEMILLA_A });

      const resumen = (casting) => casting.map((c) => ({
        id: c.tpl.id,
        ok: c.ok,
        motivo: c.motivo ?? null,
        beats: (c.beats ?? []).map((b) => `${b.n}|${b.rol}|${b.lugar?.nombre ?? ''}`),
        distancia: c.distancia ?? null,
      }));
      assert.deepEqual(resumen(levantado.mundo.casting), resumen(registro.mundo.casting), `${nombre}: el casting cambia contra el mundo levantado`);
      // Y recasteado a mano sobre los dos mundos, que es como se recompone cada vez
      // que hace falta: el casting no se congela, se vuelve a hacer.
      assert.deepEqual(resumen(castAll(levantado.mundo)), resumen(castAll(registro.mundo)), `${nombre}: recastear los dos mundos da resultados distintos`);
    }
  });

  test('Una propiedad colgada de un array hace fallar la congelación nombrando el campo', async () => {
    // La trampa que este proyecto ya pagó una vez: una propiedad puesta sobre un
    // array no sobrevive a JSON y desaparece **sin que nada se ponga rojo**.
    const registro = await celdaDeFixture('barrio-tres-calles');
    const parajes = registro.mundo.parajes.slice();
    parajes.cobertura = 'lo que se perdería en silencio';
    const alterado = celdaConMundoAlterado(registro, { parajes });

    assert.throws(
      () => congelaCelda(alterado),
      (e) => {
        assert.match(e.message, /parajes/, e.message);
        assert.match(e.message, /cobertura/, `el error no nombra la propiedad colgada: ${e.message}`);
        return true;
      },
      'una propiedad colgada de un array se ha escrito en silencio',
    );

    // Y también dentro de una lista anidada, que es donde de verdad se esconde.
    const rutas = registro.mundo.routes.map((r, i) => {
      if (i !== 0) return r;
      const pts = r.pts.slice();
      pts.trazado = 'colgado';
      return modificable(r, { pts });
    });
    assert.throws(() => congelaCelda(celdaConMundoAlterado(registro, { routes: rutas })), /trazado/, 'una propiedad colgada de una lista anidada se ha escrito en silencio');
  });

  test('Un valor que JSON no sabe escribir hace fallar la congelación nombrando el campo', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles');
    const casos = [
      ['NaN', { title: NaN }, /mundo\.title.*NaN/],
      ['Infinity', { radius: Infinity }, /mundo\.radius.*Infinity/],
      ['undefined', { title: undefined }, /mundo\.title.*undefined/],
      ['un Map', { pool: modificable(registro.mundo.pool, { tomados: new Map() }) }, /mundo\.pool\.tomados.*Map/],
      ['un Set', { pool: modificable(registro.mundo.pool, { excluidos: new Set(['a']) }) }, /mundo\.pool\.excluidos.*Set/],
      ['una función', { pool: modificable(registro.mundo.pool, { deficit: () => 0 }) }, /mundo\.pool\.deficit.*función/],
    ];
    for (const [que, cambios, esperado] of casos) {
      assert.throws(
        () => congelaCelda(celdaConMundoAlterado(registro, cambios)),
        esperado,
        `${que} en un campo del mundo no ha hecho fallar la congelación nombrando el campo`,
      );
    }
  });

  test('El orden de iteración no depende del orden de inserción', async () => {
    // Con documentos canónicos el escenario deja de comparar objetos y compara
    // bytes: los mismos datos de OSM en orden contrario dan el mismo documento.
    for (const nombre of LOS_CUATRO) {
      const natural = textoDeCelda(await celdaDeFixture(nombre));
      const invertido = textoDeCelda(await celdaDeFixture(nombre, { ordenInvertido: true }));
      assert.equal(invertido, natural, `${nombre}: el documento cambia si los datos de OSM llegan en otro orden`);
    }
  });

  test('Cada lista del documento está ordenada por un criterio declarado y estable', async () => {
    const doc = await documentoDe('costero');
    const enOrden = (lista, clave, donde) => {
      const claves = lista.map(clave);
      assert.deepEqual(claves, [...claves].sort(), `${donde}: la lista no está ordenada por su clave estable (${claves.slice(0, 4).join(' | ')})`);
    };
    // Las familias de terreno salen ordenadas por la clave de OSM del elemento del
    // que nacen, que es lo que hace el orden independiente de Overpass.
    for (const familia of ['coastlines', 'lakes', 'rivers', 'forests', 'roads', 'callejero']) {
      const lista = doc.mundo.geo[familia];
      const ids = lista.map((e) => e.osmId).filter((v) => v != null);
      assert.equal(ids.length, lista.length, `geo.${familia}: hay elementos sin identificador con el que ordenar`);
    }
    enOrden(doc.mundo.pool.porEtiqueta, (e) => e.clave, 'pool.porEtiqueta');
    enOrden(doc.mundo.pool.porKind, (e) => e.clave, 'pool.porKind');
    assert.deepEqual(doc.recursos, { ilustraciones: [], fotos: [], textos: [] }, 'los tres huecos de recursos no salen vacíos y declarados');

    // Y el diccionario de escenas de un paraje se escribe con las claves ordenadas.
    const conEscenas = doc.mundo.parajes.find((p) => Object.keys(p.scenes).length > 1);
    assert.ok(conEscenas, 'ningún paraje tiene escenas: no se está comprobando nada');
    const escritas = JSON.parse(escribe(conEscenas.scenes, { forma: 'dic', de: 'numero' }, 'scenes'));
    assert.deepEqual(Object.keys(escritas), [...Object.keys(conEscenas.scenes)].sort(), 'las claves de un diccionario no se escriben ordenadas');
  });
});

describe('La versión del formato', () => {
  test('Todo documento declara la versión del formato y la del generador', async () => {
    const doc = await documentoDe('suelo-250m');
    // **Contra la constante y no contra el literal.** Hasta SPEC-049 aquí ponía `1`, que era
    // cierto y era una copia: exactamente lo que el caso de al lado —«La versión del formato
    // sale de una sola constante»— le exige al código. Cuando la primera migración de verdad
    // subió la constante a 2, este caso se puso rojo por su propia copia y no por ningún
    // defecto de lo escrito. Lo que hay que afirmar es que el documento declara **la** versión,
    // que es un entero y que va la primera en el texto; cuál sea el número es de `formato.js`.
    assert.equal(doc.version, VERSION_FORMATO, 'la versión del formato del documento no es la que declara la constante única');
    assert.equal(Number.isInteger(doc.version), true);
    assert.equal(doc.generador, VERSION_GENERADOR, 'el documento no declara con qué versión del generador se escribió');
    assert.equal(typeof doc.generador, 'string');
    // Y la versión va antes que nada en el texto: es lo que permite rechazar un
    // documento futuro sin haber interpretado ningún otro campo.
    const crudo = texto(doc);
    assert.ok(crudo.startsWith(`{"version":${VERSION_FORMATO},`), `el documento no empieza por su versión: ${crudo.slice(0, 40)}`);
  });

  test('La versión del formato sale de una sola constante', () => {
    const modulos = readdirSync(join(RAIZ, 'packages/nucleo/partida')).filter((f) => f.endsWith('.js'));
    let declaraciones = 0;
    for (const f of modulos) {
      const src = readFileSync(join(RAIZ, 'packages/nucleo/partida', f), 'utf8');
      declaraciones += (src.match(/export const VERSION_FORMATO/g) ?? []).length;
      // Todo `version:` de un documento sale de la constante. La única otra
      // aparición legítima es la del esquema, que declara su tipo y no su valor.
      const literales = [...src.matchAll(/version:\s*([^,\n]+)/g)].map((m) => m[1].trim());
      for (const literal of literales) {
        assert.ok(
          literal === 'VERSION_FORMATO' || literal === "'entero'",
          `${f}: un documento toma su versión de "${literal}" en vez de la constante`,
        );
      }
    }
    assert.equal(declaraciones, 1, `la versión del formato se declara ${declaraciones} veces en partida/`);
  });

  test('Un documento sin versión, con una mayor o con una menor no se abre', async () => {
    const doc = await documentoDe('barrio-tres-calles');

    const sinVersion = copia(doc);
    delete sinVersion.version;
    assert.throws(() => levantaCelda(sinVersion, { semilla: SEMILLA_A }), /"version"/, 'un documento sin versión se ha abierto');
    assert.throws(() => lee(JSON.stringify(sinVersion)), /"version"/, 'un texto sin versión se ha leído');

    const mayor = copia(doc);
    mayor.version = VERSION_FORMATO + 1;
    assert.throws(
      () => levantaCelda(mayor, { semilla: SEMILLA_A }),
      (e) => {
        assert.ok(e.message.includes(String(VERSION_FORMATO + 1)), `el error no declara la versión que trae: ${e.message}`);
        assert.ok(e.message.includes(String(VERSION_FORMATO)), `el error no declara la versión que se esperaba: ${e.message}`);
        assert.match(e.message, /no se abre/, e.message);
        return true;
      },
      'un documento de una versión futura se ha abierto',
    );

    const menor = copia(doc);
    menor.version = VERSION_FORMATO - 1;
    assert.throws(
      () => levantaCelda(menor, { semilla: SEMILLA_A }),
      (e) => {
        assert.match(e.message, /migrar/, `el error no dice que hay que migrarlo: ${e.message}`);
        return true;
      },
      'un documento de una versión anterior se ha interpretado con las reglas nuevas',
    );
  });

  test('La versión se comprueba antes que cualquier otro campo', async () => {
    // Un documento de una versión futura al que además le falta un campo
    // obligatorio y le sobra uno inventado: lo que se declara es la versión, no lo
    // otro. Si el orden fuera el contrario, un formato futuro se rechazaría por el
    // motivo equivocado y la migración no sabría qué hacer con él.
    const roto = copia(await documentoDe('barrio-tres-calles'));
    roto.version = 99;
    delete roto.mundo;
    roto.loQueVieneDelFuturo = { desconocido: true };

    assert.throws(
      () => levantaCelda(roto, { semilla: SEMILLA_A }),
      (e) => {
        assert.match(e.message, /versión de formato 99/, e.message);
        assert.equal(/loQueVieneDelFuturo|falta el campo obligatorio/.test(e.message), false, `se ha interpretado el documento antes de mirar la versión: ${e.message}`);
        return true;
      },
    );
  });
});

describe('Lo que no se congela', () => {
  test('Ni los anclajes libres, ni el casting, ni la auditoría de la generación entran en el documento', async () => {
    for (const nombre of LOS_CUATRO) {
      const registro = await celdaDeFixture(nombre);
      const doc = congelaCelda(registro);
      const campos = new Set(Object.keys(doc.mundo));

      for (const fuera of ['anchors', 'casting', 'movidos', 'reparto', 'coberturaParajes', 'seed']) {
        assert.equal(campos.has(fuera), false, `${nombre}: el documento congela "${fuera}", que no es mundo`);
      }
      // Lo que sí se congela del pool es el registro de uso único; lo que no, los
      // anclajes libres que ningún elemento consumió.
      assert.ok(Array.isArray(doc.mundo.pool.tomados), 'el registro de anclajes tomados no está en el documento');
      assert.equal(Object.prototype.hasOwnProperty.call(doc.mundo.pool, 'libres'), false, 'los anclajes libres están en el documento');
      assert.equal(Object.prototype.hasOwnProperty.call(doc.mundo.pool, 'anclajes'), false, 'el pool de anclajes entero está en el documento');

      // Y el mundo levantado los recompone o los declara ausentes, sin `undefined`.
      const levantado = levantaCelda(texto(doc), { semilla: SEMILLA_A });
      assert.ok(Array.isArray(levantado.mundo.casting), `${nombre}: el mundo levantado no recompone su casting`);
      for (const campo of CAMPOS_DEL_MUNDO) {
        if (['origin', 'seed'].includes(campo)) continue;
        assert.notEqual(levantado.mundo[campo], undefined, `${nombre}: el campo "${campo}" del mundo levantado vale undefined`);
      }
    }
  });

  test('Ningún dato del jugador ni ningún binario entra en el documento', async () => {
    const doc = await documentoDe('costero');
    const PROHIBIDAS = ['rango', 'rangos', 'diario', 'repisa', 'rumor', 'rumores', 'oro', 'inventario', 'posicion', 'posiciones', 'ubicacion', 'historico', 'rastro', 'gps', 'binario', 'base64', 'datos', 'imagen', 'foto'];
    const rutasDe = [];
    recorreDocumento(doc, (ruta) => {
      const ultima = ruta.split('.').pop();
      if (ultima && !ultima.includes('[') && PROHIBIDAS.includes(ultima)) rutasDe.push(ruta);
    });
    assert.deepEqual(rutasDe, [], `el documento tiene campos que no son mundo: ${rutasDe.join(', ')}`);

    // Ni binarios en línea ni codificados: la única cadena larga sin espacios del
    // documento es la rejilla de bits de la máscara de mar, que no es una imagen.
    for (const { ruta, valor } of textosDe(doc)) {
      if (ruta === 'documento.mundo.seaMask.bits') continue;
      assert.equal(/^data:/.test(valor), false, `${ruta}: hay un binario en línea`);
      assert.ok(valor.length < 512, `${ruta}: hay una cadena de ${valor.length} caracteres, que huele a binario codificado`);
    }
    assert.deepEqual(doc.recursos.ilustraciones, [], 'un mundo sin ilustraciones no declara el hueco vacío');
    assert.deepEqual(doc.recursos.fotos, [], 'un mundo sin fotos no declara el hueco vacío');
  });

  test('El esquema cerrado rechaza un campo que no está declarado, nombrándolo', async () => {
    const doc = await documentoDe('barrio-tres-calles');

    // Un campo de más en la raíz: por ahí es por donde se colaría un día la
    // posición de quien juega sin que nada se pusiera rojo.
    const conPosicion = copia(doc);
    conPosicion.posicionDelJugador = { lat: 42.4012, lon: -8.8114 };
    assert.throws(() => texto(conPosicion), /posicionDelJugador/, 'un campo con la posición del jugador ha pasado la validación');

    // Y a cualquier profundidad.
    const dentro = copia(doc);
    dentro.mundo.settlements[0].ultimaVisitaDelJugador = '2026-08-07';
    assert.throws(() => texto(dentro), /ultimaVisitaDelJugador/, 'un campo de más dentro de un núcleo ha pasado la validación');

    // Un campo obligatorio ausente también se nombra.
    const sinCampo = copia(doc);
    delete sinCampo.mundo.title;
    assert.throws(() => texto(sinCampo), /falta el campo obligatorio "title"/, 'un documento sin un campo obligatorio ha pasado la validación');

    // Y del lado del mundo: la ficha de un anclaje con un campo que el formato no
    // declara falla al congelar, en vez de viajar de polizón.
    const costero = await celdaDeFixture('costero');
    const settlements = costero.mundo.settlements.map((s, i) => (i === 0 && s.anchor ? modificable(s, { anchor: { ...s.anchor, visto: true } }) : s));
    assert.ok(settlements.some((s) => s.anchor?.visto), 'ningún núcleo del fixture tiene anclaje: el caso no comprueba nada');
    assert.throws(
      () => congelaCelda(celdaConMundoAlterado(costero, { settlements })),
      /"visto"/,
      'un campo de más en la ficha de un anclaje ha llegado al documento',
    );

    // El esquema declarado es el que valida: no hay una segunda pasada más blanda.
    assert.equal(esquemaDe(CLASES.CELDA), ESQUEMA_CELDA);
    assert.throws(() => esquemaDe('inventada'), /clase de documento desconocida/);
  });
});

describe('El tamaño, que se mide', () => {
  test('El documento del mundo urbano denso ocupa menos de 2 MB sin comprimir', async () => {
    const crudo = textoDeCelda(await celdaDeFixture('urbano-denso'));
    const bytes = bytesDe(crudo);
    assert.ok(
      bytes < 2 * MB,
      `el documento del urbano denso ocupa ${(bytes / KB).toFixed(1)} KB y el presupuesto es ${(2 * MB) / KB} KB`,
    );
  });

  test('El documento del mundo del suelo de 250 m ocupa menos de 200 KB sin comprimir', async () => {
    const crudo = textoDeCelda(await celdaDeFixture('suelo-250m'));
    const bytes = bytesDe(crudo);
    assert.ok(
      bytes < 200 * KB,
      `el documento del suelo de 250 m ocupa ${(bytes / KB).toFixed(1)} KB y el presupuesto es 200 KB`,
    );
  });

  test('Las coordenadas del documento van en metros relativos al anclaje del mapa', async () => {
    const registro = await celdaDeFixture('costero', { celda: { i: 1, j: -2 } });
    const doc = congelaCelda(registro);

    assert.equal(doc.marco.unidad, 'm');
    assert.deepEqual(doc.marco.origenM, [registro.ladoM, -2 * registro.ladoM]);

    // Ni un `lat`/`lon` dentro del mundo: los grados solo viven en la cabecera —el
    // anclaje del mapa y los límites de la celda— y en la capa refrescable de
    // Places, que es lo que hay que poder volver a pedir.
    const enGrados = [];
    recorreDocumento(doc.mundo, (ruta) => {
      const ultima = ruta.split('.').pop();
      if ((ultima === 'lat' || ultima === 'lon') && !ruta.includes('refrescable')) enGrados.push(ruta);
    }, 'mundo');
    assert.deepEqual(enGrados, [], `el mundo guarda coordenadas en grados: ${enGrados.slice(0, 5).join(', ')}`);

    // Y los metros son metros: dentro de la celda, y no un número de seis cifras
    // que solo podría ser un grado multiplicado.
    const tope = registro.ladoM * 4;
    for (const via of doc.mundo.geo.callejero) {
      for (const v of via.pts) assert.ok(Math.abs(v) < tope, `una coordenada del callejero vale ${v}, que no es un metro dentro de la celda`);
    }
  });

  test('Una calzada cita los tramos del callejero por su identificador en lugar de copiar sus puntos', async () => {
    for (const nombre of ['costero', 'urbano-denso']) {
      const doc = await documentoDe(nombre);
      const citados = doc.mundo.routes.reduce((a, r) => a + r.pts.filter((p) => typeof p === 'number').length, 0);
      const copiados = doc.mundo.routes.reduce((a, r) => a + r.pts.filter((p) => Array.isArray(p)).length, 0);
      assert.ok(citados > 0, `${nombre}: ninguna calzada cita nodos del grafo por su índice`);
      assert.ok(citados > copiados, `${nombre}: se copian más puntos (${copiados}) de los que se citan (${citados})`);
      for (const r of doc.mundo.routes) {
        for (const t of r.tramos) {
          assert.ok(Array.isArray(t.nodos), 'un tramo no cita los nodos que recorre');
          for (const i of t.nodos) assert.ok(Number.isInteger(i) && i >= 0 && i < doc.mundo.viario.nodos.length, `un tramo cita el nodo ${i}, que no está en el grafo`);
        }
      }
      // El grafo tampoco copia la coordenada de un nodo que ya está en una vía.
      const citadas = doc.mundo.viario.coord.filter((c) => c.length === 3).length;
      assert.ok(citadas > 0, `${nombre}: el grafo copia todas las coordenadas en vez de citarlas`);
    }
  });

  test('Los recursos binarios no cuentan dentro del documento', async () => {
    const doc = await documentoDe('costero');
    // El hueco guarda la referencia y el estado; el binario vive aparte y se mide
    // aparte. Se comprueba sobre el esquema, que es lo que impide añadirlo.
    const camposDeIlustracion = Object.keys(ESQUEMA_CELDA.mapa.recursos.mapa.ilustraciones.de.mapa);
    const camposDeFoto = Object.keys(ESQUEMA_CELDA.mapa.recursos.mapa.fotos.de.mapa);
    assert.deepEqual(camposDeIlustracion, ['elemento', 'prompt', 'clave', 'recurso', 'estado']);
    assert.deepEqual(camposDeFoto, ['anclaje', 'placeId', 'recurso', 'capturadaEn', 'estado']);
    assert.deepEqual(doc.recursos, { ilustraciones: [], fotos: [], textos: [] });
  });
});

describe('Del móvil no sale nada del jugador', () => {
  test('Ni la semilla de la partida ni la coordenada exacta del arranque están en el documento', async () => {
    const registro = await celdaDeFixture('costero');
    const crudo = textoDeCelda(registro);

    assert.equal(crudo.includes(SEMILLA_A), false, 'la semilla de la partida está en el documento de la celda');
    assert.equal(crudo.includes(registro.semillaCelda), false, 'la semilla de la celda está en el documento');
    // Con otra semilla de partida, el mismo mundo se congela igual: el documento no
    // depende de ella y por tanto no la lleva escondida.
    const otra = await celdaDeFixture('costero', { semilla: SEMILLA_B });
    const iguales = JSON.parse(crudo);
    const conOtra = JSON.parse(textoDeCelda(otra));
    assert.deepEqual(Object.keys(conOtra), Object.keys(iguales), 'el documento cambia de forma con la semilla');

    // Y la coordenada exacta del arranque no está: el documento habla del anclaje
    // redondeado, que es lo mismo para todo el paso de redondeo.
    const { coordenadaDe } = await import('./celda-de-prueba.mjs');
    const { lat, lon } = coordenadaDe('costero');
    for (const dato of [String(lat), String(lon)]) {
      assert.equal(crudo.includes(dato), false, `la coordenada exacta del arranque (${dato}) está en el documento`);
    }
  });

  test('La única marca de tiempo del documento es la fecha de captura de Places', async () => {
    const doc = await documentoDe('barrio-tres-calles', { places: placesDePrueba('barrio-tres-calles'), demanda: { total: 40, suelo: 4 } });
    const FECHA = /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}|GMT|T\d{2}:\d{2}/;
    const conFecha = textosDe(doc).filter(({ valor }) => FECHA.test(valor));
    assert.ok(conFecha.length > 0, 'no hay ninguna fecha en el documento: el caso no comprueba nada');
    for (const { ruta } of conFecha) {
      assert.ok(
        ruta.endsWith('.refrescable.capturado') || ruta.endsWith('.capturadaEn'),
        `${ruta}: hay una marca de tiempo del reloj real donde no debía`,
      );
    }
  });

  test('Congelar un mundo ya generado no abre ninguna conexión de red', async () => {
    const registros = [];
    for (const nombre of LOS_CUATRO) registros.push(await celdaDeFixture(nombre));

    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      for (const registro of registros) {
        const crudo = textoDeCelda(registro);
        levantaCelda(crudo, { semilla: SEMILLA_A });
      }
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico al congelar y levantar un mundo');
    } finally {
      inspector.suelta();
    }
  });

  test('El área partida/ no importa nada que hable con la red', () => {
    // La afirmación más difícil de este proyecto es una negativa, y esta se puede
    // hacer leyendo el cierre de imports: si un día alguien mete un cliente HTTP
    // en la capa de partida, aquí se ve antes de que salga una sola petición.
    const cierre = new Set();
    const cola = readdirSync(join(RAIZ, 'packages/nucleo/partida'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => join(RAIZ, 'packages/nucleo/partida', f));
    const externos = [];
    const sospechosos = [];
    while (cola.length) {
      const fichero = cola.pop();
      if (cierre.has(fichero)) continue;
      cierre.add(fichero);
      const src = readFileSync(fichero, 'utf8');
      for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (spec.startsWith('.')) cola.push(join(fichero, '..', spec));
        else externos.push(`${fichero}: ${spec}`);
      }
      for (const patron of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /node:http/, /node:net/, /require\s*\(/]) {
        if (patron.test(src)) sospechosos.push(`${fichero}: ${patron}`);
      }
    }
    assert.ok(cierre.size > 10, `el cierre de imports de partida/ tiene solo ${cierre.size} módulos: no se ha recorrido nada`);
    assert.deepEqual(externos, [], `partida/ importa módulos de fuera del paquete: ${externos.join(', ')}`);
    assert.deepEqual(sospechosos, [], `hay una salida a red en el cierre de partida/: ${sospechosos.join(', ')}`);
  });
});

// ── SPEC-009-iter-1 · La precisión con la que se guardan los metros ─────────────
//
// La iteración no arregló un número: cerró una clase. El documento guardaba la
// precisión de la aritmética de coma flotante, que no es una decisión de nadie, y
// ahora guarda la que el juego necesita, que sí lo es. Estos casos son los que
// impiden que la clase vuelva: que la precisión siga siendo **una** constante, que
// se aplique al generar y nunca al volcar, y que gobierne los metros y solo los
// metros.

/** Todos los módulos del paquete, en orden estable y con su ruta desde la raíz. */
function modulosDelPaquete(dir = 'packages/nucleo') {
  const out = [];
  for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.isDirectory()) out.push(...modulosDelPaquete(`${dir}/${e.name}`));
    else if (e.name.endsWith('.js')) out.push(`${dir}/${e.name}`);
  }
  return out;
}

const fuenteDe = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8');

// Las fases que producen metros: las que la spec nombra como sitios donde un
// redondeo propio se colaría sin que nadie lo viera.
const FASES_QUE_PRODUCEN_METROS = [
  'packages/nucleo/world/build.js',
  'packages/nucleo/world/grafo.js',
  'packages/nucleo/world/routes.js',
  'packages/nucleo/world/settlements.js',
  'packages/nucleo/world/parajes.js',
  'packages/nucleo/world/costura.js',
];

/** Los decimales que trae escrito un número. Un metro de longitud son ~1,2e-5 grados. */
const decimalesDe = (v) => (String(v).split('.')[1] ?? '').length;

/**
 * Si un número cae en la rejilla de `PRECISION_M`. Se compara con el cociente y no
 * con el resto porque `-10000 % 1` es `-0`, y `-0 !== 0` en una igualdad estricta:
 * el resto haría fallar a todo metro negativo redondo.
 */
const enLaRejilla = (v) => v / PRECISION_M === Math.round(v / PRECISION_M);

/**
 * Las rutas del documento cuyo número **no está en metros**, y por qué. Son las dos
 * únicas familias: los grados, que la constante no toca por decisión escrita, y los
 * pesos de escena, que son proporciones sin unidad.
 */
const EN_GRADOS = /\.(lat|lon|lng)$/;
const SIN_UNIDAD = /\.scenes\.|\.pesoMinimo$/;

describe('La precisión con la que se guardan los metros es una constante única', () => {
  test('La precisión sale de una sola constante, con su justificación al lado', () => {
    const declaran = modulosDelPaquete().filter((m) => /(?:^|\n)\s*export const PRECISION_M\s*=/.test(fuenteDe(m)));
    assert.deepEqual(declaran, ['packages/nucleo/core/geo.js'], 'la precisión no sale de una sola constante, o no vive donde nacen los metros');

    // Y nadie se guarda otra con otro nombre: dos precisiones son cero precisiones,
    // porque la que manda pasa a ser la del último sitio que tocó el número.
    const otras = [];
    for (const modulo of modulosDelPaquete()) {
      for (const m of fuenteDe(modulo).matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=/g)) {
        if (m[1] !== 'PRECISION_M' && /PRECISION|PRECISION|REDONDEO|DECIMALES/i.test(m[1])) otras.push(`${modulo} → ${m[1]}`);
      }
    }
    assert.deepEqual(otras, [], 'hay otra constante de precisión repartida por el paquete');

    // La justificación, al lado del número y no en otro documento: quien vaya a
    // cambiarlo tiene que tropezarse con lo que se midió para elegirlo.
    const previo = fuenteDe('packages/nucleo/core/geo.js').split(/export const PRECISION_M\s*=/)[0].split('/**').pop();
    assert.ok(previo.split('\n').length >= 5, 'la constante de precisión no lleva su justificación escrita al lado');
    assert.ok(previo.includes('2048'), 'la justificación de la precisión no cita el presupuesto que la decidió');

    // Y las fases que producen metros la toman de ahí en vez de redondear a mano.
    for (const fase of FASES_QUE_PRODUCEN_METROS) {
      assert.match(
        fuenteDe(fase),
        /import\s*\{[^}]*\b(?:cuantizaM|cuantizaPunto|dist)\b[^}]*\}\s*from\s*'\.\.\/core\/geo\.js'/,
        `${fase}: produce metros y no toma la cuantización de core/geo.js`,
      );
    }
  });

  test('El módulo de congelado no redondea ni un número', () => {
    // Es la mitad del contrato que hace afirmable el ida y vuelta exacto: se
    // cuantiza en la generación y **nunca al volcar**. Si el volcado redondeara,
    // congelar y levantar dejarían de dar el mismo documento en cuanto un número
    // cayera justo en la mitad de la rejilla.
    for (const modulo of ['packages/nucleo/partida/mundo.js', 'packages/nucleo/partida/formato.js']) {
      const src = fuenteDe(modulo);
      for (const patron of [/\bMath\.round\s*\(/, /\bMath\.trunc\s*\(/, /\.toFixed\s*\(/, /\.toPrecision\s*\(/, /\bcuantiza(?:M|Punto)\b/, /\bPRECISION_M\b/]) {
        assert.equal(patron.test(src), false, `${modulo}: la capa de congelado toca la precisión de un número (${patron})`);
      }
      // Los `floor`/`ceil` que quedan cuentan bytes de la rejilla de bits de la
      // máscara de mar, y se comprueba que es eso: todos dividen entre 8.
      for (const linea of src.split('\n')) {
        if (/\bMath\.(?:floor|ceil)\s*\(/.test(linea)) {
          assert.match(linea, /\/\s*8\b/, `${modulo}: hay un redondeo que no es contar bytes: ${linea.trim()}`);
        }
      }
    }
  });

  test('Todo número en metros del documento de una celda es múltiplo exacto de la constante', async () => {
    // Se afirma sobre **todos** los números del documento y no sobre una lista de
    // campos elegidos a mano, que es lo que dejaría entrar el que se olvide: lo que
    // se enumera es lo contrario, las dos familias que no están en metros. Con la
    // rejilla del metro, «múltiplo exacto» es «entero», y los índices y recuentos
    // pasan de largo por serlo ya.
    for (const nombre of LOS_CUATRO) {
      const doc = await documentoDe(nombre);
      const fuera = [];
      const grados = [];
      const pesos = [];
      recorreDocumento(doc, (ruta, valor) => {
        if (typeof valor !== 'number') return;
        if (EN_GRADOS.test(ruta)) return void grados.push(ruta);
        if (SIN_UNIDAD.test(ruta)) return void pesos.push(ruta);
        if (!enLaRejilla(valor)) fuera.push(`${ruta} = ${valor}`);
      });
      assert.deepEqual(fuera.slice(0, 5), [], `${nombre}: hay metros fuera de la rejilla de ${PRECISION_M} m (${fuera.length} en total)`);
      assert.ok(grados.length > 0, `${nombre}: el filtro de grados no ha apartado ninguno, así que no está apartando lo que cree`);
      assert.ok(pesos.length > 0, `${nombre}: el filtro de pesos no ha apartado ninguno, así que no está apartando lo que cree`);
    }
  });

  test('La constante gobierna los metros y no toca los grados de la cabecera', async () => {
    // El reverso del caso anterior, y el que impide el arreglo fácil de cuantizarlo
    // todo: redondear el anclaje movería el identificador del mapa que fija
    // SPEC-003, y redondear las esquinas movería el borde de la celda.
    for (const nombre of ['costero', 'urbano-denso']) {
      const rejilla = rejillaDe(nombre);
      const doc = congelaCelda(await celdaDeFixture(nombre, { celda: DOS_CELDAS[1] }));
      const limites = limitesDeCelda(rejilla, DOS_CELDAS[1]);

      assert.deepEqual(doc.mapa.anclaje, { lat: rejilla.anclaje.lat, lon: rejilla.anclaje.lon }, `${nombre}: el anclaje del documento no es el de la rejilla`);
      assert.deepEqual(doc.celda.esquinas, limites.esquinas, `${nombre}: las esquinas del documento no son las que calcula la rejilla`);
      assert.deepEqual(doc.celda.centro, limites.centro, `${nombre}: el centro del documento no es el que calcula la rejilla`);

      // Y siguen teniendo precisión más fina que un metro, que en longitud son unos
      // 1,2e-5 grados: seis decimales o más es la prueba de que nadie los ha rozado.
      const finos = doc.celda.esquinas.filter((e) => decimalesDe(e.lat) >= 6 && decimalesDe(e.lon) >= 6);
      assert.equal(finos.length, doc.celda.esquinas.length, `${nombre}: las esquinas vienen redondeadas a menos de un metro de precisión`);

      // Los metros de la misma cabecera sí están en la rejilla.
      for (const [campo, valor] of Object.entries(doc.celda.metros)) {
        assert.equal(enLaRejilla(valor), true, `${nombre}: celda.metros.${campo} vale ${valor}, que no está en la rejilla`);
      }
    }
  });
});
