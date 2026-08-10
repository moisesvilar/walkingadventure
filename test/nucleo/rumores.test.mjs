// SPEC-012 · La propagación: dónde nace un rumor, cómo viaja por el árbol de
// calzadas, cuándo se agota y qué escribe en la partida.
//
// Dos clases de mundo, y las dos hacen falta. Los **sintéticos** llevan los metros y
// las marcas de suposición escritos a mano, que es la única manera de afirmar «a dos
// tramos» o «este salto cruza el monte» sin depender de un trazado. Los **reales**
// salen de `barrio-tres-calles` con tramo de 2 km: su celda del origen trae una
// calzada **cosida de 1553 m** y la celda `1,-2` cae fuera del extracto y tiene todas
// sus calzadas **fallback**, una de ellas de **2153 m**. Ese par es lo que impide
// colapsar el enumerado de SPEC-007 en un booleano sin que ninguna prueba se entere.
//
// Ninguna prueba de aquí toca la red, el reloj del sistema ni el azar: los datos de
// OSM salen de fixtures congelados, el mundo avanza los pasos que la prueba pide y
// el azar viene de la semilla.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás
// van declarados como huecos de la batería en test/spec-test-map.json.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { NIVEL_MAXIMO, SIGNOS } from '../../packages/nucleo/partida/deformacion.js';
import { congelaNucleos, estadoDeNucleos, loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { creaMotorDePasos, estadoDePasos } from '../../packages/nucleo/partida/pasos.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import {
  ID_DEL_PRODUCTOR,
  arbolDeCalzadas,
  congelaRumores,
  creaPropagacionDeRumores,
  declaracionDeRumor,
  estadoDeRumores,
  levantaRumores,
  naceRumor,
} from '../../packages/nucleo/partida/rumores.js';
import { SUPOSICIONES } from '../../packages/nucleo/world/grafo.js';
import { TEMPLATES } from '../../packages/nucleo/quests/templates.js';
import { fuente } from './mundo-de-prueba.mjs';
import {
  CELDA_COSIDA,
  CELDA_SIN_CALZADA_REAL,
  MAPA,
  PLANTILLA_NOTABLE,
  PLANTILLA_NO_NOTABLE,
  SEMILLA_A,
  SEMILLA_B,
  aSaltos,
  aristasDe,
  avanza,
  codigoDe,
  desenlaceEn,
  laUnicaArista,
  mundoDe,
  mundoLineal,
  mundoReal,
  nivelEn,
  origenReal,
  plantillaDe,
  propagacionSobre,
} from './rumor-de-prueba.mjs';

/** Los tres módulos que SPEC-012 entrega. Se inspeccionan como texto en varias pruebas. */
const MODULOS = [
  'packages/nucleo/partida/rumores.js',
  'packages/nucleo/partida/deformacion.js',
  'packages/nucleo/partida/nucleos.js',
];

/** La cadena de referencia: seis núcleos en fila, cada uno a 1 km del siguiente. */
const CADENA = ['Monfrida', 'Vilanova', 'Cadaval', 'Peiteiro', 'Ourille', 'Sanxil'];

describe('El nacimiento: dónde y con qué', () => {
  test('Nace fiel y en el sitio', () => {
    const { prop, nucleos, arbol } = propagacionSobre(mundoLineal(CADENA));
    const rumor = prop.nace(desenlaceEn('Monfrida'), 0);

    assert.equal(rumor.origen, 'Monfrida');
    assert.equal(nivelEn(nucleos, MAPA, 'Monfrida'), 0, 'el rumor tiene que existir en "Monfrida" en nivel 0');
    // Y no existe en ningún otro núcleo.
    for (const otro of arbol.nucleos.filter((n) => n !== 'Monfrida')) {
      assert.equal(nivelEn(nucleos, MAPA, otro), null, `"${otro}" no puede saber nada todavía`);
      assert.deepEqual(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: otro }), []);
    }
    // Fiel: en nivel 0 la versión que sedimenta es la misma que ocurrió.
    const [version] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Monfrida' });
    assert.equal(JSON.stringify(version.hechos), JSON.stringify(rumor.hechos));
    assert.deepEqual(version.ejes, []);
  });

  test('Un rumor recién nacido lleva identidad, origen, signo, nivel 0, los hechos fieles y su semilla', () => {
    const { prop } = propagacionSobre(mundoLineal(CADENA));
    const r = prop.nace(desenlaceEn('Monfrida'), 3);
    assert.equal(r.id, 'r1');
    assert.equal(r.origen, 'Monfrida');
    assert.equal(r.signo, SIGNOS.BUENO);
    assert.equal(r.nacidoEn, 3);
    assert.deepEqual(r.alcanzados, { Monfrida: 0 });
    assert.deepEqual(r.semilla, plantillaDe(PLANTILLA_NOTABLE).rumor.semilla);
    assert.equal(r.hechos.protagonista.tipo, 'jugadora');
    assert.equal(r.agotado, false);
  });

  test('El rumor solo aparece si el desenlace era notable', () => {
    const { prop, nucleos, arbol } = propagacionSobre(mundoLineal(CADENA));
    assert.equal(prop.nace(desenlaceEn('Monfrida', { plantilla: PLANTILLA_NO_NOTABLE }), 0), null);
    for (const n of arbol.nucleos) assert.deepEqual(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n }), []);
    assert.deepEqual(prop.activos(), []);
  });

  test('Un cierre en corto no genera rumor', () => {
    // Ni aunque el desenlace de repuesto de su plantilla esté declarado notable: se
    // mira **antes** que la declaración, porque RF-QUEST-013 es categórico.
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA));
    assert.equal(prop.nace(desenlaceEn('Monfrida', { cierreEnCorto: true }), 0), null);
    avanza(prop, 10);
    for (const n of CADENA) assert.deepEqual(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n }), [], `"${n}" no puede saber nada de una aventura cerrada en corto`);
  });

  test('Un paseo sin aventura tiene telón completo menos desenlace', () => {
    // La mitad `@nucleo` del escenario: sin desenlace no nace rumor, y no es un error.
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA));
    assert.equal(prop.nace(null, 0), null);
    assert.equal(prop.nace(undefined, 0), null);
    avanza(prop, 5);
    for (const n of CADENA) assert.deepEqual(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n }), []);
  });

  test('Si una plantilla es notable lo dice su declaración y no se deduce del texto', () => {
    for (const plantilla of TEMPLATES) {
      const decl = declaracionDeRumor(plantilla);
      assert.equal(typeof decl.notable, 'boolean', `la plantilla "${plantilla.id}" no declara si es notable`);
      if (decl.notable) assert.ok(['bueno', 'feo'].includes(decl.signo));
    }
    // Y una plantilla que no lo declare falla nombrándose, en lugar de pasar por no notable.
    assert.throws(() => declaracionDeRumor({ id: 'sin-declarar', beats: [] }), (e) => e.message.includes('"sin-declarar"'));
    assert.throws(() => declaracionDeRumor({ id: 'medio', rumor: {} }), (e) => e.message.includes('"medio"'));
    assert.throws(() => declaracionDeRumor({ id: 'sin-signo', rumor: { notable: true } }), (e) => e.message.includes('"sin-signo"'));
  });

  test('El signo lo fija el código a partir del desenlace y nunca un texto', () => {
    const { prop } = propagacionSobre(mundoLineal(CADENA));
    // El desenlace concreto manda sobre el de la plantilla: la partida pudo ofrecer otra salida.
    const feo = prop.nace(desenlaceEn('Monfrida', { id: 'r-feo', signo: SIGNOS.FEO }), 0);
    assert.equal(feo.signo, SIGNOS.FEO);
    for (const malo of ['neutro', '', 'Bueno', 0, true]) {
      assert.throws(
        () => prop.nace(desenlaceEn('Monfrida', { id: `r-${String(malo)}`, signo: malo }), 0),
        (e) => e instanceof Error && e.message.includes(JSON.stringify(malo) ?? String(malo)),
      );
    }
  });

  test('Un núcleo de origen que no existe en el mapa activo falla nombrándolo', () => {
    const { prop } = propagacionSobre(mundoLineal(CADENA));
    assert.throws(() => prop.nace(desenlaceEn('Aldea Inventada'), 0), (e) => e.message.includes('"Aldea Inventada"'));
    // Y un desenlace que no dice dónde ocurrió tampoco engendra un rumor de ninguna parte.
    assert.throws(() => prop.nace({ id: 'x', plantilla: plantillaDe(PLANTILLA_NOTABLE) }, 0), /no dice dónde ocurrió/);
  });

  test('Dos aventuras notables de la misma salida nacen con identidades distintas', () => {
    const { prop, estado } = propagacionSobre(mundoLineal(CADENA));
    const a = prop.nace(desenlaceEn('Monfrida', { id: 'r-a' }), 4);
    const b = prop.nace(desenlaceEn('Cadaval', { id: 'r-b', plantilla: 'tres-pistas' }), 4);
    assert.notEqual(a.id, b.id);
    assert.deepEqual(prop.activos(), ['r-a', 'r-b'], 'cada uno viaja por su cuenta');
    assert.equal(congelaRumores(estado).mapas[MAPA].rumores.length, 2);
    // Y dos sucesos con la misma identidad se rechazan: se pisarían al sedimentar.
    assert.throws(() => prop.nace(desenlaceEn('Monfrida', { id: 'r-a' }), 4), /"r-a"/);
  });

  test('Un desenlace en un paraje nace en el núcleo del que cuelga y el enganche no cuenta como salto', () => {
    const mundo = mundoDe(
      [['Monfrida', 'Vilanova', { metros: 1000 }]],
      { parajes: [{ name: 'O Paso do Demo', cuelgaDe: 'Vilanova' }] },
    );
    const { prop, nucleos } = propagacionSobre(mundo);
    const r = prop.nace(desenlaceEn('O Paso do Demo', { tipo: 'paraje' }), 0);
    assert.equal(r.origen, 'Vilanova', 'el rumor nace en el núcleo del que cuelga el paraje');
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), 0, 'el enganche no puede cobrar un salto');
    assert.equal(nivelEn(nucleos, MAPA, 'Monfrida'), null);
  });

  test('Un paraje del mundo real cuelga del núcleo al que se llega por menos metros de calzada', async () => {
    const { mundo, arbol } = await mundoReal(CELDA_COSIDA);
    // La guarda existe para que el bucle de abajo mida algo, y el número es el medido:
    // desde SPEC-041 el reparto del repertorio filtra los sorteos de nombre y con ellos
    // el flujo de azar de cada fase, así que esta celda pasó de seis parajes a cinco.
    assert.ok(mundo.parajes.length >= 5, `la celda del origen tiene que traer parajes con los que probar el enganche y trae ${mundo.parajes.length}`);
    for (const p of mundo.parajes) {
      const nucleo = arbol.nucleoDeParaje(p.name);
      assert.ok(arbol.tiene(nucleo), `"${p.name}" cuelga de "${nucleo}", que no está en el árbol`);
    }
    // Un paraje que este mapa no conoce falla nombrándose: elegir el núcleo más
    // cercano en línea recta inventaría dónde nace la noticia.
    assert.throws(() => arbol.nucleoDeParaje('A Fraga Que No Existe'), (e) => e.message.includes('"A Fraga Que No Existe"'));
  });

  test('Un rumor recién nacido se escribe en la partida y no en el documento de la celda', async () => {
    const { registro, arbol } = await mundoReal(CELDA_COSIDA);
    const antes = textoDeCelda(registro);
    const { prop } = propagacionSobre(null, { arbol });
    prop.nace(desenlaceEn(arbol.nucleos[0]), 0);
    assert.equal(textoDeCelda(registro), antes, 'el documento congelado de la celda ha cambiado al nacer un rumor');
    assert.ok(!antes.includes('"rumores"') && !antes.includes('"alcanzados"'), 'el documento del mundo trae estado de rumores');
  });
});

describe('El viaje: un tramo por paso, por el árbol', () => {
  test('Avanza un tramo por paso del mundo', () => {
    // El esquema de la batería: el vecino está a dos tramos por calzada, así que con
    // un paso el rumor no ha llegado y con dos sí.
    for (const [pasos, haLlegado] of [[1, false], [2, true]]) {
      const { prop, nucleos } = propagacionSobre(mundoLineal(['Monfrida', 'Vilanova'], { metros: 4000 }), { tramo: 2000 });
      prop.nace(desenlaceEn('Monfrida'), 0);
      avanza(prop, pasos);
      assert.equal(nivelEn(nucleos, MAPA, 'Vilanova') !== null, haLlegado, `con ${pasos} paso(s) el vecino ${haLlegado ? 'tenía' : 'no tenía'} que haberlo oído`);
    }
  });

  test('El frente avanza el tramo con el que se contó ese paso, no una distancia fija', () => {
    // Dos jugadoras, dos mundos dimensionados a lo suyo: una anda 600 m por paso y
    // la otra 2 km. Las dos llegan **en los mismos dos pasos**, habiendo recorrido
    // 1 200 m y 4 000 m. Con 2 km fijos, quien anda 600 m vería su fama adelantarse
    // siempre y «El jugador se puede adelantar a su propia fama» dejaría de valer.
    const medidas = [];
    for (const [tramo, distancia] of [[600, 1000], [2000, 3000]]) {
      const { prop, nucleos } = propagacionSobre(mundoLineal(['Monfrida', 'Vilanova'], { metros: distancia }), { tramo });
      prop.nace(desenlaceEn('Monfrida'), 0);
      let pasos = 0;
      while (nivelEn(nucleos, MAPA, 'Vilanova') === null && pasos < 20) { pasos += 1; avanza(prop, 1, pasos); }
      medidas.push({ tramo, pasos, recorrido: pasos * tramo });
    }
    assert.deepEqual(medidas.map((m) => m.pasos), [2, 2], 'los dos rumores tienen que llegar en el mismo número de pasos');
    assert.deepEqual(medidas.map((m) => m.recorrido), [1200, 4000], 'y habiendo recorrido metros muy distintos');
  });

  test('El resto de metros del frente se conserva y se suma en el paso siguiente', () => {
    // Monfrida → Vilanova 1 000 m, Vilanova → Cadaval 700 m, tramo 600 m.
    // Paso 2: 1 200 ≥ 1 000, llega a Vilanova y le sobran 200.
    // Paso 3: 200 + 600 = 800 ≥ 700, llega a Cadaval. Sin conservar el resto llegaría
    // en el paso 4, que es exactamente la diferencia que esta prueba mide.
    const mundo = mundoDe([['Monfrida', 'Vilanova', { metros: 1000 }], ['Vilanova', 'Cadaval', { metros: 700 }]]);
    const { prop, nucleos, estado } = propagacionSobre(mundo, { tramo: 600 });
    prop.nace(desenlaceEn('Monfrida'), 0);

    avanza(prop, 1);
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), null);
    assert.equal(congelaRumores(estado).mapas[MAPA].rumores[0].frentes[0].avanzadoM, 600, 'el frente no ha guardado lo andado');

    avanza(prop, 1, 2);
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), 1);
    assert.equal(congelaRumores(estado).mapas[MAPA].rumores[0].frentes[0].avanzadoM, 200, 'el resto de 200 m tiene que sobrevivir al salto');

    avanza(prop, 1, 3);
    assert.equal(nivelEn(nucleos, MAPA, 'Cadaval'), 2, 'con el resto conservado, Cadaval oye el rumor en el paso 3');
  });

  test('La distancia se mide sobre la longitud real de las calzadas y no en línea recta', () => {
    // Los dos núcleos están a 1 000 m en línea recta —el mundo sintético los coloca
    // en fila— y la calzada que los une mide 9 000 m. Manda la calzada.
    const mundo = mundoDe([['Monfrida', 'Vilanova', { metros: 9000, trozos: 9 }]]);
    const { prop, nucleos, arbol } = propagacionSobre(mundo, { tramo: 2000 });
    assert.equal(arbol.metrosDe('Monfrida', 'Vilanova'), 9000);
    assert.equal(Math.hypot(mundo.settlements[1].x - mundo.settlements[0].x, 0), 1000, 'en línea recta están mucho más cerca');
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 4);
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), null, 'con 8 000 m recorridos todavía no puede haber llegado');
    avanza(prop, 1, 5);
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), 1);
  });

  test('El jugador se puede adelantar a su propia fama', () => {
    // Ir derecho al pueblo vecino es llegar a la vez que la noticia; entretenerse por
    // el monte es llegar detrás de ella. Las dos van a la misma velocidad —un tramo
    // por paso— así que la jugadora nunca puede llegar después si no se entretiene.
    for (const [tramo, distancia] of [[600, 1000], [600, 3000], [2000, 2000], [2000, 5000], [1200, 1200]]) {
      const { prop, nucleos } = propagacionSobre(mundoLineal(['Monfrida', 'Vilanova'], { metros: distancia }), { tramo });
      prop.nace(desenlaceEn('Monfrida'), 0);
      const pasosDeLaJugadora = Math.ceil(distancia / tramo);
      let pasosDelRumor = 0;
      while (nivelEn(nucleos, MAPA, 'Vilanova') === null && pasosDelRumor < 30) { pasosDelRumor += 1; avanza(prop, 1, pasosDelRumor); }
      assert.ok(
        pasosDeLaJugadora <= pasosDelRumor,
        `yendo derecho con tramo ${tramo} m a ${distancia} m, la jugadora llega en ${pasosDeLaJugadora} pasos y la noticia en ${pasosDelRumor}`,
      );
    }
  });

  test('Sin ningún paso del mundo el rumor no avanza ni un metro', () => {
    // Por mucho tiempo real que pase: el reloj del mundo son los kilómetros.
    const { prop, nucleos, estado } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    const antes = JSON.stringify(congelaRumores(estado));
    avanza(prop, 0);
    assert.equal(JSON.stringify(congelaRumores(estado)), antes);
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), null);
  });

  test('Entre dos núcleos del árbol hay exactamente un camino, y es por el que viaja', async () => {
    // `buildRoutes` traza un árbol de expansión mínima, así que el número de calzadas
    // entre núcleos es el de núcleos menos uno y no hay ningún ciclo por el que un
    // rumor pudiera llegar dos veces con niveles distintos.
    for (const celda of [CELDA_COSIDA, CELDA_SIN_CALZADA_REAL]) {
      const { arbol } = await mundoReal(celda);
      const aristas = arbol.nucleos.reduce((n, id) => n + arbol.vecinos(id).length, 0) / 2;
      assert.equal(aristas, arbol.nucleos.length - 1, 'el árbol de calzadas tiene un ciclo o está partido');
    }
  });

  test('Un rumor que se bifurca sigue por todas las ramas a la vez, cada una con su frente', () => {
    const mundo = mundoDe([
      ['Monfrida', 'Norte', { metros: 1000 }],
      ['Monfrida', 'Sur', { metros: 3000 }],
      ['Monfrida', 'Leste', { metros: 5000 }],
    ]);
    const { prop, nucleos } = propagacionSobre(mundo, { tramo: 1000 });
    const r = prop.nace(desenlaceEn('Monfrida'), 0);
    assert.equal(r.frentes.length, 3, 'con tres calzadas salen tres frentes');
    avanza(prop, 1);
    assert.deepEqual(
      ['Norte', 'Sur', 'Leste'].map((n) => nivelEn(nucleos, MAPA, n)),
      [1, null, null],
      'cada rama lleva su propio frente y llega cuando le toca',
    );
    avanza(prop, 4, 2);
    assert.deepEqual(['Norte', 'Sur', 'Leste'].map((n) => nivelEn(nucleos, MAPA, n)), [1, 1, 1]);
  });

  test('Un núcleo que ya oyó el rumor no lo vuelve a oír por otra rama', () => {
    // El mundo es un árbol, así que la vuelta por otra rama solo puede ocurrir en el
    // mismo paso; lo que se afirma es que el frente muere y la versión no cambia.
    const mundo = mundoDe([
      ['Monfrida', 'Vilanova', { metros: 1000 }],
      ['Vilanova', 'Cadaval', { metros: 1000 }],
      ['Cadaval', 'Peiteiro', { metros: 1000 }],
    ]);
    const { prop, nucleos } = propagacionSobre(mundo, { tramo: 4000 });
    prop.nace(desenlaceEn('Vilanova'), 0);
    avanza(prop, 1);
    const antes = JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Cadaval' }));
    avanza(prop, 10, 2);
    assert.equal(JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Cadaval' })), antes, 'la versión de un núcleo no puede cambiar después de oírla');
    assert.equal(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Cadaval' }).length, 1, 'un núcleo no puede oír dos veces el mismo rumor');
  });

  test('Un núcleo al que el árbol no ofrece camino nunca lo oye, y eso no es un error', () => {
    // Dos componentes: la propagación **lee** el árbol y no lo cose, así que un
    // núcleo suelto se queda fuera para siempre y sin fallar.
    const mundo = mundoDe([['Monfrida', 'Vilanova', { metros: 1000 }], ['Lonxe', 'Máis Lonxe', { metros: 1000 }]]);
    const { prop, nucleos } = propagacionSobre(mundo, { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 50);
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), 1);
    assert.equal(nivelEn(nucleos, MAPA, 'Lonxe'), null);
    assert.equal(nivelEn(nucleos, MAPA, 'Máis Lonxe'), null);
  });

  test('Dos núcleos alcanzados en el mismo paso se entregan por identificador', () => {
    // El orden es declarado y no el del recorrido: dos ejecuciones desde cero tienen
    // que producir los efectos del paso en el mismo orden.
    const mundo = mundoDe([
      ['Monfrida', 'Zamil', { metros: 1000 }],
      ['Monfrida', 'Arcos', { metros: 1000 }],
      ['Monfrida', 'Meira', { metros: 1000 }],
    ]);
    const { prop } = propagacionSobre(mundo, { tramo: 1000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    const efectos = avanza(prop, 1)[0];
    assert.deepEqual(efectos.map((e) => e.nucleo), ['Arcos', 'Meira', 'Zamil'], 'las llegadas se entregan por identificador de núcleo');
  });

  test('Un rumor avanza durante la caminata y no al echar el telón', () => {
    // Se produce en cada paso del motor, que es lo que ocurre al completar los metros
    // de un tramo; no hay ninguna operación de «cerrar la salida» que lo mueva.
    const { prop, nucleos, estado } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    const motor = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: MAPA, estado: estadoDePasos(), productores: [prop] });
    const paso = motor.paso(1);
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), 1, 'el rumor tiene que haber avanzado con el paso, no al final de la salida');
    assert.ok(paso.efectos.some((e) => e.tipo === 'rumor' && e.nucleo === 'Vilanova'));
    assert.equal(prop.id, ID_DEL_PRODUCTOR, 'la propagación se registra en el motor como un productor con identificador propio');
  });
});

describe('El nivel sobre dato real: cosida no penaliza y fallback sí', () => {
  test('Una calzada cosida de 1717 m entrega en nivel 1 y una fallback de 2153 m en nivel 2', async () => {
    // Los dos casos medidos sobre `barrio-tres-calles` con tramo de 2 km, y no se
    // pueden colapsar: es la mitad que se pierde si alguien convierte el enumerado de
    // tres valores de SPEC-007 en un booleano. Las dos calzadas se buscan **por lo que
    // son** —la única cosida de su celda, la fallback más larga de la suya— y no por el
    // nombre de los pueblos que unen: cómo se llaman es dato del reparto del repertorio
    // (SPEC-041) y lo que este caso mide son los metros y la marca del tramo.
    const cosida = await mundoReal(CELDA_COSIDA);
    const laCosida = laUnicaArista(aristasDe(cosida.mundo, cosida.arbol), (e) => e.cosida, 'con algún tramo cosido');
    assert.equal(laCosida.metros, 1717, 'la calzada cosida de esta celda medía 1717 m');
    assert.equal(laCosida.cruzaElMonte, false, 'lo cosido no cruza el monte');
    assert.ok(laCosida.metros <= 2000, 'la calzada cosida tiene que caber en un solo paso para que el salto sea uno');
    const a = propagacionSobre(null, { arbol: cosida.arbol, tramo: 2000 });
    a.prop.nace(desenlaceEn(laCosida.a), 0);
    avanza(a.prop, 1);
    assert.equal(nivelEn(a.nucleos, MAPA, laCosida.b), 1, 'un salto por calzada cosida es nivel 1');

    const fallback = await mundoReal(CELDA_SIN_CALZADA_REAL);
    const aristas = aristasDe(fallback.mundo, fallback.arbol);
    assert.ok(aristas.every((e) => e.fallback), 'la celda de fuera del extracto tiene que traer todas sus calzadas fallback');
    const laFallback = aristas.reduce((mayor, e) => (e.metros > mayor.metros ? e : mayor));
    assert.equal(laFallback.metros, 2153, 'la fallback más larga de esa celda medía 2153 m');
    assert.equal(laFallback.cruzaElMonte, true);
    const b = propagacionSobre(null, { arbol: fallback.arbol, tramo: 2000 });
    b.prop.nace(desenlaceEn(laFallback.a), 0);
    avanza(b.prop, 2);
    assert.equal(nivelEn(b.nucleos, MAPA, laFallback.b), 2, 'un salto que cruza un trozo sin calzada real es nivel 2');
  });

  test('Cruzar un tramo sin calzada real cuesta un nivel más', () => {
    // El mismo salto, la misma distancia, la única diferencia es la marca del tramo.
    const niveles = [SUPOSICIONES.NINGUNA, SUPOSICIONES.COSIDA, SUPOSICIONES.FALLBACK].map((suposicion) => {
      const { prop, nucleos } = propagacionSobre(mundoLineal(['Monfrida', 'Vilanova'], { metros: 1000, suposicion }), { tramo: 2000 });
      prop.nace(desenlaceEn('Monfrida'), 0);
      avanza(prop, 1);
      return nivelEn(nucleos, MAPA, 'Vilanova');
    });
    assert.deepEqual(niveles, [1, 1, 2], 'sin marca 1, cosida 1, fallback 2');
  });

  test('Dos caminos de un salto, uno cosido y otro sin ninguna suposición, llegan en el mismo nivel', async () => {
    // Sobre dato real: hay un núcleo con un vecino por calzada limpia y otro por calzada
    // cosida, y los dos lo reciben igual de fiel. Se busca por esa forma —un extremo de
    // la cosida que además tenga una limpia— y no por el nombre de los tres pueblos.
    const { mundo, arbol } = await mundoReal(CELDA_COSIDA);
    const aristas = aristasDe(mundo, arbol);
    const laCosida = laUnicaArista(aristas, (e) => e.cosida, 'con algún tramo cosido');
    const tocaA = (e, n) => e.a === n || e.b === n;
    const elOtro = (e, n) => (e.a === n ? e.b : e.a);
    const desde = [laCosida.a, laCosida.b].find((n) => aristas.some((e) => e.limpia && tocaA(e, n)));
    assert.ok(desde, 'ningún extremo de la calzada cosida tiene además un vecino por calzada limpia: el caso no compararía nada');
    const laLimpia = aristas.find((e) => e.limpia && tocaA(e, desde));
    assert.ok(laCosida.metros <= 2000 && laLimpia.metros <= 2000, 'los dos caminos tienen que ser de un solo salto');
    const porCosida = elOtro(laCosida, desde);
    const porLimpia = elOtro(laLimpia, desde);
    assert.equal(arbol.cruzaElMonteDe(desde, porLimpia), false);
    assert.equal(arbol.cruzaElMonteDe(desde, porCosida), false);
    const { prop, nucleos } = propagacionSobre(null, { arbol, tramo: 2000 });
    prop.nace(desenlaceEn(desde), 0);
    avanza(prop, 1);
    assert.equal(nivelEn(nucleos, MAPA, porLimpia), 1);
    assert.equal(nivelEn(nucleos, MAPA, porCosida), 1, 'lo cosido no puede penalizar');
  });

  test('Un salto con dos tramos fallback suma uno solo, no uno por tramo', () => {
    const dosTrozos = [SUPOSICIONES.FALLBACK, SUPOSICIONES.FALLBACK];
    const mundo = mundoDe([['Monfrida', 'Vilanova', { metros: 1000, suposicion: dosTrozos }]]);
    const { prop, nucleos } = propagacionSobre(mundo, { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 1);
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), 2, 'la penalización es por salto: la noticia cruzó el monte, no cuántas veces lo cruzó');
  });

  test('Dos núcleos a la misma distancia pueden recibir versiones distintas', () => {
    // Los dos a 6 km de «Monfrida»: al primero se llega por dos aldeas intermedias y
    // al segundo directo. Lo que decide el nivel son las bocas que lo recuentan.
    const mundo = mundoDe([
      ['Monfrida', 'Aldea Primeira', { metros: 2000 }],
      ['Aldea Primeira', 'Aldea Segunda', { metros: 2000 }],
      ['Aldea Segunda', 'Pola Lonxa', { metros: 2000 }],
      ['Monfrida', 'Pola Directa', { metros: 6000 }],
    ]);
    const { prop, nucleos, arbol } = propagacionSobre(mundo, { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 3);

    assert.equal(arbol.metrosDe('Monfrida', 'Pola Directa'), 6000);
    const porAldeas = nivelEn(nucleos, MAPA, 'Pola Lonxa');
    const directo = nivelEn(nucleos, MAPA, 'Pola Directa');
    assert.equal(directo, 1);
    assert.equal(porAldeas, 3);
    assert.ok(porAldeas > directo, 'el que llega por dos aldeas tiene que recibirlo más deformado');
    // Y las versiones de verdad son distintas, no solo el número.
    const [uno] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Pola Lonxa' });
    const [otro] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Pola Directa' });
    assert.notEqual(JSON.stringify(uno.hechos), JSON.stringify(otro.hechos));
    assert.equal(uno.signo, otro.signo, 'lo que no puede cambiar entre las dos versiones es el signo');
  });

  test('El nivel de un núcleo se fija al llegar y no cambia después', () => {
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 1);
    const antes = JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' }));
    avanza(prop, 40, 2);
    assert.equal(JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' })), antes);
  });

  test('En un mundo sin ninguna calzada real cada salto suma dos niveles', async () => {
    // La celda `1,-2` cae fuera del extracto de OSM: todas sus calzadas son fallback.
    // El rumor viaja igual, solo que se tuerce el doble de deprisa.
    const { arbol } = await mundoReal(CELDA_SIN_CALZADA_REAL);
    for (const a of arbol.nucleos) {
      for (const b of arbol.vecinos(a)) assert.equal(arbol.cruzaElMonteDe(a, b), true);
    }
    // El origen y los dos destinos salen del árbol —el primero con vecinos, uno a un
    // salto y otro a dos— y no de tres nombres escritos a mano: lo que el caso afirma es
    // cuánto cuesta un salto por el monte, no cómo se llame el pueblo del otro lado.
    const origen = origenReal(arbol);
    const aUnSalto = aSaltos(arbol, origen, 1);
    const aDosSaltos = aSaltos(arbol, origen, 2);
    const { prop, nucleos } = propagacionSobre(null, { arbol, tramo: 4000 });
    prop.nace(desenlaceEn(origen), 0);
    avanza(prop, 6);
    assert.equal(nivelEn(nucleos, MAPA, aUnSalto), 2, 'un salto por el monte son dos niveles');
    assert.equal(nivelEn(nucleos, MAPA, aDosSaltos), 3, 'dos saltos por el monte topan en tres');
  });

  test('Una calzada sin longitud o sin tramos declarados falla nombrándola', () => {
    const mundo = mundoDe([['Monfrida', 'Vilanova', { metros: 1000 }]]);
    mundo.routes[0].tramos[0].metros = undefined;
    const { prop } = propagacionSobre(mundo, { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    assert.throws(() => avanza(prop, 1), (e) => e.message.includes('Calzada de Monfrida a Vilanova'));

    const sinTramos = mundoDe([['Monfrida', 'Vilanova', { metros: 1000 }]]);
    delete sinTramos.routes[0].tramos;
    const otra = propagacionSobre(sinTramos, { tramo: 2000 });
    otra.prop.nace(desenlaceEn('Monfrida'), 0);
    assert.throws(() => avanza(otra.prop, 1), /no declara sus tramos/);
  });

  test('Un tramo de calzada sin marca de suposición falla nombrando el tramo', () => {
    const mundo = mundoDe([['Monfrida', 'Vilanova', { metros: 900, trozos: 3 }]]);
    delete mundo.routes[0].tramos[1].suposicion;
    const { prop } = propagacionSobre(mundo, { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    assert.throws(
      () => avanza(prop, 1),
      (e) => e.message.includes('el tramo 2 de') && e.message.includes('Calzada de Monfrida a Vilanova'),
      'el fallo tiene que nombrar el tramo concreto, en lugar de suponer que es calzada real',
    );
  });

  test('Un paso que llega sin el tramo con el que medir falla nombrándolo', () => {
    const { prop } = propagacionSobre(mundoLineal(CADENA), { tramo: null });
    prop.nace(desenlaceEn('Monfrida'), 0);
    assert.throws(() => avanza(prop, 1), /no ha recibido el tramo con el que se contó el paso/);
    // Y un tramo que no es un número de metros positivo tampoco pasa por defecto.
    const cero = propagacionSobre(mundoLineal(CADENA), { tramo: 0 });
    cero.prop.nace(desenlaceEn('Monfrida'), 0);
    assert.throws(() => avanza(cero.prop, 1), /tramoM/);
  });
});

describe('Se agota solo y sedimenta', () => {
  test('El rumor se agota solo', async () => {
    // Sobre el mundo real, y con las dos vías por las que `quests.md` §6 lo agota: el
    // frente se para al entregar en nivel 3, y el árbol es finito.
    const { arbol } = await mundoReal(CELDA_COSIDA);
    const { prop, nucleos } = propagacionSobre(null, { arbol, tramo: 2000 });
    prop.nace(desenlaceEn(origenReal(arbol)), 0);
    avanza(prop, 50);

    assert.deepEqual(prop.activos(), [], 'después de cincuenta pasos el rumor ya no viaja');
    const oyeron = arbol.nucleos.filter((n) => nivelEn(nucleos, MAPA, n) !== null);
    assert.ok(oyeron.length >= 2, 'alguien tiene que haberlo oído');
    for (const n of oyeron) {
      const [version] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n });
      assert.equal(typeof version.nivel, 'number', `en "${n}" no ha sedimentado nada`);
      assert.equal(version.signo, SIGNOS.BUENO);
    }
  });

  test('La cadena de seis núcleos recibe 0, 1, 2 y 3, y los dos últimos no lo oyen nunca', () => {
    // El frente se para en cuanto entrega en nivel 3: ese núcleo sí lo oye, los que
    // quedan más allá por esa rama no. Es la lectura que la spec da a la fila `| 5 | 3 |`
    // del esquema de la batería, y por eso allí se pregunta por el nivel que
    // *corresponde* a cinco saltos y no por el nivel con el que *llegó*.
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 100);
    assert.deepEqual(CADENA.map((n) => nivelEn(nucleos, MAPA, n)), [0, 1, 2, 3, null, null]);
    assert.deepEqual(prop.activos(), []);

    // Y cien pasos más no cambian nada: lo sedimentado no caduca, no se olvida y no
    // se degrada, y un rumor agotado no produce ningún efecto.
    const antes = CADENA.map((n) => JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n })));
    const efectos = avanza(prop, 100, 101);
    assert.deepEqual(efectos.flat(), [], 'un rumor agotado no produce ningún efecto');
    assert.deepEqual(CADENA.map((n) => JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n }))), antes);
  });

  test('Un rumor que ya alcanzó todo lo que el árbol permite queda agotado', () => {
    // La otra vía del agotamiento, y la que lo cierra en un mundo pequeño: no hace
    // falta ni tope de rumores activos ni caducidad por pasos.
    const { prop, nucleos } = propagacionSobre(mundoLineal(['Monfrida', 'Vilanova']), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 1);
    assert.equal(nivelEn(nucleos, MAPA, 'Vilanova'), 1, 'llegó sin toparse en nivel 3');
    assert.deepEqual(prop.activos(), [], 'y aun así queda agotado, porque no le queda a quién contárselo');
  });

  test('Veinte rumores a la vez avanzan todos y no hay ningún tope', () => {
    const { prop, nucleos, estado } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    for (let k = 0; k < 20; k++) prop.nace(desenlaceEn('Monfrida', { id: `r-${k}` }), 0);
    assert.equal(prop.activos().length, 20, 'no puede haber tope de rumores activos');
    avanza(prop, 1);
    const enVilanova = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' });
    assert.equal(enVilanova.length, 20, 'los veinte tienen que haber avanzado en el mismo paso');
    assert.equal(congelaRumores(estado).mapas[MAPA].rumores.length, 20);
  });

  test('Un rumor nuevo sobre un núcleo donde ya sedimentó otro convive con él', () => {
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida', { id: 'r-viejo' }), 0);
    avanza(prop, 1);
    prop.nace(desenlaceEn('Monfrida', { id: 'r-nuevo', plantilla: 'tres-pistas' }), 1);
    avanza(prop, 1, 2);
    const enVilanova = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' });
    assert.deepEqual(enVilanova.map((v) => v.rumor).sort(), ['r-nuevo', 'r-viejo'], 'ninguno sustituye al otro');
  });

  test('La versión fiel se conserva aunque haya sedimentado deformada en varios núcleos', () => {
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    const nacido = prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 10);
    const fiel = prop.versionFiel('r1');
    assert.equal(fiel.nivel, 0);
    assert.equal(fiel.signo, nacido.signo);
    assert.equal(JSON.stringify(fiel.hechos), JSON.stringify(nacido.hechos), 'la versión fiel tiene que seguir siendo consultable para quien estuvo presente');
    // Y lo sedimentado en un núcleo lejano es la deformada, no la fiel.
    const [lejos] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Peiteiro' });
    assert.equal(lejos.nivel, 3);
    assert.notEqual(JSON.stringify(lejos.hechos), JSON.stringify(fiel.hechos));
    assert.throws(() => prop.versionFiel('no-existe'), /"no-existe"/);
  });
});

describe('Vacíos, entradas inválidas y errores', () => {
  test('Un paso sin ningún rumor activo no produce nada y no falla', () => {
    // Y **no pide el tramo**: un paso sin rumores no puede fallar por un dato que no
    // hace falta, que es lo que ocurriría si se resolviera antes de mirar.
    const { prop } = propagacionSobre(mundoLineal(CADENA), { tramo: null });
    assert.deepEqual(avanza(prop, 5).flat(), []);
  });

  test('Un mundo de un solo núcleo sedimenta ahí y no viaja a ninguna parte', () => {
    const mundo = mundoDe([], { sueltos: ['Monfrida'] });
    const { prop, nucleos } = propagacionSobre(mundo, { tramo: 2000 });
    const r = prop.nace(desenlaceEn('Monfrida'), 0);
    assert.deepEqual(r.frentes, [], 'sin ningún vecino al que llegar no hay frente que crear');
    assert.equal(r.agotado, true);
    assert.equal(nivelEn(nucleos, MAPA, 'Monfrida'), 0);
    assert.deepEqual(avanza(prop, 10).flat(), []);
  });

  test('Un mapa sin ningún núcleo no hace nada y no falla', () => {
    const { prop, arbol } = propagacionSobre(mundoDe([]), { tramo: 2000 });
    assert.deepEqual(arbol.nucleos, []);
    assert.deepEqual(avanza(prop, 3).flat(), []);
  });

  test('Un paso que falla a mitad no cambia ni el contador ni lo que se cuenta en ningún núcleo', () => {
    // La calzada rota está en la segunda rama: la primera ya ha calculado su llegada
    // cuando la segunda revienta, y aun así no puede haberse escrito nada.
    const mundo = mundoDe([
      ['Monfrida', 'Arcos', { metros: 1000 }],
      ['Monfrida', 'Zamil', { metros: 1000 }],
    ]);
    mundo.routes[1].tramos[0].metros = 'muchos';
    const { prop, nucleos, estado } = propagacionSobre(mundo, { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    const motor = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: MAPA, estado: estadoDePasos(), productores: [prop] });

    const rumoresAntes = JSON.stringify(congelaRumores(estado));
    const nucleosAntes = JSON.stringify(nucleos);
    assert.throws(() => motor.paso(1), /Calzada de Monfrida a Zamil/);
    assert.equal(motor.contador(), 0, 'el contador no puede haber avanzado con un paso que no se aplicó');
    assert.equal(JSON.stringify(congelaRumores(estado)), rumoresAntes, 'el viaje del rumor ha cambiado en un paso que falló');
    assert.equal(JSON.stringify(nucleos), nucleosAntes, 'ha sedimentado algo en un paso que falló');
    assert.equal(nivelEn(nucleos, MAPA, 'Arcos'), null);
  });

  test('El estado de rumores mal formado y el mapa ausente fallan diciéndolo', () => {
    assert.throws(() => naceRumor({ estado: {}, mapaId: MAPA, arbol: arbolDeCalzadas(mundoLineal(CADENA)), desenlace: desenlaceEn('Monfrida') }), /estadoDeRumores/);
    for (const malo of ['', null, undefined, 7]) {
      assert.throws(
        () => creaPropagacionDeRumores({ semilla: SEMILLA_A, mapaId: malo, arbol: arbolDeCalzadas(mundoLineal(CADENA)) }),
        (e) => e.message.includes('falta el mapa activo'),
      );
    }
    // Y sin el árbol ya leído no se levanta: esta entrega no traza, no cose y no recalcula.
    assert.throws(() => creaPropagacionDeRumores({ semilla: SEMILLA_A, mapaId: MAPA, arbol: null }), /no lo traza, no lo cose y no lo recalcula/);
  });

  test('Un número de paso que no es un entero no negativo falla nombrándolo', () => {
    const { prop } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    for (const malo of [-1, 1.5, '3', null]) {
      assert.throws(() => prop.produce(malo, null), (e) => e.message.includes(JSON.stringify(malo) ?? String(malo)));
    }
  });

  test('Dos núcleos del mapa con el mismo nombre se rechazan al leer el árbol', () => {
    // El nombre es el identificador: compartirían lo que se cuenta de la jugadora sin
    // que nadie lo notara.
    const mundo = mundoLineal(['Monfrida', 'Vilanova']);
    mundo.settlements.push({ name: 'Monfrida', x: 5000, y: 0, type: 'aldea', services: [] });
    assert.throws(() => arbolDeCalzadas(mundo), /comparten el nombre "Monfrida"/);
    assert.throws(() => arbolDeCalzadas({ settlements: [{ x: 0, y: 0 }], routes: [] }), /sin nombre/);
  });

  test('Los efectos de un paso son del catálogo cerrado de SPEC-011 y solo añaden', () => {
    const { prop } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    const efectos = avanza(prop, 3).flat();
    assert.ok(efectos.length >= 3);
    for (const e of efectos) {
      assert.equal(e.tipo, 'rumor', 'una noticia que llega a un sitio es del tipo "rumor" del catálogo');
      assert.deepEqual(Object.keys(e).sort(), ['asunto', 'nivel', 'nucleo', 'origen', 'signo', 'tipo']);
      // No resta oro, no baja ningún rango, no retira nada.
      for (const campo of ['oro', 'rango', 'retira', 'quita', 'caduca', 'resta', 'penaliza']) {
        assert.ok(!(campo in e), `el efecto trae "${campo}", y un paso solo añade`);
      }
    }
  });
});

describe('Determinismo y estado de partida', () => {
  test('Propagar dos veces desde cero da exactamente lo mismo', async () => {
    const { arbol } = await mundoReal(CELDA_COSIDA);
    const corrida = () => {
      const p = propagacionSobre(null, { arbol, tramo: 2000 });
      p.prop.nace(desenlaceEn(origenReal(arbol)), 0);
      avanza(p.prop, 20);
      return JSON.stringify({ rumores: congelaRumores(p.estado), nucleos: p.nucleos });
    };
    // Serialización completa y no comparación campo a campo: es lo único que afirma
    // «idéntico byte a byte» de verdad.
    assert.equal(corrida(), corrida());
  });

  test('Añadir otro productor de paso no desplaza los rumores ya sembrados', () => {
    const conRumoresSolo = () => {
      const p = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
      p.prop.nace(desenlaceEn('Monfrida'), 0);
      creaMotorDePasos({ semilla: SEMILLA_A, mapaId: MAPA, estado: estadoDePasos(), productores: [p.prop] }).avanza(6);
      return JSON.stringify(p.nucleos);
    };
    const conOtroDetras = () => {
      const p = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
      p.prop.nace(desenlaceEn('Monfrida'), 0);
      const oportunidades = { id: 'oportunidades', produce: (n, azarDelPaso) => [{ tipo: 'oportunidad', asunto: `o-${azarDelPaso().toFixed(6)}` }] };
      creaMotorDePasos({ semilla: SEMILLA_A, mapaId: MAPA, estado: estadoDePasos(), productores: [oportunidades, p.prop] }).avanza(6);
      return JSON.stringify(p.nucleos);
    };
    assert.equal(conRumoresSolo(), conOtroDetras(), 'la cola de oportunidades no puede mover lo que se contó en ningún sitio');
  });

  test('La deformación se siembra por paso, rumor y núcleo', () => {
    // De modo que alcanzar un núcleo más no cambia lo que se contó en los anteriores.
    const corto = propagacionSobre(mundoLineal(CADENA.slice(0, 3)), { tramo: 2000 });
    corto.prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(corto.prop, 10);

    const largo = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    largo.prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(largo.prop, 10);

    for (const n of ['Vilanova', 'Cadaval']) {
      assert.equal(
        JSON.stringify(loQueSeCuentaEn(corto.nucleos, { mapaId: MAPA, nucleo: n })),
        JSON.stringify(loQueSeCuentaEn(largo.nucleos, { mapaId: MAPA, nucleo: n })),
        `lo que se cuenta en "${n}" cambia según a cuántos núcleos más llegue el rumor`,
      );
    }
  });

  test('Dos partidas con semillas distintas cuentan cosas distintas del mismo suceso', () => {
    const versionCon = (semilla) => {
      const p = propagacionSobre(mundoLineal(CADENA), { tramo: 2000, semilla });
      p.prop.nace(desenlaceEn('Monfrida'), 0);
      avanza(p.prop, 10);
      const [v] = loQueSeCuentaEn(p.nucleos, { mapaId: MAPA, nucleo: 'Peiteiro' });
      return v;
    };
    const a = versionCon(SEMILLA_A);
    const b = versionCon(SEMILLA_B);
    assert.equal(JSON.stringify(a), JSON.stringify(versionCon(SEMILLA_A)), 'la misma semilla tiene que contar lo mismo');
    assert.notEqual(JSON.stringify(a.hechos.detalle), JSON.stringify(b.hechos.detalle), 'el detalle que se trastoca sale del azar de la partida');
    // Pero el nivel y el signo no dependen del azar: los fija el código.
    assert.equal(a.nivel, b.nivel);
    assert.equal(a.signo, b.signo);
  });

  test('Un rumor a mitad de viaje vuelve de la partida exactamente donde estaba', () => {
    const { prop, estado, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 700 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 2);

    const doc = JSON.parse(JSON.stringify(congelaRumores(estado)));
    const vuelto = levantaRumores(doc);
    assert.equal(JSON.stringify(congelaRumores(vuelto)), JSON.stringify(congelaRumores(estado)), 'el ida y vuelta pierde el frente, el resto o los niveles');
    const guardado = doc.mapas[MAPA].rumores[0];
    assert.ok(guardado.frentes.length >= 1 && guardado.frentes[0].avanzadoM > 0, 'el resto en metros tiene que viajar con la partida');

    // Y sigue exactamente donde estaba: continuar sobre el estado levantado alcanza
    // lo mismo que continuar sobre el original.
    const sigue = (estadoDeRumores_) => {
      const p = propagacionSobre(mundoLineal(CADENA), { tramo: 700, estado: estadoDeRumores_, nucleos: estadoDeNucleos() });
      avanza(p.prop, 8, 3);
      return JSON.stringify(congelaRumores(estadoDeRumores_));
    };
    assert.equal(sigue(vuelto), sigue(estado));
    assert.ok(nucleos.mapas[MAPA]);
  });

  test('Un rumor agotado vuelve agotado y no reanuda el viaje', () => {
    const { prop, estado } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 50);
    assert.deepEqual(prop.activos(), []);

    const vuelto = levantaRumores(JSON.parse(JSON.stringify(congelaRumores(estado))));
    const otra = propagacionSobre(mundoLineal(CADENA), { tramo: 2000, estado: vuelto, nucleos: estadoDeNucleos() });
    assert.deepEqual(otra.prop.activos(), [], 'un rumor agotado no puede volver vivo');
    assert.deepEqual(avanza(otra.prop, 20).flat(), []);
  });

  test('Un rumor guardado sin identidad o con un signo inválido se rechaza al levantarlo', () => {
    assert.throws(() => levantaRumores({ mapas: { [MAPA]: { rumores: [{ origen: 'Monfrida', signo: 'bueno' }] } } }), /sin identidad/);
    assert.throws(() => levantaRumores({ mapas: { [MAPA]: { rumores: [{ id: 'r1', origen: 'Monfrida', signo: 'regular' }] } } }), /"regular"/);
  });

  test('Un mundo congelado recorrido entero durante cincuenta pasos sigue idéntico byte a byte', async () => {
    const { registro, arbol } = await mundoReal(CELDA_COSIDA);
    const antes = textoDeCelda(registro);
    const { prop, nucleos } = propagacionSobre(null, { arbol, tramo: 2000 });
    prop.nace(desenlaceEn(origenReal(arbol)), 0);
    avanza(prop, 50);
    assert.ok(arbol.nucleos.some((n) => nivelEn(nucleos, MAPA, n) !== null), 'alguien tiene que haberse enterado');
    assert.equal(textoDeCelda(registro), antes, 'la propagación ha tocado el documento congelado de la celda');
  });

  test('Los módulos de la propagación no usan azar del sistema, ni el reloj, ni orden de inserción', () => {
    for (const modulo of MODULOS) {
      const codigo = codigoDe(fuente(modulo));
      for (const prohibido of ['Math.random', 'Date.now', 'new Date', 'performance.now']) {
        assert.ok(!codigo.includes(prohibido), `${modulo} usa ${prohibido}`);
      }
      // En lo que se serializa, todo recorrido de claves va ordenado: sin el `.sort()`
      // el orden sería el de inserción, que es el patrón que `CLAUDE.md` prohíbe. En
      // el resto del módulo `Object.keys` se usa para **validar** —recorrer las claves
      // de un detalle para rechazar las que el catálogo no declara— y ahí el orden no
      // sale a ningún sitio, así que exigir el `.sort()` sería ruido.
      for (const nombre of ['congelaRumores', 'congelaNucleos', 'levantaRumores', 'levantaNucleos', 'congelaPasos']) {
        const trozo = codigo.split(`export function ${nombre}`)[1];
        if (!trozo) continue;
        for (const m of trozo.split('\n}\n')[0].matchAll(/Object\.keys\([^)]*\)(\s*\.\w+)?/g)) {
          assert.ok(m[1]?.trim().startsWith('.sort'), `${modulo}: ${nombre} recorre Object.keys sin ordenar: ${m[0]}`);
        }
      }
    }
  });

  test('El orden en que se enteraron los núcleos no cambia lo que se escribe', () => {
    // Dos partidas con lo mismo oído tienen que escribir el mismo texto aunque los
    // núcleos se hayan enterado en otro orden. Es la afirmación de verdad detrás del
    // `.sort()` de la serialización, y no depende de cómo esté escrita.
    const mundo = mundoDe([
      ['Monfrida', 'Zamil', { metros: 1000 }],
      ['Monfrida', 'Arcos', { metros: 1000 }],
      ['Monfrida', 'Meira', { metros: 1000 }],
    ]);
    const texto = (alReves) => {
      const nucleos = estadoDeNucleos();
      const p = propagacionSobre(mundo, { tramo: 1000, nucleos });
      p.prop.nace(desenlaceEn('Monfrida'), 0);
      // Sembrar el registro del mapa con los núcleos en un orden u otro es lo más
      // parecido a «se enteraron en otro orden» que el estado admite.
      const orden = alReves ? ['Zamil', 'Meira', 'Arcos'] : ['Arcos', 'Meira', 'Zamil'];
      for (const n of orden) loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n });
      avanza(p.prop, 2);
      return JSON.stringify(congelaNucleos(nucleos));
    };
    assert.equal(texto(false), texto(true));
  });

  test('Los módulos de la propagación no importan buildWorld ni ninguna fase de la generación', () => {
    for (const modulo of MODULOS) {
      const imports = [...fuente(modulo).matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
      for (const via of imports) {
        assert.ok(!/world\/(build|celda|settlements|routes|parajes|seamask)\.js$/.test(via), `${modulo} importa una fase de la generación: ${via}`);
      }
      assert.ok(!codigoDe(fuente(modulo)).includes('buildWorld'), `${modulo} llama a buildWorld`);
    }
    // La única entrada de `world/` es el enumerado de marcas de SPEC-007, que es dato
    // y no una fase: colapsarlo aquí sería reescribirlo en dos sitios.
    const deDeformacion = [...fuente('packages/nucleo/partida/deformacion.js').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    assert.deepEqual(deDeformacion.filter((v) => v.includes('world/')), ['../world/grafo.js']);
  });
});
