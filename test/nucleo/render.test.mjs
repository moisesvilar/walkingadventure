// SPEC-021 · El render partido en dos: componer una escena de datos y ejecutarla en
// Skia, con los cinco estilos como objetos de datos.
//
// Casi todo se afirma **componiendo escenas de verdad** sobre los ocho mundos de
// referencia, sin simulador y sin dependencias: la partición que entrega la spec es
// justamente lo que lo hace posible, y por eso las pruebas viven aquí y no en
// `test/app/`. Lo que sí se lee del código fuente, y solo eso, son las tres
// afirmaciones que son sobre el código y no sobre su resultado: que en el módulo de
// dibujo no hay ni un color, ni un grosor, ni una tipografía; que el que compone no
// nombra ningún estilo; y que añadir un estilo no toca ninguno de los dos.
//
// Escenarios de docs/testing.md que se reutilizan aquí, con su nombre literal:
// «Cambiar el estilo de pintado no resiembra nada» (@nucleo @determinismo, el que
// manda), y de la característica «En marcha no hay nada que tocar» —que es @app— la
// mitad que el render sí puede poner roja sin dispositivo: «La pantalla del mapa no
// tiene ni un control», «No se enseña ninguna cifra de esfuerzo», «El mapa no cambia
// durante la salida» y «El norte está siempre arriba». La otra mitad, la del
// dispositivo, sigue siendo @app y en esta máquina no hay dónde ejecutarla.
//
// El resto de criterios de la spec no tienen escenario en la batería y van marcados
// como hueco declarado en test/spec-test-map.json.
//
// La paridad de pintado es @manual y no está aquí. Lo que sí está es su mitad
// automática: los cinco objetos de estilo, clave a clave, contra el prototipo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  componeEscena,
  PLAN_DE_CAPAS,
  SUFIJO_DE_RENDER,
  TAMANO_DE_ROTULO,
} from '../../packages/nucleo/render/escena.js';
import {
  ESTILOS,
  ESTILO_POR_DEFECTO,
  POR_DEFECTO,
  creaCatalogo,
  fusiona,
  resuelveEstilo,
  tipografiasDeCatalogo,
  tipografiasDeEstilo,
} from '../../packages/nucleo/render/estilos.js';
import { medidorNominal } from '../../packages/nucleo/render/medidor-nominal.js';
import { COLOCADOR_SIMPLE, colocadorSimple, solapes } from '../../packages/nucleo/render/colocador-simple.js';
import { makeRng } from '../../packages/nucleo/core/rng.js';
import { isSea } from '../../packages/nucleo/world/seamask.js';
import { STYLES, DEFAULT_STYLE } from '../../prototipo/js/render/styles.js';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { LAS_DOS_SEMILLAS, LOS_CUATRO, fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';

/** El hueco de una pantalla de móvil, que es donde vive la lámina. */
const TAMANO = { ancho: 390, alto: 780 };

/**
 * Cómo se llamaría un ángulo si alguien metiera uno. Es lo que hace comprobable «el
 * norte está siempre arriba» sin enumerar la firma entera: lo que la lámina no puede
 * tener es una manera de pedir que gire, se llame como se llame.
 */
const VOCABULARIO_DE_ANGULO = /angul|ángul|rot|giro|bearing|rumbo|heading|orientaci|azimut|acimut|brujula|brújula|norte/i;

/**
 * Lo que este porte añade sobre los cinco estilos del prototipo, declarado.
 *
 * La paridad clave a clave sigue siendo estricta —cualquier otra clave de más o de
 * menos pone el caso rojo—, pero las altas deliberadas se declaran aquí en lugar de
 * llevar la lista entera copiada: `tintas` es de SPEC-036, que llena la capa 17 con
 * tres claves de estilo para que ningún color viva en el código de dibujo.
 */
const ALTAS_SOBRE_EL_PROTOTIPO = ['tintas'];

/** Los dos módulos de los que la spec afirma cosas sobre su código, no sobre su salida. */
const DIBUJO = 'app/render/skia.js';
const COMPOSICION = 'packages/nucleo/render/escena.js';

/** Los ocho mundos de referencia: los cuatro extractos por sus dos semillas. */
const LOS_OCHO = LOS_CUATRO.flatMap((nombre) => LAS_DOS_SEMILLAS.map((s) => ({ nombre, s })));

// Generar los ocho cuesta segundos y las pruebas los comparten: el render nunca
// muta el documento, y que no lo mute es cosa que se afirma más abajo.
const cache = new Map();
async function documentoDe(nombre = 'costero', s = '1') {
  const clave = `${nombre}#${s}`;
  if (!cache.has(clave)) cache.set(clave, await generaMundo(nombre, semillaDe(nombre, s)));
  return cache.get(clave);
}

function compone(documento, estilo = ESTILO_POR_DEFECTO, extra = {}) {
  return componeEscena({ documento, estilo, tamano: TAMANO, medidor: medidorNominal, colocador: colocadorSimple, ...extra });
}

/** La escena sin su pintura: lo que tiene que sobrevivir a un cambio de estilo. */
function geometria(escena) {
  return escena.primitivas.map(({ pintura, ...resto }) => resto);
}

/** Solo la pintura, en orden. */
function pinturas(escena) {
  return escena.primitivas.map((p) => p.pintura ?? null);
}

const cuantas = (escena, capa) => escena.primitivas.filter((p) => p.capa === capa).length;

/** El código de un módulo sin comentarios: lo que se afirma es lo que se ejecuta. */
function codigo(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Las cadenas literales de un módulo. */
function cadenasDe(texto) {
  return [...texto.matchAll(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g)].map((m) => m[0]);
}

const sha = (texto) => createHash('sha256').update(texto).digest('hex');

// ── Lo generado no se resiembra jamás ────────────────────────────────────────────

describe('Lo generado no se resiembra jamás', () => {
  test('Cambiar el estilo de pintado no resiembra nada', async () => {
    // El escenario que manda de esta fila (RF-MAPA-001, @determinismo y por tanto
    // bloqueante). La mitad del documento ya la afirmaba SPEC-009; la que se añade
    // aquí es la del render, y tiene un matiz que hay que decir bien: entre dos
    // estilos con `margin` o `shape` distintos **la geometría sí cambia**, porque el
    // encuadre es del estilo. Lo que no puede cambiar es el mundo.
    const documento = await documentoDe('costero', '1');
    const antes = JSON.stringify(documento);

    const reino = compone(documento, 'reino');
    const pergamino = compone(documento, 'pergamino');

    assert.equal(JSON.stringify(documento), antes, 'componer con otro estilo ha tocado el documento de celda');
    assert.equal(reino.documentoId, pergamino.documentoId, 'el repintado no ha recibido el mismo documento');
    assert.equal(reino.documentoId, documento.seed);

    // Y solo cambian los colores, los grosores y las tipografías: se repinta Reino
    // con otra paleta, sin tocar ni el encuadre ni la tipografía, que es la única
    // comparación en la que «la geometría es la misma» significa algo.
    const repintado = compone(documento, repinteDeReino(), { catalogo: creaCatalogo([repinteDeReino()]) });
    assert.deepEqual(geometria(repintado), geometria(reino), 'repintar con otra paleta ha movido la geometría');
    assert.notDeepEqual(pinturas(repintado), pinturas(reino), 'el repintado no ha cambiado ni una pintura: la prueba sería vacía');
    assert.deepEqual(
      repintado.rotulos.map((r) => [r.id, r.x, r.y]),
      reino.rotulos.map((r) => [r.id, r.x, r.y]),
      'repintar ha movido los rótulos',
    );
  });

  test('Volver al estilo de partida devuelve la escena de partida, primitiva a primitiva', async () => {
    const documento = await documentoDe('urbano-denso', '1');
    const antes = JSON.stringify(documento);

    const primera = compone(documento, 'reino');
    compone(documento, 'pergamino');
    compone(documento, 'atlas');
    const vuelta = compone(documento, 'reino');

    assert.deepEqual(vuelta.primitivas, primera.primitivas, 'ir y volver de estilo no devuelve la misma escena');
    assert.deepEqual(vuelta.rotulos, primera.rotulos);
    assert.equal(JSON.stringify(documento), antes, 'pasear por cuatro estilos ha tocado el documento');
  });

  test('Cambiar el estilo no ejecuta ninguna fase de generación ni pide nada a la red', async () => {
    const documento = await documentoDe('costero', '2');
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      for (const estilo of ESTILOS) compone(documento, estilo.id);
      assert.deepEqual(inspector.peticiones(), [], 'componer la escena ha salido a la red');
    } finally {
      inspector.suelta();
    }

    // Y no hay ninguna fase de generación al alcance: el módulo que compone importa
    // el RNG, la geometría y la máscara, y nada de la tubería.
    const importados = [...codigo(COMPOSICION).matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(importados.sort(), ['../core/geo.js', '../core/rng.js', '../world/seamask.js', './estilos.js']);
  });
});

/** Reino con otra paleta y otros grosores, y con el mismo encuadre y la misma letra. */
function repinteDeReino() {
  const reino = ESTILOS.find((e) => e.id === 'reino');
  return fusiona({
    ...reino,
    id: 'reino-repintado',
    title: 'Reino repintado',
    outside: '#000001',
    paper: { ...reino.paper, base: '#000002' },
    land: { ...reino.land, fill: '#000003' },
    ink: '#000004',
    inkSoft: '#000005',
    accent: '#000006',
    water: { ...reino.water, lake: '#000007', river: '#000008', riverW: 11 },
    coast: { ...reino.coast, line: '#000009' },
    route: { ...reino.route, casing: '#00000a', fill: '#00000b', casingW: 9 },
    glyph: { ...reino.glyph, fill: '#00000c', stroke: '#00000d' },
    label: { ...reino.label, color: '#00000e', halo: '#00000f' },
    placa: { ...reino.placa, fill: '#000010', color: '#000011' },
    cartouche: { ...reino.cartouche, fill: '#000012' },
    frame: { ...reino.frame, color: '#000013', gold: '#000014' },
  });
}

// ── En marcha no hay nada que tocar ─────────────────────────────────────────────

describe('En marcha no hay nada que tocar', () => {
  test('La pantalla del mapa no tiene ni un control', () => {
    // La mitad de esta fila: la lámina es un elemento pasivo. El estilo se cambia
    // desde los ajustes (fila 38) y en ningún otro sitio, así que ni la lámina ni el
    // ejecutor pueden llevar nada tocable encima.
    for (const modulo of ['app/render/lamina.jsx', DIBUJO]) {
      const texto = codigo(modulo);
      for (const control of [/onPress/, /<Button\b/, /<Pressable\b/, /Touchable(Opacity|Highlight)/, /<Switch\b/, /<TextInput\b/]) {
        assert.equal(control.test(texto), false, `${modulo}: la lámina lleva un control encima (${control})`);
      }
    }
    // Y no hay leyenda en ninguna capa: lo que hay que explicar con una leyenda está
    // mal dibujado.
    assert.deepEqual(PLAN_DE_CAPAS.filter((c) => /leyenda/i.test(c.nombre)), []);
  });

  test('No se enseña ninguna cifra de esfuerzo', async () => {
    // La barra de escala existe en el estilo y **está apagada en todas las pantallas
    // del juego**: una escala cartográfica dice «250 varas (250 m)», que es una cifra
    // de distancia. Solo la enciende la pantalla de revisión, que no es del juego.
    const documento = await documentoDe('costero', '1');
    for (const estilo of ESTILOS) {
      assert.equal(estilo.escala, true, `${estilo.id}: el estilo tiene que conservar la barra para la revisión de paridad`);
      for (const vista of [null, { cx: 0, cy: 0, r: documento.radius, foco: null, paraje: null, escala: false }]) {
        const escena = compone(documento, estilo.id, { vista });
        assert.equal(cuantas(escena, 'escala'), 0, `${estilo.id}: la barra de escala se ha pintado en una vista de juego`);
        const textos = escena.primitivas.filter((p) => p.tipo === 'texto').map((p) => p.texto);
        for (const cadena of textos) {
          assert.doesNotMatch(cadena, /\d+\s*(km|m|min|pasos|%|varas|leguas)\b/i, `${estilo.id}: la lámina enseña una cifra de esfuerzo: "${cadena}"`);
        }
      }
    }

    // Encendida, la barra sí trae su cifra: es lo que demuestra que apagarla importa.
    const revision = compone(documento, 'reino', { vista: { cx: 0, cy: 0, r: documento.radius, foco: null, paraje: null, escala: true } });
    const leyenda = revision.primitivas.filter((p) => p.capa === 'escala' && p.tipo === 'texto');
    assert.equal(leyenda.length, 1);
    assert.match(leyenda[0].texto, /\d+\s*(varas|leguas)/);

    // Y en toda la app, el único sitio que la enciende es la pantalla de revisión.
    const enciende = ['app/render/lamina.jsx', 'app/render/skia.js', 'app/pantallas/revision-render.jsx']
      .filter((m) => /escala:\s*true/.test(codigo(m)));
    assert.deepEqual(enciende, ['app/pantallas/revision-render.jsx'], 'la barra de escala se enciende fuera de la pantalla de revisión');
  });

  test('El mapa no cambia durante la salida', async () => {
    // La mitad que le toca al render: pintar dos veces el mismo documento con el
    // mismo estilo, el mismo tamaño y la misma vista da la misma escena. Que durante
    // la salida no se genere nada es de la fila 29.
    for (const { nombre, s } of LOS_OCHO) {
      const documento = await documentoDe(nombre, s);
      const a = compone(documento, 'reino');
      const b = compone(documento, 'reino');
      assert.deepEqual(b.primitivas, a.primitivas, `${nombre}#${s}: dos composiciones del mismo mundo no dan la misma escena`);
      assert.deepEqual(b.rotulos, a.rotulos);
    }
  });

  test('El norte está siempre arriba', async () => {
    // No hay manera de pedir que la lámina rote: la vista es centro, radio y escala,
    // y no lleva ningún ángulo. Las únicas rotaciones de la escena son las de los
    // rótulos de camino, que siguen el trazo de su calzada.
    const documento = await documentoDe('urbano-denso', '1');
    for (const estilo of ESTILOS) {
      const escena = compone(documento, estilo.id);
      assert.deepEqual(Object.keys(escena.vista), ['cx', 'cy', 'r', 'escala'], `${estilo.id}: la vista expone algo más que centro, radio y escala`);
      for (const p of escena.primitivas) {
        if (p.tipo === 'transforma' && p.rot !== 0) {
          assert.equal(p.capa, 'rotulos', `${estilo.id}: hay una rotación fuera de los rótulos, en la capa "${p.capa}"`);
        }
      }
    }
    // Y la firma de la composición **no admite ningún ángulo**, que es la propiedad y
    // no el inventario: lo que este caso vigila es que no haya por dónde pedir una
    // rotación, no cuántos parámetros hay. Con la lista literal, cada fila que añadía
    // una entrada —`entintado` y `telon` en SPEC-036— ponía rojo un caso que habla del
    // norte, y arreglarlo era copiar el nombre nuevo sin mirar qué significaba.
    const firma = codigo(COMPOSICION).match(/export function componeEscena\(\{([\s\S]*?)\}\)/)[1];
    const parametros = firma.split(',').map((t) => t.split('=')[0].trim()).filter(Boolean);
    assert.ok(parametros.length >= 8, 'la firma de componeEscena no se ha podido leer');
    const angulos = parametros.filter((p) => VOCABULARIO_DE_ANGULO.test(p));
    assert.deepEqual(angulos, [], `componeEscena admite un parámetro que es un ángulo: ${angulos.join(', ')}`);
    // Y la comprobación se puede poner roja: un parámetro que fuera un ángulo lo haría.
    assert.ok(VOCABULARIO_DE_ANGULO.test('rumbo'), 'el vocabulario de ángulo no reconocería un ángulo si lo hubiera');
  });
});

// ── Componer y pintar ───────────────────────────────────────────────────────────

describe('Componer y pintar', () => {
  test('Cada primitiva lleva ya resuelto su color, su grosor y su tipografía', async () => {
    const documento = await documentoDe('costero', '1');
    const escena = compone(documento, 'pergamino');
    assert.ok(escena.primitivas.length > 0);
    for (const p of escena.primitivas) {
      if (['guarda', 'restaura', 'recorta', 'transforma', 'trama', 'degradadoRadial'].includes(p.tipo)) continue;
      assert.ok(p.pintura, `una primitiva "${p.tipo}" llega sin pintura`);
      if (p.tipo === 'texto') {
        assert.equal(typeof p.pintura.familia, 'string', 'un texto llega sin tipografía resuelta');
        assert.equal(Number.isFinite(p.pintura.tamano), true, 'un texto llega sin tamaño resuelto');
        assert.equal(typeof p.pintura.relleno, 'string', 'un texto llega sin color resuelto');
      } else {
        assert.ok(p.pintura.relleno || p.pintura.trazo, `una primitiva "${p.tipo}" llega sin color`);
        if (p.pintura.trazo) assert.equal(Number.isFinite(p.pintura.grosor), true, `una primitiva "${p.tipo}" llega sin grosor`);
      }
    }
  });

  test('El orden de las capas es el del plan y ninguna se pinta antes de la que la precede', async () => {
    const esperado = [
      'fuera', 'papel', 'tierra', 'brujula-detras', 'bosques', 'picos', 'mar', 'lagos', 'rios',
      'costa', 'carreteras', 'callejero', 'calzadas', 'glifos-paraje', 'glifos-nucleo',
      'marcadores-servicio', 'entintado', 'rotulos', 'vinneteo', 'marco', 'brujula-delante',
      'cartela', 'escala',
    ];
    assert.deepEqual(PLAN_DE_CAPAS.map((c) => c.nombre), esperado, 'el plan de capas no es el que declara la spec');
    assert.deepEqual(PLAN_DE_CAPAS.map((c) => c.n), esperado.map((_, i) => i + 1));
    assert.equal(PLAN_DE_CAPAS[16].nombre, 'entintado', 'la fila 17 está reservada para el entintado de la fila 36');

    const documento = await documentoDe('costero', '1');
    for (const estilo of ESTILOS) {
      const escena = compone(documento, estilo.id);
      // Monótona y contigua: los rótulos son una única pasada posterior a toda la
      // geometría, y ninguna capa se cuela dentro de otra.
      const vistas = [];
      let previa = 0;
      for (const p of escena.primitivas) {
        assert.ok(p.n >= previa, `${estilo.id}: la capa "${p.capa}" se pinta antes que la anterior`);
        if (p.n !== previa) {
          assert.equal(vistas.includes(p.n), false, `${estilo.id}: la capa "${p.capa}" se pinta en dos tandas`);
          vistas.push(p.n);
          previa = p.n;
        }
      }
      assert.equal(cuantas(escena, 'entintado'), 0, `${estilo.id}: la fila reservada del entintado ya pinta algo`);
    }
  });

  test('El azar del pintado sale de makeRng(semilla + \':render\') y de ninguna otra fuente', async () => {
    assert.equal(SUFIJO_DE_RENDER, ':render');
    const documento = await documentoDe('costero', '1');
    const escena = compone(documento, 'pergamino');
    const papel = escena.primitivas.filter((p) => p.capa === 'papel');

    // El primer grano del papel, reproducido a mano con el mismo RNG: color, radio y
    // sitio, en ese orden. Si el pintado sembrara de otra fuente, no coincidiría.
    const rng = makeRng(documento.seed + SUFIJO_DE_RENDER);
    const grano = ESTILOS.find((e) => e.id === 'pergamino').paper.grain;
    const claro = rng() < 0.5 ? grano.dark : grano.light;
    const radio = 1 + rng() * grano.rMax;
    const x = rng() * TAMANO.ancho;
    const y = rng() * TAMANO.alto;

    assert.equal(papel[0].tipo, 'rect', 'la capa del papel no empieza por el papel');
    assert.deepEqual(
      { tipo: papel[1].tipo, cx: papel[1].cx, cy: papel[1].cy, r: papel[1].r, color: papel[1].pintura.relleno },
      { tipo: 'circulo', cx: x, cy: y, r: radio, color: claro },
      'el grano del papel no sale de makeRng(semilla + \':render\')',
    );

    // Y no hay ninguna otra siembra: una sola llamada a makeRng en todo el módulo.
    const siembras = [...codigo(COMPOSICION).matchAll(/makeRng\(([^)]*)\)/g)].map((m) => m[1].trim());
    assert.deepEqual(siembras, ['semilla + SUFIJO_DE_RENDER'], 'el pintado siembra desde más de un sitio');
    for (const prohibido of [/Math\.random/, /Date\.now/, /new Date\(/, /performance\.now/]) {
      assert.equal(prohibido.test(codigo(COMPOSICION)), false, `el pintado usa una fuente de azar o de tiempo del sistema (${prohibido})`);
    }
  });

  test('El módulo que compone no importa nada de React Native ni de Skia y corre en Node', () => {
    // Que corre en Node lo demuestra esta prueba misma, que lo ha importado.
    for (const modulo of [COMPOSICION, 'packages/nucleo/render/estilos.js', 'packages/nucleo/render/colocador-simple.js', 'packages/nucleo/render/medidor-nominal.js']) {
      const texto = codigo(modulo);
      for (const patron of [/react-native/, /\breact\b/, /@shopify\/react-native-skia/, /\bSkia\b/, /StyleSheet/, /'expo/, /\bexpo-/]) {
        assert.equal(patron.test(texto), false, `${modulo}: importa o nombra plataforma (${patron})`);
      }
      for (const m of texto.matchAll(/from\s+'([^']+)'/g)) {
        assert.match(m[1], /^\.{1,2}\//, `${modulo}: importa "${m[1]}", que hay que resolver con una instalación`);
      }
    }
  });

  test('Sobre el agua no queda pintado ningún árbol ni ningún pico', async () => {
    const documento = await documentoDe('costero', '1');
    const mascara = documento.seaMask;
    assert.ok(mascara, 'el mundo costero de referencia tiene que traer máscara de mar');

    const enMar = puntoDeLaMascara(mascara, documento.radius, true);
    const enTierra = puntoDeLaMascara(mascara, documento.radius, false);
    const base = compone(documento, 'cuento');

    const conMar = compone(conBosqueYPico(documento, enMar), 'cuento');
    assert.equal(cuantas(conMar, 'bosques'), cuantas(base, 'bosques'), 'un bosque plantado en el mar se ha pintado');
    assert.equal(cuantas(conMar, 'picos'), cuantas(base, 'picos'), 'un pico plantado en el mar se ha pintado');

    // Y la prueba no es vacía: el mismo bosque y el mismo pico en tierra sí se pintan.
    const conTierra = compone(conBosqueYPico(documento, enTierra), 'cuento');
    assert.ok(cuantas(conTierra, 'bosques') > cuantas(base, 'bosques'), 'un bosque en tierra tampoco se pinta: la prueba no distingue nada');
    assert.ok(cuantas(conTierra, 'picos') > cuantas(base, 'picos'), 'un pico en tierra tampoco se pinta');

    // La segunda medida, que es la que tapa lo que se derrame por el borde: el mar se
    // pinta después de bosques y picos.
    const n = (nombre) => PLAN_DE_CAPAS.find((c) => c.nombre === nombre).n;
    assert.ok(n('mar') > n('bosques') && n('mar') > n('picos'), 'el mar se pinta antes que la vegetación y el relieve');
  });
});

/** Un punto del mundo que la máscara dice que es mar, o que es tierra. */
function puntoDeLaMascara(mascara, radio, quieroMar) {
  const paso = (2 * mascara.extent) / mascara.n;
  for (let j = 0; j < mascara.n; j++) {
    for (let i = 0; i < mascara.n; i++) {
      const p = { x: -mascara.extent + (i + 0.5) * paso, y: -mascara.extent + (j + 0.5) * paso };
      if (Math.hypot(p.x, p.y) > radio * 0.6) continue;
      if (isSea(mascara, p) === quieroMar) return p;
    }
  }
  throw new Error(`la máscara del mundo no tiene ningún punto ${quieroMar ? 'de mar' : 'de tierra'} dentro del radio`);
}

/** El mismo documento con un bosque y un pico añadidos en un punto concreto. */
function conBosqueYPico(documento, p) {
  const L = 120;
  return {
    ...documento,
    geo: {
      ...documento.geo,
      forests: [...documento.geo.forests, { pts: [{ x: p.x - L, y: p.y - L }, { x: p.x + L, y: p.y - L }, { x: p.x + L, y: p.y + L }, { x: p.x - L, y: p.y + L }] }],
      peaks: [...documento.geo.peaks, { x: p.x, y: p.y, ele: 400 }],
    },
  };
}

// ── Lo que el dibujo no puede contener ──────────────────────────────────────────

describe('Lo que el dibujo no puede contener', () => {
  // Los nombres de color de CSS que alguien escribiría a mano, más los castellanos.
  // No es la lista completa de CSS a propósito: la lista completa mete palabras
  // corrientes —`tan`, `plum`— que darían rojos falsos sobre prosa en español.
  const NOMBRES_DE_COLOR = [
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'gray', 'grey', 'brown',
    'pink', 'cyan', 'magenta', 'gold', 'silver', 'beige', 'ivory', 'teal', 'navy', 'olive', 'maroon',
    'lime', 'aqua', 'fuchsia', 'crimson', 'salmon', 'khaki', 'coral', 'indigo', 'violet', 'turquoise',
    'transparent', 'negro', 'blanco', 'rojo', 'verde', 'azul', 'amarillo', 'dorado', 'sepia',
  ];
  const ES_COLOR = new RegExp(`^(${NOMBRES_DE_COLOR.join('|')})$`, 'i');

  test('En el módulo que ejecuta el dibujo no aparece ni un literal de color', () => {
    const texto = codigo(DIBUJO);
    assert.doesNotMatch(texto, /#[0-9a-fA-F]{3,8}\b/, `${DIBUJO}: hay un color en hexadecimal`);
    assert.doesNotMatch(texto, /\b(rgb|rgba|hsl|hsla)\s*\(/, `${DIBUJO}: hay un color en rgb() o hsl()`);
    for (const cadena of cadenasDe(texto)) {
      const dentro = cadena.slice(1, -1);
      assert.doesNotMatch(dentro, /#[0-9a-fA-F]{3,8}/, `${DIBUJO}: la cadena ${cadena} es un color`);
      assert.equal(ES_COLOR.test(dentro.trim()), false, `${DIBUJO}: la cadena ${cadena} es un nombre de color`);
    }
    // Todo color que se pinta sale de la escena: cada Skia.Color recibe una
    // propiedad de la primitiva, nunca un literal.
    const colores = [...texto.matchAll(/Skia\.Color\(([^)]*)\)/g)].map((m) => m[1].trim());
    assert.ok(colores.length > 0, 'el ejecutor no pinta ningún color: la comprobación sería vacía');
    for (const argumento of colores) {
      assert.doesNotMatch(argumento, /['"`#]/, `${DIBUJO}: Skia.Color recibe el literal "${argumento}"`);
      assert.match(argumento, /\.(color|relleno|trazo)\b/, `${DIBUJO}: Skia.Color recibe "${argumento}", que no es un color que traiga la escena`);
    }
  });

  test('En el módulo que ejecuta el dibujo no aparece ni un grosor ni una tipografía escritos a mano', () => {
    const texto = codigo(DIBUJO);

    // Ningún grosor ni tamaño literal: el ancho de trazo sale siempre de la pintura.
    for (const patron of [/setStrokeWidth\(\s*[\d.]/, /setTextSize\s*\(/, /fontSize/, /fontFamily/]) {
      assert.equal(patron.test(texto), false, `${DIBUJO}: hay un grosor o un tamaño escrito a mano (${patron})`);
    }
    for (const argumento of [...texto.matchAll(/setStrokeWidth\(([^)]*)\)/g)].map((m) => m[1].trim())) {
      assert.match(argumento, /^(pintura|tipografia)\./, `${DIBUJO}: setStrokeWidth recibe "${argumento}", que no viene de la escena`);
    }

    // Ninguna familia tipográfica: la fuente llega resuelta por el proveedor inyectado.
    for (const patron of [/\bserif\b/, /sans-serif/, /monospace/, /cursive/, /Georgia/, /Cinzel/, /Caveat/, /MedievalSharp/, /IM Fell/]) {
      assert.equal(patron.test(texto), false, `${DIBUJO}: hay una tipografía escrita a mano (${patron})`);
    }

    // Y el cerrojo que hace que meter un número nuevo se ponga rojo: los únicos
    // números del ejecutor son 0 y 1, los índices de las operaciones de camino, el
    // 2 del diámetro de la elipse y las dos constantes con nombre.
    const sinIndices = texto.replace(/\[\s*\d+\s*\]/g, '[]');
    const numeros = [...new Set([...sinIndices.matchAll(/(?<![\w.$])\d+(?:\.\d+)?/g)].map((m) => m[0]))].sort();
    assert.deepEqual(numeros, ['0', '1', '180', '2', '4'].sort(), `${DIBUJO}: hay números que no son ni 0, ni 1, ni las dos constantes con nombre`);
    for (const numero of ['180', '4']) {
      const lineas = sinIndices.split('\n').filter((l) => new RegExp(`(?<![\\w.$])${numero}(?![\\d.])`).test(l));
      assert.equal(lineas.length, 1, `${DIBUJO}: el número ${numero} aparece fuera de su constante con nombre`);
      assert.match(lineas[0], /^const [A-Z_]+ =/, `${DIBUJO}: el número ${numero} no está detrás de una constante con nombre`);
    }
  });

  test('En el módulo que ejecuta el dibujo no aparece ninguna decisión de capa ni de estilo', () => {
    const texto = codigo(DIBUJO);
    for (const patron of [/\bcapas\b/, /\bestilo\b/, /\bplaca\b/, /\blabel\b/, /POR_DEFECTO/, /ESTILOS/]) {
      assert.equal(patron.test(texto), false, `${DIBUJO}: consulta el estilo (${patron})`);
    }
    assert.doesNotMatch(texto, /from\s+'[^']*estilos/, `${DIBUJO}: importa el catálogo de estilos`);
    // Ni un cálculo de posición de rótulo: el texto se escribe donde diga la escena.
    for (const patron of [/\bancla\b/, /\bcolocador\b/, /medida\.ancho/, /\bcolocaR/]) {
      assert.equal(patron.test(texto), false, `${DIBUJO}: calcula la posición de un rótulo (${patron})`);
    }
    assert.match(texto, /canvas\.drawText\(p\.texto, p\.x, p\.y/, `${DIBUJO}: el texto no se escribe en la posición que trae la escena`);
  });

  test('En el módulo que compone la escena no aparece el identificador de ningún estilo', () => {
    const texto = codigo(COMPOSICION);
    for (const estilo of [...ESTILOS, ...STYLES]) {
      assert.equal(texto.includes(`'${estilo.id}'`), false, `${COMPOSICION}: nombra el estilo "${estilo.id}"`);
      assert.equal(texto.includes(`"${estilo.id}"`), false, `${COMPOSICION}: nombra el estilo "${estilo.id}"`);
    }
  });
});

// ── Los cinco estilos ───────────────────────────────────────────────────────────

describe('Los cinco estilos', () => {
  test('El catálogo tiene exactamente cinco entradas y Reino es el de por defecto', () => {
    assert.equal(ESTILOS.length, 5);
    assert.deepEqual(ESTILOS.map((e) => e.id), ['reino', 'clasico', 'pergamino', 'cuento', 'atlas']);
    assert.deepEqual(ESTILOS.map((e) => e.title), ['Reino', 'Clásico', 'Pergamino', 'Cuento', 'Atlas']);
    assert.equal(ESTILO_POR_DEFECTO, 'reino');
    assert.equal(resuelveEstilo(undefined).estilo.id, 'reino');
    assert.equal(ESTILO_POR_DEFECTO, DEFAULT_STYLE, 'el estilo por defecto no es el del prototipo');
  });

  test('Los cinco estilos son idénticos clave a clave a los del prototipo', () => {
    // La mitad automática de la paridad visual, que es la que sí se puede afirmar.
    // Cubre la paleta entera, todos los grosores, todas las tipografías, las esquinas
    // de brújula, los modos de marco y de cartela y el contenido de `capas`.
    assert.equal(ESTILOS.length, STYLES.length, 'el porte no tiene los mismos estilos que el prototipo');
    for (const portado of ESTILOS) {
      const original = STYLES.find((e) => e.id === portado.id);
      assert.ok(original, `el prototipo no tiene el estilo "${portado.id}"`);
      const claves = Object.keys(portado).sort();
      const esperadas = [...Object.keys(original), ...ALTAS_SOBRE_EL_PROTOTIPO].sort();
      assert.deepEqual(claves, esperadas, `${portado.id}: las claves no son las del prototipo más las altas declaradas`);
      assert.equal(claves.length, Object.keys(original).length + ALTAS_SOBRE_EL_PROTOTIPO.length, `${portado.id}: sobra o falta alguna clave`);
      for (const clave of claves) {
        if (ALTAS_SOBRE_EL_PROTOTIPO.includes(clave)) continue;
        assert.deepEqual(portado[clave], original[clave], `${portado.id}: la clave "${clave}" no es la del prototipo`);
      }
      // Y el alta no es una excusa para que falte: los cinco declaran las tres tintas
      // con su color, su grosor y su alfa (SPEC-036, RF-MAPA-001 aplicado a la capa 17).
      assert.deepEqual(Object.keys(portado.tintas).sort(), ['aLapiz', 'asentado', 'deHoy'], `${portado.id}: no declara las tres tintas`);
      for (const [tinta, valores] of Object.entries(portado.tintas)) {
        assert.match(valores.color, /^#[0-9a-f]{6}$/i, `${portado.id}: la tinta "${tinta}" no declara color`);
        assert.ok(Number.isFinite(valores.grosor) && valores.grosor > 0, `${portado.id}: la tinta "${tinta}" no declara grosor`);
        assert.ok(Number.isFinite(valores.alfa) && valores.alfa > 0 && valores.alfa <= 1, `${portado.id}: la tinta "${tinta}" no declara alfa`);
      }
    }
  });

  test('La fusión es de dos niveles y lo que un estilo no declara le llega de los valores por defecto', () => {
    // Las tres trampas documentadas en CLAUDE.md, cada una con su aserción.
    const soloLoSuyo = fusiona({ id: 'niebla', title: 'Niebla', outside: '#101010', label: { color: '#202020' } });

    // 1 · `label` es la tipografía; el nombre visible es `title`.
    assert.equal(soloLoSuyo.title, 'Niebla');
    assert.equal(typeof soloLoSuyo.label, 'object', 'el nombre visible ha machacado la tipografía de los rótulos');
    assert.equal(soloLoSuyo.label.family, POR_DEFECTO.label.family);

    // 2 · La fusión es de dos niveles: el grupo conserva lo que el estilo no declara.
    assert.equal(soloLoSuyo.label.color, '#202020');
    assert.equal(soloLoSuyo.label.halo, POR_DEFECTO.label.halo);
    assert.deepEqual(soloLoSuyo.label.placa, POR_DEFECTO.label.placa);
    assert.deepEqual(soloLoSuyo.paper, POR_DEFECTO.paper, 'un grupo no declarado no llega entero de los valores por defecto');
    assert.deepEqual(soloLoSuyo.capas, POR_DEFECTO.capas);

    // 3 · Y nada anida más hondo: `paper.grain` es un objeto, no un tercer nivel de
    // fusión. Declararlo a medias lo reemplaza entero, que es lo que hace el prototipo.
    const conGrano = fusiona({ id: 'x', title: 'X', paper: { grain: { count: 7 } } });
    assert.deepEqual(conGrano.paper.grain, { count: 7 }, 'la fusión ha anidado más de dos niveles');
    assert.equal(conGrano.paper.base, POR_DEFECTO.paper.base);
  });

  test('El nombre visible sale de title y nunca de label', () => {
    for (const estilo of ESTILOS) {
      assert.equal(typeof estilo.title, 'string');
      assert.ok(estilo.title.length > 0);
      assert.equal(typeof estilo.label, 'object', `${estilo.id}: label no es la tipografía de los rótulos`);
      assert.equal(typeof estilo.label.family, 'string');
    }
    // Y el selector de la revisión se construye desde el catálogo y enseña el `title`.
    const pantalla = codigo('app/pantallas/revision-render.jsx');
    assert.match(pantalla, /ESTILOS\.map\(/, 'el selector de estilos no se construye desde el catálogo');
    assert.match(pantalla, /\{uno\.title\}/, 'el selector no enseña el nombre visible del estilo');
  });

  test('El grupo capas decide qué se dibuja y el código de las capas apagadas sigue existiendo', async () => {
    const documento = conBosqueYPico(
      await documentoDe('urbano-denso', '1'),
      { x: 0, y: 0 },
    );
    const reino = compone(documento, 'reino');
    const cuento = compone(documento, 'cuento');

    // Reino es el mapa base: ni un árbol, ni un pico, ni un lago, ni una carretera,
    // ni un rótulo de camino.
    for (const capa of ['bosques', 'picos', 'lagos', 'carreteras']) {
      assert.equal(cuantas(reino, capa), 0, `Reino ha pintado la capa "${capa}", que tiene apagada`);
    }
    assert.deepEqual(reino.rotulos.filter((r) => r.rol === 'ruta'), [], 'Reino ha rotulado caminos, que tiene apagados');

    // Y el código que las dibuja sigue vivo para los otros cuatro: Cuento las pinta
    // sobre el mismo documento.
    assert.ok(cuantas(cuento, 'bosques') > 0, 'el código de los bosques ha desaparecido al portar Reino');
    assert.ok(cuantas(cuento, 'picos') > 0, 'el código de los picos ha desaparecido al portar Reino');
    assert.ok(cuantas(cuento, 'lagos') > 0, 'el código de los lagos ha desaparecido al portar Reino');
  });

  test('La forma del área es la que declara el estilo: disco en Clásico, a sangre en Atlas', async () => {
    const documento = await documentoDe('costero', '1');
    const recorteDe = (id) => compone(documento, id).primitivas.find((p) => p.tipo === 'recorta').forma;

    assert.equal(recorteDe('clasico').tipo, 'circulo', 'Clásico no recorta el área a un disco');
    assert.equal(recorteDe('atlas').tipo, 'rect');
    assert.equal(recorteDe('reino').tipo, 'rect');

    const atlas = compone(documento, 'atlas');
    assert.equal(ESTILOS.find((e) => e.id === 'atlas').margin, 0, 'Atlas ha dejado de ir a sangre');
    assert.equal(cuantas(atlas, 'marco'), 0, 'Atlas ha pintado marco, y va sin él');
    assert.ok(cuantas(compone(documento, 'reino'), 'marco') > 0, 'Reino no pinta su marco');
  });

  test('La jerarquía de rótulo la decide el estilo: placa en los roles que declara, halo en el resto', async () => {
    const documento = await documentoDe('costero', '1');
    const reino = compone(documento, 'reino');
    assert.deepEqual(ESTILOS.find((e) => e.id === 'reino').label.placa, ['nucleo']);

    const enRotulos = reino.primitivas.filter((p) => p.capa === 'rotulos');
    const cajas = enRotulos.filter((p) => p.tipo === 'camino');
    const textos = enRotulos.filter((p) => p.tipo === 'texto');
    const nucleos = reino.rotulos.filter((r) => r.rol === 'nucleo');
    const parajes = reino.rotulos.filter((r) => r.rol === 'paraje');
    assert.ok(nucleos.length > 0 && parajes.length > 0, 'el mundo de referencia no trae núcleos y parajes a la vez');
    assert.equal(cajas.length, nucleos.length, 'las cajas de pergamino no son exactamente las de los núcleos');
    assert.equal(textos.length, reino.rotulos.length);

    // El de paraje va con halo y sin caja; el de núcleo, sobre placa y sin halo.
    const textoDe = (rol) => textos[reino.rotulos.findIndex((r) => r.rol === rol)];
    assert.ok(textoDe('paraje').pintura.halo, 'el rótulo de paraje no lleva halo');
    assert.equal(textoDe('nucleo').pintura.halo, null, 'el rótulo sobre placa lleva además halo');

    // Un estilo con `label.placa` vacía no pone caja a ninguno.
    const sinPlaca = fusiona({ ...ESTILOS.find((e) => e.id === 'reino'), id: 'reino-sin-placa', title: 'Reino sin placa', label: { ...ESTILOS.find((e) => e.id === 'reino').label, placa: [] } });
    const escena = compone(documento, sinPlaca, { catalogo: creaCatalogo([sinPlaca]) });
    assert.deepEqual(escena.primitivas.filter((p) => p.capa === 'rotulos' && p.tipo === 'camino'), [], 'un estilo sin roles de placa sigue pintando cajas');
  });

  test('Añadir un estilo es añadir un objeto: pinta sin tocar el módulo de dibujo ni el que compone', async () => {
    const dibujoAntes = sha(fuente(DIBUJO));
    const composicionAntes = sha(fuente(COMPOSICION));

    // Solo datos: ni una línea de código nueva, ni un import de nada interno.
    const bruma = fusiona({
      id: 'bruma',
      title: 'Bruma',
      hint: 'Un sexto estilo declarado solo como objeto de datos.',
      margin: 40,
      outside: '#334455',
      paper: { base: '#a1b2c3', grain: { count: 0, dark: '#000000', light: '#000000', rMax: 1 }, vignette: { power: 0, color: '0,0,0', inner: 1, outer: 1 } },
      label: { ...POR_DEFECTO.label, color: '#123456' },
    });
    const catalogo = creaCatalogo([bruma]);
    assert.equal(catalogo.length, 6);
    assert.equal(catalogo[5].id, 'bruma');
    assert.deepEqual(ESTILOS.map((e) => e.id), ['reino', 'clasico', 'pergamino', 'cuento', 'atlas'], 'añadir un estilo ha tocado el catálogo de los cinco');

    const documento = await documentoDe('costero', '1');
    const escena = compone(documento, 'bruma', { catalogo });
    assert.equal(escena.estilo, 'bruma');
    assert.equal(escena.sustitucion, null);
    assert.equal(escena.primitivas[0].pintura.relleno, '#334455', 'el estilo nuevo no ha pintado con su color de fuera del área');
    assert.ok(escena.primitivas.length > 0);

    // Y lo que la spec exige literalmente: los dos módulos siguen byte a byte iguales
    // y no nombran al estilo nuevo por ningún lado.
    assert.equal(sha(fuente(DIBUJO)), dibujoAntes, `${DIBUJO} ha cambiado al añadir un estilo`);
    assert.equal(sha(fuente(COMPOSICION)), composicionAntes, `${COMPOSICION} ha cambiado al añadir un estilo`);
    for (const modulo of [DIBUJO, COMPOSICION]) {
      const texto = fuente(modulo);
      assert.equal(texto.includes('bruma'), false, `${modulo} nombra el estilo nuevo`);
      assert.equal(texto.includes('#334455'), false, `${modulo} lleva escrito un color del estilo nuevo`);
    }
  });

  test('Las tipografías las declara el propio objeto de estilo', () => {
    for (const estilo of ESTILOS) {
      const familias = tipografiasDeEstilo(estilo);
      assert.ok(familias.length > 0, `${estilo.id}: no declara ninguna tipografía`);
      assert.ok(familias.includes(estilo.label.family), `${estilo.id}: no declara la tipografía de sus rótulos`);
      assert.ok(familias.includes(estilo.cartouche.family), `${estilo.id}: no declara la tipografía de su cartela`);
      assert.equal(new Set(familias).size, familias.length, `${estilo.id}: repite una tipografía`);
    }
    const todas = tipografiasDeCatalogo();
    assert.equal(new Set(todas).size, todas.length);
    for (const estilo of ESTILOS) for (const familia of tipografiasDeEstilo(estilo)) assert.ok(todas.includes(familia));

    // Y viajan con la app: ninguna se pide a un servidor.
    for (const familia of todas) assert.doesNotMatch(familia, /https?:|\/\//, `la tipografía "${familia}" se pediría a un servidor`);
  });
});

// ── Los rótulos llegan colocados ────────────────────────────────────────────────

describe('Los rótulos llegan colocados', () => {
  test('El colocador recibe todos los rótulos de una vez, con su rol, su texto, su anclaje y su caja', async () => {
    const documento = await documentoDe('costero', '1');
    const llamadas = [];
    const escena = compone(documento, 'pergamino', {
      colocador: (rotulos, contexto) => {
        llamadas.push({ rotulos, contexto });
        return colocadorSimple(rotulos);
      },
    });

    assert.equal(llamadas.length, 1, 'el colocador no se ha llamado exactamente una vez con todos los rótulos');
    const { rotulos, contexto } = llamadas[0];
    assert.equal(rotulos.length, escena.rotulos.length);
    assert.ok(rotulos.length > 0);
    for (const r of rotulos) {
      assert.deepEqual(Object.keys(r).sort(), ['ancla', 'base', 'id', 'medida', 'rol', 'rotacion', 'texto']);
      assert.ok(['nucleo', 'paraje', 'servicio', 'ruta'].includes(r.rol), `un rótulo llega con el rol desconocido "${r.rol}"`);
      assert.equal(typeof r.texto, 'string');
      assert.equal(Number.isFinite(r.ancla.x) && Number.isFinite(r.ancla.y), true);
      assert.equal(Number.isFinite(r.medida.ancho) && Number.isFinite(r.medida.alto), true, 'un rótulo llega sin la medida de su caja');
    }
    assert.deepEqual(contexto.tamano, TAMANO);
    assert.ok(contexto.caja, 'el colocador no recibe el área pintada');
    assert.equal(contexto.factorTexto, 1);

    // Los tamaños por rol antes de la escala tipográfica del estilo, los del wireframe.
    assert.deepEqual({ ...TAMANO_DE_ROTULO }, { ciudad: 25, pueblo: 19, aldea: 15, granja: 12, paraje: 13, servicio: 18, ruta: 16 });
  });

  test('El colocador provisional pone cada rótulo en su anclaje y puede solapar', async () => {
    assert.equal(COLOCADOR_SIMPLE.provisional, true);
    assert.equal(COLOCADOR_SIMPLE.puedeSolapar, true);

    const documento = await documentoDe('urbano-denso', '1');
    const capturados = [];
    const escena = compone(documento, 'reino', {
      colocador: (rotulos) => { capturados.push(...rotulos); return colocadorSimple(rotulos); },
    });
    for (const r of escena.rotulos) {
      const pedido = capturados.find((c) => c.id === r.id);
      assert.deepEqual([r.x, r.y], [pedido.ancla.x, pedido.ancla.y], `el rótulo "${r.id}" no se ha quedado en su anclaje`);
    }
    // La deuda de la fila 22, medida y no solo declarada.
    assert.equal(typeof solapes(capturados, escena.rotulos.map((r) => ({ id: r.id, x: r.x, y: r.y }))), 'number');
  });

  test('El render pinta los rótulos donde diga el colocador, aunque se solapen', async () => {
    const documento = await documentoDe('costero', '1');
    const escena = compone(documento, 'reino', {
      colocador: (rotulos) => rotulos.map((r) => ({ id: r.id, x: 100, y: 200 })),
    });
    assert.ok(escena.rotulos.length > 1, 'hace falta más de un rótulo para que el solape signifique algo');
    for (const r of escena.rotulos) assert.deepEqual([r.x, r.y], [100, 200], 'el render ha movido un rótulo que el colocador puso encima de otro');

    const solapados = solapes(
      escena.rotulos.map((r) => ({ id: r.id, medida: r.caja })),
      escena.rotulos.map((r) => ({ id: r.id, x: r.x, y: r.y })),
    );
    assert.ok(solapados > 0, 'poner todos los rótulos en el mismo punto no produce ni un solape: la medida no mide');
  });

  test('Otro colocador cambia las posiciones y no cambia ni un color, ni un grosor, ni una tipografía', async () => {
    const documento = await documentoDe('costero', '1');
    const conSimple = compone(documento, 'reino');
    const desplazado = compone(documento, 'reino', {
      colocador: (rotulos) => rotulos.map((r) => ({ id: r.id, x: r.ancla.x + 37, y: r.ancla.y - 21 })),
    });

    // Fuera de la capa de rótulos no se mueve nada.
    const salvoRotulos = (escena) => escena.primitivas.filter((p) => p.capa !== 'rotulos');
    assert.deepEqual(salvoRotulos(desplazado), salvoRotulos(conSimple), 'cambiar de colocador ha tocado la geometría del terreno');

    // Y dentro, cambian las posiciones y no las pinturas.
    const rotulosDe = (escena) => escena.primitivas.filter((p) => p.capa === 'rotulos');
    assert.deepEqual(rotulosDe(desplazado).map((p) => p.pintura), rotulosDe(conSimple).map((p) => p.pintura), 'cambiar de colocador ha cambiado una pintura');
    assert.notDeepEqual(rotulosDe(desplazado).map((p) => p.x ?? null), rotulosDe(conSimple).map((p) => p.x ?? null));
    for (const r of desplazado.rotulos) {
      const antes = conSimple.rotulos.find((x) => x.id === r.id);
      assert.ok(Math.abs((r.x - antes.x) - 37) < 1e-9 && Math.abs((r.y - antes.y) + 21) < 1e-9, `el rótulo "${r.id}" no se ha movido lo que dijo el colocador`);
      assert.deepEqual(r.caja, antes.caja, 'cambiar de colocador ha cambiado la medida de una caja');
    }
  });

  test('El factor de tamaño de letra entra al medir y al colocar, y no toca el objeto de estilo', async () => {
    const documento = await documentoDe('costero', '1');
    const estiloAntes = JSON.stringify(ESTILOS.find((e) => e.id === 'reino'));

    const normal = compone(documento, 'reino');
    const grande = compone(documento, 'reino', { factorTexto: 2 });

    assert.equal(grande.factorTexto, 2);
    for (const r of grande.rotulos) {
      const antes = normal.rotulos.find((x) => x.id === r.id);
      assert.ok(r.caja.ancho > antes.caja.ancho, `el rótulo "${r.id}" no ha crecido con el factor de letra`);
      assert.equal(Math.round(r.caja.ancho / antes.caja.ancho), 2);
    }
    assert.equal(JSON.stringify(ESTILOS.find((e) => e.id === 'reino')), estiloAntes, 'el factor de letra ha modificado el objeto de estilo');

    for (const malo of [0, -1, Number.NaN, 'grande']) {
      assert.throws(() => compone(documento, 'reino', { factorTexto: malo }), /factor de tamaño de letra/);
    }
  });
});

// ── Mundos a los que les falta casi todo ────────────────────────────────────────

describe('Mundos a los que les falta casi todo', () => {
  test('El más pobre de los ocho mundos de referencia se pinta con los cinco estilos', async () => {
    for (const s of LAS_DOS_SEMILLAS) {
      const documento = await documentoDe('suelo-250m', s);
      for (const estilo of ESTILOS) {
        const escena = compone(documento, estilo.id);
        assert.equal(escena.vacia, false, `suelo-250m#${s} con ${estilo.id}: no ha producido lámina`);
        assert.ok(escena.primitivas.length > 0);
        assert.ok(cuantas(escena, 'papel') > 0, `suelo-250m#${s} con ${estilo.id}: no se ve ni el papel`);
        assert.ok(cuantas(escena, 'cartela') > 0, `suelo-250m#${s} con ${estilo.id}: falta la cartela`);
      }
    }
  });

  test('Un mundo sin costa, sin parajes, sin bosques, sin picos, sin lagos y sin ríos se pinta entero', async () => {
    const base = await documentoDe('barrio-tres-calles', '1');
    const pelado = {
      ...base,
      seaMask: null,
      parajes: [],
      geo: { ...base.geo, forests: [], peaks: [], lakes: [], rivers: [], coastlines: [], roads: [] },
    };
    for (const estilo of ESTILOS) {
      const escena = compone(pelado, estilo.id);
      assert.equal(escena.vacia, false, `${estilo.id}: un mundo pelado no ha producido lámina`);
      assert.ok(cuantas(escena, 'papel') > 0, `${estilo.id}: no se ve el papel del estilo`);
      assert.equal(cuantas(escena, 'mar'), 0, `${estilo.id}: sin máscara se ha pintado mar`);
      assert.equal(cuantas(escena, 'glifos-paraje'), 0, `${estilo.id}: sin parajes se ha pintado un marcador vacío`);
      assert.deepEqual(escena.rotulos.filter((r) => r.rol === 'paraje'), []);
    }
  });

  test('Un mundo con un solo núcleo enseña su rótulo y la lámina no queda en blanco', async () => {
    const base = await documentoDe('costero', '1');
    const uno = base.settlements.find((s) => s.type !== 'granja');
    const documento = { ...base, settlements: [uno], parajes: [] };
    const escena = compone(documento, 'reino');
    // Reino rotula en versalitas: el nombre es el mismo, la caja lo pone en mayúsculas.
    assert.deepEqual(escena.rotulos.map((r) => r.texto), [uno.name.toUpperCase()], 'el único núcleo del mundo no tiene rótulo');
    assert.ok(cuantas(escena, 'glifos-nucleo') > 0);
  });
});

// ── Cuando algo falta o no cabe ─────────────────────────────────────────────────

describe('Cuando algo falta o no cabe', () => {
  test('Un estilo que no existe se pinta con Reino y lo declara, en lugar de fallar', async () => {
    const documento = await documentoDe('costero', '1');
    // Una partida guardada con un estilo que ya no existe: se abre en Reino y no se
    // corrompe. El aviso es lo que impide que la sustitución sea silenciosa.
    for (const pedido of ['bruma-que-ya-no-existe', '', null]) {
      const escena = compone(documento, pedido);
      assert.equal(escena.estilo, 'reino', `pedir el estilo ${JSON.stringify(pedido)} no ha caído a Reino`);
      assert.deepEqual(escena.sustitucion, { pedido, usado: 'reino' }, 'la sustitución ha sido silenciosa');
      assert.ok(escena.primitivas.length > 0, 'la lámina no se ha pintado');
    }
    // Y con un estilo que sí existe, o sin pedir ninguno, no se declara sustitución.
    assert.equal(compone(documento, 'atlas').sustitucion, null);
    assert.equal(compone(documento).sustitucion, null);
    assert.equal(compone(documento).estilo, 'reino');
  });

  test('Un documento al que le falta un campo falla nombrando el campo y la capa', async () => {
    const documento = await documentoDe('costero', '1');
    const casos = [
      ['routes', 'calzadas'],
      ['parajes', 'glifos-paraje'],
      ['settlements', 'glifos-nucleo'],
      ['title', 'cartela'],
      ['seed', 'papel'],
    ];
    for (const [campo, capa] of casos) {
      assert.throws(
        () => compone({ ...documento, [campo]: undefined }, 'reino'),
        (e) => e.message.includes(`"${campo}"`) && e.message.includes(`"${capa}"`),
        `quitar "${campo}" no falla nombrando el campo y la capa "${capa}"`,
      );
    }
    for (const campo of ['forests', 'peaks', 'lakes', 'rivers', 'coastlines']) {
      assert.throws(
        () => compone({ ...documento, geo: { ...documento.geo, [campo]: undefined } }, 'cuento'),
        new RegExp(`geo\\.${campo}`),
        `quitar geo.${campo} no falla nombrándolo`,
      );
    }
  });

  test('Una superficie de ancho o alto cero no pinta nada y no falla', async () => {
    const documento = await documentoDe('costero', '1');
    for (const tamano of [{ ancho: 0, alto: 780 }, { ancho: 390, alto: 0 }, { ancho: 0, alto: 0 }]) {
      const escena = componeEscena({ documento, estilo: 'reino', tamano, medidor: medidorNominal, colocador: colocadorSimple });
      assert.equal(escena.vacia, true, `${JSON.stringify(tamano)}: la escena no se declara vacía`);
      assert.deepEqual(escena.primitivas, []);
      assert.deepEqual(escena.rotulos, []);
    }
  });

  test('Un colocador que devuelve menos rótulos de los que se le dieron falla nombrando los que faltan', async () => {
    const documento = await documentoDe('costero', '1');
    assert.throws(
      () => compone(documento, 'reino', { colocador: (rotulos) => colocadorSimple(rotulos).slice(1) }),
      (e) => /faltan/.test(e.message) && /paraje:0|nucleo:/.test(e.message),
      'perder un rótulo por el camino no falla nombrándolo',
    );
    assert.throws(() => compone(documento, 'reino', { colocador: () => null }), /lista de posiciones/);
    assert.throws(() => compone(documento, 'reino', { colocador: (r) => r.map((x) => ({ id: x.id, x: 'ahí', y: 0 })) }), /mal formada/);
  });

  test('Un medidor que no sabe medir una tipografía falla nombrándola, en lugar de inventarse la medida', async () => {
    const documento = await documentoDe('costero', '1');
    const familia = ESTILOS.find((e) => e.id === 'reino').label.family;
    assert.throws(
      () => compone(documento, 'reino', { medidor: () => { throw new Error('esta familia no está cargada'); } }),
      (e) => e.message.includes(familia),
      'un medidor que no sabe medir no nombra la tipografía',
    );
    assert.throws(
      () => compone(documento, 'reino', { medidor: () => ({ ancho: Number.NaN, alto: 10 }) }),
      /no devolvió una medida/,
      'una medida que no es un número pasa como buena',
    );
    // Y las dos entradas son obligatorias: sin ellas no hay cajas y no hay colocación.
    assert.throws(() => componeEscena({ documento, tamano: TAMANO, colocador: colocadorSimple }), /medidor/);
    assert.throws(() => componeEscena({ documento, tamano: TAMANO, medidor: medidorNominal }), /colocador/);
  });
});

// ── Los bordes de la lámina ─────────────────────────────────────────────────────

describe('Los bordes de la lámina', () => {
  test('Una vista más grande que el mundo entero lo enseña rodeado del color de fuera, sin estirarlo', async () => {
    const documento = await documentoDe('costero', '1');
    const ajustada = compone(documento, 'reino', { vista: { cx: 0, cy: 0, r: documento.radius, foco: null, paraje: null, escala: false } });
    const holgada = compone(documento, 'reino', { vista: { cx: 0, cy: 0, r: documento.radius * 4, foco: null, paraje: null, escala: false } });

    assert.equal(ajustada.primitivas[0].pintura.relleno, ESTILOS.find((e) => e.id === 'reino').outside);
    assert.equal(holgada.primitivas[0].pintura.relleno, ESTILOS.find((e) => e.id === 'reino').outside);

    // El mundo no se estira: con cuatro veces el radio, todo queda cuatro veces más
    // pequeño y en el mismo sitio relativo.
    const glifo = (escena) => escena.primitivas.find((p) => p.capa === 'glifos-nucleo' && p.tipo === 'circulo');
    const a = glifo(ajustada), b = glifo(holgada);
    assert.equal(a.r, b.r, 'el glifo de núcleo se ha escalado con la vista');
    assert.ok(Math.abs(b.cx - TAMANO.ancho / 2) < Math.abs(a.cx - TAMANO.ancho / 2) + 1e-9, 'alejar la vista no ha acercado el mundo al centro');
  });

  test('Girar la superficie de vertical a apaisada reencuadra y no cambia el mundo pintado', async () => {
    const documento = await documentoDe('costero', '1');
    const antes = JSON.stringify(documento);
    const vertical = compone(documento, 'reino');
    const apaisada = componeEscena({
      documento, estilo: 'reino', tamano: { ancho: TAMANO.alto, alto: TAMANO.ancho },
      medidor: medidorNominal, colocador: colocadorSimple,
    });

    assert.equal(JSON.stringify(documento), antes, 'girar el dispositivo ha tocado el documento');
    assert.deepEqual(apaisada.tamano, { ancho: TAMANO.alto, alto: TAMANO.ancho });
    assert.deepEqual(
      apaisada.rotulos.map((r) => r.texto).sort(),
      vertical.rotulos.map((r) => r.texto).sort(),
      'girar el dispositivo ha cambiado lo que se rotula',
    );
    assert.equal(apaisada.estilo, vertical.estilo);
  });

  test('Un rótulo más largo que la lámina se pinta y no desborda por los dos lados a la vez', async () => {
    const base = await documentoDe('costero', '1');
    const largo = 'Un nombre absurdamente largo que no cabe de ninguna manera en el ancho de la lámina';
    const documento = { ...base, settlements: base.settlements.map((s, i) => (i === 0 ? { ...s, name: largo } : s)) };
    const escena = compone(documento, 'reino');

    const rotulo = escena.rotulos.find((r) => r.texto.toUpperCase() === largo.toUpperCase());
    assert.ok(rotulo, 'el rótulo largo no se ha pintado');
    assert.ok(rotulo.caja.ancho > TAMANO.ancho, 'la prueba no mide nada: el rótulo cabe');
    const texto = escena.primitivas.find((p) => p.tipo === 'texto' && p.texto.toUpperCase() === largo.toUpperCase());
    assert.ok(texto.x < 0, 'el rótulo largo no desborda por la izquierda, así que la caja no está centrada');
    assert.ok(texto.x + texto.ancho > TAMANO.ancho, 'el rótulo largo tampoco desborda por la derecha');
    // Y desbordar por los dos lados es lo correcto para un texto centrado: lo que no
    // puede es salirse solo por uno, que sería una caja mal medida.
    assert.ok(Math.abs((texto.x + texto.ancho / 2) - TAMANO.ancho / 2) < TAMANO.ancho, 'el rótulo se ha ido de la lámina por un lado');
  });
});

// ── La fluidez, que se mide ─────────────────────────────────────────────────────

describe('La fluidez, que se mide', () => {
  test('El número de primitivas de una escena queda por debajo del tope declarado', async () => {
    // 40.000 sobre el mundo de referencia más denso. No es un límite de la máquina:
    // es la señal de que una capa se ha ido de las manos.
    const TOPE = 40000;
    let peor = { cuantas: 0 };
    for (const { nombre, s } of LOS_OCHO) {
      const documento = await documentoDe(nombre, s);
      for (const estilo of ESTILOS) {
        const escena = compone(documento, estilo.id);
        assert.ok(escena.primitivas.length < TOPE, `${nombre}#${s} con ${estilo.id}: ${escena.primitivas.length} primitivas, por encima del tope de ${TOPE}`);
        if (escena.primitivas.length > peor.cuantas) peor = { cuantas: escena.primitivas.length, nombre, s, estilo: estilo.id };
      }
    }
    assert.ok(peor.cuantas > 0, 'no se ha compuesto ni una escena');
  });

  test('Componer no depende del reloj ni del rendimiento de la máquina', () => {
    for (const modulo of [COMPOSICION, 'packages/nucleo/render/estilos.js', 'packages/nucleo/render/colocador-simple.js', 'packages/nucleo/render/medidor-nominal.js', DIBUJO]) {
      const texto = codigo(modulo);
      for (const patron of [/Date\.now/, /new Date\(/, /performance\.now/, /setTimeout/, /requestAnimationFrame/]) {
        assert.equal(patron.test(texto), false, `${modulo}: el render mira el reloj (${patron})`);
      }
    }
  });
});

// ── La paridad visual, que se revisa a mano ─────────────────────────────────────

describe('La paridad visual, que se revisa a mano', () => {
  test('Los cuarenta pares de la ficha de revisión existen y los cuarenta producen lámina', async () => {
    // La mitad humana de la paridad es @manual y no se puede afirmar aquí. Lo que sí
    // se afirma es que el corpus está entero y que ninguno de los cuarenta pares
    // falla al componerse, que es la condición para poder mirarlos.
    assert.equal(LOS_OCHO.length, 8, 'el corpus de la revisión no son los ocho mundos de referencia');
    let pares = 0;
    for (const { nombre, s } of LOS_OCHO) {
      const documento = await documentoDe(nombre, s);
      for (const estilo of ESTILOS) {
        const escena = compone(documento, estilo.id, { vista: { cx: 0, cy: 0, r: documento.radius, foco: null, paraje: null, escala: true } });
        assert.equal(escena.vacia, false);
        assert.ok(cuantas(escena, 'escala') > 0, `${nombre}#${s} con ${estilo.id}: la revisión no puede comparar la escala`);
        pares += 1;
      }
    }
    assert.equal(pares, 40, 'la revisión de paridad no cubre los cuarenta pares');
  });

  test('La pantalla de revisión no es del juego y es la que enciende la escala', () => {
    const pantalla = codigo('app/pantallas/revision-render.jsx');
    assert.match(pantalla, /escala:\s*true/, 'la pantalla de revisión no enciende la barra de escala');
    assert.match(pantalla, /MUNDOS_DE_REFERENCIA/);
    for (const testid of ['revision-render', 'revision-render-mundo', 'revision-render-estilo']) {
      assert.ok(pantalla.includes(`testID="${testid}"`), `la pantalla de revisión no declara "${testid}"`);
    }
    // Y no entra en el diagrama de las cuarenta pantallas del juego.
    assert.doesNotMatch(fuente('docs/flujo.md'), /revision-render/i, 'la pantalla de revisión se ha colado en el diagrama del juego');
  });
});
