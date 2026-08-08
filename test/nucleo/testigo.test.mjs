// SPEC-014 · Lo que una cara recuerda y cómo está el trato con ella: la memoria del
// testigo —corta, fiel y gratis— y la relación, que es **el único mecanismo del
// proyecto que puede ir hacia abajo**.
//
// Las dos direcciones del testigo se afirman a la vez porque juntas son la pieza:
// hacia la jugadora cuenta la versión fiel, hacia el pueblo no corrige nada. Sobre
// el mundo de mesa está medido: su núcleo cuenta el rumor en **nivel 1** y con la
// escala abultada, él lo cuenta en **nivel 0** y gratis, y preguntarle veinte veces
// no mueve ni un byte de lo sedimentado — ni propagar cuatro pasos más toca su
// memoria.
//
// Un solo caso lleva el nombre literal de su escenario de `docs/testing.md`; todo lo
// demás va declarado como hueco en `test/spec-test-map.json`, y no es descuido: el
// PRD marca RF-NPC-004 —la relación y la reparación— con «⚠ sin escenario», y es el
// requisito peor cubierto de los cinco.
//
// Nada de aquí toca la red ni el reloj del sistema: el mundo se escribe a mano, el
// azar sale de la semilla y los pasos los pide la prueba.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { SIGNOS, hechosFieles } from '../../packages/nucleo/partida/deformacion.js';
import {
  NIVEL_DEL_TESTIGO,
  TOPE_DE_MEMORIA,
  congelaMemorias,
  hechoRecordado,
  levantaMemorias,
  loQueRecuerda,
  recuerda,
} from '../../packages/nucleo/partida/memoria.js';
import { congelaNpcs, levantaNpcs, sitiosDeMapa } from '../../packages/nucleo/partida/npcs.js';
import { estadoDeNucleos, loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { creaMotorDePasos, estadoDePasos } from '../../packages/nucleo/partida/pasos.js';
import { plantillaDePuestos } from '../../packages/nucleo/partida/puestos.js';
import {
  ESCALONES,
  ESCALON_DE_PARTIDA,
  MECANISMOS_QUE_BAJAN,
  SIGNOS_DE_ACTO,
  TECHO_CON_CICATRIZ,
  congelaRelaciones,
  levantaRelaciones,
} from '../../packages/nucleo/partida/relacion.js';
import { arbolDeCalzadas, creaPropagacionDeRumores, estadoDeRumores, naceSuceso } from '../../packages/nucleo/partida/rumores.js';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import {
  LA_TABERNERA,
  MAPA,
  OTRO_MAPA,
  capaSobre,
  desenlaceDe,
  mundoDe,
  mundoDeMesa,
  semillaDeRumor,
} from './npc-de-prueba.mjs';

/** La otra cara del mismo sitio, que no fue rol en nada. */
const LA_COCINA = Object.freeze({ sitio: 'Casa Manuela', puesto: 'cocina' });
/** Una cara de otro sitio del mismo mapa. */
const EL_MERCADO = Object.freeze({ sitio: 'A Praza', puesto: 'regencia' });

/** El mundo de mesa con su capa y el hecho fiel del que todo cuelga. */
function mesaConTestigo() {
  const mundo = mundoDeMesa();
  const montaje = capaSobre(mundo);
  const hechos = hechosFieles(semillaDeRumor(), { lugar: 'Ourela' });
  return { mundo, ...montaje, hechos };
}

/** Un hecho más, con su propia identidad, para llenar una memoria. */
const otroHecho = (k) => hechosFieles(semillaDeRumor(`el asunto ${k}`), { lugar: 'Ourela' });

describe('La memoria del testigo: corta, fiel y gratis', () => {
  test('Lo que una cara vivió entra en su memoria en nivel 0, y lo que no vivió no entra', () => {
    const { capa, hechos } = mesaConTestigo();
    assert.deepEqual(capa.consultaAlTestigo(LA_TABERNERA).hechos, [], 'una cara nace con algo en la memoria');

    const cierre = capa.cierraSalida({ desenlace: desenlaceDe({ hechos, caras: [LA_TABERNERA] }), n: 3 });
    assert.deepEqual(cierre.recordado, [{ sitio: LA_TABERNERA.sitio, puesto: LA_TABERNERA.puesto }]);

    const recordado = capa.consultaAlTestigo(LA_TABERNERA);
    assert.equal(recordado.hechos.length, 1, 'el hecho que vivió no ha entrado en su memoria');
    assert.equal(recordado.hechos[0].id, 'r1');
    assert.equal(recordado.hechos[0].nivel, NIVEL_DEL_TESTIGO, 'el testigo no guarda su versión en nivel 0');
    assert.equal(NIVEL_DEL_TESTIGO, 0);
    assert.deepEqual(recordado.hechos[0].hechos, hechos, 'lo que guarda no es la versión fiel');

    // Gratis, y el cero va declarado dentro: un informante vende, un testigo cuenta.
    assert.equal(recordado.gratis, true);
    assert.deepEqual(recordado.coste, { oro: 0 }, 'preguntarle al testigo cuesta oro');

    // Hechos estructurados, y ni un texto redactado: los ejes de SPEC-012, intactos.
    assert.deepEqual(Object.keys(recordado.hechos[0].hechos).sort(), ['asunto', 'detalle', 'escala', 'fundidoCon', 'protagonista', 'trastocado']);
    assert.equal(JSON.stringify(recordado).includes('"texto"'), false, 'lo que entrega el testigo trae texto redactado');

    // Y quien no fue rol no lo recuerda: le llegará por rumor como a todo el mundo.
    assert.deepEqual(capa.consultaAlTestigo(LA_COCINA).hechos, [], 'un hecho ha entrado en la memoria de quien no participó');
    assert.deepEqual(capa.consultaAlTestigo(EL_MERCADO).hechos, [], 'un hecho ha entrado en la memoria de otro sitio');
  });

  test('La memoria se queda en cinco hechos y olvida el más antiguo por paso del mundo', () => {
    const { capa } = mesaConTestigo();
    assert.equal(TOPE_DE_MEMORIA, 5);
    // Seis hechos en pasos crecientes: al entrar el sexto se olvida el del paso 10.
    for (let k = 0; k < 6; k++) {
      capa.cierraSalida({ desenlace: desenlaceDe({ id: `h${k}`, hechos: otroHecho(k), caras: [LA_TABERNERA] }), n: 10 + k });
    }
    const recordado = capa.consultaAlTestigo(LA_TABERNERA).hechos;
    assert.equal(recordado.length, TOPE_DE_MEMORIA, 'la memoria ha crecido por encima de su tope');
    assert.deepEqual(recordado.map((h) => h.id), ['h1', 'h2', 'h3', 'h4', 'h5'], 'lo que se olvida no es lo de más atrás');

    // Y el desalojo es **por paso del mundo**, no por orden de llegada: un hecho que
    // se cierra el último pero ocurrió antes es el que se cae.
    capa.cierraSalida({ desenlace: desenlaceDe({ id: 'viejo', hechos: otroHecho('viejo'), caras: [LA_TABERNERA] }), n: 1 });
    const despues = capa.consultaAlTestigo(LA_TABERNERA).hechos.map((h) => h.id);
    assert.equal(despues.includes('viejo'), false, 'el desalojo mira el orden de llegada y no el paso del mundo');
    assert.deepEqual(despues, ['h1', 'h2', 'h3', 'h4', 'h5']);
    assert.equal(despues.length, TOPE_DE_MEMORIA);
  });

  test('Una cara sin ningún hecho en su memoria no cuenta nada y no falla', () => {
    const { capa } = mesaConTestigo();
    const vacia = capa.consultaAlTestigo(LA_COCINA);
    assert.deepEqual(vacia.hechos, []);
    assert.equal(vacia.gratis, true);
    assert.deepEqual(vacia.cara, { sitio: LA_COCINA.sitio, puesto: LA_COCINA.puesto });
    assert.equal(vacia.nivel, NIVEL_DEL_TESTIGO);
  });
});

describe('El diario registra lo oído, no lo cierto', () => {
  test('El testigo directo es fiel y no corrige al pueblo', () => {
    const { mundo, capa, hechos } = mesaConTestigo();
    // La tabernera de Vilanova fue rol en lo que ocurrió en Ourela.
    capa.cierraSalida({ desenlace: desenlaceDe({ hechos, caras: [LA_TABERNERA] }), n: 1 });

    // Y el rumor del mismo hecho llega a su núcleo por la calzada, deformado.
    const rumores = estadoDeRumores();
    const nucleos = estadoDeNucleos();
    const arbol = arbolDeCalzadas(mundo);
    naceSuceso({ estado: rumores, nucleos, mapaId: MAPA, arbol, id: 'r1', origen: 'Ourela', signo: SIGNOS.BUENO, hechos, semilla: semillaDeRumor(), n: 1 });
    const prop = creaPropagacionDeRumores({ semilla: SEMILLA_A, mapaId: MAPA, arbol, estado: rumores, nucleos, tramo: 1000 });
    for (let n = 2; n <= 5; n++) prop.produce(n, null);

    const [enVilanova] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' });
    assert.ok(enVilanova, 'el rumor no ha llegado al núcleo de la cara y el caso no compara nada');
    assert.equal(enVilanova.nivel, 1, 'lo que se cuenta en su núcleo ya no está deformado');
    assert.notEqual(JSON.stringify(enVilanova.hechos), JSON.stringify(hechos), 'lo que se cuenta en el núcleo es la versión fiel');

    // El NPC cuenta la versión fiel...
    const testigo = capa.consultaAlTestigo(LA_TABERNERA);
    assert.equal(testigo.hechos[0].nivel, 0);
    assert.deepEqual(testigo.hechos[0].hechos, hechos, 'el testigo no cuenta la versión fiel');

    // ...pero lo que se cuenta en el núcleo sigue siendo la versión deformada, por
    // mucho que se le pregunte. Las dos direcciones están cerradas a propósito.
    const sedimentado = JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' }));
    const memoria = JSON.stringify(capa.consultaAlTestigo(LA_TABERNERA));
    for (let k = 0; k < 20; k++) capa.consultaAlTestigo(LA_TABERNERA);
    assert.equal(JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' })), sedimentado, 'consultar a la cara ha corregido lo que se cuenta en el pueblo');

    // Y al revés: el rumor que sigue circulando no toca su memoria, que sigue en 0.
    for (let n = 6; n <= 9; n++) prop.produce(n, null);
    assert.equal(JSON.stringify(capa.consultaAlTestigo(LA_TABERNERA)), memoria, 'lo que circula ha contaminado la memoria de la cara');
    assert.equal(capa.consultaAlTestigo(LA_TABERNERA).hechos[0].nivel, NIVEL_DEL_TESTIGO);

    // La cara y el informante del mismo núcleo cuentan lo mismo de dos maneras: ella
    // la fiel y él la que le llegó. (El precio del informante es de la fila 15; aquí
    // lo que se afirma es que las dos versiones conviven sin pisarse.)
    assert.equal(enVilanova.signo, testigo.hechos[0].signo, 'la fiel y la torcida cuentan distinto tipo de acto');
    assert.notEqual(JSON.stringify(enVilanova.hechos), JSON.stringify(testigo.hechos[0].hechos), 'el informante del núcleo cuenta exactamente lo mismo que el testigo');
  });
});

describe('La relación baja por actos, nunca por el tiempo', () => {
  test('La relación nace cordial, un acto feo la baja un escalón y no toca a nadie más', () => {
    const { capa } = mesaConTestigo();
    assert.deepEqual(ESCALONES, ['rota', 'tirante', 'cordial', 'cercana']);
    assert.equal(ESCALON_DE_PARTIDA, 'cordial');
    assert.deepEqual(capa.relacionCon(LA_TABERNERA), { escalon: ESCALON_DE_PARTIDA, cicatriz: false }, 'una cara recién despertada no nace en el escalón de partida');

    // El acto feo llega **declarado por el desenlace**, no deducido de un texto.
    capa.cierraSalida({ desenlace: desenlaceDe({ hechos: otroHecho('feo'), caras: [LA_TABERNERA], efectos: [{ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.FEO }] }), n: 2 });
    assert.deepEqual(capa.relacionCon(LA_TABERNERA), { escalon: 'tirante', cicatriz: false }, 'el acto feo no ha bajado un escalón');

    // Y no ha tocado a nadie más del mismo sitio, ni a nadie del mapa.
    for (const otra of [LA_COCINA, EL_MERCADO, { sitio: 'Ourela', puesto: 'regencia' }]) {
      assert.deepEqual(capa.relacionCon(otra), { escalon: ESCALON_DE_PARTIDA, cicatriz: false }, `la relación con "${otra.puesto}" de "${otra.sitio}" se ha movido sola`);
    }

    // En el escalón más bajo se queda quieta: otro acto feo no falla ni baja más.
    capa.aplicaActo({ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.FEO });
    assert.deepEqual(capa.relacionCon(LA_TABERNERA), { escalon: 'rota', cicatriz: true });
    assert.deepEqual(capa.aplicaActo({ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.FEO }), { escalon: 'rota', cicatriz: true }, 'romper lo ya roto falla o baja más');

    // El único mecanismo de la entrega que puede bajar es este, y va declarado.
    assert.deepEqual(MECANISMOS_QUE_BAJAN, ['relacion-por-cara']);
  });

  test('Cien pasos del mundo no mueven una relación', () => {
    const { mundo, capa } = mesaConTestigo();
    capa.aplicaActo({ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.FEO });
    const antes = JSON.stringify([LA_TABERNERA, LA_COCINA, EL_MERCADO].map((c) => capa.relacionCon(c)));

    // El mundo avanza de verdad: cien pasos con la propagación de rumores colgada
    // del motor. Lo que no avanza es la relación, porque esta capa no está en la
    // cola de productores — no hay por dónde metérselo.
    const rumores = estadoDeRumores();
    const nucleos = estadoDeNucleos();
    const arbol = arbolDeCalzadas(mundo);
    const prop = creaPropagacionDeRumores({ semilla: SEMILLA_A, mapaId: MAPA, arbol, estado: rumores, nucleos, tramo: 1000 });
    const motor = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: MAPA, estado: estadoDePasos(), productores: [prop] });
    naceSuceso({ estado: rumores, nucleos, mapaId: MAPA, arbol, id: 'r1', origen: 'Ourela', signo: SIGNOS.BUENO, hechos: hechosFieles(semillaDeRumor(), { lugar: 'Ourela' }), semilla: semillaDeRumor(), n: 0 });
    for (let n = 1; n <= 100; n++) motor.paso(n);

    assert.equal(JSON.stringify([LA_TABERNERA, LA_COCINA, EL_MERCADO].map((c) => capa.relacionCon(c))), antes, 'cien pasos del mundo han movido una relación');
  });

  test('Una cara rota sigue casteando: la relación cambia el trato, nunca el catálogo', async () => {
    const mundo = await mundoDe('costero', '1');
    const { capa } = capaSobre(mundo);
    const sitios = sitiosDeMapa(mundo).filter((s) => s.familia === 'servicio');
    assert.ok(sitios.length > 0, 'el mundo del caso no trae servicios');

    const resuelve = () => sitios.map((sitio) => {
      const persona = capa.resuelveRolHumano({
        sitio: { nombre: sitio.id, x: sitio.x, y: sitio.y, real: sitio.anclaje },
        rol: { tipo: 'humano', puesto: plantillaDePuestos(sitio.tipo)[0] },
      });
      return JSON.stringify(persona);
    });
    const antes = resuelve();

    // Se rompe la relación con todas ellas, hasta el fondo de la escalera.
    for (const sitio of sitios) {
      const cara = { sitio: sitio.id, puesto: plantillaDePuestos(sitio.tipo)[0] };
      for (let k = 0; k < 3; k++) capa.aplicaActo({ cara, signo: SIGNOS_DE_ACTO.FEO });
      assert.equal(capa.relacionCon(cara).escalon, 'rota', `la relación con "${sitio.id}" no ha llegado a romperse`);
    }
    assert.deepEqual(resuelve(), antes, 'una cara rota ha dejado de dar la misma resolución: la relación está tocando el catálogo');
  });
});

describe('La reparación', () => {
  test('Reparar sube un escalón, la cicatriz baja el techo para siempre y no sale ningún número', () => {
    const { capa } = mesaConTestigo();
    for (let k = 0; k < 2; k++) capa.aplicaActo({ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.FEO });
    assert.deepEqual(capa.relacionCon(LA_TABERNERA), { escalon: 'rota', cicatriz: true });

    // La primera reparación de una relación rota alcanza «poder sentarse».
    assert.deepEqual(capa.aplicaActo({ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.REPARADOR }), { escalon: 'tirante', cicatriz: true });
    // Y reparando todo lo posible, el techo queda por debajo del escalón más alto.
    for (let k = 0; k < 5; k++) capa.aplicaActo({ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.REPARADOR });
    const reparada = capa.relacionCon(LA_TABERNERA);
    assert.equal(reparada.escalon, TECHO_CON_CICATRIZ);
    assert.equal(TECHO_CON_CICATRIZ, 'cordial');
    assert.notEqual(reparada.escalon, ESCALONES[ESCALONES.length - 1], 'la cicatriz no ha bajado el techo');
    assert.equal(reparada.cicatriz, true, 'la cicatriz se ha borrado al reparar');

    // Lo que se consulta es un escalón y si hay cicatriz. Ni un número, ni un tanto
    // por ciento: el design system prohíbe cualquier medidor.
    assert.deepEqual(Object.keys(reparada).sort(), ['cicatriz', 'escalon']);
    for (const valor of Object.values(reparada)) assert.notEqual(typeof valor, 'number', 'la relación expone un número');

    // Sobre una relación intacta, reparar no sube por encima del techo y no falla.
    assert.deepEqual(capa.aplicaActo({ cara: LA_COCINA, signo: SIGNOS_DE_ACTO.REPARADOR }), { escalon: 'cercana', cicatriz: false });
    assert.deepEqual(capa.aplicaActo({ cara: LA_COCINA, signo: SIGNOS_DE_ACTO.REPARADOR }), { escalon: 'cercana', cicatriz: false }, 'una relación intacta sube por encima de su techo');
  });

  test('En un mapa nuevo todas las relaciones están en el escalón de partida y ninguna cicatriz ha viajado', () => {
    const mundo = mundoDeMesa();
    const relaciones = { mapas: {} };
    const enCasa = capaSobre(mundo, { mapaId: MAPA, relaciones });
    for (let k = 0; k < 3; k++) enCasa.capa.aplicaActo({ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.FEO });
    assert.deepEqual(enCasa.capa.relacionCon(LA_TABERNERA), { escalon: 'rota', cicatriz: true });

    // El mismo estado de partida, otro mapa: ni el escalón ni la cicatriz cruzan.
    const fuera = capaSobre(mundo, { mapaId: OTRO_MAPA, relaciones });
    for (const cara of [LA_TABERNERA, LA_COCINA, EL_MERCADO]) {
      assert.deepEqual(fuera.capa.relacionCon(cara), { escalon: ESCALON_DE_PARTIDA, cicatriz: false }, `la relación con "${cara.puesto}" de "${cara.sitio}" ha viajado al otro mapa`);
    }
    // Y las de casa siguen donde estaban: mirar el otro mapa no las ha tocado.
    assert.deepEqual(enCasa.capa.relacionCon(LA_TABERNERA), { escalon: 'rota', cicatriz: true });
  });
});

describe('La partida se guarda entera y se recupera entera', () => {
  test('Las caras despiertas, las conocidas, las memorias y las relaciones vuelven de su documento', () => {
    const { mundo, capa, estado, memorias, relaciones, hechos } = mesaConTestigo();
    capa.despierta(LA_COCINA);
    capa.conoce(LA_TABERNERA);
    capa.cierraSalida({ desenlace: desenlaceDe({ hechos, caras: [LA_TABERNERA], efectos: [{ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.FEO }] }), n: 4 });

    const documento = JSON.parse(JSON.stringify({
      npcs: congelaNpcs(estado),
      memorias: congelaMemorias(memorias),
      relaciones: congelaRelaciones(relaciones),
    }));

    const vuelta = capaSobre(mundo, {
      estado: levantaNpcs(documento.npcs),
      memorias: levantaMemorias(documento.memorias),
      relaciones: levantaRelaciones(documento.relaciones),
    });
    assert.deepEqual(vuelta.capa.despiertas(), capa.despiertas(), 'no vuelven las mismas caras despiertas');
    assert.deepEqual(vuelta.capa.comoNombrar(LA_TABERNERA), capa.comoNombrar(LA_TABERNERA), 'no vuelve conocida la cara con la que ya se había hablado');
    assert.deepEqual(vuelta.capa.comoNombrar(LA_COCINA).nombre, null, 'vuelve conocida una cara con la que no se había hablado');
    assert.deepEqual(vuelta.capa.consultaAlTestigo(LA_TABERNERA), capa.consultaAlTestigo(LA_TABERNERA), 'no vuelve la misma memoria');
    assert.deepEqual(vuelta.capa.relacionCon(LA_TABERNERA), capa.relacionCon(LA_TABERNERA), 'no vuelve la misma relación');
    assert.deepEqual(vuelta.capa.cara(LA_TABERNERA), capa.cara(LA_TABERNERA), 'la cara levantada no es la misma persona');

    // El documento es estable: congelar dos veces el mismo estado da el mismo texto.
    assert.equal(JSON.stringify(congelaNpcs(levantaNpcs(documento.npcs))), JSON.stringify(documento.npcs));
    assert.equal(JSON.stringify(congelaRelaciones(levantaRelaciones(documento.relaciones))), JSON.stringify(documento.relaciones));
    assert.equal(JSON.stringify(congelaMemorias(levantaMemorias(documento.memorias))), JSON.stringify(documento.memorias));
  });
});

describe('Vacíos, entradas inválidas y errores de la memoria y la relación', () => {
  test('Un hecho sin versión fiel o de quien no participó falla nombrando el hecho y la cara', () => {
    const { capa, memorias, hechos } = mesaConTestigo();

    assert.throws(
      () => capa.cierraSalida({ desenlace: desenlaceDe({ id: 'sin-hechos', hechos: undefined, caras: [LA_TABERNERA] }) }),
      (e) => e.message.includes('sin-hechos'),
      'un hecho sin versión fiel entra en la memoria igualmente',
    );
    assert.throws(
      () => capa.cierraSalida({ desenlace: desenlaceDe({ id: 'con-nivel', hechos, caras: [LA_TABERNERA], signo: 'regular' }) }),
      (e) => e.message.includes('con-nivel'),
      'un hecho con un signo fuera del enumerado entra igualmente',
    );
    assert.throws(() => hechoRecordado({ id: 'r9', hechos, signo: SIGNOS.BUENO, caras: [LA_TABERNERA], nivel: 2 }), (e) => e.message.includes('"r9"'), 'un hecho se puede guardar en un nivel que no es el del testigo');

    // Y guardar en la memoria de quien no participó falla nombrando la cara.
    const hecho = hechoRecordado({ id: 'r2', hechos, signo: SIGNOS.BUENO, caras: [LA_TABERNERA] });
    assert.throws(
      () => recuerda(memorias, { mapaId: MAPA, cara: LA_COCINA, hecho, n: 1 }),
      (e) => e.message.includes('"cocina"') && e.message.includes('"Casa Manuela"'),
      'un hecho entra en la memoria de quien no lo vivió',
    );
    assert.deepEqual(loQueRecuerda(memorias, { mapaId: MAPA, cara: LA_COCINA }), []);
  });

  test('Un efecto sin signo, con un signo de fuera o sobre una cara de otro mapa falla nombrando qué le pasa', async () => {
    const { capa } = mesaConTestigo();
    for (const signo of [undefined, null, '', 'neutro', 0]) {
      assert.throws(
        () => capa.aplicaActo({ cara: LA_TABERNERA, signo }),
        (e) => e.message.includes(JSON.stringify(signo) ?? String(signo)),
        `el signo ${JSON.stringify(signo)} se ha aplicado sin protestar`,
      );
    }
    assert.deepEqual(capa.relacionCon(LA_TABERNERA), { escalon: ESCALON_DE_PARTIDA, cicatriz: false }, 'un efecto inválido ha movido la relación');

    // Una cara de otro mapa se rechaza nombrando el mapa, en lugar de crearse aquí.
    const otro = await mundoDe('costero', '1');
    const ajena = { sitio: sitiosDeMapa(otro)[0].id, puesto: 'regencia' };
    assert.throws(
      () => capa.aplicaActo({ cara: ajena, signo: SIGNOS_DE_ACTO.FEO }),
      (e) => e.message.includes(MAPA) && e.message.includes(ajena.sitio),
      'un efecto sobre una cara de otro mapa crea la relación igualmente',
    );
  });

  test('El cierre de una salida se aplica entero o no se aplica', () => {
    const { capa, memorias, relaciones, hechos } = mesaConTestigo();
    capa.cierraSalida({ desenlace: desenlaceDe({ id: 'antes', hechos, caras: [LA_TABERNERA] }), n: 1 });
    const memoriaAntes = JSON.stringify(congelaMemorias(memorias));
    const relacionAntes = JSON.stringify(congelaRelaciones(relaciones));

    // Un desenlace que guarda bien la memoria y falla en el efecto de relación: si
    // se aplicara a medias, la memoria quedaría escrita y la relación no.
    assert.throws(() => capa.cierraSalida({
      desenlace: desenlaceDe({
        id: 'a-medias',
        hechos: otroHecho('a-medias'),
        caras: [LA_TABERNERA, LA_COCINA],
        efectos: [{ cara: LA_TABERNERA, signo: SIGNOS_DE_ACTO.FEO }, { cara: LA_COCINA, signo: 'a-traición' }],
      }),
      n: 2,
    }), (e) => e.message.includes('a-traición'));

    assert.equal(JSON.stringify(congelaMemorias(memorias)), memoriaAntes, 'el cierre ha escrito una memoria antes de fallar');
    assert.equal(JSON.stringify(congelaRelaciones(relaciones)), relacionAntes, 'el cierre ha escrito una relación antes de fallar');
    assert.equal(capa.consultaAlTestigo(LA_COCINA).hechos.length, 0, 'la memoria de la segunda cara se escribió antes de fallar');
    assert.deepEqual(capa.relacionCon(LA_TABERNERA), { escalon: ESCALON_DE_PARTIDA, cicatriz: false });
  });
});
