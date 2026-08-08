// SPEC-013 · El prólogo del mundo: cuándo corre, con qué se siembra, qué siembra,
// cuánto dura, cuántas veces se resiembra y qué deja detrás.
//
// Dos clases de mundo, y las dos hacen falta. Los **sintéticos** llevan la cadena de
// núcleos, sus metros y su casting escritos a mano, que es la única manera de fijar
// quién oye qué y en qué nivel sin depender de un trazado. Los **reales** salen de
// los mundos congelados de SPEC-001, y son los que sostienen la frontera que esta
// fila existe para no romper: resembrar el prólogo ocho veces y comparar el
// documento de la celda byte a byte.
//
// La iteración 1 **deroga dos criterios de la base** —los que medían un recorrido
// sintético que pasara por los dos núcleos y cupiera en «alguno de los tamaños»— y
// aquí no se prueban: la cuarta cláusula vive ahora en `arranque.test.mjs`.
//
// Ninguna prueba de aquí toca la red, el reloj del sistema ni el azar: los datos de
// OSM salen de fixtures congelados, el mundo avanza los pasos que la prueba pide y
// el azar viene siempre de la semilla.
//
// `docs/testing.md` **no tiene ni una característica sobre el prólogo**, así que
// prácticamente todo lo de aquí va declarado como hueco de la batería en
// `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../../packages/nucleo/core/rng.js';
import { semillaDePasoDePrologo, semillaDePrologo } from '../../packages/nucleo/core/semilla.js';
import { congelaArranque, estadoDeArranque, levantaArranque } from '../../packages/nucleo/partida/arranque.js';
import { NIVEL_MAXIMO, PROTAGONISTAS, IDS_DE_SIGNO } from '../../packages/nucleo/partida/deformacion.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { congelaNucleos, estadoDeNucleos, levantaNucleos, loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { estadoDeMapa, estadoDePasos, creaMotorDePasos } from '../../packages/nucleo/partida/pasos.js';
import {
  ENTREGAS_PROLOGO,
  INTENTOS_PROLOGO,
  SUCESOS_PROLOGO,
  TOPE_PASOS_PROLOGO,
  correPrologo,
  intentoDePrologo,
  tieneAlgoQueContar,
  tienePrologo,
} from '../../packages/nucleo/partida/prologo.js';
import {
  arbolDeCalzadas,
  congelaRumores,
  creaPropagacionDeRumores,
  estadoDeRumores,
  levantaRumores,
  rumoresDeMapa,
} from '../../packages/nucleo/partida/rumores.js';
import {
  CLASES_DE_ENTREGA,
  ENTREGAS_DEL_MUNDO,
  IDS_DE_SUCESO,
  SUCESOS_DEL_MUNDO,
  siembraEntregas,
} from '../../packages/nucleo/partida/sucesos-prologo.js';
import { fuente } from './mundo-de-prueba.mjs';
import { celdaDeFixture } from './partida-de-prueba.mjs';
import { codigoDe } from './rumor-de-prueba.mjs';
import {
  MAPA,
  PARTIDA,
  SEMILLA_A,
  SEMILLA_B,
  TRAMO,
  mundoSintetico,
} from './prologo-de-prueba.mjs';

/** Los tres módulos que SPEC-013 entrega. Se inspeccionan como texto en varias pruebas. */
const MODULOS = [
  'packages/nucleo/partida/prologo.js',
  'packages/nucleo/partida/sucesos-prologo.js',
  'packages/nucleo/partida/arranque.js',
];

/** La cadena de referencia: cinco núcleos en fila, todos alcanzables desde el punto de partida. */
const CADENA = ['Albariza', 'Bermeda', 'Cobreira', 'Dorna', 'Ermida'];

/** El casting de la cadena: dos aventuras, cada una con beats en dos núcleos. */
const CASTING = [
  { id: 'la-de-los-extremos', en: ['Albariza', 'Ermida'] },
  { id: 'la-del-medio', en: ['Bermeda', 'Cobreira'] },
];

function mundoDeLaCadena(extra = {}) {
  return mundoSintetico({ nucleos: CADENA, casting: CASTING, ...extra });
}

/** Un prólogo corrido sobre un mundo, con los estados de la partida a la vista. */
function prologoSobre(mundo, opciones = {}) {
  const arranque = opciones.arranque ?? estadoDeArranque();
  const rumores = opciones.rumores ?? estadoDeRumores();
  const nucleos = opciones.nucleos ?? estadoDeNucleos();
  const resultado = correPrologo({
    semilla: SEMILLA_A,
    mapaId: MAPA,
    mundo,
    tramoM: TRAMO,
    partida: PARTIDA,
    ...opciones,
    arranque,
    rumores,
    nucleos,
  });
  return { resultado, arranque, rumores, nucleos };
}

/** Lo que ha quedado escrito en la partida, en su forma serializable y comparable. */
const huella = ({ rumores, nucleos, resultado }) => JSON.stringify({
  rumores: congelaRumores(rumores),
  nucleos: congelaNucleos(nucleos),
  entregas: resultado.entregas,
  par: resultado.par,
  intentos: resultado.diagnostico.intentos,
  pasos: resultado.diagnostico.pasos,
});

describe('Cuándo corre el prólogo y qué deja detrás', () => {
  test('El prólogo deja algo que contar en al menos un núcleo alcanzable', () => {
    const { resultado, nucleos } = prologoSobre(mundoDeLaCadena());
    assert.equal(resultado.corrido, true);
    const conAlgo = CADENA.filter((n) => tieneAlgoQueContar({ nucleos, mapaId: MAPA, nucleo: n }));
    assert.ok(conAlgo.length >= 1, 'ningún núcleo alcanzable tiene nada que contar tras el prólogo');
  });

  test('El contador de pasos de la partida sigue en cero al terminar el prólogo', () => {
    const mundo = mundoDeLaCadena();
    const pasos = estadoDePasos();
    prologoSobre(mundo);
    assert.equal(estadoDeMapa(pasos, MAPA).n, 0, 'el prólogo no es tiempo de la jugadora: su contador empieza en cero');
    // Y no puede tocarlo aunque quiera: no hay por dónde pasárselo.
    const firma = codigoDe(fuente('packages/nucleo/partida/prologo.js')).split('export function correPrologo')[1].split(')')[0];
    assert.ok(!/\bpasos\b/.test(firma), 'correPrologo recibe el estado de pasos de la partida y no debería');
  });

  test('El diario de la jugadora arranca vacío aunque el mundo tenga pasado', () => {
    const { resultado } = prologoSobre(mundoDeLaCadena());
    // Lo que el prólogo devuelve son los estados del mundo y el arranque; ninguna
    // entrada de diario, que solo entra yendo (fila 16).
    assert.deepEqual(
      Object.keys(resultado).sort(),
      ['arranque', 'corrido', 'diagnostico', 'entregas', 'mapaId', 'nucleos', 'par', 'rumores'],
    );
  });

  test('Un rumor que quedó en vuelo avanza con los pasos de la jugadora, sin trato especial', () => {
    const mundo = mundoSintetico({ nucleos: CADENA, casting: CASTING, separacionM: 2500 });
    const { rumores, nucleos } = prologoSobre(mundo, { topePasos: 1, intentos: 1, sucesos: 1 });
    const antes = CADENA.filter((n) => tieneAlgoQueContar({ nucleos, mapaId: MAPA, nucleo: n })).length;
    assert.ok(antes < CADENA.length, 'con un solo paso no puede haberse enterado todo el mundo');

    const arbol = arbolDeCalzadas(mundo);
    const propagacion = creaPropagacionDeRumores({ semilla: SEMILLA_A, mapaId: MAPA, arbol, estado: rumores, nucleos, tramo: TRAMO });
    const motor = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: MAPA, estado: estadoDePasos(), productores: [propagacion] });
    motor.paso(1);
    const despues = CADENA.filter((n) => tieneAlgoQueContar({ nucleos, mapaId: MAPA, nucleo: n })).length;
    assert.ok(despues > antes, 'el rumor del prólogo no ha avanzado con el paso de la jugadora');
  });

  test('El prólogo no expone ninguna cifra suya a la capa de presentación', () => {
    const { resultado, arranque } = prologoSobre(mundoDeLaCadena());
    // El diagnóstico existe para medir el pendiente 2 de arranque.md y **no se
    // serializa**: lo que no se guarda no se puede pintar.
    for (const clave of Object.keys(congelaArranque(arranque))) {
      assert.ok(!['pasos', 'intentos', 'sucesos', 'diagnostico'].includes(clave), `el arranque serializa "${clave}"`);
    }
    assert.equal(JSON.stringify(congelaRumores(resultado.rumores)).includes('"intentos"'), false);
    const codigo = codigoDe(fuente('packages/nucleo/partida/prologo.js'));
    for (const consulta of ['export function pasosDelPrologo', 'export function intentosDelPrologo', 'export function sucesosDelPrologo']) {
      assert.ok(!codigo.includes(consulta), `prologo.js exporta ${consulta}`);
    }
  });

  test('El prólogo no llama a ningún narrador, no pide ninguna imagen y no necesita red', () => {
    for (const modulo of MODULOS) {
      const codigo = codigoDe(fuente(modulo));
      for (const prohibido of ['fetch(', 'XMLHttpRequest', 'require(', 'http://', 'https://', 'narrador', 'imagen(']) {
        assert.ok(!codigo.includes(prohibido), `${modulo} usa ${prohibido}`);
      }
    }
  });

  test('Sin cobertura, una vez descargados los datos de OSM, el prólogo termina entero', async () => {
    // El núcleo no llama a nadie: lo único que entra es el mundo congelado que ya
    // está en disco. Con la red apagada el prólogo corre igual porque no hay nada
    // que apagarle.
    const registro = await celdaDeFixture('costero', { semilla: SEMILLA_A });
    const { resultado } = prologoSobre(registro.mundo, { mapaId: registro.mapaId });
    assert.equal(resultado.corrido, true);
    for (const modulo of MODULOS) assert.ok(!/\bimport\b.*(overpass|proxy|red)/.test(fuente(modulo)), `${modulo} importa la capa de red`);
  });
});

describe('La siembra del prólogo es del mundo, no de la partida', () => {
  test('La semilla de un paso del prólogo lleva el mapa, el intento y el número de paso', () => {
    const s = semillaDePasoDePrologo(SEMILLA_A, MAPA, 3, 5);
    assert.ok(s.startsWith(`${SEMILLA_A}@${MAPA}`), 'la semilla del prólogo no cuelga de la del mapa');
    assert.ok(s.includes(':prologo:3'), 'la semilla no lleva el número de intento');
    assert.ok(s.endsWith(':tick:5'), 'la semilla no lleva el número de paso');
    assert.notEqual(semillaDePrologo(SEMILLA_A, MAPA, 1), semillaDePrologo(SEMILLA_A, MAPA, 2));
    assert.ok(codigoDe(fuente('packages/nucleo/partida/prologo.js')).includes('semillaDePasoDePrologo'), 'el prólogo no usa el mecanismo de semillas de fase');
  });

  test('Dos partidas con la misma semilla, sitio y tramo tienen prólogos idénticos', () => {
    const uno = prologoSobre(mundoDeLaCadena());
    const otro = prologoSobre(mundoDeLaCadena());
    assert.equal(huella(uno), huella(otro));
  });

  test('El oficio y el nombre del personaje no entran en la siembra del prólogo', () => {
    const uno = prologoSobre(mundoDeLaCadena(), { oficio: 'panadera', nombre: 'Uxía', genero: 'f' });
    const otro = prologoSobre(mundoDeLaCadena(), { oficio: 'herrero', nombre: 'Brais', genero: 'm' });
    assert.equal(huella(uno), huella(otro));
    for (const modulo of MODULOS) {
      const codigo = codigoDe(fuente(modulo));
      for (const dato of ['oficio', 'genero', 'personaje.nombre']) {
        assert.ok(!codigo.includes(dato), `${modulo} mira "${dato}", que es de la partida y no del lugar`);
      }
    }
  });

  test('En la siembra del prólogo no entra ninguna fecha, ni el dispositivo, ni el estado de la partida', () => {
    for (const modulo of MODULOS) {
      const codigo = codigoDe(fuente(modulo));
      for (const prohibido of ['Math.random', 'Date.now', 'new Date', 'performance.now', 'process.env', 'navigator']) {
        assert.ok(!codigo.includes(prohibido), `${modulo} usa ${prohibido}`);
      }
    }
  });

  test('Dos mapas de la misma partida tienen semillas de prólogo distintas', () => {
    assert.notEqual(semillaDePrologo(SEMILLA_A, 'casa', 1), semillaDePrologo(SEMILLA_A, 'playa', 1));
    const mundo = mundoDeLaCadena();
    const casa = prologoSobre(mundo, { mapaId: 'casa' });
    const playa = prologoSobre(mundo, { mapaId: 'playa' });
    assert.notEqual(
      JSON.stringify(congelaNucleos(casa.nucleos).mapas.casa),
      JSON.stringify(congelaNucleos(playa.nucleos).mapas.playa),
    );
  });

  test('El frente del prólogo avanza el tramo con el que se dimensionó el mapa', () => {
    const mundo = mundoSintetico({ nucleos: CADENA, casting: CASTING, separacionM: 1500 });
    const corto = prologoSobre(mundo, { tramoM: 500, topePasos: 1, intentos: 1 });
    const largo = prologoSobre(mundo, { tramoM: 4000, topePasos: 1, intentos: 1 });
    const cuantos = (r) => CADENA.filter((n) => tieneAlgoQueContar({ nucleos: r.nucleos, mapaId: MAPA, nucleo: n })).length;
    assert.ok(cuantos(largo) > cuantos(corto), 'el tramo con el que se dimensionó el mapa no mueve el frente');
  });

  test('Cambiar el tramo de la jugadora no recalcula ni reescribe un prólogo ya corrido', () => {
    const mundo = mundoDeLaCadena();
    const corrido = prologoSobre(mundo);
    const antes = huella(corrido);
    // El prólogo de un mapa se corre una sola vez: volver a lanzarlo sobre la misma
    // partida, con otro tramo, se niega en lugar de pisar lo que ya hay.
    assert.throws(
      () => correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: 4000, partida: PARTIDA, arranque: corrido.arranque, rumores: corrido.rumores, nucleos: corrido.nucleos }),
      /ya tiene/,
    );
    assert.equal(huella(corrido), antes);
  });
});

describe('Los sucesos del prólogo: de quién no son', () => {
  test('Cada suceso nace en un núcleo del mapa, en nivel cero y con la forma de rumor de SPEC-012', () => {
    const { resultado, nucleos } = prologoSobre(mundoDeLaCadena());
    const rumores = rumoresDeMapa(resultado.rumores, MAPA).rumores;
    assert.ok(rumores.length > 0);
    for (const r of rumores) {
      assert.ok(CADENA.includes(r.origen), `el suceso "${r.id}" nace en "${r.origen}", que no es un núcleo del mapa`);
      const enOrigen = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: r.origen }).find((v) => v.rumor === r.id);
      assert.equal(enOrigen.nivel, 0, 'un suceso nace fiel y en el sitio');
      for (const campo of ['id', 'origen', 'signo', 'hechos', 'frentes', 'alcanzados', 'agotado']) {
        assert.ok(Object.prototype.hasOwnProperty.call(r, campo), `al suceso le falta "${campo}"`);
      }
    }
  });

  test('Ningún suceso del prólogo lo protagoniza la jugadora', () => {
    const { resultado, nucleos } = prologoSobre(mundoDeLaCadena());
    for (const r of rumoresDeMapa(resultado.rumores, MAPA).rumores) {
      assert.equal(r.hechos.protagonista.tipo, PROTAGONISTAS.VECINDARIO);
      assert.notEqual(r.hechos.protagonista.tipo, PROTAGONISTAS.JUGADORA);
    }
    for (const nucleo of CADENA) {
      for (const version of loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo })) {
        assert.notEqual(version.hechos.protagonista.tipo, PROTAGONISTAS.JUGADORA, `en "${nucleo}" se cuenta algo de la jugadora el día 1`);
      }
    }
  });

  test('Los signos de los sucesos salen del enumerado cerrado y los fija el código', () => {
    for (const entrada of SUCESOS_DEL_MUNDO) {
      assert.ok(IDS_DE_SIGNO.includes(entrada.signo), `el suceso "${entrada.id}" trae el signo "${entrada.signo}"`);
    }
    const { resultado } = prologoSobre(mundoDeLaCadena());
    for (const r of rumoresDeMapa(resultado.rumores, MAPA).rumores) assert.ok(IDS_DE_SIGNO.includes(r.signo));
  });

  test('Un suceso del prólogo se deforma con la misma escalera y la misma invariante de signo', () => {
    const { resultado, nucleos } = prologoSobre(mundoDeLaCadena());
    const porId = new Map(rumoresDeMapa(resultado.rumores, MAPA).rumores.map((r) => [r.id, r]));
    for (const nucleo of CADENA) {
      for (const version of loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo })) {
        assert.ok(version.nivel >= 0 && version.nivel <= NIVEL_MAXIMO, `nivel fuera de la escalera en "${nucleo}"`);
        assert.equal(version.signo, porId.get(version.rumor).signo, 'el signo ha cambiado al viajar');
      }
    }
  });

  test('Se siembran los sucesos del parámetro y nacen en núcleos distintos', () => {
    const { resultado } = prologoSobre(mundoDeLaCadena());
    const rumores = rumoresDeMapa(resultado.rumores, MAPA).rumores;
    assert.equal(rumores.length, SUCESOS_PROLOGO);
    assert.equal(new Set(rumores.map((r) => r.origen)).size, rumores.length, 'dos sucesos han nacido en el mismo núcleo habiendo sitio');
  });

  test('Con menos núcleos que sucesos se siembran los que caben y no falla', () => {
    const mundo = mundoSintetico({ nucleos: ['Albariza', 'Bermeda'], casting: [] });
    const { resultado } = prologoSobre(mundo, { sucesos: 5 });
    assert.equal(rumoresDeMapa(resultado.rumores, MAPA).rumores.length, 2);
  });

  test('Un suceso puede no tener texto todavía y su nivel, su signo y sus hechos están completos', () => {
    const { nucleos } = prologoSobre(mundoDeLaCadena());
    let vistas = 0;
    for (const nucleo of CADENA) {
      for (const version of loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo })) {
        vistas++;
        assert.equal(version.texto, null, 'la redacción es de la fila 18 y aquí no existe todavía');
        assert.ok(Number.isInteger(version.nivel) && version.signo && version.hechos.asunto);
      }
    }
    assert.ok(vistas > 0);
  });

  test('El catálogo de sucesos del prólogo es cerrado y apto para menores', () => {
    assert.equal(new Set(SUCESOS_DEL_MUNDO.map((s) => s.id)).size, SUCESOS_DEL_MUNDO.length);
    assert.deepEqual(IDS_DE_SUCESO, SUCESOS_DEL_MUNDO.map((s) => s.id).sort());
    const noApto = /\b(alcohol|arma|bar|borracho|cerveza|copas|discoteca|droga|matanza|muerte|muerto|prostituta|pub|sangre|sexo|suicidio|tabaco|whisky)\b/i;
    for (const entrada of [...SUCESOS_DEL_MUNDO, ...ENTREGAS_DEL_MUNDO]) {
      for (const campo of ['id', 'asunto', 'con', 'motivo']) {
        if (typeof entrada[campo] === 'string') assert.ok(!noApto.test(entrada[campo]), `"${entrada[campo]}" no es apto para menores`);
      }
    }
    // Y el catálogo se comprueba a sí mismo **al cargarse**, que es lo que cierra la
    // puerta el día que alguien amplíe la lista sin releer la especificación: la
    // guarda vive en el módulo y no en quien lo usa.
    const codigo = codigoDe(fuente('packages/nucleo/partida/sucesos-prologo.js'));
    assert.ok(/for \(const catalogo of \[SUCESOS_DEL_MUNDO, ENTREGAS_DEL_MUNDO\]\)/.test(codigo), 'los catálogos no se comprueban al cargarse');
    assert.ok(codigo.includes('VOCABULARIO_NO_APTO.test'), 'no hay guarda de contenido apto para menores');
    assert.ok(codigo.includes('vistos.includes(entrada.id)'), 'no hay guarda de identificadores repetidos');
  });
});

describe('El tope de intentos y qué pasa al agotarlo', () => {
  test('Los cuatro parámetros del prólogo son constantes declaradas con su justificación escrita', () => {
    const texto = fuente('packages/nucleo/partida/prologo.js');
    for (const [nombre, valor] of [
      ['TOPE_PASOS_PROLOGO', TOPE_PASOS_PROLOGO],
      ['SUCESOS_PROLOGO', SUCESOS_PROLOGO],
      ['INTENTOS_PROLOGO', INTENTOS_PROLOGO],
      ['ENTREGAS_PROLOGO', ENTREGAS_PROLOGO],
    ]) {
      assert.equal((texto.match(new RegExp(`export const ${nombre} =`, 'g')) ?? []).length, 1, `${nombre} no se declara una sola vez`);
      assert.ok(Number.isInteger(valor) && valor > 0, `${nombre} no es un entero positivo`);
      const justificacion = texto.split(`export const ${nombre}`)[0].split('/**').pop();
      assert.ok(justificacion.length > 120, `${nombre} se declara sin justificación escrita`);
    }
  });

  test('Un mundo en el que la condición no se cumple nunca gasta como mucho el tope y termina', () => {
    // Dos núcleos con reparto —así que la composición se intenta— y ninguno de los
    // dos alcanzable desde el punto de partida: ninguna resiembra puede componer.
    const mundo = mundoSintetico({
      cadenas: [['Albariza', 'Bermeda'], ['Xures', 'Zarra']],
      casting: [{ id: 'la-de-la-otra-orilla', en: ['Xures', 'Zarra'] }],
    });
    const { resultado } = prologoSobre(mundo);
    assert.equal(resultado.par, null, 'ha compuesto un par con núcleos a los que no se llega');
    assert.equal(resultado.diagnostico.intentos, INTENTOS_PROLOGO);
    assert.equal(resultado.diagnostico.pasos.length, INTENTOS_PROLOGO);
  });

  test('El primer intento que cumple la condición termina el prólogo y no se ejecuta ninguno más', () => {
    const { resultado } = prologoSobre(mundoDeLaCadena());
    assert.ok(resultado.par, 'esta cadena compone en el primer intento');
    assert.equal(resultado.diagnostico.intentos, 1);
    assert.equal(resultado.diagnostico.pasos.length, 1, 'ha seguido resembrando después de componer');
  });

  test('Con el tope agotado el mapa conserva el prólogo del último intento y no hay par', () => {
    const mundo = mundoSintetico({
      cadenas: [['Albariza', 'Bermeda'], ['Xures', 'Zarra']],
      casting: [{ id: 'la-de-la-otra-orilla', en: ['Xures', 'Zarra'] }],
    });
    const { resultado, nucleos, arranque } = prologoSobre(mundo);
    assert.equal(resultado.par, null);
    assert.equal(arranque.par, null, 'la ausencia de par es un valor declarado, no un error');
    assert.ok(['Albariza', 'Bermeda'].some((n) => tieneAlgoQueContar({ nucleos, mapaId: MAPA, nucleo: n })), 'el mundo tiene pasado igualmente');
    // El último intento y no otro: lo asentado es lo del intento número ocho.
    const octavo = intentoDePrologo({ semilla: SEMILLA_A, mapaId: MAPA, arbol: arbolDeCalzadas(mundo), alcanzables: ['Albariza', 'Bermeda'], tramoM: TRAMO, intento: INTENTOS_PROLOGO });
    assert.equal(JSON.stringify(congelaNucleos(nucleos)), JSON.stringify(congelaNucleos(octavo.nucleos)));
  });

  test('Con el tope agotado no hay ningún texto que mencione que faltó algo', () => {
    const mundo = mundoSintetico({
      cadenas: [['Albariza', 'Bermeda'], ['Xures', 'Zarra']],
      casting: [{ id: 'la-de-la-otra-orilla', en: ['Xures', 'Zarra'] }],
    });
    const { resultado } = prologoSobre(mundo);
    const texto = JSON.stringify({ par: resultado.par, arranque: congelaArranque(resultado.arranque), diagnostico: resultado.diagnostico });
    for (const disculpa of ['no se pudo', 'lo sentimos', 'faltó', 'error', 'aviso']) {
      assert.ok(!texto.toLowerCase().includes(disculpa), `el resultado del prólogo menciona "${disculpa}"`);
    }
  });

  test('Un tope que no es un entero positivo falla nombrando el valor recibido', () => {
    const mundo = mundoDeLaCadena();
    for (const malo of [0, -1, 2.5, '8', null]) {
      assert.throws(
        () => prologoSobre(mundo, { intentos: malo }),
        (e) => e.message.includes('tope de intentos') && e.message.includes(String(malo)),
        `un tope de ${JSON.stringify(malo)} no se ha rechazado nombrándolo`,
      );
    }
    assert.throws(() => prologoSobre(mundo, { topePasos: 0 }), /tope de pasos/);
    assert.throws(() => prologoSobre(mundo, { sucesos: -2 }), /sucesos/);
    assert.throws(() => prologoSobre(mundo, { entregas: 1.5 }), /entradas sembradas/);
  });

  test('El número de intentos está acotado por construcción y no por que la condición se cumpla', () => {
    const codigo = codigoDe(fuente('packages/nucleo/partida/prologo.js'));
    assert.ok(!/\bwhile\s*\(\s*true\s*\)/.test(codigo), 'hay un bucle sin condición de salida');
    assert.ok(!/\bdo\s*\{/.test(codigo), 'hay un do/while en el bucle de intentos');
    assert.ok(/for \(let intento = 1; intento <= tope; intento\+\+\)/.test(codigo), 'el bucle de intentos no es un for acotado');
  });

  test('Con menos de dos núcleos con reparto se corre un solo intento y se termina sin par', () => {
    // La condición es inalcanzable por construcción: lo que falta está en el mundo,
    // y el mundo no se resiembra. Gastar los ocho sería tiempo tirado.
    const mundo = mundoSintetico({ nucleos: CADENA, casting: [] });
    const { resultado } = prologoSobre(mundo);
    assert.equal(resultado.par, null);
    assert.equal(resultado.diagnostico.intentos, 1, 'ha gastado más de un intento con la condición inalcanzable');
    assert.equal(resultado.diagnostico.conReparto, 0);
  });
});

describe('Resembrar el prólogo no es resembrar el mundo', () => {
  test('Ocho resiembras y el documento congelado de la celda sigue idéntico byte a byte', async () => {
    const registro = await celdaDeFixture('costero', { semilla: SEMILLA_A });
    const antes = textoDeCelda(registro);
    const arbol = arbolDeCalzadas(registro.mundo);
    const alcanzables = registro.mundo.settlements.map((s) => s.name).sort();
    for (let intento = 1; intento <= 8; intento++) {
      intentoDePrologo({ semilla: SEMILLA_A, mapaId: registro.mapaId, arbol, alcanzables, tramoM: TRAMO, intento });
    }
    assert.equal(textoDeCelda(registro), antes, 'resembrar el prólogo ha tocado el documento congelado de la celda');
  });

  test('Tras ocho resiembras los nombres, los anclajes y el grafo son los mismos', async () => {
    const registro = await celdaDeFixture('costero', { semilla: SEMILLA_A });
    const retrato = (m) => JSON.stringify({
      nucleos: m.settlements.map((s) => [s.name, s.anchor?.osmId ?? null]),
      servicios: m.settlements.flatMap((s) => s.services).map((v) => [v.name, v.real?.osmId ?? null]),
      parajes: m.parajes.map((p) => [p.name, p.type, p.real?.osmId ?? null]),
      calzadas: m.routes.map((r) => [r.name, r.tramos?.length ?? 0]),
      grafo: m.viario.nodeIds.length,
      libres: (m.freeAnchors ?? []).length,
    });
    const antes = retrato(registro.mundo);
    const arbol = arbolDeCalzadas(registro.mundo);
    const alcanzables = registro.mundo.settlements.map((s) => s.name).sort();
    for (let intento = 1; intento <= 8; intento++) {
      intentoDePrologo({ semilla: SEMILLA_A, mapaId: registro.mapaId, arbol, alcanzables, tramoM: TRAMO, intento });
    }
    assert.equal(retrato(registro.mundo), antes);
  });

  test('Los módulos del prólogo no importan buildWorld ni ninguna fase de la generación', () => {
    for (const modulo of MODULOS) {
      const codigo = codigoDe(fuente(modulo));
      for (const fase of ['buildWorld', 'generateSettlements', 'generateParajes', 'buildRoutes', 'construyeGrafo', 'castAll', 'generaCelda']) {
        assert.ok(!codigo.includes(fase), `${modulo} importa o llama a ${fase}`);
      }
      assert.ok(!/from '\.\.\/world\//.test(codigo), `${modulo} importa del área de generación`);
    }
  });

  test('El prólogo no es una fase de la tubería de generación', () => {
    const codigo = codigoDe(fuente('packages/nucleo/world/build.js'));
    assert.ok(!codigo.includes('prologo'), 'build.js conoce el prólogo, y el prólogo es capa y no fase');
    assert.ok(!codigoDe(fuente('packages/nucleo/world/celda.js')).includes('prologo'), 'la generación de una celda corre el prólogo');
  });

  test('Volver a generar la celda tras el prólogo la devuelve idéntica', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles', { semilla: SEMILLA_A });
    const antes = textoDeCelda(registro);
    prologoSobre(registro.mundo, { mapaId: registro.mapaId, sinContenidoJugable: registro.sinContenidoJugable });
    const otra = await celdaDeFixture('barrio-tres-calles', { semilla: SEMILLA_B });
    assert.notEqual(textoDeCelda(otra), antes, 'dos semillas distintas no pueden dar la misma celda');
    assert.equal(textoDeCelda(registro), antes, 'el prólogo entra en la generación de la celda');
  });
});

describe('Cuánto dura el prólogo', () => {
  test('El intento para en cuanto todos los núcleos alcanzables han oído algo', () => {
    const mundo = mundoSintetico({ nucleos: ['Albariza', 'Bermeda'], casting: [], separacionM: 300 });
    const { resultado, nucleos } = prologoSobre(mundo, { intentos: 1 });
    assert.ok(resultado.diagnostico.pasos[0] < TOPE_PASOS_PROLOGO, 'ha gastado el tope entero teniendo cobertura antes');
    for (const n of ['Albariza', 'Bermeda']) assert.ok(tieneAlgoQueContar({ nucleos, mapaId: MAPA, nucleo: n }));
  });

  test('Si algún núcleo alcanzable nunca oye nada, el intento agota su tope y no es un error', () => {
    // «Lonxe» cuelga de una calzada de cien kilómetros: se llega por el grafo, así
    // que es alcanzable, y ningún frente la recorre entera dentro del tope de pasos.
    const mundo = mundoSintetico({ nucleos: ['Albariza', 'Bermeda', 'Cobreira', 'Lonxe'], casting: [], separacionM: [600, 600, 100000] });
    const arbol = arbolDeCalzadas(mundo);
    const intento = intentoDePrologo({
      semilla: SEMILLA_A,
      mapaId: MAPA,
      arbol,
      alcanzables: ['Albariza', 'Bermeda', 'Cobreira', 'Lonxe'],
      tramoM: TRAMO,
      intento: 1,
      sucesos: 1,
    });
    assert.equal(intento.pasos, TOPE_PASOS_PROLOGO);
  });

  test('Al menos un núcleo que oyó algo lo oyó por debajo del nivel máximo', () => {
    const { nucleos } = prologoSobre(mundoDeLaCadena());
    const niveles = CADENA.flatMap((n) => loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n }).map((v) => v.nivel));
    assert.ok(niveles.length > 0);
    assert.ok(niveles.some((n) => n < NIVEL_MAXIMO), 'el mundo entero suena a leyenda el día 1');
  });

  test('Dos mapas de tamaños distintos pueden gastar un número de pasos distinto', () => {
    const corto = prologoSobre(mundoSintetico({ nucleos: ['Albariza', 'Bermeda'], casting: [], separacionM: 300 }), { intentos: 1 });
    const largo = prologoSobre(mundoSintetico({ nucleos: CADENA, casting: [], separacionM: 1800 }), { intentos: 1 });
    assert.notEqual(corto.resultado.diagnostico.pasos[0], largo.resultado.diagnostico.pasos[0]);
  });

  test('El trabajo del prólogo está acotado por sus dos topes y no por lo que tarde', () => {
    // Se afirma la cota y no los milisegundos: una prueba con reloj real mediría la
    // máquina. El presupuesto de RNF-PER-001 se sostiene sobre que el trabajo es
    // como mucho `INTENTOS_PROLOGO` × `TOPE_PASOS_PROLOGO` pasos en memoria.
    const mundo = mundoSintetico({
      cadenas: [['Albariza', 'Bermeda'], ['Xures', 'Zarra']],
      casting: [{ id: 'la-de-la-otra-orilla', en: ['Xures', 'Zarra'] }],
    });
    const { resultado } = prologoSobre(mundo);
    const total = resultado.diagnostico.pasos.reduce((a, b) => a + b, 0);
    assert.ok(resultado.diagnostico.intentos <= INTENTOS_PROLOGO);
    assert.ok(total <= INTENTOS_PROLOGO * TOPE_PASOS_PROLOGO, `el prólogo ha dado ${total} pasos`);
  });
});

describe('La cola de entregas queda sembrada', () => {
  test('La cola de entregas del mapa no está vacía tras el prólogo', () => {
    const { resultado } = prologoSobre(mundoDeLaCadena());
    assert.equal(resultado.entregas.length, ENTREGAS_PROLOGO);
  });

  test('Las entradas sembradas tienen la forma de la cola y ningún campo propio del prólogo', () => {
    const { resultado } = prologoSobre(mundoDeLaCadena());
    for (const entrada of resultado.entregas) {
      assert.deepEqual(Object.keys(entrada).sort(), ['asunto', 'clase', 'lugar', 'tipo']);
      assert.equal(entrada.tipo, 'oportunidad');
      assert.ok(CADENA.includes(entrada.lugar));
      assert.ok(Object.values(CLASES_DE_ENTREGA).includes(entrada.clase));
      for (const propio of ['prologo', 'arranque', 'intento', 'sembrada']) {
        assert.ok(!Object.keys(entrada).includes(propio), `la entrada lleva el campo "${propio}"`);
      }
    }
  });

  test('Entre las entradas sembradas hay al menos un encargo suelto', () => {
    const { resultado } = prologoSobre(mundoDeLaCadena());
    assert.ok(resultado.entregas.some((e) => e.clase === CLASES_DE_ENTREGA.ENCARGO), 'un día sin aventura del oficio sería un día vacío');
    // Y sale por construcción, no por sorteo: el reparto empieza por un encargo.
    const soloUna = siembraEntregas({ nucleos: CADENA, cuantos: 1, rng: makeRng('x') });
    assert.equal(soloUna[0].clase, CLASES_DE_ENTREGA.ENCARGO);
  });

  test('Una cola de entregas que nadie consume devuelve sus entradas y no un error', () => {
    const { resultado } = prologoSobre(mundoDeLaCadena());
    assert.ok(Array.isArray(resultado.entregas));
    assert.deepEqual(resultado.entregas, JSON.parse(JSON.stringify(resultado.entregas)));
  });

  test('El prólogo no deja ninguna aventura preparada', () => {
    const { resultado } = prologoSobre(mundoDeLaCadena());
    assert.equal(JSON.stringify(resultado).includes('"aventuras"'), false, 'el prólogo deja aventuras, y las aventuras salen de castear');
    assert.ok(!codigoDe(fuente('packages/nucleo/partida/prologo.js')).includes('repartoDeAventuras'), 'el prólogo castea o reparte aventuras por su cuenta');
  });
});

describe('El prólogo de un mapa que no es el primero', () => {
  test('Un mapa que no es el primero corre su prólogo igual y sus núcleos nacen con algo que contar', () => {
    const { resultado, nucleos } = prologoSobre(mundoDeLaCadena(), { primerMapa: false });
    assert.equal(resultado.corrido, true);
    assert.ok(CADENA.some((n) => tieneAlgoQueContar({ nucleos, mapaId: MAPA, nucleo: n })));
  });

  test('En un mapa que no es el primero no se evalúa la condición y no hay resiembra', () => {
    const { resultado, arranque } = prologoSobre(mundoDeLaCadena(), { primerMapa: false });
    assert.equal(resultado.par, null);
    assert.equal(resultado.diagnostico.intentos, 1, 'ha resembrado un mapa que no es el primero');
    assert.equal(resultado.diagnostico.reparto, 0, 'ha trazado el reparto de un mapa que no compone');
    assert.equal(arranque.par, null);
  });

  test('Un mapa que no es el primero no reabre el arranque', () => {
    const arranque = levantaArranque({ abierto: false, cerradoPor: 'te-cuentan', marcado: true, reglaDePaso: false, par: null });
    prologoSobre(mundoDeLaCadena(), { primerMapa: false, arranque });
    assert.equal(arranque.abierto, false);
    assert.equal(arranque.marcado, true);
    assert.equal(arranque.reglaDePaso, false);
  });

  test('Los sucesos del prólogo de un mapa no alcanzan los núcleos de otro mapa', () => {
    const mundo = mundoDeLaCadena();
    const rumores = estadoDeRumores();
    const nucleos = estadoDeNucleos();
    prologoSobre(mundo, { mapaId: 'casa', rumores, nucleos });
    prologoSobre(mundo, { mapaId: 'playa', rumores, nucleos });
    const deCasa = rumoresDeMapa(rumores, 'casa').rumores.map((r) => r.id);
    const doc = congelaNucleos(nucleos);
    for (const nucleo of Object.keys(doc.mapas.playa)) {
      for (const version of doc.mapas.playa[nucleo]) {
        assert.ok(!deCasa.includes(version.rumor) || rumoresDeMapa(rumores, 'playa').rumores.some((r) => r.id === version.rumor));
      }
    }
    assert.notEqual(JSON.stringify(doc.mapas.casa), JSON.stringify(doc.mapas.playa));
  });
});

describe('Determinismo, persistencia y errores del prólogo', () => {
  test('Dos prólogos del mismo mundo con la misma semilla son idénticos', () => {
    const uno = prologoSobre(mundoDeLaCadena());
    const otro = prologoSobre(mundoDeLaCadena());
    assert.equal(huella(uno), huella(otro));
    assert.equal(JSON.stringify(uno.resultado.par), JSON.stringify(otro.resultado.par));
    assert.deepEqual(uno.resultado.diagnostico.pasos, otro.resultado.diagnostico.pasos);
  });

  test('Un intento resembrado difiere del anterior, porque el intento entra en la siembra', () => {
    const mundo = mundoDeLaCadena();
    const arbol = arbolDeCalzadas(mundo);
    const uno = intentoDePrologo({ semilla: SEMILLA_A, mapaId: MAPA, arbol, alcanzables: CADENA, tramoM: TRAMO, intento: 1 });
    const dos = intentoDePrologo({ semilla: SEMILLA_A, mapaId: MAPA, arbol, alcanzables: CADENA, tramoM: TRAMO, intento: 2 });
    assert.notEqual(JSON.stringify(congelaNucleos(uno.nucleos)), JSON.stringify(congelaNucleos(dos.nucleos)));
  });

  test('Una resiembra no conserva nada del intento anterior', () => {
    const mundo = mundoDeLaCadena();
    const arbol = arbolDeCalzadas(mundo);
    const uno = intentoDePrologo({ semilla: SEMILLA_A, mapaId: MAPA, arbol, alcanzables: CADENA, tramoM: TRAMO, intento: 1 });
    const dos = intentoDePrologo({ semilla: SEMILLA_A, mapaId: MAPA, arbol, alcanzables: CADENA, tramoM: TRAMO, intento: 2 });
    // Cada intento corre sobre estado de usar y tirar: ni los rumores, ni lo
    // sedimentado, ni la cola del anterior aparecen en el siguiente.
    assert.notEqual(uno.rumores, dos.rumores);
    assert.notEqual(uno.nucleos, dos.nucleos);
    const idsDeUno = rumoresDeMapa(uno.rumores, MAPA).rumores.map((r) => r.id);
    const idsDeDos = rumoresDeMapa(dos.rumores, MAPA).rumores.map((r) => r.id);
    assert.notDeepEqual(idsDeUno.slice().sort(), idsDeDos.slice().sort());
    // Y el segundo intento vuelve a repartir la cola entera desde cero.
    assert.equal(dos.entregas.length, ENTREGAS_PROLOGO);
  });

  test('Un prólogo serializado y vuelto a cargar devuelve lo sedimentado, los frentes y el arranque', () => {
    const { resultado, arranque, rumores, nucleos } = prologoSobre(mundoDeLaCadena());
    const doc = {
      rumores: congelaRumores(rumores),
      nucleos: congelaNucleos(nucleos),
      arranque: congelaArranque(arranque),
      entregas: resultado.entregas,
    };
    const texto = JSON.stringify(doc);
    const vuelto = JSON.parse(texto);
    assert.equal(JSON.stringify(congelaRumores(levantaRumores(vuelto.rumores))), JSON.stringify(doc.rumores));
    assert.equal(JSON.stringify(congelaNucleos(levantaNucleos(vuelto.nucleos))), JSON.stringify(doc.nucleos));
    assert.equal(JSON.stringify(congelaArranque(levantaArranque(vuelto.arranque))), JSON.stringify(doc.arranque));
    assert.deepEqual(vuelto.entregas, resultado.entregas);
  });

  test('Una partida cargada de un respaldo no vuelve a ejecutar su prólogo', () => {
    const mundo = mundoDeLaCadena();
    const { rumores, nucleos, arranque } = prologoSobre(mundo);
    assert.equal(tienePrologo({ rumores, mapaId: MAPA }), true);
    assert.throws(
      () => correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO, partida: PARTIDA, arranque, rumores, nucleos }),
      /una sola vez|ya tiene/,
    );
  });

  test('Un intento que falla a mitad no deja un prólogo a medias asentado', () => {
    const mundo = mundoDeLaCadena();
    // Una calzada que no declara sus tramos: el frente falla al recorrerla.
    mundo.routes[1] = { ...mundo.routes[1], tramos: null };
    const rumores = estadoDeRumores();
    const nucleos = estadoDeNucleos();
    const antes = JSON.stringify({ r: congelaRumores(rumores), n: congelaNucleos(nucleos) });
    assert.throws(() => correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO, partida: PARTIDA, rumores, nucleos }));
    assert.equal(JSON.stringify({ r: congelaRumores(rumores), n: congelaNucleos(nucleos) }), antes, 'ha quedado medio prólogo asentado');
  });

  test('Un mapa sin punto de partida falla nombrando el punto que falta', () => {
    const mundo = mundoDeLaCadena();
    assert.throws(
      () => correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO }),
      /punto de partida/,
    );
  });

  test('Un mapa sin grafo de calzadas falla nombrando lo que falta', () => {
    const mundo = mundoDeLaCadena();
    delete mundo.viario;
    assert.throws(
      () => correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO, partida: PARTIDA }),
      /grafo de calzadas|viario/,
    );
  });

  test('Un mapa sin el tramo con el que se dimensionó falla nombrando el tramo', () => {
    const mundo = mundoDeLaCadena();
    assert.throws(
      () => correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, partida: PARTIDA }),
      /tramo/,
    );
  });

  test('Un mapa con un solo núcleo siembra un suceso, no compone par y no falla', () => {
    const mundo = mundoSintetico({ nucleos: ['Albariza'], casting: [] });
    const { resultado, nucleos } = prologoSobre(mundo);
    assert.equal(rumoresDeMapa(resultado.rumores, MAPA).rumores.length, 1);
    assert.equal(resultado.par, null);
    assert.ok(tieneAlgoQueContar({ nucleos, mapaId: MAPA, nucleo: 'Albariza' }));
  });

  test('Un mapa sin ningún núcleo alcanzable termina sin par y no falla', () => {
    // La jugadora vive al otro lado de la ría: se siembra igual, y no compone.
    const mundo = mundoSintetico({ nucleos: ['Albariza', 'Bermeda'], casting: [] });
    const { resultado } = prologoSobre(mundo, { partida: { x: 100000, y: 100000 } });
    assert.equal(resultado.par, null);
    assert.equal(resultado.diagnostico.alcanzables, 0);
    assert.equal(resultado.corrido, true);
  });

  test('Un mapa marcado como sin contenido jugable no siembra nada y no falla', () => {
    const { resultado } = prologoSobre(mundoDeLaCadena(), { sinContenidoJugable: true });
    assert.equal(rumoresDeMapa(resultado.rumores, MAPA).rumores.length, 0);
    assert.deepEqual(resultado.entregas, []);
    assert.equal(resultado.par, null);
    assert.equal(resultado.corrido, true);
  });
});
