// SPEC-026 · La lámina en el móvil: la cámara con la que se mira el mundo congelado.
//
// SPEC-021 entregó el pintado y dejó la cámara a esta fila; aquí se afirma lo que
// aquella no podía: que arrastrar y acercar mueven **la cámara y no el mundo**, que no
// hay por dónde girar, que alejarse hasta que la celda entera cabe sigue sin dejar dos
// rótulos pisándose, y que el encuadre sobrevive a cerrar y abrir la app sin haber
// tocado un byte del documento.
//
// La cámara es geometría pura y el pintado es puro, así que todo esto corre en
// `node --test` sin simulador. Lo que de verdad necesita dispositivo —que el dedo
// produzca los píxeles que aquí entran a mano, y que Skia dibuje lo que la escena
// dice— es @app y en esta máquina no hay dónde ejecutarlo.
//
// Escenarios de docs/testing.md que se reutilizan aquí, con su nombre literal: «El
// norte está siempre arriba», «El mapa no cambia durante la salida» y «La pantalla del
// mapa no tiene ni un control» (de «En marcha no hay nada que tocar», que es @app y de
// la que esta fila puede poner roja la mitad que no necesita dispositivo), «Cambiar el
// estilo de pintado no resiembra nada» (@determinismo, bloqueante), «Ninguna pareja de
// rótulos se solapa en un mundo denso», «Ningún rótulo se sale del marco» y «Cuando
// dos no caben, se retira el de menor prioridad y su pueblo se sigue dibujando».

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALEJAMIENTO_MAXIMO,
  CLAVE_DE_CAMARA,
  EJES_DE_LA_CAMARA,
  MARGEN_DE_ENCUADRE,
  RADIO_MINIMO_M,
  acerca,
  arrastra,
  encuadraCelda,
  leeCamara,
  metrosPorPixel,
  normaliza,
  textoDeCamara,
  vistaDe,
} from '../../app/mapa/camara.js';
import { ESTADOS } from '../../app/mapa/levantamiento.js';
import { FASES } from '../../app/mapa/fases.js';
import { cajaDentroDe } from '../../packages/nucleo/core/cajas.js';
import { componeEscena } from '../../packages/nucleo/render/escena.js';
import { colocadorDeRotulos } from '../../packages/nucleo/render/colocador.js';
import { medidorNominal } from '../../packages/nucleo/render/medidor-nominal.js';
import { ESTILOS, ESTILO_POR_DEFECTO } from '../../packages/nucleo/render/estilos.js';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import {
  LA_QUE_GOBIERNA,
  SEMILLA_DE_PRUEBA,
  TAMANO,
  cajasDe,
  geometriaDe,
  levantaFixture,
  parejasQueSePisan,
  serializado,
} from './levantamiento-de-prueba.mjs';

/** La pantalla del mapa: lo único de esta fila de lo que se afirma leyendo su código. */
const PANTALLA = 'app/pantallas/mapa.jsx';

/** El flujo de Maestro de esta fila, con lo que solo se puede afirmar en dispositivo. */
const FLUJO_DE_APP = 'test/app/mapa.yaml';

// Un solo mundo denso levantado en el móvil, compartido por todo el fichero: la cámara
// no muta el documento y que no lo mute es de lo que se afirma más abajo.
let banco = null;
async function elBanco() {
  if (!banco) banco = await levantaFixture(LA_QUE_GOBIERNA);
  return banco;
}

/** Repinta el mundo congelado con una cámara dada, por el mismo sitio que la pantalla. */
async function pintaCon(camara, opciones = {}) {
  const { levantamiento, resultado } = await elBanco();
  return levantamiento.pinta({ documento: resultado.documento, camara, tamano: TAMANO, ...opciones });
}

/** El mundo que la escena dice pintar: nombre, tipo y posición de cada elemento. */
function mundoQueSePinta(documento) {
  return {
    nucleos: documento.settlements.map((s) => [s.name, s.type, s.x, s.y]),
    servicios: documento.settlements.flatMap((s) => s.services).map((v) => [v.name, v.kind, v.x, v.y]),
    parajes: documento.parajes.map((p) => [p.name, p.type, p.x, p.y]),
    calzadas: documento.routes.map((r) => [r.name, r.pts.length, r.pts[0].x, r.pts[0].y]),
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// La lámina en el móvil
// ════════════════════════════════════════════════════════════════════════════════

describe('La lámina en el móvil', () => {
  test('Un mundo de referencia se ve con su terreno, su mar, sus calzadas, sus núcleos y sus parajes', async () => {
    const { resultado } = await elBanco();
    const escena = resultado.escena;
    assert.equal(escena.estilo, ESTILO_POR_DEFECTO, 'el estilo de partida no es Reino');

    const capas = new Set(escena.primitivas.map((p) => p.capa));
    for (const capa of ['papel', 'tierra', 'calzadas', 'glifos-nucleo', 'marco', 'cartela']) {
      assert.ok(capas.has(capa), `la lámina del móvil no ha pintado la capa "${capa}"`);
    }
    assert.ok(escena.rotulos.length > 0, 'la lámina no ha compuesto ni un rótulo');
    assert.ok(escena.colocacion.length > 0, 'la lámina no ha colocado ni un rótulo');
    assert.ok(resultado.documento.settlements.length > 0 && resultado.documento.parajes.length > 0);

    // El mar es del mundo costero: la capa existe y se pinta donde hay costa.
    const costero = await levantaFixture('costero');
    const capasDelMar = new Set(costero.resultado.escena.primitivas.map((p) => p.capa));
    assert.ok(capasDelMar.has('mar'), 'el mundo costero se ha pintado sin mar');
  });

  test('Ninguna pareja de rótulos se solapa en un mundo denso', async () => {
    const { resultado } = await elBanco();
    assert.deepEqual(
      parejasQueSePisan(cajasDe(resultado.escena)), [],
      'dos rótulos se pisan en la lámina levantada dentro del móvil',
    );
    // Y en los cinco estilos, sobre el mismo mundo congelado.
    for (const estilo of ESTILOS) {
      const escena = await pintaCon(resultado.camara, { estilo: estilo.id });
      assert.deepEqual(parejasQueSePisan(cajasDe(escena)), [], `dos rótulos se pisan con el estilo ${estilo.id}`);
    }
  });

  test('El norte está siempre arriba', async () => {
    // La cámara son tres números y **ningún ángulo**: si apareciera un cuarto eje, hay
    // rotación. No es que nadie haya pedido girar todavía; es que no hay por dónde.
    assert.deepEqual([...EJES_DE_LA_CAMARA], ['cx', 'cy', 'r']);

    const { resultado } = await elBanco();
    const encuadres = [
      resultado.camara,
      arrastra(resultado.camara, { dxPx: 140, dyPx: -95, tamano: TAMANO, documento: resultado.documento }),
      acerca(resultado.camara, 3.5, resultado.documento),
      acerca(resultado.camara, 0.05, resultado.documento),
    ];
    for (const camara of encuadres) {
      assert.deepEqual(Object.keys(camara).sort(), ['cx', 'cy', 'r'], 'un encuadre de la cámara lleva algo más que centro y radio');
      const vista = vistaDe(camara);
      assert.equal('rot' in vista, false, 'la vista con la que se pinta lleva un ángulo');
      assert.equal('angulo' in vista, false);
      const escena = await pintaCon(camara);
      // Las únicas rotaciones de la lámina son las de los rótulos de camino, que
      // siguen el trazo de su calzada. Fuera de esa capa, ninguna.
      for (const p of escena.primitivas) {
        if (p.tipo === 'transforma' && p.rot !== 0) {
          assert.equal(p.capa, 'rotulos', `hay una rotación fuera de los rótulos, en la capa "${p.capa}"`);
        }
      }
    }

    // Y en el código de la cámara no hay ni un ángulo que mover.
    const codigo = fuente('app/mapa/camara.js').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const prohibido of ['rot', 'angulo', 'ángulo', 'Math.atan2', 'bearing']) {
      assert.equal(codigo.includes(prohibido), false, `la cámara nombra "${prohibido}": eso es una rotación`);
    }
  });

  test('Un gesto de rotación no encuentra nada que mover y no ocurre nada', async () => {
    // Acercar recibe la razón entre la separación de dos dedos, y el ángulo entre
    // ellos no entra: un gesto que además gire acerca exactamente igual.
    const { resultado } = await elBanco();
    const factor = 1.8;
    assert.deepEqual(acerca(resultado.camara, factor, resultado.documento), acerca(resultado.camara, factor, resultado.documento));

    // El código de la pantalla calcula la separación y no el ángulo, y no hay ninguna
    // animación de rechazo: ignorar en silencio, porque una animación es la app hablando.
    const pantalla = fuente(PANTALLA);
    assert.match(pantalla, /Math\.hypot/, 'la pantalla no calcula la separación entre los dos dedos');
    assert.equal(/Math\.atan2/.test(pantalla), false, 'la pantalla calcula el ángulo entre los dos dedos');
    for (const rechazo of ['Animated', 'rebote', 'withSpring', 'shake']) {
      assert.equal(pantalla.includes(rechazo), false, `la pantalla responde al gesto de rotación con "${rechazo}"`);
    }
  });

  test('Arrastrar mueve la cámara y no el mundo', async () => {
    const { resultado } = await elBanco();
    const antes = serializado(resultado.documento);
    const mundoAntes = serializado(mundoQueSePinta(resultado.documento));

    const m = metrosPorPixel(resultado.camara, TAMANO);
    const movida = arrastra(resultado.camara, { dxPx: 120, dyPx: 60, tamano: TAMANO, documento: resultado.documento });

    // El dedo va con el papel: arrastrar a la derecha lleva la cámara a la izquierda, y
    // el eje vertical se invierte porque en la lámina la y crece hacia el norte.
    assert.equal(movida.cx, resultado.camara.cx - 120 * m);
    assert.equal(movida.cy, resultado.camara.cy + 60 * m);
    assert.equal(movida.r, resultado.camara.r, 'arrastrar ha cambiado la escala');

    assert.equal(serializado(resultado.documento), antes, 'arrastrar ha tocado el documento congelado');
    assert.equal(serializado(mundoQueSePinta(resultado.documento)), mundoAntes, 'arrastrar ha movido el mundo');

    const escena = await pintaCon(movida);
    assert.notEqual(serializado(escena.primitivas), serializado(resultado.escena.primitivas), 'arrastrar no ha cambiado nada de la lámina');
  });

  test('El mapa no cambia durante la salida', async () => {
    // Acercar y alejar cambian la escala y no cambian ni un nombre, ni un tipo, ni una
    // posición del mundo. Y volver al mismo encuadre devuelve la misma lámina.
    const { resultado } = await elBanco();
    const mundoAntes = serializado(mundoQueSePinta(resultado.documento));

    let camara = resultado.camara;
    for (const factor of [2, 1.5, 0.3, 4]) {
      camara = acerca(camara, factor, resultado.documento);
      const escena = await pintaCon(camara);
      assert.equal(escena.vista.r, camara.r, 'la escala pintada no es la de la cámara');
      assert.equal(serializado(mundoQueSePinta(resultado.documento)), mundoAntes, `acercar por ${factor} ha cambiado el mundo`);
      // Los rótulos que quedan siguen siendo nombres del mundo, no otros. Se comparan
      // en versalitas y sin espaciado porque la caja alta la pone el estilo al pintar,
      // y eso es pintura y no mundo.
      const comoSeLee = (t) => t.toLocaleUpperCase('es').replace(/\s+/g, ' ').trim();
      const nombres = new Set([
        ...resultado.documento.settlements.map((s) => s.name),
        ...resultado.documento.settlements.flatMap((s) => s.services).map((v) => v.name),
        ...resultado.documento.parajes.map((p) => p.name),
        ...resultado.documento.routes.map((r) => r.name).filter(Boolean),
      ].map(comoSeLee));
      for (const rotulo of escena.rotulos) {
        assert.ok(nombres.has(comoSeLee(rotulo.texto)), `la lámina ha pintado "${rotulo.texto}", que no es un nombre de este mundo`);
      }
    }

    const vuelta = await pintaCon(resultado.camara);
    assert.deepEqual(vuelta.primitivas, resultado.escena.primitivas, 'volver al encuadre de partida no devuelve la misma lámina');
    assert.deepEqual(vuelta.rotulos, resultado.escena.rotulos);
  });

  test('Arrastrar y acercar no llaman al generador ni una vez', async () => {
    // Doce arrastres y cinco estilos sobre el mismo mundo congelado: una generación —la
    // del levantamiento— y ninguna consulta más.
    const { levantamiento, resultado, consultaOsm } = await levantaFixture('barrio-tres-calles');
    const antesDeMoverse = { ...levantamiento.recuento() };
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      let camara = resultado.camara;
      for (let i = 0; i < 12; i++) {
        camara = arrastra(camara, { dxPx: 25 * (i % 5) - 50, dyPx: 18 * (i % 3) - 20, tamano: TAMANO, documento: resultado.documento });
        camara = acerca(camara, i % 2 ? 1.2 : 0.85, resultado.documento);
        for (const estilo of ESTILOS) {
          levantamiento.pinta({ documento: resultado.documento, camara, tamano: TAMANO, estilo: estilo.id });
        }
      }
      assert.deepEqual(inspector.peticiones(), [], 'mover la cámara ha sacado tráfico del móvil');
    } finally {
      inspector.suelta();
    }
    assert.equal(levantamiento.recuento().generaciones, antesDeMoverse.generaciones, 'mover la cámara ha llamado al generador');
    assert.equal(levantamiento.recuento().generaciones, 1);
    assert.equal(levantamiento.recuento().consultas, antesDeMoverse.consultas, 'mover la cámara ha pedido datos a OSM');
    assert.equal(consultaOsm.llamadas.length, 1);
  });

  test('Cambiar el estilo de pintado no resiembra nada', async () => {
    const { levantamiento, resultado } = await elBanco();
    const antes = serializado(resultado.documento);
    const generacionesAntes = levantamiento.recuento().generaciones;

    const escenas = ESTILOS.map((estilo) => levantamiento.pinta({
      documento: resultado.documento, camara: resultado.camara, tamano: TAMANO, estilo: estilo.id,
    }));

    assert.equal(serializado(resultado.documento), antes, 'cambiar de estilo ha tocado el documento congelado');
    assert.equal(levantamiento.recuento().generaciones, generacionesAntes, 'cambiar de estilo ha resembrado');
    for (const escena of escenas) {
      assert.equal(escena.vista.cx, resultado.camara.cx, 'cambiar de estilo ha movido la cámara');
      assert.equal(escena.vista.r, resultado.camara.r);
    }
    // Y volver al de partida devuelve la lámina de partida, primitiva a primitiva.
    const vuelta = levantamiento.pinta({ documento: resultado.documento, camara: resultado.camara, tamano: TAMANO, estilo: ESTILO_POR_DEFECTO });
    assert.deepEqual(vuelta.primitivas, resultado.escena.primitivas);
    // La geometría de dos estilos puede diferir —el encuadre es del estilo—, pero el
    // mundo que cada uno dice pintar es el mismo.
    assert.ok(geometriaDe(escenas[0]).length > 0);
  });

  test('Cuando dos no caben, se retira el de menor prioridad y su pueblo se sigue dibujando', async () => {
    // La cámara alejada hasta que la celda entera cabe en cuatrocientos píxeles: los
    // rótulos que no caben se sacrifican por orden y los que quedan siguen sin pisarse.
    const { resultado } = await elBanco();
    const documento = resultado.documento;
    const alejada = normaliza({ cx: 0, cy: 0, r: documento.radius * ALEJAMIENTO_MAXIMO }, documento);
    const escena = await pintaCon(alejada);

    assert.ok(escena.retirados.length > 0, 'alejarse del todo no ha sacrificado ni un rótulo: el caso no prueba nada');
    assert.deepEqual(parejasQueSePisan(cajasDe(escena)), [], 'dos rótulos se pisan con la celda entera en pantalla');
    // Todo rótulo compuesto está resuelto: o colocado o retirado con su motivo.
    const resueltos = new Set([...escena.colocacion.map((c) => c.id), ...escena.retirados.map((r) => r.id)]);
    for (const rotulo of escena.rotulos) assert.ok(resueltos.has(rotulo.id), `el rótulo ${rotulo.id} no se ha resuelto`);
    for (const retirado of escena.retirados) assert.ok(retirado.motivo, `el rótulo ${retirado.id} se ha retirado sin motivo`);

    // Y el glifo del que perdió el nombre se sigue dibujando: se retira el rótulo, no
    // el pueblo. Los núcleos de la lámina siguen siendo todos los del mundo.
    const glifos = escena.primitivas.filter((p) => p.capa === 'glifos-nucleo');
    assert.ok(glifos.length > 0, 'se han retirado los glifos de los núcleos junto con sus rótulos');
  });

  test('Ningún rótulo se sale del marco', async () => {
    // El marco del área pintada solo lo conoce quien coloca, así que se compone con el
    // colocador envuelto para verlo. Es la misma escena: el envoltorio solo mira.
    const { resultado } = await elBanco();
    for (const r of [resultado.documento.radius * ALEJAMIENTO_MAXIMO, resultado.documento.radius / 2, RADIO_MINIMO_M * 3]) {
      let marco = null;
      const escena = componeEscena({
        documento: resultado.documento,
        estilo: ESTILO_POR_DEFECTO,
        vista: vistaDe(normaliza({ cx: 0, cy: 0, r }, resultado.documento)),
        tamano: TAMANO,
        medidor: medidorNominal,
        colocador: (rotulos, contexto) => { marco = contexto.marco; return colocadorDeRotulos(rotulos, contexto); },
      });
      assert.ok(marco, `con radio ${r} el colocador no ha recibido el marco del área pintada`);
      for (const puesto of cajasDe(escena)) {
        assert.equal(cajaDentroDe(puesto.caja, marco), true, `el rótulo ${puesto.id} se sale del marco con radio ${r}`);
      }
    }
  });

  test('La pantalla del mapa no tiene ni un control', () => {
    // La mitad que se puede afirmar sin dispositivo: en el código de la pantalla del
    // mapa no hay ningún control de zoom, ni de centrar, ni leyenda, ni cabecera. Los
    // dos únicos elementos tocables viven en los momentos que **no** son la lámina.
    const pantalla = fuente(PANTALLA);
    // Sin comentarios: el código de la pantalla explica que **no** lleva control de
    // zoom, y buscar la palabra sin quitarlos encontraría justo esa frase.
    const codigo = pantalla.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const dentroDeLaLamina = codigo.slice(codigo.indexOf('testID="mapa-lamina"'));
    assert.ok(dentroDeLaLamina.length > 0, 'la pantalla no tiene contenedor de lámina');
    assert.equal(/Pressable|TouchableOpacity|Button|onPress/.test(dentroDeLaLamina), false, 'hay algo tocable encima de la lámina');
    for (const control of ['zoom', 'Zoom', 'centrar', 'Centrar', 'leyenda', 'Leyenda', 'Slider', 'ScrollView', 'SafeAreaView', 'Header']) {
      assert.equal(codigo.includes(control), false, `la pantalla del mapa lleva un control "${control}"`);
    }
    // El único tocable que existe es la acción de levantar el mapa, y vive en los
    // momentos que no son la lámina: el momento «de consulta» no tiene ninguno.
    const tocables = [...codigo.matchAll(/<Pressable\s+testID="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(tocables)], ['levantar-mapa']);
    // Y ninguna cifra: ni kilómetros, ni pasos, ni porcentaje, ni segundos que faltan.
    const literales = codigo.match(/export const TEXTOS = Object\.freeze\(\{[\s\S]*?\}\);/)[0];
    assert.equal(/\d/.test(literales), false, `un literal de la pantalla del mapa lleva una cifra: ${literales}`);
    for (const cifra of ['%', 'km', 'kilómetros', 'segundos', 'minutos']) {
      assert.equal(literales.includes(cifra), false, `la pantalla del mapa enseña "${cifra}"`);
    }
  });

  test('La pantalla declara los cinco identificadores de la spec, y el flujo de @app no usa otros', () => {
    // Si un flujo se agarra a un identificador que la spec no declara, o el flujo
    // inventa un selector frágil o la spec tiene un hueco. Las dos cosas hay que verlas.
    const pantalla = fuente(PANTALLA);
    const declarados = ['mapa-estado', 'mapa-lamina', 'mapa-camara', 'levantar-mapa', 'generacion-fases'];
    for (const id of declarados) {
      assert.ok(pantalla.includes(`testID="${id}"`), `la pantalla del mapa no declara el identificador "${id}"`);
    }
    // El vocabulario del estado del momento es cerrado y es el de la spec.
    assert.deepEqual([...ESTADOS], ['sin-mapa', 'levantando', 'pintado', 'no-se-pudo']);
    for (const estado of ESTADOS) {
      assert.ok(pantalla.includes(`'${estado}'`), `la pantalla no usa el estado declarado "${estado}"`);
    }

    // Los que el flujo de Maestro puede usar: los cinco de la spec, los auxiliares que
    // la pantalla declara para el diagnóstico y el paso provisional de App.js.
    const alcanzables = new Set([
      ...declarados,
      'mapa-pantalla', 'mapa-motivo', 'mapa-jugable', 'mapa-minuto', 'mapa-no-se-pudo', 'mapa-sin-cablear',
      ...FASES.map((f) => `fase-${f.id}`),
      'paso-mapa',
    ]);
    const flujo = fuente(FLUJO_DE_APP);
    const usados = [...flujo.matchAll(/^\s*id:\s*'([^']+)'/gm)].map((m) => m[1]);
    assert.ok(usados.length > 0, 'el flujo de @app de esta fila no localiza nada por identificador');
    for (const id of usados) {
      assert.ok(alcanzables.has(id), `${FLUJO_DE_APP}: usa el identificador "${id}", que la pantalla no declara`);
    }
    // Y los cinco de la spec están todos ejercitados desde el dispositivo.
    for (const id of declarados) assert.ok(usados.includes(id), `el flujo de @app no ejercita "${id}"`);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// El encuadre: estado de pantalla y nunca del mundo
// ════════════════════════════════════════════════════════════════════════════════

describe('El encuadre de la cámara', () => {
  test('El encuadre de partida es la celda entera con margen', async () => {
    const { resultado } = await elBanco();
    const inicial = encuadraCelda(resultado.documento);
    assert.deepEqual(inicial, { cx: 0, cy: 0, r: Math.min(resultado.documento.radius * MARGEN_DE_ENCUADRE, resultado.documento.radius * ALEJAMIENTO_MAXIMO) });
    assert.ok(inicial.r >= resultado.documento.radius, 'el encuadre de partida no enseña la celda entera');
    assert.deepEqual(resultado.camara, inicial, 'al terminar de generar la cámara no encuadra la celda entera');
  });

  test('La cámara tiene topes y no se puede perder el mapa', async () => {
    const { resultado } = await elBanco();
    const documento = resultado.documento;
    assert.equal(acerca(resultado.camara, 1e9, documento).r, RADIO_MINIMO_M, 'se puede acercar por debajo del mínimo');
    assert.equal(acerca(resultado.camara, 1e-9, documento).r, documento.radius * ALEJAMIENTO_MAXIMO, 'se puede alejar más allá del tope');
    const lejos = arrastra(resultado.camara, { dxPx: -1e6, dyPx: -1e6, tamano: TAMANO, documento });
    assert.equal(lejos.cx, documento.radius, 'el centro se ha salido del mundo por el este');
    assert.ok(Math.abs(lejos.cy) <= documento.radius);
    assert.throws(() => acerca(resultado.camara, 0, documento), /positivo/);
    assert.throws(() => arrastra(resultado.camara, { dxPx: NaN, dyPx: 0, tamano: TAMANO, documento }), /píxeles/);
    assert.throws(() => normaliza({ cx: 0, cy: 0, r: NaN }, documento), /tres números en metros/);
    assert.throws(() => encuadraCelda({}), /documento del mundo congelado/);
  });

  test('El mapa cerrado y vuelto a abrir vuelve al encuadre que dejó, sin tocar el documento', async () => {
    const { levantamiento, almacen, resultado } = await levantaFixture('costero');
    const documento = resultado.documento;
    const escrito = serializado(almacen.volcado());

    const dejada = acerca(arrastra(resultado.camara, { dxPx: 70, dyPx: -35, tamano: TAMANO, documento }), 2.4, documento);
    await levantamiento.guardaCamara({ mapaId: resultado.mapaId, clave: resultado.clave, camara: dejada });

    // La cámara vive **fuera** de los documentos del mapa: guardarla no puede tocar ni
    // un byte del mundo congelado.
    const clave = CLAVE_DE_CAMARA(resultado.mapaId, resultado.clave);
    assert.match(clave, /^camara\//, 'la cámara se guarda dentro del árbol de documentos del mapa');
    const documentosDelMapa = almacen.volcado().filter(([k]) => k.startsWith('mapa/'));
    assert.equal(serializado(documentosDelMapa), serializado(JSON.parse(escrito).filter(([k]) => k.startsWith('mapa/'))), 'guardar la cámara ha tocado la partida');

    const reabierto = await levantamiento.abre({ id: resultado.mapaId, semilla: SEMILLA_DE_PRUEBA, tamano: TAMANO });
    assert.deepEqual(reabierto.camara, normaliza(dejada, documento), 'al reabrir no ha vuelto el encuadre que se dejó');
    assert.notDeepEqual(reabierto.camara, encuadraCelda(documento), 'al reabrir ha vuelto al encuadre inicial en lugar de al guardado');
  });

  test('Una cámara guardada ilegible vuelve al encuadre inicial y no es un error del juego', async () => {
    const { resultado } = await elBanco();
    const documento = resultado.documento;
    const inicial = encuadraCelda(documento);
    for (const basura of ['', '{{', 'null', '{"version":1}', '{"cx":"norte","cy":0,"r":100}', JSON.stringify({ cx: 0, cy: 0 })]) {
      assert.deepEqual(leeCamara(basura, documento), inicial, `la cámara ilegible ${JSON.stringify(basura)} no ha caído al encuadre inicial`);
    }
    // Y una legible se relee dentro de sus topes.
    const guardada = { cx: 120, cy: -80, r: 300 };
    const texto = textoDeCamara(guardada, { mapaId: resultado.mapaId, clave: resultado.clave });
    assert.deepEqual(leeCamara(texto, documento), normaliza(guardada, documento));
    // Lo guardado lleva el mapa y la celda a los que pertenece: tres números sueltos no
    // dirían de qué mundo son.
    const leido = JSON.parse(texto);
    assert.deepEqual(Object.keys(leido).sort(), ['clave', 'cx', 'cy', 'mapaId', 'r', 'version']);
  });
});
