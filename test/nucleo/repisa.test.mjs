// SPEC-038 · La repisa (A6P5): **lo que se te ha quedado, de quién vino y de qué día**,
// y debajo los motes por núcleo.
//
// Lo que aquí se afirma, y es lo que la spec gasta criterios en decir: **la repisa no es
// un inventario**. No se comprueba mirando una pantalla —en esta máquina no hay
// simulador— sino contra el vocabulario cerrado del núcleo: las ausencias están
// nombradas (`LO_QUE_LA_REPISA_NO_TIENE`) y, sobre todo, **no existe la función que las
// escribiría**. Un inventario aparecería como una operación exportada que quita, ordena
// o equipa, y la lista de exportaciones se puede recorrer.
//
// «La repisa no es un inventario» está etiquetado `@app` en `docs/testing.md` y se
// implementa aquí en `@nucleo`, sobre la proyección: es el nivel al que hoy se puede
// ejecutar y donde de verdad vive la afirmación. Lo que solo se ve con dispositivo —que
// los tres gestos de inventario no respondan— va en `test/app/repisa.yaml`. Igual con
// «El mote nace del rumor y es por núcleo», del que aquí vive la mitad de pantalla: que
// los motes se vean por núcleo y juntos. Los demás casos van declarados como huecos de
// la batería en `test/spec-test-map.json`.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as moduloDeRepisa from '../../packages/nucleo/partida/repisa.js';
import {
  CIFRAS_QUE_LA_REPISA_NO_ENSENA,
  LO_QUE_LA_REPISA_NO_TIENE,
  MANERAS_DE_APARECER,
  MOMENTO,
  SIN_CARAS,
  SITIO,
  TESTIDS,
  TEXTOS,
  componeRepisa,
  exigeCaras,
  lineaDeOro,
  procedenciaLegible,
} from '../../packages/nucleo/partida/repisa.js';
import { REGISTROS, TIPOGRAFIAS } from '../../packages/nucleo/lenguaje/registro.js';
import { hechosFieles } from '../../packages/nucleo/partida/deformacion.js';
import { declaraCandidato, estadoDeMotes } from '../../packages/nucleo/partida/motes.js';
import { estadoDeNucleos, sedimenta, versionQueLlego } from '../../packages/nucleo/partida/nucleos.js';
import { estadoDeObjetos, guarda } from '../../packages/nucleo/partida/objetos.js';
import { estadoDeOro, ingresa } from '../../packages/nucleo/partida/oro.js';
import { fuente } from './mundo-de-prueba.mjs';
import { CADENA, MAPA, OTRO_MAPA, SIGNOS, mapaDe, semillaDeRumor } from './progresion-de-prueba.mjs';

/** Los cuatro núcleos que usan estas pruebas, del mapa de cadena de SPEC-015. */
const [MONFRIDA, VILANOVA, CADAVAL] = CADENA;

/** Los verbos que un inventario tendría y esta superficie no puede tener. */
const VERBOS_DE_INVENTARIO = ['quita', 'tira', 'suelta', 'descarta', 'equipa', 'ordena', 'combina', 'reordena', 'mueve', 'vacia'];

/**
 * Sedimenta en un núcleo un rumor con su mote candidato y **el momento en que se oyó**.
 *
 * Se escribe aquí en lugar de usar `oye` de `progresion-de-prueba.mjs` porque el orden
 * de los motes sale precisamente de `oidoEn`, que aquel helper no fija: sin él, todas
 * las pruebas de orden pasarían por el desempate y no por el criterio.
 */
function oyeConMomento(nucleos, motes, { nucleo, rumor, candidato, oidoEn, nivel = 0, mapaId = MAPA }) {
  sedimenta(nucleos, {
    mapaId,
    nucleo,
    loQueLlego: versionQueLlego({
      rumor,
      origen: nucleo,
      nivel,
      signo: SIGNOS.BUENO,
      hechos: hechosFieles(semillaDeRumor(`lo de ${rumor}`, nucleo), { lugar: nucleo }),
      oidoEn,
    }),
  });
  if (candidato) declaraCandidato(motes, { mapaId, rumor, candidato });
  return nucleos;
}

/** Una partida con lo que la repisa lee, todo vacío. */
function partida() {
  return { objetos: estadoDeObjetos(), oro: estadoDeOro(), motes: estadoDeMotes(), nucleos: estadoDeNucleos() };
}

/** La proyección de la repisa sobre una partida, con el mapa de cadena como activo. */
function repisaDe(estado, { mapaId = MAPA, caras = SIN_CARAS, mapa = mapaDe() } = {}) {
  return componeRepisa({ ...estado, mapaId, mapa, caras });
}

/** Los cuatro objetos de referencia: dos días distintos, dos el mismo día, dos clases. */
function conCuatroObjetos(estado) {
  guarda(estado.objetos, { id: 'silbato-del-zagal', clase: 'llave', procedencia: { desenlace: 'd1', plantilla: 'rescate-en-la-granja' }, dia: 11 });
  guarda(estado.objetos, { id: 'hule-del-paquete', clase: 'recuerdo', procedencia: { plantilla: 'entrega-sospechosa', lugar: 'la plaza' }, dia: 23 });
  guarda(estado.objetos, { id: 'clavo-de-la-forja', clase: 'recuerdo', procedencia: { desenlace: 'd3' }, dia: 23 });
  guarda(estado.objetos, { id: 'saco-de-la-sal', clase: 'llave', procedencia: {}, dia: 4 });
  return estado;
}

/** Todas las cifras de un valor con la ruta en la que están, para poder nombrarlas. */
function cifrasConRuta(valor, ruta = 'repisa', out = []) {
  if (typeof valor === 'number') out.push({ ruta, valor });
  else if (Array.isArray(valor)) valor.forEach((v, i) => cifrasConRuta(v, `${ruta}[${i}]`, out));
  else if (valor && typeof valor === 'object') for (const k of Object.keys(valor)) cifrasConRuta(valor[k], `${ruta}.${k}`, out);
  return out;
}

describe('Los objetos son llaves, no requisitos', () => {
  test('La repisa no es un inventario', () => {
    // Escenario `@app` de la batería, verificado aquí en `@nucleo` sobre la proyección.
    // La mitad que sí necesita dispositivo —que los tres gestos no respondan— vive en
    // `test/app/repisa.yaml`.
    const estado = conCuatroObjetos(partida());
    const repisa = repisaDe(estado);
    assert.equal(repisa.objetos.lista.length, 4);

    // Ni peso, ni huecos, ni manera de tirar nada, y ninguna de las cuatro acciones que
    // un inventario tendría.
    for (const ausencia of ['peso', 'huecos', 'tirar', 'equipar', 'ordenar', 'combinar', 'descartar']) {
      assert.ok(LO_QUE_LA_REPISA_NO_TIENE.includes(ausencia), `"${ausencia}" no está entre las ausencias declaradas`);
    }
    const texto = JSON.stringify(repisa);
    for (const ausencia of LO_QUE_LA_REPISA_NO_TIENE) {
      assert.ok(!texto.includes(`"${ausencia}"`), `la proyección de la repisa lleva "${ausencia}"`);
    }

    // Y lo que de verdad lo sostiene: **no existe la función que lo escribiría**. Una
    // ausencia que solo vigila una lista se puede saltar añadiendo un export.
    for (const nombre of Object.keys(moduloDeRepisa)) {
      for (const verbo of VERBOS_DE_INVENTARIO) {
        assert.ok(
          !nombre.toLowerCase().startsWith(verbo),
          `la repisa exporta "${nombre}", que es una operación de inventario: la repisa se lee y no se opera`,
        );
      }
    }

    // Cada objeto dice de quién viene y de qué día, que es la otra mitad del escenario.
    for (const objeto of repisa.objetos.lista) {
      assert.match(objeto.linea, /^de .+ · día \d+$/, `el objeto "${objeto.id}" no dice de quién viene y de qué día`);
      assert.ok(MANERAS_DE_APARECER.includes(objeto.procedencia.manera));
    }
  });
});

describe('La repisa se lee y no se opera', () => {
  test('Un hallazgo de cuneta declara cómo apareció y no queda en blanco', () => {
    // Sin cara, sin sitio y sin salida: el objeto sigue diciendo cómo llegó.
    const cuneta = procedenciaLegible({ id: 'saco-de-la-sal', procedencia: {} }, SIN_CARAS);
    assert.equal(cuneta.manera, 'de-camino');
    assert.equal(cuneta.quien, null);
    assert.ok(cuneta.texto.trim().length, 'la procedencia de un hallazgo de cuneta ha quedado en blanco');

    // Y con una cara detrás, dice de quién viene.
    const caras = { nombreDe: (p) => (p.desenlace === 'd1' ? 'Sabela' : null) };
    const deSabela = procedenciaLegible({ id: 'silbato-del-zagal', procedencia: { desenlace: 'd1' } }, caras);
    assert.equal(deSabela.manera, 'de-alguien');
    assert.equal(deSabela.quien, 'Sabela');
    assert.equal(deSabela.texto, 'de Sabela');
  });

  test('Los objetos salen del más reciente al más antiguo, con desempate declarado', () => {
    const repisa = repisaDe(conCuatroObjetos(partida()));
    assert.deepEqual(repisa.objetos.lista.map((o) => o.dia), [23, 23, 11, 4]);
    // Dos objetos del mismo día es un caso corriente, y el desempate no puede ser el
    // orden de llegada: es por identidad.
    assert.deepEqual(
      repisa.objetos.lista.filter((o) => o.dia === 23).map((o) => o.id),
      ['clavo-de-la-forja', 'hule-del-paquete'],
    );
  });

  test('Una llave y un recuerdo se presentan igual', () => {
    const repisa = repisaDe(conCuatroObjetos(partida()));
    const llave = repisa.objetos.lista.find((o) => o.id === 'silbato-del-zagal');
    const recuerdo = repisa.objetos.lista.find((o) => o.id === 'clavo-de-la-forja');
    assert.equal(llave.clase, 'llave');
    assert.equal(recuerdo.clase, 'recuerdo');
    // Misma forma exacta: nada que distinga al que abre puertas.
    assert.deepEqual(Object.keys(llave), Object.keys(recuerdo));
    for (const objeto of repisa.objetos.lista) {
      assert.ok(!/llave|abre|puerta/i.test(objeto.linea), `la línea de "${objeto.id}" distingue al que abre puertas`);
    }
  });

  test('Un objeto obtenido en otro mapa aparece en la repisa del mapa activo', () => {
    // Los objetos son de la jugadora y no del sitio: se leen de la partida entera.
    const estado = conCuatroObjetos(partida());
    const enCasa = repisaDe(estado, { mapaId: MAPA });
    const fuera = repisaDe(estado, { mapaId: OTRO_MAPA });
    assert.deepEqual(fuera.objetos.lista.map((o) => o.id), enCasa.objetos.lista.map((o) => o.id));
    assert.equal(fuera.oro.saldo, enCasa.oro.saldo, 'la bolsa tampoco es del sitio');
  });

  test('La repisa sin objetos se enseña vacía y no es un error', () => {
    const repisa = repisaDe(partida());
    assert.deepEqual(repisa.objetos.lista, []);
    assert.equal(repisa.objetos.vacio, TEXTOS.sinObjetos);
    // En voz de mundo y sin explicar por qué: explicarlo sería la voz de aplicación
    // asomando en el bucle.
    assert.equal(repisa.registro, REGISTROS.MUNDO);
    assert.ok(!/aplicaci|ajuste|pantalla|todav[ií]a no has desbloqueado/i.test(repisa.objetos.vacio));
  });

  test('Un objeto sin procedencia declarada falla nombrándolo', () => {
    const estado = partida();
    // Se escribe directamente en el área para saltarse la normalización, que es
    // exactamente lo que haría una partida guardada antes de que existiera el campo.
    estado.objetos.objetos = [{ id: 'hebilla-de-laton', clase: 'recuerdo', procedencia: null, dia: 9 }];
    assert.throws(() => repisaDe(estado), /hebilla-de-laton/, 'un objeto sin procedencia se ha pintado a medias');
    assert.throws(() => repisaDe(estado), /RF-PROG-007/);
  });

  test('La repisa sin con qué resolver de quién viene un objeto falla en vez de callarse', () => {
    // §6h: sin `caras`, todos los objetos dirían cómo aparecieron y ninguno de quién
    // viene, y nada protestaría. Quien no tenga caras pasa SIN_CARAS por escrito.
    const estado = conCuatroObjetos(partida());
    assert.throws(() => componeRepisa({ ...estado, mapaId: MAPA, mapa: mapaDe(), caras: null }), /SIN_CARAS/);
    assert.throws(() => exigeCaras({}), /nombreDe/);
  });

  test('La única cifra de la repisa es el saldo de oro', () => {
    const estado = conCuatroObjetos(partida());
    ingresa(estado.oro, { oro: 12, quien: 'una entrega' });
    const repisa = repisaDe(estado);

    // El día es cifra y se enseña —es la mitad de RF-PROG-007—, y el saldo también. Ni
    // una más: ni distancia, ni tiempo, ni ritmo, ni pasos, ni progreso.
    for (const { ruta } of cifrasConRuta(repisa)) {
      assert.ok(
        /\.dia$/.test(ruta) || ruta === 'repisa.oro.saldo',
        `la repisa enseña una cifra que no es el saldo ni el día: ${ruta}`,
      );
    }
    const texto = JSON.stringify(repisa);
    for (const cifra of CIFRAS_QUE_LA_REPISA_NO_ENSENA) {
      assert.ok(!texto.includes(cifra), `la repisa habla de "${cifra}"`);
    }
  });
});

describe('El personaje se elige una vez y el oficio no se cambia', () => {
  test('El mote nace del rumor y es por núcleo', () => {
    // Escenario `@app` de la batería. La mitad de datos —que un rumor pegue motes
    // distintos en dos núcleos— es de SPEC-015; aquí se sostiene la de pantalla: que la
    // repisa los enseñe **juntos y cada uno con su núcleo**, debajo de los objetos.
    const estado = partida();
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r1', candidato: 'la-de-la-caja', oidoEn: 30 });
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: VILANOVA, rumor: 'r2', candidato: 'la-que-no-preguntó', oidoEn: 12 });

    const repisa = repisaDe(estado);
    assert.equal(repisa.motes.lista.length, 2);
    assert.deepEqual(
      repisa.motes.lista.map((m) => [m.nucleo, m.candidato]),
      [[MONFRIDA, 'la-de-la-caja'], [VILANOVA, 'la-que-no-preguntó']],
    );
    // Cada uno con el núcleo donde te llaman así, y el mote escrito en palabras.
    assert.equal(repisa.motes.lista[0].mote, 'la de la caja');
    assert.equal(repisa.motes.titulo, TEXTOS.motes);
    // Y en la misma columna que los objetos: una sola proyección, sin pestañas ni
    // secciones plegables.
    assert.deepEqual(Object.keys(repisa).sort(), ['momento', 'motes', 'objetos', 'oro', 'registro', 'textos']);
  });
});

describe('Los motes hacen de ficha de personaje', () => {
  test('Los motes son solo los del mapa activo', () => {
    const estado = partida();
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r1', candidato: 'la-de-la-caja', oidoEn: 30 });
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r9', candidato: 'la-de-fuera', oidoEn: 30, mapaId: OTRO_MAPA });

    const repisa = repisaDe(estado, { mapaId: MAPA });
    assert.deepEqual(repisa.motes.lista.map((m) => m.candidato), ['la-de-la-caja']);
    assert.ok(!JSON.stringify(repisa).includes('la-de-fuera'), 'un mote de otro mapa ha viajado: el rango no viaja');
  });

  test('Un núcleo sin mote no aparece, y su ausencia no se declara', () => {
    const estado = partida();
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r1', candidato: 'la-de-la-caja', oidoEn: 30 });
    // Vilanova ha oído algo que no trae mote: no es que no haya oído nada, es que ese
    // rumor no declaró candidato. Tampoco aparece.
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: VILANOVA, rumor: 'r3', candidato: null, oidoEn: 40 });

    const repisa = repisaDe(estado);
    assert.deepEqual(repisa.motes.lista.map((m) => m.nucleo), [MONFRIDA]);
    for (const nucleo of [VILANOVA, CADAVAL]) {
      assert.ok(!repisa.motes.lista.some((m) => m.nucleo === nucleo), `"${nucleo}" aparece sin mote`);
    }
    // Y ninguna línea vacía: la lista tiene exactamente los que tienen mote.
    assert.ok(repisa.motes.lista.every((m) => m.mote && m.nucleo));
  });

  test('Un mapa recién levantado no tiene ningún mote y el hueco lo dice en voz de mundo', () => {
    const repisa = repisaDe(partida());
    assert.deepEqual(repisa.motes.lista, []);
    assert.equal(repisa.motes.vacio, TEXTOS.sinMotes);
    // Sin explicar por qué no hay ninguno: no se enseña la mecánica.
    assert.ok(!/rumor|mote se|cuando|desbloque|todav[ií]a no has/i.test(repisa.motes.vacio));
  });

  test('La lista de motes no lleva barra, escalones ni número junto a un pueblo', () => {
    const estado = partida();
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r1', candidato: 'la-de-la-caja', oidoEn: 30 });
    const repisa = repisaDe(estado);

    // La línea de un mote es el mote y el núcleo, y nada más: ni recuento, ni escalón,
    // ni momento. `progresion.md` §1 descarta el marcador de reputación.
    for (const mote of repisa.motes.lista) {
      assert.deepEqual(Object.keys(mote).sort(), ['candidato', 'mote', 'nucleo']);
    }
    assert.equal(cifrasConRuta(repisa.motes).length, 0, 'hay una cifra junto a un pueblo');
    for (const ausencia of ['barra-de-reputacion', 'escalones-por-nucleo', 'numero-junto-a-un-pueblo']) {
      assert.ok(LO_QUE_LA_REPISA_NO_TIENE.includes(ausencia), `"${ausencia}" no está entre las ausencias declaradas`);
    }
    assert.ok(!/forasteria|nombradia|pertenencia/.test(JSON.stringify(repisa)), 'el escalón de rango ha llegado a la repisa');
  });

  test('El orden de los motes sale del rumor más reciente y no del orden en que llegaron', () => {
    const estado = partida();
    // Se oye antes el de Monfrida y después el de Vilanova: manda el momento, no la
    // llegada, y por eso Vilanova va primero.
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r1', candidato: 'la-de-la-caja', oidoEn: 12 });
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: VILANOVA, rumor: 'r2', candidato: 'la-de-la-nota', oidoEn: 44 });
    assert.deepEqual(repisaDe(estado).motes.lista.map((m) => m.nucleo), [VILANOVA, MONFRIDA]);

    // Y con el mismo momento, el desempate es declarado y estable: por el núcleo.
    const empate = partida();
    oyeConMomento(empate.nucleos, empate.motes, { nucleo: VILANOVA, rumor: 'r1', candidato: 'la-de-la-nota', oidoEn: 20 });
    oyeConMomento(empate.nucleos, empate.motes, { nucleo: MONFRIDA, rumor: 'r2', candidato: 'la-de-la-caja', oidoEn: 20 });
    assert.deepEqual(repisaDe(empate).motes.lista.map((m) => m.nucleo), [MONFRIDA, VILANOVA]);
  });

  test('El mote es el candidato que SPEC-015 declara pegado en ese núcleo', () => {
    const estado = partida();
    // Dos rumores con dos candidatos en el mismo núcleo: el que se enseña es el que
    // `moteEn` resuelve, y esta entrega no elige ninguno.
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r1', candidato: 'la-de-la-caja', oidoEn: 10 });
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r2', candidato: 'la-de-la-caja', oidoEn: 20 });
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r3', candidato: 'la-de-la-nota', oidoEn: 30 });

    const [pegado] = repisaDe(estado).motes.lista;
    assert.equal(pegado.candidato, 'la-de-la-caja', 'la repisa ha elegido un mote en vez de leer el que está pegado');
  });
});

describe('El oro va al pie y en pequeño', () => {
  test('El saldo se compone en tiempo de ejecución a partir de la bolsa', () => {
    const estado = partida();
    ingresa(estado.oro, { oro: 12, quien: 'una entrega' });
    const repisa = repisaDe(estado);
    assert.equal(repisa.oro.saldo, 12);
    assert.equal(repisa.oro.linea, lineaDeOro(12));
    assert.ok(repisa.oro.linea.includes('12'), 'la línea del oro no sale del saldo');
    // Y no está escrita a mano en el catálogo de textos de la pantalla.
    assert.ok(!Object.values(TEXTOS).some((t) => /moneda/i.test(t)), 'la línea del oro se ha escrito a mano');
    assert.equal(repisa.textos.find((t) => t.id === 'oro').texto, repisa.oro.linea);
  });

  test('Una bolsa a cero lo dice sin cifra escrita a mano y sin reproche', () => {
    const repisa = repisaDe(partida());
    assert.equal(repisa.oro.saldo, 0);
    assert.equal(repisa.oro.linea, lineaDeOro(0));
    assert.ok(!/\d/.test(repisa.oro.linea), 'la bolsa a cero enseña una cifra');
    assert.ok(!/pena|deber[ií]as|todav[ií]a no|vac[ií]a|pobre/i.test(repisa.oro.linea), 'la línea del oro reprocha');
    // Y una cantidad que no es un saldo falla en vez de componer una frase rara.
    assert.throws(() => lineaDeOro(-1), /línea del oro/);
    assert.throws(() => lineaDeOro(1.5), /línea del oro/);
  });

  test('El oro ganado a lo largo de la partida no aparece: solo está el saldo', () => {
    const estado = partida();
    ingresa(estado.oro, { oro: 12, quien: 'una entrega' });
    ingresa(estado.oro, { oro: 7, quien: 'otra' });
    const repisa = repisaDe(estado);
    assert.deepEqual(Object.keys(repisa.oro).sort(), ['linea', 'saldo']);
    assert.equal(repisa.oro.saldo, 19);
    assert.ok(LO_QUE_LA_REPISA_NO_TIENE.includes('oro-ganado'));
    assert.ok(!/ganado|acumulad|total|hist[oó]ric/i.test(JSON.stringify(repisa)));
  });
});

describe('La repisa se proyecta igual siempre', () => {
  test('Dos proyecciones del mismo estado son idénticas', () => {
    const estado = conCuatroObjetos(partida());
    ingresa(estado.oro, { oro: 12, quien: 'una entrega' });
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: MONFRIDA, rumor: 'r1', candidato: 'la-de-la-caja', oidoEn: 30 });
    oyeConMomento(estado.nucleos, estado.motes, { nucleo: VILANOVA, rumor: 'r2', candidato: 'la-de-la-nota', oidoEn: 44 });

    const una = JSON.stringify(repisaDe(estado));
    const otra = JSON.stringify(repisaDe(estado));
    assert.equal(una, otra, 'dos proyecciones de la misma repisa difieren');
  });

  test('La repisa declara su momento, su registro y sus localizadores', () => {
    const repisa = repisaDe(partida());
    assert.equal(repisa.momento, MOMENTO);
    assert.equal(MOMENTO, 'de-consulta');
    assert.equal(SITIO, 'repisa');
    // Habla como mundo, y de ahí sale la serif sin que la pantalla la elija.
    assert.equal(repisa.registro, REGISTROS.MUNDO);
    for (const texto of repisa.textos) {
      assert.equal(texto.registro, REGISTROS.MUNDO, `el texto "${texto.id}" de la repisa no habla como mundo`);
      assert.equal(texto.tipografia, TIPOGRAFIAS.SERIF);
      assert.equal(texto.pantalla, 'a6p5');
    }
    assert.deepEqual(
      Object.values(TESTIDS).sort(),
      ['momento', 'repisa-mote', 'repisa-motes', 'repisa-objeto', 'repisa-objetos', 'repisa-oro'],
    );
  });

  test('La repisa no lee el reloj del sistema ni el azar', () => {
    const codigo = fuente('packages/nucleo/partida/repisa.js');
    for (const prohibido of ['Math.random', 'Date.now', 'new Date']) {
      assert.ok(!codigo.includes(prohibido), `repisa.js usa ${prohibido}`);
    }
  });
});
