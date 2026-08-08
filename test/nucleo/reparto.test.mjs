// SPEC-005-iter-1 · Los topes de diversidad, fuera de la admisión y dentro del reparto.
//
// Dos cosas distintas se afirman aquí, y conviene no confundirlas. Una es de
// corrección: el pool ya no se amputa por porcentaje y el tope actúa sobre los
// candidatos que se le ofrecen a la fase que reparte, deteniéndose en su cupo. La
// otra es de **salud del generador**, que es lo que faltaba: la casteabilidad
// agregada de los ocho extractos de referencia no puede bajar. Ese es el caso que
// habría cazado solo el defecto que originó esta iteración, y por eso el umbral se
// escribe como el número medido antes de la fila —21 de 48— y no como el de hoy:
// si mañana sube, no debe ponerse rojo; si baja de la línea, sí.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mundoCongelado } from '../dobles/mundo-congelado.mjs';
import {
  LOS_CUATRO,
  LAS_DOS_SEMILLAS,
  extraeReferencia,
  generaMundo,
  leeExtracto,
  semillaDe,
} from './mundo-de-prueba.mjs';

import {
  ETIQUETAS_SIN_RECONOCIMIENTO,
  ENTRADAS_PARA_EXIGIR_NOMBRE,
  FRACCION_NOMBRADAS_MINIMA,
  TOPE_POR_ETIQUETA,
  TOPE_POR_KIND,
  construyePool,
  entradaDeAdmision,
  familiaProblematica,
  puntuaCandidatos,
  recortaPorTopes,
} from '../../packages/nucleo/world/anclajes.js';
import { generateParajes, parajeCountForRadius } from '../../packages/nucleo/world/parajes.js';
import { generateSettlements } from '../../packages/nucleo/world/settlements.js';
import { namesFor } from '../../packages/nucleo/names/index.js';
import { isSea } from '../../packages/nucleo/world/seamask.js';

/**
 * La casteabilidad, los parajes y los servicios medidos en `cec7d91`, el commit
 * anterior a esta fila. Es la línea que no se puede bajar, y va escrita como número
 * absoluto a propósito: un umbral relativo a lo commiteado se satisface regenerando
 * los extractos, que es justo el agujero por el que se coló el defecto. Subirla
 * cuando el generador mejore es una decisión explícita, no un efecto secundario.
 */
const ANTES_DE_LA_FILA = {
  'barrio-tres-calles#1': { castea: 0, parajes: 2, servicios: 0 },
  'barrio-tres-calles#2': { castea: 1, parajes: 2, servicios: 0 },
  'costero#1': { castea: 3, parajes: 5, servicios: 11 },
  'costero#2': { castea: 5, parajes: 5, servicios: 12 },
  'suelo-250m#1': { castea: 0, parajes: 0, servicios: 6 },
  'suelo-250m#2': { castea: 0, parajes: 0, servicios: 6 },
  'urbano-denso#1': { castea: 6, parajes: 5, servicios: 13 },
  'urbano-denso#2': { castea: 6, parajes: 5, servicios: 14 },
};

const SUELO_AGREGADO = 21;
const PLANTILLAS_POR_MUNDO = 6;

const LOS_OCHO = LOS_CUATRO.flatMap((nombre) => LAS_DOS_SEMILLAS.map((semilla) => ({ nombre, semilla, clave: `${nombre}#${semilla}` })));

/** El pool de un mundo congelado, sin radio ni máscara: solo los filtros de etiqueta. */
function poolDe(nombre) {
  const d = mundoCongelado(nombre);
  return construyePool({ poiJson: d.pois, lat0: d.manifiesto.coordenada.lat, lon0: d.manifiesto.coordenada.lon, semilla: 's' });
}

/**
 * Qué anclajes admitiría la misma admisión sin ningún tope, calculado aquí y no
 * llamando al código que se está probando: filtro de tipos problemáticos, catálogo,
 * exclusión nominal y descarte de una etiqueta entera por falta de nombre.
 */
function admisionSinTopes(nombre) {
  const paso = [];
  for (const el of mundoCongelado(nombre).pois.elements ?? []) {
    const t = el.tags ?? {};
    if (familiaProblematica(t)) continue;
    const entrada = entradaDeAdmision(t);
    if (!entrada) continue;
    if (ETIQUETAS_SIN_RECONOCIMIENTO.includes(entrada.etiqueta)) continue;
    if ((el.lat ?? el.center?.lat) == null || (el.lon ?? el.center?.lon) == null) continue;
    paso.push({ osmId: `${el.type}/${el.id}`, etiqueta: entrada.etiqueta, name: t.name || null });
  }
  const total = new Map();
  const nombradas = new Map();
  for (const a of paso) {
    total.set(a.etiqueta, (total.get(a.etiqueta) ?? 0) + 1);
    if (a.name) nombradas.set(a.etiqueta, (nombradas.get(a.etiqueta) ?? 0) + 1);
  }
  const fuera = new Set(
    [...total.keys()].filter((e) => total.get(e) > ENTRADAS_PARA_EXIGIR_NOMBRE && (nombradas.get(e) ?? 0) / total.get(e) < FRACCION_NOMBRADAS_MINIMA),
  );
  return paso.filter((a) => !fuera.has(a.etiqueta)).map((a) => a.osmId).sort();
}

/** Cuántos aporta como mucho un mismo valor de `campo` en una lista de candidatos. */
function maximoPor(candidatos, campo) {
  const m = new Map();
  for (const c of candidatos) m.set(c.a[campo], (m.get(c.a[campo]) ?? 0) + 1);
  return Math.max(0, ...m.values());
}

/** Los candidatos que la fase de parajes tiene delante en un mundo ya generado. */
function candidatosDeParajes(world, semilla) {
  const { freeAnchors } = generateSettlements(world.anchors, world.geo, world.radius, semilla, world.seaMask, namesFor(world.locale));
  const elegibles = freeAnchors.filter((a) => Math.hypot(a.x, a.y) < world.radius * 0.95 && !isSea(world.seaMask, a));
  return {
    puntuados: puntuaCandidatos(elegibles, { settlements: world.settlements, routes: world.routes, radius: world.radius }),
    cupo: parajeCountForRadius(world.radius),
  };
}

/** Un candidato ya puntuado, para las pruebas del recorte en sí. */
const cand = (id, etiqueta, kind, puntos, name = `sitio ${id}`) => ({
  a: { osmId: `node/${id}`, etiqueta, kind, name, x: 0, y: 0 },
  puntos,
});

describe('El pool no se recorta', () => {
  test('Ningún anclaje que pasó los filtros queda fuera del pool por exceder un tope', () => {
    for (const nombre of LOS_CUATRO) {
      const esperado = admisionSinTopes(nombre);
      const real = poolDe(nombre).anclajes.map((a) => a.osmId).sort();
      assert.deepEqual(real, esperado, `${nombre}: el pool no coincide con la admisión sin ningún tope`);
    }
  });

  test('Los mundos congelados admiten los anclajes medidos: 45 en el costero y 2 556 en el urbano denso', () => {
    assert.equal(poolDe('costero').anclajes.length, 45);
    assert.equal(poolDe('urbano-denso').anclajes.length, 2556);
  });

  test('Una etiqueta puede aportar más del 25 % del pool sin que se la recorte', () => {
    // Es la comprobación de que el instrumento se movió de sitio de verdad: con el
    // tope en la admisión, esto era imposible por construcción. Medido, la etiqueta
    // dominante del urbano denso aporta más de la mitad del pool.
    const pool = poolDe('urbano-denso');
    const porEtiqueta = new Map();
    const porKind = new Map();
    for (const a of pool.anclajes) {
      porEtiqueta.set(a.etiqueta, (porEtiqueta.get(a.etiqueta) ?? 0) + 1);
      porKind.set(a.kind, (porKind.get(a.kind) ?? 0) + 1);
    }
    const maxEtiqueta = Math.max(...porEtiqueta.values()) / pool.anclajes.length;
    const maxKind = Math.max(...porKind.values()) / pool.anclajes.length;
    assert.ok(maxEtiqueta > TOPE_POR_ETIQUETA, `la etiqueta dominante aporta el ${(maxEtiqueta * 100).toFixed(1)} %: el pool se sigue recortando`);
    assert.ok(maxKind > TOPE_POR_KIND, `el kind dominante aporta el ${(maxKind * 100).toFixed(1)} %: el pool se sigue recortando`);
  });

  test('El resumen del pool sigue declarando cuánto aporta cada etiqueta y cada kind', () => {
    const pool = poolDe('costero');
    const { porEtiqueta, porKind } = pool.resumen();
    assert.ok(porEtiqueta.length > 0 && porKind.length > 0, 'el resumen ya no publica el reparto por etiqueta y por kind');
    assert.equal(porEtiqueta.reduce((n, e) => n + e.n, 0), pool.anclajes.length, 'las cuentas por etiqueta no suman el pool');
    assert.equal(porKind.reduce((n, e) => n + e.n, 0), pool.anclajes.length, 'las cuentas por kind no suman el pool');
    assert.deepEqual(porEtiqueta.map((e) => e.clave), [...porEtiqueta.map((e) => e.clave)].sort(), 'las cuentas por etiqueta no salen en orden estable');
  });
});

describe('El tope actúa al repartir y solo sobre el excedente', () => {
  test('Con más candidatos que cupo, ninguna etiqueta ni ningún kind pasa de su tope', async () => {
    let medidos = 0;
    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const w = await generaMundo(nombre, semillaDe(nombre, semilla));
      const { puntuados, cupo } = candidatosDeParajes(w, semillaDe(nombre, semilla));
      if (puntuados.length <= cupo) continue;
      const recorte = recortaPorTopes(puntuados, cupo);
      assert.equal(recorte.relajado, false, `${clave}: el reparto se ha tenido que saltar los topes con candidatos de sobra`);
      const limiteEtiqueta = Math.max(1, Math.floor(puntuados.length * TOPE_POR_ETIQUETA));
      const limiteKind = Math.max(1, Math.floor(puntuados.length * TOPE_POR_KIND));
      assert.ok(maximoPor(recorte.candidatos, 'etiqueta') <= limiteEtiqueta, `${clave}: una etiqueta pasa del ${TOPE_POR_ETIQUETA * 100} % de los candidatos ofrecidos`);
      assert.ok(maximoPor(recorte.candidatos, 'kind') <= limiteKind, `${clave}: un kind pasa del ${TOPE_POR_KIND * 100} % de los candidatos ofrecidos`);
      // Y el recorte sirve para algo: la etiqueta dominante manda menos que antes.
      assert.ok(
        maximoPor(recorte.candidatos, 'etiqueta') / recorte.candidatos.length < maximoPor(puntuados, 'etiqueta') / puntuados.length,
        `${clave}: el recorte no ha reducido el dominio de la etiqueta mayoritaria`,
      );
      medidos += 1;
    }
    assert.ok(medidos >= 3, `solo ${medidos} mundos tenían más candidatos que cupo: el tope apenas se ha medido`);
  });

  test('Si los candidatos no llegan al cupo no se descarta ninguno', () => {
    const candidatos = [
      cand(1, 'amenity=cafe', 'cafetería', 3),
      cand(2, 'amenity=cafe', 'cafetería', 2),
      cand(3, 'amenity=cafe', 'cafetería', 1),
    ];
    for (const cupo of [3, 5, 99]) {
      const r = recortaPorTopes(candidatos, cupo);
      assert.deepEqual(r.candidatos, candidatos, `cupo ${cupo}: se ha descartado un candidato donde ya faltaban`);
      assert.equal(r.recortados, 0);
      assert.equal(r.relajado, false, `cupo ${cupo}: se declara una relajación sin haber recortado nada`);
    }
    assert.deepEqual(recortaPorTopes([], 4).candidatos, []);
  });

  test('Cuando respetar los topes dejaría menos candidatos que el cupo, el recorte se detiene justo en el cupo', () => {
    // Diez candidatos de la misma etiqueta y el mismo kind: los topes por sí solos
    // dejarían 2, muy por debajo del cupo de 5.
    const candidatos = Array.from({ length: 10 }, (_, i) => cand(i + 1, 'amenity=cafe', 'cafetería', 10 - i));
    const r = recortaPorTopes(candidatos, 5);
    assert.equal(r.candidatos.length, 5, 'el recorte no se ha detenido en el cupo');
    assert.equal(r.relajado, true, 'el reparto se saltó los topes y no lo declara');
    assert.equal(r.recuperados, 3);
    // Y los que quedan son los mejor puntuados, en el orden en que llegaron.
    assert.deepEqual(r.candidatos.map((c) => c.a.osmId), ['node/1', 'node/2', 'node/3', 'node/4', 'node/5']);
  });

  test('Los candidatos que se recuperan y los que se conservan son los mejor puntuados y, a igualdad, los que tienen nombre', () => {
    // Misma puntuación para todos: lo único que puede ordenar es el nombre.
    const candidatos = [
      cand(1, 'amenity=cafe', 'cafetería', 5, null),
      cand(2, 'amenity=cafe', 'cafetería', 5, 'Casa Manuela'),
      cand(3, 'amenity=cafe', 'cafetería', 5, null),
      cand(4, 'amenity=cafe', 'cafetería', 5, 'O Muíño'),
      cand(5, 'amenity=cafe', 'cafetería', 5, null),
      cand(6, 'amenity=cafe', 'cafetería', 5, null),
      cand(7, 'amenity=cafe', 'cafetería', 5, null),
      cand(8, 'amenity=cafe', 'cafetería', 5, null),
    ];
    const r = recortaPorTopes(candidatos, 2);
    assert.equal(r.candidatos.length, 2);
    assert.deepEqual(
      r.candidatos.map((c) => c.a.name),
      ['Casa Manuela', 'O Muíño'],
      'a igualdad de puntos no se han conservado los que tienen nombre',
    );

    // Y con puntos distintos, manda el punto por delante del nombre.
    const porPuntos = recortaPorTopes(
      [cand(1, 'amenity=cafe', 'cafetería', 9, null), cand(2, 'amenity=cafe', 'cafetería', 1, 'Con nombre'), cand(3, 'amenity=cafe', 'cafetería', 5, null), cand(4, 'amenity=cafe', 'cafetería', 4, null)],
      1,
    );
    assert.deepEqual(porPuntos.candidatos.map((c) => c.a.osmId), ['node/1'], 'el mejor puntuado no es el que sobrevive');
  });

  test('Cuando el reparto tuvo que saltarse los topes, consta en el mundo con la fase que lo hizo', () => {
    // Un mundo mínimo montado a mano: doce anclajes libres de la misma etiqueta,
    // repartidos por la circunferencia para que quepan todos. Es el caso que
    // ningún mundo congelado produce hoy y que hay que forzar para verlo.
    const radius = 1000;
    const libres = Array.from({ length: 12 }, (_, i) => {
      const t = (i / 12) * Math.PI * 2;
      return {
        osmId: `node/${100 + i}`,
        x: Math.cos(t) * 800,
        y: Math.sin(t) * 800,
        name: `Sitio ${i}`,
        etiqueta: 'amenity=cafe',
        kind: 'cafetería',
        cat: 'local',
        weight: 1,
        desempate: i / 12,
      };
    });
    const geo = { roads: [], rivers: [], forests: [], lakes: [], coastlines: [], peaks: [] };
    const reparto = { relajaciones: [] };
    const parajes = generateParajes(libres, [], [], geo, radius, 'reparto#1', null, namesFor('es'), undefined, null, reparto);

    assert.ok(parajes.length > 0, 'el mundo de prueba no ha colocado ni un paraje: no se está midiendo el reparto');
    assert.equal(reparto.relajaciones.length, 1, 'el reparto se saltó los topes y el mundo no lo declara');
    const r = reparto.relajaciones[0];
    assert.equal(r.fase, 'parajes', 'la relajación no dice qué fase la hizo');
    assert.equal(r.cupo, parajeCountForRadius(radius));
    assert.equal(r.candidatos, libres.length);
    assert.ok(r.recuperados > 0, 'se declara una relajación que no recuperó a nadie');
    assert.equal(typeof r.motivo, 'string');
  });

  test('Cuando los candidatos sobraban, no consta ninguna relajación', async () => {
    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const w = await generaMundo(nombre, semillaDe(nombre, semilla));
      assert.deepEqual(w.reparto.relajaciones, [], `${clave}: el reparto declara una relajación que no hacía falta`);
    }
  });

  test('El tope trata igual a los candidatos de Places y a los de OSM', () => {
    // Ocho candidatos idénticos salvo la fuente, alternados y con los mismos puntos:
    // si el tope distinguiera la fuente, sobreviviría una de las dos y no la mitad
    // de cada una.
    const mezcla = Array.from({ length: 8 }, (_, i) => {
      const dePlaces = i % 2 === 1;
      const c = cand(i + 1, 'amenity=cafe', 'cafetería', 8 - i, `Sitio ${i}`);
      c.a.osmId = dePlaces ? `places:ChIJ-${i}` : `node/${i + 1}`;
      c.a.fuente = dePlaces ? 'places' : 'osm';
      return c;
    });
    const r = recortaPorTopes(mezcla, 4);
    assert.equal(r.candidatos.length, 4);
    const deCadaFuente = (f) => r.candidatos.filter((c) => c.a.fuente === f).length;
    assert.equal(deCadaFuente('osm'), 2, 'el recorte ha tratado distinto a los candidatos de OSM');
    assert.equal(deCadaFuente('places'), 2, 'el recorte ha tratado distinto a los candidatos de Places');
  });

  test('El mismo mundo congelado y la misma semilla eligen los mismos anclajes y en el mismo orden', async () => {
    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const una = await generaMundo(nombre, semillaDe(nombre, semilla));
      const otra = await generaMundo(nombre, semillaDe(nombre, semilla));
      const elegidos = (w) => w.parajes.map((p) => `${p.type}|${p.real?.osmId ?? 'grafo'}|${Math.round(p.x)},${Math.round(p.y)}`);
      assert.deepEqual(elegidos(otra), elegidos(una), `${clave}: el reparto elige otros anclajes o en otro orden`);
    }
  });
});

describe('La casteabilidad no puede bajar', () => {
  test('La casteabilidad agregada de los ocho extractos de referencia no baja de 21 de 48', async () => {
    let agregado = 0;
    const detalle = [];
    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const r = extraeReferencia(await generaMundo(nombre, semillaDe(nombre, semilla)));
      const castea = r.casting.filter((c) => c.castea).length;
      assert.equal(r.casting.length, PLANTILLAS_POR_MUNDO, `${clave}: el catálogo de plantillas ha cambiado de tamaño y el umbral 21/48 ya no significa lo mismo`);
      agregado += castea;
      detalle.push(`${clave} ${castea}/${PLANTILLAS_POR_MUNDO}`);
    }
    assert.ok(
      agregado >= SUELO_AGREGADO,
      `la casteabilidad agregada es ${agregado} de ${LOS_OCHO.length * PLANTILLAS_POR_MUNDO} y no puede bajar de ${SUELO_AGREGADO}: ${detalle.join(', ')}`,
    );
  });

  test('Ningún extracto castea menos, ni tiene menos parajes ni menos servicios, que antes de esta fila', async () => {
    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const antes = ANTES_DE_LA_FILA[clave];
      const r = extraeReferencia(await generaMundo(nombre, semillaDe(nombre, semilla)));
      const castea = r.casting.filter((c) => c.castea).length;
      assert.ok(castea >= antes.castea, `${clave}: castea ${castea} plantillas y antes de esta fila casteaba ${antes.castea}`);
      assert.ok(r.recuentos.parajes >= antes.parajes, `${clave}: tiene ${r.recuentos.parajes} parajes y antes tenía ${antes.parajes}`);
      assert.ok(r.recuentos.servicios >= antes.servicios, `${clave}: tiene ${r.recuentos.servicios} servicios y antes tenía ${antes.servicios}`);
      // Las calzadas quedan deliberadamente fuera: está medido que un reparto mejor
      // puede trazar una calzada menos y castear más, y afirmarlas convertiría una
      // mejora en un rojo.
    }
  });

  test('Los dos mundos costeros llegan al cupo de parajes de su celda', async () => {
    for (const semilla of LAS_DOS_SEMILLAS) {
      const w = await generaMundo('costero', semillaDe('costero', semilla));
      assert.equal(w.parajes.length, parajeCountForRadius(w.radius), `costero#${semilla}: no llega al cupo de parajes de la celda`);
      assert.equal(w.parajes.length, 5, `costero#${semilla}: el cupo de la celda ya no es 5 y el criterio de aceptación lo daba por hecho`);
    }
  });

  test('Cada extracto de referencia declara qué iteración lo regeneró y por qué', () => {
    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const cabecera = leeExtracto(nombre, semilla).cabecera;
      assert.equal(cabecera.regenerado_por, 'SPEC-005-iter-1', `${clave}: el extracto no declara qué iteración lo regeneró`);
      assert.ok(
        typeof cabecera.motivo_regeneracion === 'string' && cabecera.motivo_regeneracion.length > 40,
        `${clave}: el extracto no explica por qué se regeneró`,
      );
    }
  });
});
