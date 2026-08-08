// SPEC-006 · Los parajes y la cobertura de escenas.
//
// Lo que esta fila invierte, y por tanto lo que hay que afirmar aquí: **primero
// los tipos que cubren el vocabulario de escenas y después el anclaje real**, con
// el anclaje sacrificado sin drama —y sin cambiar el tipo— cuando no hay afín.
// Cruces y puentes participan en la cobertura en igualdad de condiciones, y en una
// celda sin anclajes son lo único que hay.
//
// Dónde acaba la fila 4 y empieza esta, porque ya costó dos reatribuciones:
// `cupos.test.mjs` afirma el **número** que la celda entrega (suelo derivado del
// catálogo, techo por ritmo, congelados con la celda); aquí se afirma el **mundo
// que se monta con ese número**. Los dos escenarios de la batería que quedan a
// caballo —«El suelo de parajes cubre el vocabulario de escenas» y «El cupo por
// ritmo es un techo, no un objetivo»— viven en los dos ficheros con el mismo
// nombre a propósito: allí la mitad aritmética, aquí la mitad de los parajes
// realmente colocados.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema: los mundos salen de
// los fixtures congelados o se montan a mano, y el azar viene siempre de la
// semilla.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANCHORED_TYPES,
  GRAPH_TYPES,
  PARAJE_INFO,
  generateParajes,
  parajeCountForRadius,
} from '../../packages/nucleo/world/parajes.js';
import {
  ESCENAS_POR_PARAJE,
  escenasQueCubre,
  normalizaVocabulario,
  sueloDeVocabulario,
} from '../../packages/nucleo/world/escenas.js';
import { vocabularioDeEscenas } from '../../packages/nucleo/world/cupos.js';
import { crearIndiceDeNombres, namesFor } from '../../packages/nucleo/names/index.js';
import { isSea } from '../../packages/nucleo/world/seamask.js';

import {
  LAS_DOS_SEMILLAS,
  LOS_CUATRO,
  fuente,
  generaMundo,
  modulosDelPaquete,
  semillaDe,
} from './mundo-de-prueba.mjs';

/** El vocabulario vivo: las siete escenas que hoy piden los roles de paraje del catálogo. */
const VOCABULARIO = vocabularioDeEscenas();
const SUELO = sueloDeVocabulario(VOCABULARIO);

const GEO_VACIA = { roads: [], rivers: [], forests: [], lakes: [], coastlines: [], peaks: [] };

/**
 * Un mundo sin nada más que los anclajes que se le den: ni calles, ni ríos, ni mar.
 *
 * Repartidos por la circunferencia y a 0,9 del radio para que quepan todos con la
 * separación mínima de la fase: apiñarlos convertiría cualquier prueba de reparto en
 * una prueba de la separación, que es otra cosa y tiene la suya.
 */
function anclajes(n, { radius = 1000, kind = 'bar', etiqueta = 'amenity=bar', desde = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const t = ((i + desde) / n) * Math.PI * 2;
    return {
      osmId: `node/${1000 + i}`,
      x: Math.cos(t) * radius * 0.9,
      y: Math.sin(t) * radius * 0.9,
      name: `Sitio ${i}`,
      etiqueta,
      kind,
      cat: 'local',
      weight: 1,
      desempate: i / n,
    };
  });
}

/**
 * La fase de parajes sobre un mundo montado a mano.
 *
 * Doblar es pasar otro argumento: el vocabulario y la ficha son la frontera de
 * inyección de esta spec, y aquí se pasan a mano igual que los pasa `build.js`.
 */
function reparte({
  libres = [],
  settlements = [],
  routes = [],
  geo = GEO_VACIA,
  radius = 1000,
  semilla = 'parajes#1',
  vocabulario = VOCABULARIO,
  cupo = null,
  opciones = {},
} = {}) {
  const ficha = {};
  const parajes = generateParajes(
    libres,
    settlements,
    routes,
    geo,
    radius,
    semilla,
    null,
    namesFor('es'),
    crearIndiceDeNombres(),
    null,
    null,
    { vocabulario, ...(cupo ? { cupo } : {}), ficha, ...opciones },
  );
  return { parajes, ficha, tipos: parajes.map((p) => p.type) };
}

/** Dos calzadas nombradas que se cruzan en el centro, que es el colchón de una celda sin anclajes. */
function dosRutasQueSeCruzan() {
  return [
    { name: 'Calzada del Este', pts: [{ x: -900, y: 0 }, { x: -300, y: 0 }, { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 900, y: 0 }] },
    { name: 'Calzada del Norte', pts: [{ x: 0, y: -900 }, { x: 0, y: -300 }, { x: 0, y: 0 }, { x: 0, y: 300 }, { x: 0, y: 900 }] },
  ];
}

/** Las escenas del vocabulario que cubre una lista de parajes ya colocados. */
function cubiertas(parajes, vocabulario = VOCABULARIO) {
  return new Set(parajes.flatMap((p) => escenasQueCubre(p.scenes, vocabulario)));
}

const LOS_OCHO = LOS_CUATRO.flatMap((nombre) => LAS_DOS_SEMILLAS.map((semilla) => ({ nombre, semilla, clave: `${nombre}#${semilla}` })));

describe('El mundo de una celda es jugable por construcción', () => {
  test('El suelo de parajes cubre el vocabulario de escenas', async () => {
    // La mitad de esta fila: el suelo que entrega la celda es el que se persigue al
    // colocar, y donde hay con qué llenarlo, el mundo acaba diciendo el vocabulario
    // entero. La otra mitad —que el suelo sea el cociente del catálogo— está en
    // `cupos.test.mjs` y no se repite aquí.
    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const w = await generaMundo(nombre, semillaDe(nombre, semilla));
      const ficha = w.coberturaParajes;
      assert.equal(ficha.suelo, SUELO, `${clave}: la celda no persigue el suelo derivado del catálogo`);
      assert.equal(ficha.cupo, Math.max(ficha.suelo, ficha.techo), `${clave}: el cupo no es el mayor entre suelo y techo`);
      assert.equal(ficha.colocados, w.parajes.length, `${clave}: la ficha no cuenta los parajes que hay`);
      assert.ok(ficha.colocados <= ficha.cupo, `${clave}: se han colocado ${ficha.colocados} parajes con un cupo de ${ficha.cupo}`);
    }

    // Y donde hay anclajes de sobra, el suelo se alcanza y el vocabulario entero
    // queda dicho: ninguna escena sin sitio donde jugarse.
    for (const nombre of ['costero', 'urbano-denso']) {
      for (const semilla of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, semilla));
        assert.ok(w.parajes.length >= SUELO, `${nombre}#${semilla}: ${w.parajes.length} parajes por debajo del suelo de ${SUELO}`);
        assert.deepEqual(w.coberturaParajes.deficit, [], `${nombre}#${semilla}: un mundo con anclajes de sobra deja escenas sin cubrir`);
        assert.deepEqual(
          [...cubiertas(w.parajes)].sort(),
          VOCABULARIO.map((e) => e.escena),
          `${nombre}#${semilla}: los parajes colocados no dicen el vocabulario entero`,
        );
      }
    }

    // El suelo es una regla viva y no una cifra: ensanchar el vocabulario coloca más
    // parajes sin tocar ninguna constante del generador.
    const ancho = [...VOCABULARIO.map((e) => e.escena), 'naufragio', 'trueque', 'vigía'];
    const conAncho = reparte({ libres: anclajes(20, { radius: 500 }), radius: 500, vocabulario: ancho });
    const conHoy = reparte({ libres: anclajes(20, { radius: 500 }), radius: 500 });
    assert.equal(conAncho.ficha.suelo, Math.ceil(ancho.length / ESCENAS_POR_PARAJE));
    assert.ok(conAncho.ficha.suelo > conHoy.ficha.suelo, 'ensanchar el vocabulario no ha subido el suelo');
    assert.ok(
      conAncho.parajes.length > conHoy.parajes.length,
      `ensanchar el vocabulario no ha colocado más parajes: ${conHoy.parajes.length} → ${conAncho.parajes.length}`,
    );

    // Y encogerlo lo baja en la misma proporción.
    const corto = reparte({ libres: anclajes(20, { radius: 500 }), radius: 500, vocabulario: ['guarida', 'encuentro'] });
    assert.equal(corto.ficha.suelo, 1, 'retirar escenas no ha bajado el suelo');

    // Ninguna cifra de suelo escrita a mano en los módulos que lo calculan y lo gastan.
    for (const modulo of ['packages/nucleo/world/escenas.js', 'packages/nucleo/world/parajes.js']) {
      assert.equal(/\bsuelo\s*[:=]\s*\d/.test(fuente(modulo)), false, `${modulo} lleva una cifra de suelo escrita a mano`);
    }
  });

  test('El cupo por ritmo es un techo, no un objetivo', async () => {
    // Celda pequeña con anclajes de sobra: el número de parajes colocados queda
    // entre el suelo derivado y el cupo objetivo, nunca por encima. Con el techo por
    // debajo del suelo, gana el suelo — que es el caso de la celda de 500 m.
    const pequena = reparte({ libres: anclajes(20, { radius: 500 }), radius: 500 });
    assert.ok(pequena.ficha.techo < pequena.ficha.suelo, 'la celda pequeña no tiene el techo por debajo del suelo');
    assert.equal(pequena.ficha.cupo, pequena.ficha.suelo);
    assert.ok(
      pequena.parajes.length >= pequena.ficha.suelo && pequena.parajes.length <= pequena.ficha.cupo,
      `la celda pequeña coloca ${pequena.parajes.length} parajes fuera de [${pequena.ficha.suelo}, ${pequena.ficha.cupo}]`,
    );

    // Celda grande con anclajes de sobra: el techo manda y no se pasa de ahí, por
    // muchos anclajes que haya. Más hitos no añaden beats a una salida.
    const grande = reparte({ libres: anclajes(40, { radius: 2000 }), radius: 2000 });
    assert.ok(grande.ficha.techo > grande.ficha.suelo, 'la celda grande no tiene el techo por encima del suelo');
    assert.equal(grande.ficha.cupo, grande.ficha.techo);
    assert.ok(
      grande.parajes.length <= grande.ficha.techo,
      `la celda grande coloca ${grande.parajes.length} parajes con un techo de ${grande.ficha.techo}`,
    );

    // Y en los mundos congelados, lo mismo: nunca por encima del cupo de su celda.
    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const w = await generaMundo(nombre, semillaDe(nombre, semilla));
      assert.ok(
        w.parajes.length <= w.coberturaParajes.cupo,
        `${clave}: ${w.parajes.length} parajes con un cupo de ${w.coberturaParajes.cupo}`,
      );
    }
  });

  test('La cobertura de escenas manda sobre la afinidad del anclaje', async () => {
    // Un mundo donde ningún anclaje real pega con la vigilancia: cuarenta bares y
    // ni una torre, ni un faro, ni un mirador. Aun así tiene que haber un sitio
    // desde el que vigilar, y su anclaje real será un bar.
    const libres = anclajes(40, { radius: 2000, kind: 'bar', etiqueta: 'amenity=bar' });
    for (const semilla of ['vigilancia#1', 'vigilancia#2', 'vigilancia#3']) {
      const { parajes } = reparte({ libres, radius: 2000, semilla });
      const vigilan = parajes.filter((p) => (p.scenes.vigilancia ?? 0) >= 0.2);
      assert.ok(vigilan.length > 0, `${semilla}: ningún paraje con escena de vigilancia en un mundo sin anclajes afines`);
      for (const p of vigilan) {
        assert.equal(p.real.kind, 'bar', `${semilla}: el paraje de vigilancia no se ancló a lo único que había`);
      }
    }
  });

  test('El mundo mínimo todavía compone un lazo', async () => {
    // El escenario que llevaba tres filas sin poder cerrarse: la celda de 250 m
    // castea al menos una plantilla **con el lazo cerrado** —el último beat vuelve
    // donde empezó el primero— y en una duración que se puede andar.
    for (const semilla of LAS_DOS_SEMILLAS) {
      const w = await generaMundo('suelo-250m', semillaDe('suelo-250m', semilla));
      assert.equal(w.radius, 250, `suelo-250m#${semilla}: el fixture ya no es el mundo de 250 m del escenario`);
      const lazos = w.casting.filter(
        (c) => c.ok && c.beats[0].lugar === c.beats[c.beats.length - 1].lugar && c.encaja !== 'demasiado larga',
      );
      assert.ok(
        lazos.length > 0,
        `suelo-250m#${semilla}: ninguna plantilla castea con lazo cerrado; motivos: ${w.casting.filter((c) => !c.ok).map((c) => c.motivo).join(' / ')}`,
      );
    }
  });

  test('Una celda que no llega al suelo declara en su ficha las escenas que quedaron sin cubrir', async () => {
    // Hueco de la batería declarado por la propia spec: que se declare es el
    // criterio, no que se alcance. Un barrio de tres calles sin anclajes elegibles y
    // con dos cruces es una celda pobre prevista por el diseño, no un error.
    let pobres = 0;
    for (const { nombre, semilla, clave } of LOS_OCHO) {
      const w = await generaMundo(nombre, semillaDe(nombre, semilla));
      const ficha = w.coberturaParajes;
      const sinCubrir = VOCABULARIO.map((e) => e.escena).filter((e) => !cubiertas(w.parajes).has(e));
      assert.deepEqual(ficha.deficit, sinCubrir, `${clave}: el déficit declarado no es el que de verdad falta`);
      assert.deepEqual(ficha.escenasPedidas, VOCABULARIO.map((e) => e.escena), `${clave}: la ficha no declara qué se le pidió`);
      if (ficha.colocados < ficha.cupo) {
        assert.ok(ficha.deficit.length > 0, `${clave}: no llega al cupo y no declara ni una escena sin cubrir`);
        pobres += 1;
      }
    }
    assert.ok(pobres > 0, 'ningún mundo se quedó corto: el déficit no se ha medido contra nada');
  });

  test('El reparto de tipos es el mismo con un pool de una sola clase que con un pool diverso del mismo tamaño', () => {
    // El otro hueco que declara la spec: el escenario del tag masivo de la batería
    // verifica el filtro del pool, que es de SPEC-005. Lo que falta afirmar es que el
    // **reparto** ya no depende del histograma del pool, que es lo que se rompía
    // cuando el sesgo tocaba el sorteo de tipo.
    const monoclase = anclajes(50, { radius: 2000, kind: 'fuente', etiqueta: 'amenity=fountain' });
    const clases = ['torre', 'iglesia', 'castillo', 'monasterio', 'mirador', 'fuente', 'cafetería', 'panadería', 'museo', 'mercado'];
    const diverso = monoclase.map((a, i) => ({ ...a, kind: clases[i % clases.length], etiqueta: `sintetico=${clases[i % clases.length]}` }));

    for (const semilla of ['pool#1', 'pool#2', 'pool#3']) {
      const uno = reparte({ libres: monoclase, radius: 2000, semilla });
      const otro = reparte({ libres: diverso, radius: 2000, semilla });
      assert.deepEqual(otro.tipos, uno.tipos, `${semilla}: el histograma del pool ha cambiado el reparto de tipos`);
      // Y cincuenta anclajes de la misma clase no monopolizan ningún tipo.
      for (const tipo of new Set(uno.tipos)) {
        const n = uno.tipos.filter((t) => t === tipo).length;
        assert.ok(n <= uno.tipos.length / 2, `${semilla}: el tipo "${tipo}" se lleva ${n} de ${uno.tipos.length} parajes`);
      }
    }
  });
});

describe('La elección de tipos por cobertura', () => {
  test('Los tipos se eligen antes de mirar ningún anclaje: permutar el pool no cambia la secuencia', () => {
    const libres = anclajes(30, { radius: 2000 });
    const permutado = [...libres].reverse().map((a, i) => ({ ...a, desempate: i / libres.length }));
    for (const semilla of ['orden#1', 'orden#2']) {
      assert.deepEqual(
        reparte({ libres: permutado, radius: 2000, semilla }).tipos,
        reparte({ libres, radius: 2000, semilla }).tipos,
        `${semilla}: permutar el pool ha cambiado la secuencia de tipos`,
      );
    }
  });

  test('Gana el tipo que cubre más escenas pendientes, y el empate lo rompe el azar de la fase', () => {
    // Atalaya cubre las dos escenas del vocabulario; piedra y cruce, una cada una.
    // No hay empate posible: gana atalaya siempre, sea cual sea la semilla.
    for (let k = 0; k < 12; k++) {
      const { tipos } = reparte({
        libres: anclajes(12, { radius: 500 }),
        radius: 500,
        semilla: `cobertura#${k}`,
        vocabulario: ['revelación', 'vigilancia'],
      });
      assert.equal(tipos[0], 'atalaya', `semilla ${k}: no ha ganado el tipo que cubre más escenas pendientes`);
    }

    // Con "ritual" empatan ermita, monasterio y piedra: el desempate es del azar de
    // la fase y no del orden de la tabla, que es alfabético y daría siempre ermita.
    const primeros = new Set();
    for (let k = 0; k < 12; k++) {
      const { tipos } = reparte({
        libres: anclajes(12, { radius: 500 }),
        radius: 500,
        semilla: `empate#${k}`,
        vocabulario: ['ritual'],
      });
      primeros.add(tipos[0]);
    }
    assert.ok(primeros.size > 1, `el empate lo rompe siempre igual: ${[...primeros].join(', ')}`);
    for (const t of primeros) {
      assert.ok(['ermita', 'monasterio', 'piedra'].includes(t), `ha ganado "${t}", que no cubre la escena empatada`);
    }
  });

  test('Una escena solo cuenta como cubierta por un tipo cuyo peso alcanza el mínimo que pide el rol', () => {
    // Vigilancia la dicen atalaya (0,3) y cruce (0,2). Un rol que exija 0,25 deja
    // fuera al cruce; uno que exija 0,4 no lo cubre nadie y es hueco de taxonomía.
    const exigente = reparte({
      libres: anclajes(12, { radius: 500 }),
      radius: 500,
      vocabulario: [{ escena: 'vigilancia', pesoMinimo: 0.25 }],
    });
    assert.deepEqual(exigente.ficha.huecosDeTaxonomia, []);
    assert.equal(exigente.tipos[0], 'atalaya', 'con peso mínimo 0,25 ha ganado un tipo que no llega');

    const imposible = reparte({
      libres: anclajes(12, { radius: 500 }),
      radius: 500,
      vocabulario: [{ escena: 'vigilancia', pesoMinimo: 0.4 }],
    });
    assert.deepEqual(imposible.ficha.huecosDeTaxonomia, ['vigilancia'], 'ningún tipo llega a 0,4 y no se declara el hueco');

    // Y la cuenta de cobertura usa el mismo mínimo: el paraje que roza la escena no
    // la cubre.
    assert.deepEqual(escenasQueCubre(PARAJE_INFO.cruce.scenes, [{ escena: 'vigilancia', pesoMinimo: 0.25 }]), []);
    assert.deepEqual(escenasQueCubre(PARAJE_INFO.atalaya.scenes, [{ escena: 'vigilancia', pesoMinimo: 0.25 }]), ['vigilancia']);
  });

  test('Una escena que ningún tipo cubre se declara como hueco de taxonomía y la generación continúa', () => {
    const { parajes, ficha } = reparte({
      libres: anclajes(12, { radius: 1000 }),
      radius: 1000,
      vocabulario: ['guarida', 'naufragio', 'ritual'],
    });
    assert.deepEqual(ficha.huecosDeTaxonomia, ['naufragio'], 'la escena que nadie sabe decir no se declara');
    assert.ok(parajes.length > 0, 'la generación se ha detenido por un hueco de taxonomía');
    const dichas = cubiertas(parajes, ['guarida', 'ritual']);
    assert.deepEqual([...dichas].sort(), ['guarida', 'ritual'], 'el resto del vocabulario no se ha cubierto');
    assert.deepEqual(ficha.deficit, ['naufragio'], 'el hueco de taxonomía no consta como escena sin cubrir');
  });

  test('Con el vocabulario ya cubierto, los huecos restantes no repiten tipo mientras queden tipos sin usar', () => {
    // Un vocabulario de una sola escena y una celda con cupo para seis: cubierta la
    // escena, lo que queda se reparte por diversidad.
    const { tipos } = reparte({
      libres: anclajes(30, { radius: 2000 }),
      radius: 2000,
      vocabulario: ['encuentro'],
    });
    assert.ok(tipos.length >= 4, `solo se han colocado ${tipos.length} parajes: la diversidad no se ha medido`);
    // Sin calzadas, los tipos disponibles son los seis que salen de un anclaje: hasta
    // gastarlos todos no puede repetirse ninguno. Del séptimo en adelante repetir es
    // lo único que queda, y eso no es un fallo de diversidad.
    const hastaAgotar = tipos.slice(0, ANCHORED_TYPES.length);
    assert.equal(
      new Set(hastaAgotar).size,
      hastaAgotar.length,
      `un tipo se repite habiendo tipos sin usar: ${tipos.join(', ')}`,
    );
  });

  test('Un vocabulario vacío deja el suelo en cero y el cupo lo fija el techo por ritmo', () => {
    const { ficha, parajes } = reparte({ libres: anclajes(20, { radius: 1000 }), radius: 1000, vocabulario: [] });
    assert.equal(ficha.suelo, 0, 'un vocabulario vacío no deja el suelo en cero');
    assert.equal(ficha.techo, parajeCountForRadius(1000));
    assert.equal(ficha.cupo, ficha.techo, 'sin vocabulario que cubrir el cupo no es el techo por ritmo');
    assert.equal(parajes.length, ficha.techo, 'con anclajes de sobra no se ha llenado el techo');
    assert.deepEqual(ficha.deficit, []);
  });

  test('El generador sin vocabulario inyectado falla nombrando la dependencia que falta', () => {
    // Precedente de SPEC-001 con el reloj de mundo sin motor: un default silencioso
    // convierte un olvido de cableado en un mundo mal dimensionado que nadie detecta.
    // Un vocabulario **vacío** es un caso normal —el de arriba—; **no recibirlo** es
    // un fallo de la frontera de inyección y tiene que decirlo por su nombre.
    //
    // Si esto se arregla en el generador, hay un sitio más que tocar: la llamada
    // sintética de `reparto.test.mjs` («Cuando el reparto tuvo que saltarse los
    // topes…») genera parajes sin pasar opciones y habrá que inyectarle el
    // vocabulario para que siga midiendo lo suyo.
    for (const opciones of [{}, { vocabulario: null }, { vocabulario: undefined }]) {
      assert.throws(
        () => generateParajes(anclajes(12), [], [], GEO_VACIA, 1000, 'sin-vocabulario#1', null, namesFor('es'), crearIndiceDeNombres(), null, null, opciones),
        (e) => {
          assert.match(e.message, /vocabulario/, `el error no nombra la dependencia que falta: ${e.message}`);
          return true;
        },
        `se han generado parajes con opciones ${JSON.stringify(opciones)}: el suelo se ha asumido en silencio`,
      );
    }
  });
});

describe('La asignación de anclaje: sesgo suave y sacrificio', () => {
  test('Sin ningún anclaje afín, el anclaje se sacrifica y el tipo no cambia', () => {
    // El orden es tipo → anclaje, y es la decisión de esta fila: la secuencia de
    // tipos se decide sin mirar el pool, así que cambiar el pool entero de clase no
    // cambia ni un tipo. Lo que cambia es a qué se ancla cada uno.
    const semilla = 'sacrificio#1';
    const afines = anclajes(12, { radius: 1000, kind: 'torre', etiqueta: 'man_made=tower' });
    const nadaAfin = anclajes(12, { radius: 1000, kind: 'bar', etiqueta: 'amenity=bar' });

    const con = reparte({ libres: afines, radius: 1000, semilla });
    const sin = reparte({ libres: nadaAfin, radius: 1000, semilla });
    assert.deepEqual(sin.tipos, con.tipos, 'quedarse sin anclajes afines ha cambiado los tipos elegidos');
    for (const p of sin.parajes) {
      assert.equal(p.real.kind, 'bar', 'un paraje se ha anclado a algo que no estaba en el pool');
      assert.ok(p.origin === 'anclaje', 'el paraje no declara de dónde salió');
    }
    // Y con afines, el guiño ocurre alguna vez: la torre sale de atalaya más veces
    // que nunca, sin salir siempre.
    let guinos = 0;
    for (let k = 0; k < 20; k++) {
      const { parajes } = reparte({ libres: afines, radius: 1000, semilla: `guino#${k}` });
      guinos += parajes.filter((p) => p.type === 'atalaya' && p.real?.kind === 'torre').length;
    }
    assert.ok(guinos > 0, 'la afinidad no gana nunca: el sesgo suave no se aplica');
  });

  test('Dos anclajes reales de la misma clase pueden salir con tipos distintos', () => {
    const { parajes } = reparte({ libres: anclajes(20, { radius: 2000, kind: 'cafetería' }), radius: 2000 });
    const tipos = new Set(parajes.filter((p) => p.real?.kind === 'cafetería').map((p) => p.type));
    assert.ok(tipos.size > 1, `todas las cafeterías han salido del mismo tipo: ${[...tipos].join(', ')}`);
  });

  test('Ninguna etiqueta de OSM ni tipo de lugar de Places determina por sí solo el tipo de un paraje', () => {
    // La misma clase real sale de tipos distintos según lo que el mundo necesite
    // decir, que es lo contrario de un mapeo 1:1 de tags.
    const torres = anclajes(20, { radius: 2000, kind: 'torre', etiqueta: 'man_made=tower' });
    const tipos = new Set();
    for (let k = 0; k < 8; k++) {
      for (const p of reparte({ libres: torres, radius: 2000, semilla: `tags#${k}` }).parajes) {
        if (p.real?.kind === 'torre') tipos.add(p.type);
      }
    }
    assert.ok(tipos.size > 1, `la clase "torre" siempre da el mismo tipo: ${[...tipos].join(', ')}`);
    // Y el sesgo vive en el sorteo de anclaje, no en el de tipo: el módulo elige la
    // secuencia sin consultar ninguna clase real.
    const texto = fuente('packages/nucleo/world/parajes.js');
    const secuencia = texto.slice(texto.indexOf('function secuenciaDeTipos'), texto.indexOf('export function generateParajes'));
    assert.equal(/BIAS/.test(secuencia), false, 'el sesgo por clase real ha vuelto al sorteo de tipos');
  });

  test('Un paraje anclado conserva el nombre y la clase del lugar real, separados de los fantásticos', () => {
    const { parajes } = reparte({ libres: anclajes(20, { radius: 2000, kind: 'museo' }), radius: 2000 });
    assert.ok(parajes.length > 0);
    for (const p of parajes) {
      assert.equal(p.real.kind, 'museo');
      assert.match(p.real.name, /^Sitio \d+$/, 'el nombre del lugar real no se conserva');
      assert.notEqual(p.name, p.real.name, 'el nombre fantástico es el del lugar real');
      assert.equal(p.label, PARAJE_INFO[p.type].label, 'la etiqueta visible no es la de su tipo');
      assert.ok(p.real.osmId, 'el anclaje real no viaja con su identificador');
    }
  });
});

describe('Cruces y puentes: el colchón que no depende de OSM', () => {
  test('Una celda sin ningún anclaje elegible y con dos rutas que se cruzan coloca un paraje de cruce', () => {
    const { parajes, ficha } = reparte({ libres: [], routes: dosRutasQueSeCruzan(), radius: 1000 });
    assert.ok(parajes.length > 0, 'una celda con cruces se ha quedado sin ningún paraje');
    assert.ok(parajes.some((p) => p.type === 'cruce'), 'ningún paraje de cruce donde el grafo es lo único que hay');
    assert.ok(ficha.colocados > 0);
  });

  test('El tipo de un candidato del grafo lo da su origen y no pasa por el sorteo', () => {
    const { parajes } = reparte({ libres: [], routes: dosRutasQueSeCruzan(), radius: 1000 });
    for (const p of parajes) {
      assert.equal(p.origin, 'grafo', 'un paraje sin anclaje no declara que salió del grafo');
      assert.ok(GRAPH_TYPES.includes(p.type), `un candidato del grafo ha salido de tipo "${p.type}"`);
      assert.equal(p.real, null, 'un cruce del grafo se ha llevado un anclaje real');
    }
  });

  test('Cuando el tipo que más cubre es de grafo y el grafo ofrece candidato, se coloca ahí antes que en un anclaje', () => {
    // "Peaje" solo la dicen cruce y puente. Con anclajes de sobra y un cruce
    // disponible, el primer paraje es el cruce.
    const { parajes } = reparte({
      libres: anclajes(12, { radius: 1000 }),
      routes: dosRutasQueSeCruzan(),
      radius: 1000,
      vocabulario: ['peaje'],
    });
    assert.equal(parajes[0].type, 'cruce', 'el tipo que cubre la escena pendiente no se ha colocado primero');
    assert.equal(parajes[0].origin, 'grafo');
  });

  test('El barrio de tres calles llena sus parajes con cruces y puentes, y declara lo que no alcanza', async () => {
    for (const semilla of LAS_DOS_SEMILLAS) {
      const w = await generaMundo('barrio-tres-calles', semillaDe('barrio-tres-calles', semilla));
      const clave = `barrio-tres-calles#${semilla}`;
      assert.ok(w.parajes.length > 0, `${clave}: el barrio se ha quedado sin ningún paraje`);
      for (const p of w.parajes) {
        assert.equal(p.origin, 'grafo', `${clave}: el barrio no tiene anclajes elegibles y aun así hay un paraje anclado`);
        assert.ok(GRAPH_TYPES.includes(p.type));
      }
      // Llegue o no al suelo —depende de cuántos cruces y puentes dé el callejero—,
      // el criterio es que se coloque todo lo que se puede y se declare el resto.
      const ficha = w.coberturaParajes;
      assert.ok(ficha.colocados <= ficha.suelo, `${clave}: se han colocado más parajes que el suelo`);
      if (ficha.colocados < ficha.suelo) {
        assert.ok(ficha.deficit.length > 0, `${clave}: se queda corto de suelo y no declara ninguna escena sin cubrir`);
      }
    }
  });

  test('Una celda sin anclajes, sin cruces y sin puentes no falla y declara las escenas sin cubrir', () => {
    const { parajes, ficha } = reparte({ libres: [], routes: [], radius: 1000 });
    assert.deepEqual(parajes, [], 'se han inventado parajes donde no había nada de lo que colgarlos');
    assert.equal(ficha.colocados, 0);
    assert.equal(ficha.suelo, SUELO, 'la celda vacía ha dejado de perseguir el suelo');
    assert.deepEqual(ficha.deficit, VOCABULARIO.map((e) => e.escena), 'una celda sin nada no declara el vocabulario entero como déficit');
    assert.deepEqual(ficha.escenasCubiertas, []);
  });

  test('El déficit de cobertura es dato interno y no lo lee nadie fuera de la generación', () => {
    // El design system prohíbe cualquier panel del estado del mundo: una celda pobre
    // se nota jugando, no leyendo un informe. Mientras no exista la app, lo que se
    // puede afirmar es que la ficha no sale del núcleo. La mitad de pantalla es
    // @app y queda pendiente.
    const lectores = modulosDelPaquete().filter((m) => /coberturaParajes/.test(fuente(m)));
    assert.deepEqual(lectores, ['packages/nucleo/world/build.js'], `la ficha de cobertura la lee alguien más: ${lectores.join(', ')}`);
  });
});

describe('Colocación, nombres y ficha del paraje', () => {
  test('Dos candidatos a menos de la separación mínima no se colocan los dos', () => {
    // Doce anclajes apiñados en veinte metros: por muchos que haya, solo cabe uno.
    const apinados = Array.from({ length: 12 }, (_, i) => ({
      osmId: `node/${2000 + i}`,
      x: i * 2,
      y: 0,
      name: `Pegado ${i}`,
      etiqueta: 'amenity=cafe',
      kind: 'cafetería',
      cat: 'local',
      weight: 1,
      desempate: i / 12,
    }));
    const { parajes } = reparte({ libres: apinados, radius: 1000 });
    assert.equal(parajes.length, 1, `se han colocado ${parajes.length} parajes dentro de la separación mínima`);
  });

  test('Ningún paraje cae en el mar ni fuera de la celda', async () => {
    for (const semilla of LAS_DOS_SEMILLAS) {
      const w = await generaMundo('costero', semillaDe('costero', semilla));
      for (const p of w.parajes) {
        assert.equal(isSea(w.seaMask, p), false, `costero#${semilla}: el paraje ${p.name} ha caído en el mar`);
        assert.ok(Math.hypot(p.x, p.y) < w.radius, `costero#${semilla}: el paraje ${p.name} ha caído fuera de la celda`);
      }
    }
  });

  test('La ficha de un paraje trae tipo, etiqueta visible, escenas con pesos, posición y origen', async () => {
    const w = await generaMundo('costero', semillaDe('costero', '1'));
    assert.ok(w.parajes.length > 0);
    for (const p of w.parajes) {
      assert.ok([...ANCHORED_TYPES, ...GRAPH_TYPES].includes(p.type), `tipo desconocido "${p.type}"`);
      assert.equal(p.label, PARAJE_INFO[p.type].label);
      assert.deepEqual(p.scenes, PARAJE_INFO[p.type].scenes, `${p.name}: las escenas no son las de su tipo`);
      assert.equal(typeof p.name, 'string');
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(['anclaje', 'grafo'].includes(p.origin), `${p.name}: origen "${p.origin}"`);
      if (p.origin === 'anclaje') assert.ok(p.real?.osmId, `${p.name}: sale de un anclaje y no lo declara`);
      else assert.equal(p.real, null);
    }
  });

  test('Los pesos de escena de los ocho tipos coinciden con game-design/parajes.md', () => {
    // Se leen del documento de diseño en vez de copiarlos aquí: el diseño manda
    // sobre el código, y una tabla copiada a mano deja de ser una comprobación en
    // cuanto alguien toca el documento.
    const tabla = new Map();
    for (const linea of fuente('game-design/parajes.md').split('\n')) {
      const m = linea.match(/^\|\s*([A-ZÁÉÍÓÚ][^|]*?)\s*\|\s*([a-záéíóú]+ 0[.,]\d[^|]*?)\s*\|/);
      if (!m) continue;
      const escenas = {};
      for (const trozo of m[2].split('·')) {
        const [, escena, peso] = trozo.trim().match(/^(\S+)\s+([0-9.]+)$/) ?? [];
        if (escena) escenas[escena] = Number(peso);
      }
      tabla.set(m[1], escenas);
    }
    assert.equal(tabla.size, 8, `el documento ya no declara los ocho tipos: ${[...tabla.keys()].join(', ')}`);

    for (const [nombreDoc, escenas] of tabla) {
      const clave = Object.keys(PARAJE_INFO).find((k) => PARAJE_INFO[k].label.startsWith(nombreDoc));
      assert.ok(clave, `el tipo "${nombreDoc}" del documento no existe en la taxonomía`);
      assert.deepEqual(PARAJE_INFO[clave].scenes, escenas, `los pesos de "${nombreDoc}" no son los del documento de diseño`);
    }
    assert.equal(Object.keys(PARAJE_INFO).length, 8, 'la taxonomía tiene tipos que el documento no declara');
  });
});

describe('Determinismo y frontera de la fase de parajes', () => {
  test('La fase de parajes siembra con su propio sufijo y no usa ninguna otra fuente de azar ni de tiempo', () => {
    const texto = fuente('packages/nucleo/world/parajes.js');
    assert.match(texto, /makeRng\(seedStr \+ SUFIJOS_DE_FASE\.parajes\)/, 'la fase no siembra con su sufijo de fase');
    assert.equal((texto.match(/makeRng\(/g) ?? []).length, 1, 'la fase abre más de un generador');
    for (const prohibido of [/Math\s*\.\s*random/, /Date\s*\.\s*now/, /new Date\(/, /performance\s*\.\s*now/]) {
      assert.equal(prohibido.test(texto), false, `la fase de parajes usa ${prohibido}`);
    }
  });

  test('Los mismos datos y la misma semilla dan los mismos parajes', () => {
    const libres = anclajes(20, { radius: 2000 });
    const routes = dosRutasQueSeCruzan();
    const uno = reparte({ libres, routes, radius: 2000, semilla: 'repetible#1' });
    const otro = reparte({ libres, routes, radius: 2000, semilla: 'repetible#1' });
    assert.equal(JSON.stringify(otro.parajes), JSON.stringify(uno.parajes), 'dos repartos con la misma semilla difieren');
    assert.equal(JSON.stringify(otro.ficha), JSON.stringify(uno.ficha), 'dos fichas de cobertura con la misma semilla difieren');

    // Y el vocabulario, que es lo que entra por la frontera nueva, se normaliza:
    // llegue en el orden que llegue, el mundo es el mismo.
    const alReves = [...VOCABULARIO].reverse();
    const permutado = reparte({ libres, routes, radius: 2000, semilla: 'repetible#1', vocabulario: alReves });
    assert.equal(JSON.stringify(permutado.parajes), JSON.stringify(uno.parajes), 'el orden del vocabulario cambia el mundo');
    assert.deepEqual(normalizaVocabulario(alReves), VOCABULARIO);
  });
});
