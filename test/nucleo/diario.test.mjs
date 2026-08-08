// SPEC-016 · El diario: **registra lo oído, no lo cierto**.
//
// Lo que aquí se afirma, y es la propiedad que hay que defender de la tentación de
// arreglarla: si a la jugadora le contaron tres campanas y en realidad fue una, el
// diario guarda tres campanas, con el sitio y el momento en que se lo contaron. Oír
// después la versión buena **no corrige la entrada anterior**: se añade otra, y
// ninguna se marca como correcta. De ahí sale sin tutorial el mejor truco del juego.
//
// Y la otra mitad: **el nivel de deformación viaja en el dato y no llega a pantalla**.
// Se guarda porque el código lo necesita para agrupar, auditar y reconstruir; la
// proyección que consumen las pantallas no lo lleva, así que ninguna puede pintarlo.
//
// Los tres escenarios de la característica «El diario registra lo oído, no lo
// cierto» están etiquetados `@app` en `docs/testing.md` y se implementan aquí en
// `@nucleo`, sobre el dato guardado: es el nivel al que hoy se pueden ejecutar, y
// así queda anotado en `test/spec-test-map.json`. Lo mismo con «Las versiones se
// ordenan por cuándo se oyeron», del que aquí vive la mitad de dato.
//
// Los demás casos van declarados como huecos de la batería en el mapa de cobertura.
// Nada de aquí toca la red, el reloj del sistema ni el azar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as moduloDeDiario from '../../packages/nucleo/partida/diario.js';
import {
  CLASES_DE_ENTRADA,
  FUENTES,
  apunta,
  apuntaLoQueCuentaUnTestigo,
  apuntaLoQueSeCuenta,
  bytesDeEntrada,
  claveDeEntrada,
  congelaDiario,
  entradaDeDiario,
  entradasDe,
  entradasDeSuceso,
  estadoDeDiario,
  estadoDeTextos,
  guardaTexto,
  levantaDiario,
  proyeccion,
  proyeccionDeSuceso,
  proyeccionPorDias,
  sucesosConVariasVersiones,
  textoDe,
  tieneVariasVersiones,
} from '../../packages/nucleo/partida/diario.js';
import { hechoRecordado } from '../../packages/nucleo/partida/memoria.js';
import { estadoDeNucleos, loQueSeCuentaEn, sedimenta } from '../../packages/nucleo/partida/nucleos.js';
import {
  MAPA,
  OTRO_MAPA,
  SIGNOS,
  SUCESO,
  entradaDe,
  hechosDe,
  versionDe,
} from './diario-de-prueba.mjs';

/** El presupuesto de una entrada, tal como lo fija la spec. */
const PRESUPUESTO_DE_ENTRADA = 500;

/** Lo que se cuenta en «Monfrida»: tres campanas, cuando en realidad fue una. */
const TRES_CAMPANAS = versionDe({ nivel: 1, veces: 3 });

/** Lo que se cuenta en «Vilanova»: la versión fiel, de una campana. */
const UNA_CAMPANA = versionDe({ nivel: 0, veces: 1 });

describe('El diario registra lo oído, no lo cierto', () => {
  test('Se guarda la versión deformada', () => {
    // Escenario `@app` de la batería, verificado aquí en `@nucleo` sobre el dato
    // guardado: llega a «Monfrida» la versión de nivel 1 que habla de tres campanas
    // y el diario guarda **esa**, con el lugar y el momento en que se oyó.
    const diario = estadoDeDiario();
    const { entradas } = apuntaLoQueSeCuenta({ diario, versiones: [TRES_CAMPANAS], mapaId: MAPA, nucleo: 'Monfrida', dia: 22, paso: 40 });
    assert.equal(entradas.length, 1);
    const [entrada] = entradas;
    assert.equal(entrada.hechos.escala.veces, 3, 'lo que se guarda es la versión de tres campanas');
    assert.equal(entrada.nivel, 1);
    assert.equal(entrada.lugar, 'Monfrida', 'y guarda el lugar donde se la contaron');
    assert.deepEqual({ dia: entrada.dia, paso: entrada.paso }, { dia: 22, paso: 40 }, 'y el momento en que se la contaron');
    assert.equal(entradasDe(diario).length, 1, 'la entrada queda en el diario');
  });

  test('La entrada declara el lugar y el momento en que se oyó, y nunca una coordenada ni un reloj', () => {
    const entrada = entradaDe({ dia: 22, paso: 40 });
    assert.equal(typeof entrada.lugar, 'string');
    assert.equal(entrada.lugar, 'Monfrida');
    assert.equal(entrada.dia, 22);
    assert.equal(entrada.paso, 40);
    // El lugar es obligatorio y es un identificador; el momento son dos enteros.
    assert.throws(() => entradaDe({ lugar: '' }), /nunca una coordenada/);
    assert.throws(() => entradaDe({ dia: null }), /nunca una marca del reloj real/);
    assert.throws(() => entradaDe({ paso: 1.5 }), /nunca una marca del reloj real/);
    // Y ninguna forma de colar una posición: el esquema de la entrada es cerrado.
    const doc = congelaDiario({ entradas: [entrada], triangulado: false });
    assert.deepEqual(Object.keys(doc.entradas[0]).sort(), [
      'clase', 'dia', 'fuente', 'hechos', 'lugar', 'mapa', 'nivel', 'origen', 'paso', 'plantilla', 'signo', 'suceso', 'texto',
    ]);
  });

  test('El diario copia lo que sedimentó en ese núcleo, no lo que ocurrió', () => {
    // Aquí no se propaga, no se deforma y no se recalcula ningún nivel: la entrada es
    // la versión que llegó, campo a campo.
    const nucleos = estadoDeNucleos();
    sedimenta(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', loQueLlego: TRES_CAMPANAS });
    const versiones = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Monfrida' });
    const diario = estadoDeDiario();
    const { entradas } = apuntaLoQueSeCuenta({ diario, versiones, mapaId: MAPA, nucleo: 'Monfrida', dia: 3, paso: 9 });
    assert.deepEqual(JSON.parse(JSON.stringify(entradas[0].hechos)), JSON.parse(JSON.stringify(versiones[0].hechos)));
    assert.equal(entradas[0].nivel, versiones[0].nivel);
    assert.equal(entradas[0].signo, versiones[0].signo);
    assert.equal(entradas[0].suceso, versiones[0].rumor, 'la identidad del suceso es la del rumor y no otra');
  });

  test('Un núcleo donde no se cuenta nada no apunta ninguna entrada y no falla', () => {
    const diario = estadoDeDiario();
    const resultado = apuntaLoQueSeCuenta({ diario, versiones: [], mapaId: MAPA, nucleo: 'Peiteiro', dia: 1, paso: 1 });
    assert.deepEqual(resultado.entradas, []);
    assert.deepEqual(resultado.hechos, []);
    assert.deepEqual(entradasDe(diario), []);
  });

  test('Volver al mismo núcleo que ya contó su versión no añade una segunda entrada', () => {
    const diario = estadoDeDiario();
    apuntaLoQueSeCuenta({ diario, versiones: [TRES_CAMPANAS], mapaId: MAPA, nucleo: 'Monfrida', dia: 22, paso: 40 });
    const antes = JSON.stringify(entradasDe(diario));
    const vuelta = apuntaLoQueSeCuenta({ diario, versiones: [TRES_CAMPANAS], mapaId: MAPA, nucleo: 'Monfrida', dia: 25, paso: 90 });
    assert.deepEqual(vuelta.entradas, [], 'volver al mismo pueblo no aporta nada nuevo');
    assert.equal(entradasDe(diario).length, 1);
    assert.equal(JSON.stringify(entradasDe(diario)), antes, 'y no reescribe el momento de la primera');
  });

  test('Una entrada declara de qué mapa es y no aparece en el diario de otro', () => {
    const diario = estadoDeDiario();
    apunta(diario, entradaDe({ mapa: MAPA }));
    apunta(diario, entradaDe({ mapa: OTRO_MAPA, nucleo: 'Vilanova' }));
    assert.equal(entradasDe(diario, { mapaId: MAPA }).length, 1);
    assert.equal(entradasDe(diario, { mapaId: MAPA })[0].mapa, MAPA);
    assert.equal(entradasDe(diario, { mapaId: OTRO_MAPA }).length, 1);
    assert.equal(entradasDe(diario).length, 2, 'las dos están en la partida, cada una en su mapa');
  });

  test('Un diario sin ninguna entrada se lee como lista vacía y no como un error', () => {
    const diario = estadoDeDiario();
    assert.deepEqual(entradasDe(diario), []);
    assert.deepEqual(entradasDe(diario, { mapaId: MAPA }), []);
    assert.deepEqual(entradasDeSuceso(diario, { suceso: SUCESO }), []);
    assert.deepEqual(proyeccionPorDias(diario), []);
    assert.deepEqual(sucesosConVariasVersiones(diario), []);
    assert.equal(tieneVariasVersiones(diario, { suceso: SUCESO }), false);
  });

  test('Una entrada sin texto del narrador tiene el dato completo y cae al texto de su plantilla', () => {
    const entrada = entradaDe({ texto: null });
    assert.equal(entrada.texto, null);
    assert.equal(entrada.plantilla, 'entrega-sospechosa', 'de qué plantilla salió es lo que permite caer a su texto');
    assert.equal(entrada.nivel, 1);
    assert.equal(entrada.signo, SIGNOS.BUENO);
    assert.equal(entrada.hechos.escala.veces, 3, 'los hechos están completos sin la redacción');
    assert.equal(textoDe(estadoDeTextos(), entrada), null);
  });

  test('La versión de un testigo directo entra como una entrada más y no corrige la del pueblo', () => {
    // SPEC-014: el testigo es nivel 0 por construcción. Con la fuente en la clave,
    // su versión convive con la torcida del pueblo en lugar de pisarla.
    const diario = estadoDeDiario();
    apuntaLoQueSeCuenta({ diario, versiones: [TRES_CAMPANAS], mapaId: MAPA, nucleo: 'Monfrida', dia: 22, paso: 40 });
    const recordado = hechoRecordado({
      id: SUCESO,
      hechos: hechosDe({ veces: 1 }),
      signo: SIGNOS.BUENO,
      origen: 'Monfrida',
      caras: [{ sitio: 'Vilanova', puesto: 'regencia' }],
    });
    const { entradas } = apuntaLoQueCuentaUnTestigo({
      diario,
      cara: { sitio: 'Vilanova', puesto: 'regencia' },
      hechos: [recordado],
      mapaId: MAPA,
      dia: 23,
      paso: 55,
    });
    assert.equal(entradas.length, 1);
    assert.equal(entradas[0].fuente.tipo, FUENTES.CARA);
    assert.equal(entradas[0].nivel, 0);
    assert.equal(entradas[0].lugar, 'Vilanova', 'el diario apunta dónde te lo contaron, no dónde ocurrió');
    const todas = entradasDeSuceso(diario, { suceso: SUCESO });
    assert.equal(todas.length, 2, 'la del testigo entra además de la del pueblo');
    assert.equal(todas[0].hechos.escala.veces, 3, 'y la del pueblo sigue con sus tres campanas');
  });
});

describe('El diario no sobrescribe', () => {
  test('Una entrada no se sobrescribe con otra más veraz', () => {
    // Escenario `@app` de la batería, verificado aquí en `@nucleo`: la versión fiel
    // que se oye en «Vilanova» **no corrige** la torcida que se oyó en «Monfrida».
    const diario = estadoDeDiario();
    apuntaLoQueSeCuenta({ diario, versiones: [TRES_CAMPANAS], mapaId: MAPA, nucleo: 'Monfrida', dia: 22, paso: 40 });
    const antes = JSON.stringify(entradasDe(diario)[0]);
    apuntaLoQueSeCuenta({ diario, versiones: [UNA_CAMPANA], mapaId: MAPA, nucleo: 'Vilanova', dia: 23, paso: 61 });

    const dos = entradasDeSuceso(diario, { suceso: SUCESO });
    assert.equal(dos.length, 2, 'el diario contiene las dos entradas');
    assert.deepEqual(dos.map((e) => e.hechos.escala.veces), [3, 1]);
    assert.deepEqual(dos.map((e) => e.lugar), ['Monfrida', 'Vilanova']);
    // Ninguna se marca como correcta: no hay dónde escribirlo.
    for (const e of dos) {
      assert.ok(!('correcta' in e) && !('fiel' in e) && !('veraz' in e), 'una entrada no puede declararse la buena');
    }
    assert.ok(!/correcta|veraz|fiabilidad/i.test(JSON.stringify(dos)));
    // Y la anterior sigue idéntica: ni su versión, ni su lugar, ni su momento.
    assert.equal(JSON.stringify(dos[0]), antes);
  });

  test('Dos entradas del mismo suceso declaran la misma identidad y se agrupan sin comparar textos', () => {
    const diario = estadoDeDiario();
    apuntaLoQueSeCuenta({ diario, versiones: [TRES_CAMPANAS], mapaId: MAPA, nucleo: 'Monfrida', dia: 22, paso: 40 });
    apuntaLoQueSeCuenta({ diario, versiones: [UNA_CAMPANA], mapaId: MAPA, nucleo: 'Vilanova', dia: 23, paso: 61 });
    const dos = entradasDeSuceso(diario, { suceso: SUCESO });
    assert.equal(new Set(dos.map((e) => e.suceso)).size, 1, 'las dos hablan del mismo suceso');
    assert.equal(new Set(dos.map((e) => e.id)).size, 2, 'y son dos entradas distintas, por la fuente');
    assert.deepEqual(sucesosConVariasVersiones(diario), [SUCESO]);
    assert.equal(tieneVariasVersiones(diario, { suceso: SUCESO }), true);
    // Se responde por identidad de suceso: los dos textos son el mismo y da igual.
    assert.deepEqual(dos.map((e) => e.texto), [null, null]);
  });

  test('Las versiones se ordenan por cuándo se oyeron', () => {
    // Escenario `@app` de la batería; aquí vive su mitad de dato. Tres versiones
    // oídas en los días 22, 23 y 29 salen en ese orden, **y no en orden de
    // fidelidad**: se apuntan en desorden y con los niveles al revés a propósito.
    const diario = estadoDeDiario();
    apuntaLoQueSeCuenta({ diario, versiones: [versionDe({ nivel: 3, veces: 9 })], mapaId: MAPA, nucleo: 'Peiteiro', dia: 29, paso: 200 });
    apuntaLoQueSeCuenta({ diario, versiones: [versionDe({ nivel: 0, veces: 1 })], mapaId: MAPA, nucleo: 'Vilanova', dia: 23, paso: 61 });
    apuntaLoQueSeCuenta({ diario, versiones: [versionDe({ nivel: 1, veces: 3 })], mapaId: MAPA, nucleo: 'Monfrida', dia: 22, paso: 40 });

    const tres = entradasDeSuceso(diario, { suceso: SUCESO });
    assert.deepEqual(tres.map((e) => e.dia), [22, 23, 29]);
    assert.deepEqual(tres.map((e) => e.nivel), [1, 0, 3], 'el orden no es el de fidelidad');
    assert.deepEqual(proyeccionDeSuceso(diario, { suceso: SUCESO }).map((e) => e.dia), [22, 23, 29]);
    assert.deepEqual(proyeccionPorDias(diario).map((e) => e.dia), [22, 23, 29]);
  });

  test('En la superficie pública no existe ningún orden por fidelidad ni por nivel', () => {
    // Se evita mejor no exportando la función que confiando en que nadie la llame,
    // que es el mismo argumento con el que SPEC-012 no entrega el nivel a quien pinta.
    assert.deepEqual(Object.keys(moduloDeDiario).sort(), [
      'CLASES_DE_ENTRADA',
      'ESQUEMA_DIARIO',
      'ESQUEMA_ENTRADA',
      'ESQUEMA_TEXTOS',
      'FUENTES',
      'IDS_DE_CLASE_DE_ENTRADA',
      'IDS_DE_FUENTE',
      'ORIGENES_DE_TEXTO',
      'apunta',
      'apuntaLoQueCuentaUnTestigo',
      'apuntaLoQueSeCuenta',
      'bytesDeEntrada',
      'claveDeEntrada',
      'congelaDiario',
      'congelaTextos',
      'entradaDeDiario',
      'entradaDeHecho',
      'entradasDe',
      'entradasDeSuceso',
      'estadoDeDiario',
      'estadoDeTextos',
      'exigeFuente',
      'guardaTexto',
      'hechoDeEntrada',
      'levantaDiario',
      'levantaTextos',
      'planDeApunte',
      'proyeccion',
      'proyeccionDeSuceso',
      'proyeccionPorDias',
      'sucesosConVariasVersiones',
      'textoDe',
      'tieneVariasVersiones',
    ]);
    // Ni una función que corrija, sustituya o marque como correcta una entrada.
    for (const nombre of Object.keys(moduloDeDiario)) {
      assert.ok(!/corrige|sustituye|marcaCorrecta|ordenaPorNivel|ordenaPorFidelidad/i.test(nombre), `"${nombre}" ofrecería la corrección que el diario se niega a hacer`);
    }
  });

  test('Una tercera versión del mismo suceso convive con las dos anteriores', () => {
    const diario = estadoDeDiario();
    for (const [nucleo, dia, nivel, veces] of [['Monfrida', 22, 1, 3], ['Vilanova', 23, 0, 1], ['Cadaval', 29, 2, 9]]) {
      apuntaLoQueSeCuenta({ diario, versiones: [versionDe({ nivel, veces })], mapaId: MAPA, nucleo, dia, paso: dia * 2 });
    }
    const tres = entradasDeSuceso(diario, { suceso: SUCESO });
    assert.equal(tres.length, 3, 'las tres conviven y ninguna sustituye a otra');
    assert.deepEqual(tres.map((e) => e.hechos.escala.veces), [3, 1, 9]);
    assert.equal(new Set(tres.map((e) => e.id)).size, 3);
  });

  test('La clave de una entrada es su suceso y su fuente, y no el suceso a secas', () => {
    const enElPueblo = claveDeEntrada({ mapa: MAPA, suceso: SUCESO, fuente: { tipo: FUENTES.NUCLEO, sitio: 'Monfrida' } });
    const enOtroPueblo = claveDeEntrada({ mapa: MAPA, suceso: SUCESO, fuente: { tipo: FUENTES.NUCLEO, sitio: 'Vilanova' } });
    const laCara = claveDeEntrada({ mapa: MAPA, suceso: SUCESO, fuente: { tipo: FUENTES.CARA, sitio: 'Monfrida', puesto: 'regencia' } });
    assert.equal(new Set([enElPueblo, enOtroPueblo, laCara]).size, 3);
    assert.equal(claveDeEntrada({ mapa: MAPA, suceso: SUCESO, fuente: { tipo: FUENTES.NUCLEO, sitio: 'Monfrida' } }), enElPueblo);
    assert.throws(() => claveDeEntrada({ mapa: MAPA, suceso: SUCESO, fuente: { tipo: 'oido-por-ahi', sitio: 'x' } }), /enumerado cerrado/);
  });

  test('El diario vuelve de su documento con sus entradas y su orden intactos', () => {
    const diario = estadoDeDiario();
    apuntaLoQueSeCuenta({ diario, versiones: [TRES_CAMPANAS], mapaId: MAPA, nucleo: 'Monfrida', dia: 22, paso: 40 });
    apuntaLoQueSeCuenta({ diario, versiones: [UNA_CAMPANA], mapaId: MAPA, nucleo: 'Vilanova', dia: 23, paso: 61 });
    const vuelto = levantaDiario(congelaDiario(diario));
    assert.equal(JSON.stringify(congelaDiario(vuelto)), JSON.stringify(congelaDiario(diario)));
    assert.deepEqual(entradasDe(vuelto).map((e) => e.nivel), [1, 0], 'el nivel y el signo vuelven intactos');
  });
});

describe('El nivel de deformación no sale a pantalla', () => {
  test('El dato interno de una entrada lleva el nivel y el signo con los que llegó', () => {
    const entrada = entradaDe({ nivel: 3, signo: SIGNOS.FEO });
    assert.equal(entrada.nivel, 3);
    assert.equal(entrada.signo, SIGNOS.FEO);
  });

  test('El nivel de deformación no sale nunca a pantalla', () => {
    // Escenario `@app` de la batería, verificado aquí en `@nucleo`: un diario con
    // versiones de niveles 0, 1 y 3, recorrido entero por días y por sucesos, no
    // expone el nivel en ninguna entrada de la proyección. La pantalla no puede
    // enseñar lo que no recibe.
    const diario = estadoDeDiario();
    const niveles = [0, 1, 3];
    niveles.forEach((nivel, i) => {
      apuntaLoQueSeCuenta({
        diario,
        versiones: [versionDe({ nivel, veces: nivel + 1 })],
        mapaId: MAPA,
        nucleo: ['Vilanova', 'Monfrida', 'Peiteiro'][i],
        dia: 20 + i,
        paso: 40 + i,
      });
    });

    const porDias = proyeccionPorDias(diario, { mapaId: MAPA });
    const porSucesos = proyeccionDeSuceso(diario, { mapaId: MAPA, suceso: SUCESO });
    assert.equal(porDias.length, 3);
    assert.equal(porSucesos.length, 3);
    for (const vista of [porDias, porSucesos]) {
      for (const e of vista) {
        assert.deepEqual(Object.keys(e).sort(), ['clase', 'dia', 'fuente', 'hechos', 'id', 'lugar', 'mapa', 'paso', 'plantilla', 'signo', 'suceso', 'texto']);
        assert.ok(!('nivel' in e), 'el nivel ha llegado hasta la proyección que consumen las pantallas');
      }
      assert.ok(!/"nivel"|"ejes"|"escalon"|fiabilidad|porcentaje|fidelidad/i.test(JSON.stringify(vista)));
    }
    // El signo sí viaja: es si el acto fue bueno o feo, no cuánto se ha torcido.
    assert.deepEqual(porDias.map((e) => e.signo), [SIGNOS.BUENO, SIGNOS.BUENO, SIGNOS.BUENO]);
    // Y el dato interno sigue llevándolo, que es lo que hace posible reconstruir.
    assert.deepEqual(entradasDe(diario).map((e) => e.nivel), [0, 1, 3]);
  });

  test('La proyección solo se puede ordenar por cuándo se oyó', () => {
    const diario = estadoDeDiario();
    apuntaLoQueSeCuenta({ diario, versiones: [versionDe({ nivel: 3, veces: 9 })], mapaId: MAPA, nucleo: 'Peiteiro', dia: 29, paso: 200 });
    apuntaLoQueSeCuenta({ diario, versiones: [versionDe({ nivel: 0, veces: 1 })], mapaId: MAPA, nucleo: 'Vilanova', dia: 23, paso: 61 });
    const vista = proyeccionPorDias(diario);
    assert.deepEqual(vista.map((e) => e.dia), [23, 29]);
    // No hay ningún campo con el que reordenar por fidelidad: ni nivel, ni ejes.
    for (const e of vista) assert.ok(!('nivel' in e) && !('ejes' in e));
  });

  test('Un nivel fuera del rango de cero a tres falla nombrando el valor recibido', () => {
    assert.throws(() => entradaDe({ nivel: 4 }), /4/);
    assert.throws(() => entradaDe({ nivel: -1 }), /-1/);
    assert.throws(() => entradaDe({ nivel: '1' }), /"1"/);
    // Y falla al apuntar, no al leer: una entrada mal formada no llega al diario.
    const diario = estadoDeDiario();
    assert.throws(() => apunta(diario, { ...entradaDe(), nivel: 7 }), /7/);
    assert.deepEqual(entradasDe(diario), []);
  });

  test('Una entrada sin identidad de suceso no se puede apuntar', () => {
    assert.throws(() => entradaDe({ suceso: '' }), /sin identidad de suceso/);
    assert.throws(() => entradaDeDiario({ mapa: MAPA, suceso: SUCESO, fuente: null, lugar: 'x', dia: 1, paso: 1, hechos: hechosDe({}), nivel: 0, signo: SIGNOS.BUENO }), /"nucleo" \| "cara"/);
  });
});

describe('Los textos del narrador viven una sola vez', () => {
  test('Un texto citado por varias entradas se guarda una sola vez y por su clave', () => {
    const textos = estadoDeTextos();
    const REDACCION = 'Dicen que en el valle se oyeron campanadas hasta el amanecer.';
    guardaTexto(textos, { clave: 't1', texto: REDACCION, origen: 'llm' });
    guardaTexto(textos, { clave: 't1', texto: 'otra redacción', origen: 'plantilla' });
    assert.equal(Object.keys(textos.textos).length, 1, 'guardarlo dos veces con la misma clave deja el primero');
    assert.equal(textos.textos.t1.texto, REDACCION);

    const dos = [entradaDe({ nucleo: 'Monfrida', texto: 't1' }), entradaDe({ nucleo: 'Vilanova', texto: 't1' })];
    for (const e of dos) {
      assert.equal(e.texto, 't1', 'la entrada cita el texto por su clave y no lo copia');
      assert.equal(textoDe(textos, e).texto, textos.textos.t1.texto);
    }
    assert.ok(!JSON.stringify(dos).includes(REDACCION), 'ninguna entrada lleva el texto dentro');
    assert.throws(() => guardaTexto(textos, { clave: 't2', texto: 'x', origen: 'inventado' }), /enumerado cerrado/);
  });
});

describe('El tamaño de una entrada del diario', () => {
  test('Una entrada de diario ocupa menos de 500 bytes', () => {
    // Se mide en su forma canónica y sin el texto que la cuenta, que vive aparte.
    const casos = [
      entradaDe({}),
      entradaDe({ nivel: 3, veces: 27, texto: 'texto-de-la-entrada-1' }),
      entradaDe({ fuente: { tipo: FUENTES.CARA, sitio: 'Vilanova', puesto: 'regencia' }, lugar: 'Vilanova', nivel: 0, veces: 1 }),
    ];
    for (const entrada of casos) {
      const bytes = bytesDeEntrada(entrada);
      assert.ok(bytes < PRESUPUESTO_DE_ENTRADA, `una entrada ocupa ${bytes} bytes y el presupuesto son ${PRESUPUESTO_DE_ENTRADA}`);
    }
  });

  test('La proyección de una lista y la de una entrada suelta dan lo mismo', () => {
    const entrada = entradaDe({});
    assert.deepEqual(JSON.parse(JSON.stringify(proyeccion(entrada))), JSON.parse(JSON.stringify(proyeccion([entrada]))));
    assert.equal(proyeccion(entrada)[0].clase, CLASES_DE_ENTRADA.OIDO);
  });
});
