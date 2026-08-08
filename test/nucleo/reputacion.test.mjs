// SPEC-012 · La reputación es lo que llegó, no lo que se hizo: qué se cuenta de la
// jugadora en cada núcleo, con su nivel y su signo, y qué de eso sale hacia fuera.
//
// Dos ausencias se afirman aquí, y las dos son la pieza y no un descuido. **No existe
// ninguna consulta que devuelva el estado de todos los núcleos del mapa a la vez**:
// la exclusión 4 del PRD retira el panel del estado del mundo y el medidor de
// reputación, y lo que no sale del núcleo no se puede pintar por descuido. Y **lo que
// se le entrega a la capa que pinta no lleva el nivel de deformación**, que es lo que
// hace barato sostener «El nivel de deformación no sale nunca a pantalla».
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás
// van declarados como huecos de la batería en test/spec-test-map.json.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { SIGNOS } from '../../packages/nucleo/partida/deformacion.js';
import * as moduloDeNucleos from '../../packages/nucleo/partida/nucleos.js';
import {
  congelaNucleos,
  estadoDeNucleos,
  levantaNucleos,
  loQueSeCuentaEn,
  paraLaCapaQuePinta,
  sedimenta,
  versionQueLlego,
} from '../../packages/nucleo/partida/nucleos.js';
import { estadoDeRumores } from '../../packages/nucleo/partida/rumores.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { fuente } from './mundo-de-prueba.mjs';
import {
  CELDA_COSIDA,
  MAPA,
  avanza,
  desenlaceEn,
  mundoDe,
  mundoLineal,
  mundoReal,
  propagacionSobre,
} from './rumor-de-prueba.mjs';

/** La cadena de referencia, la misma de rumores.test.mjs. */
const CADENA = ['Monfrida', 'Vilanova', 'Cadaval', 'Peiteiro', 'Ourille', 'Sanxil'];

/** Una partida con el rumor ya repartido por la cadena, que es el punto de partida de casi todo. */
function partidaConRumor({ tramo = 2000, pasos = 10, mundo = mundoLineal(CADENA) } = {}) {
  const p = propagacionSobre(mundo, { tramo });
  p.prop.nace(desenlaceEn('Monfrida'), 0);
  avanza(p.prop, pasos);
  return p;
}

describe('La reputación es lo que llegó', () => {
  test('Se pregunta núcleo a núcleo y cada uno devuelve su propia versión', () => {
    const { nucleos } = partidaConRumor();
    const [cerca] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' });
    const [lejos] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Peiteiro' });

    assert.equal(cerca.nivel, 1);
    assert.equal(lejos.nivel, 3);
    assert.equal(cerca.signo, SIGNOS.BUENO);
    assert.equal(lejos.signo, SIGNOS.BUENO, 'el signo es el del origen en los dos');
    assert.notEqual(JSON.stringify(cerca.hechos), JSON.stringify(lejos.hechos), 'cada núcleo devuelve lo suyo y no lo del otro');
  });

  test('Se puede ser alguien en un pueblo donde no has estado', () => {
    // La jugadora no ha pisado «Vilanova»: la noticia llegó sola por el árbol de
    // calzadas, y cuando llegue allí por primera vez ya sabrán quién es.
    const { nucleos } = partidaConRumor({ pasos: 1 });
    const enElVecino = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' });
    assert.equal(enElVecino.length, 1, 'en el vecino tienen que saber ya quién es');
    assert.equal(enElVecino[0].origen, 'Monfrida', 'y saber que el suceso fue en otro sitio');
  });

  test('El rango sube por lo que llega, no por lo que se pisa', () => {
    // La mitad `@nucleo`: pasar por «Vilanova» cada día sin hacer nada allí no mueve
    // nada, porque no hay ningún rumor que le llegue. El rango que sale de este dato
    // es de la fila 15; aquí se afirma que el dato sigue vacío.
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    avanza(prop, 20);
    assert.deepEqual(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' }), [], 'andar por un sitio no cuenta nada de ti allí');
  });

  test('Un núcleo que no ha oído nada devuelve que no hay nada que contar, y no un error', () => {
    const { nucleos } = partidaConRumor();
    assert.deepEqual(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Sanxil' }), []);
    // Y uno que ni siquiera está en el mapa tampoco es un error: no hay nada que contar.
    assert.deepEqual(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Aldea Inventada' }), []);
    // Lo que sí falla es preguntar sin decir por quién se pregunta.
    for (const malo of ['', null, undefined, 7]) {
      assert.throws(
        () => loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: malo }),
        (e) => e instanceof Error && e.message.includes(JSON.stringify(malo) ?? String(malo)),
      );
    }
  });

  test('No existe ninguna consulta que devuelva el estado de todos los núcleos del mapa', () => {
    // Exclusión 4 del PRD —«Panel del estado del mundo y marcador de reputación»— y
    // el design system, «ningún medidor de reputación». Se evita mejor no exportando
    // el dato que confiando en que nadie lo pinte, que es el mismo argumento con el
    // que SPEC-011 no expone el contador de pasos.
    assert.deepEqual(Object.keys(moduloDeNucleos).sort(), [
      'congelaNucleos',
      'estadoDeNucleos',
      'haOido',
      'levantaNucleos',
      'loQueSeCuentaEn',
      'nucleosDeMapa',
      'paraLaCapaQuePinta',
      'sedimenta',
      'versionQueLlego',
    ]);
    // Las tres que reciben un mapa y no un núcleo son de estado y de serialización, no
    // consultas de presentación: `nucleosDeMapa` devuelve el registro vivo que la
    // propagación escribe, y `congelaNucleos` / `levantaNucleos` son el ida y vuelta
    // de la partida guardada. Ninguna otra puede responder «cómo va el mapa».
    for (const nombre of ['loQueSeCuentaEn', 'haOido']) {
      const { nucleos } = partidaConRumor();
      assert.throws(() => moduloDeNucleos[nombre](nucleos, { mapaId: MAPA }), /identificador del núcleo/, `${nombre} responde sin decirle de qué núcleo`);
    }
  });

  test('El nivel de deformación no sale nunca a pantalla', () => {
    // La mitad `@nucleo`: el dato que se le entrega a la capa que pinta no lleva ni el
    // nivel ni los ejes que lo delatarían. La pantalla no puede enseñar lo que no
    // recibe, y por eso el escenario `@app` es barato de sostener.
    const { nucleos } = partidaConRumor();
    for (const nucleo of ['Monfrida', 'Vilanova', 'Cadaval', 'Peiteiro']) {
      const versiones = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo });
      const paraPintar = paraLaCapaQuePinta(versiones);
      for (const v of paraPintar) {
        assert.deepEqual(Object.keys(v).sort(), ['hechos', 'origen', 'plantilla', 'rumor', 'signo', 'texto']);
        assert.ok(!('nivel' in v), 'el nivel de deformación ha llegado hasta la capa que pinta');
        assert.ok(!('ejes' in v), 'los ejes delatan el nivel igual que el nivel');
        assert.ok(!('escalon' in v), 'el nombre del peldaño es el nivel con otro nombre');
      }
      assert.ok(!/"nivel"|"ejes"|"escalon"|fiel|abultado|trastocado|leyenda/.test(JSON.stringify(paraPintar.map((v) => ({ ...v, hechos: undefined })))));
    }
  });

  test('Lo que llega a dos núcleos con distinto nivel permite un mote distinto en cada sitio', () => {
    // «El mote nace del rumor y es por núcleo»: aquí se deja preparado el dato, y el
    // mote lo cierra la fila 15.
    const { nucleos } = partidaConRumor();
    const niveles = ['Vilanova', 'Cadaval', 'Peiteiro'].map((n) => loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n })[0].nivel);
    assert.deepEqual(niveles, [1, 2, 3], 'tres núcleos con tres versiones distintas de lo mismo');
    assert.equal(new Set(niveles).size, 3);
  });

  test('Lo que compras es la versión que ese informante oyó', () => {
    // Solo puede ser cierto si lo que se guarda por núcleo es la versión de ese
    // núcleo y no la fiel. Quien vive en «Cadaval» tiene la de nivel 2, no la de 0.
    const { nucleos, prop } = partidaConRumor();
    const [informante] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Cadaval' });
    const fiel = prop.versionFiel('r1');
    assert.equal(informante.nivel, 2);
    assert.notEqual(JSON.stringify(informante.hechos), JSON.stringify(fiel.hechos), 'el informante no puede estar guardando la versión fiel');
  });

  test('Se guarda la versión deformada', () => {
    // La mitad `@nucleo` del escenario del diario: lo que sedimenta en un núcleo es la
    // versión deformada —con su escala abultada— y no la fiel, que es de lo que el
    // diario copiará su entrada. El lugar y el momento viajan con ella.
    const { nucleos, prop } = partidaConRumor();
    const [enVilanova] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilanova' });
    const fiel = prop.versionFiel('r1');
    assert.equal(enVilanova.nivel, 1);
    assert.equal(enVilanova.hechos.escala.veces, fiel.hechos.escala.veces * 3, 'lo que se guarda es la versión abultada');
    assert.equal(enVilanova.origen, 'Monfrida', 'con el lugar donde ocurrió');
    assert.equal(typeof enVilanova.oidoEn, 'number', 'y con el paso en que se oyó');
  });

  test('El testigo directo es fiel y no corrige al pueblo', () => {
    // La mitad `@nucleo`: la versión fiel se conserva **además** de la sedimentada, y
    // sedimentar la deformada en el mismo núcleo no la borra. Quién la cuenta es de
    // la fila 14; aquí se garantiza que existe con qué contarla.
    const { nucleos, prop } = partidaConRumor();
    const fiel = prop.versionFiel('r1');
    const [enCadaval] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Cadaval' });
    assert.equal(fiel.nivel, 0);
    assert.equal(enCadaval.nivel, 2);
    assert.notEqual(JSON.stringify(fiel.hechos), JSON.stringify(enCadaval.hechos));
    assert.equal(fiel.signo, enCadaval.signo, 'la fiel y la torcida cuentan el mismo tipo de acto');
  });

  test('Una entrada no se sobrescribe con otra más veraz', () => {
    // La mitad `@nucleo`: sedimentar el mismo rumor otra vez no reescribe lo que ese
    // núcleo oyó, ni siquiera con una versión de nivel más bajo.
    const { nucleos } = partidaConRumor();
    const antes = JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Peiteiro' }));
    sedimenta(nucleos, {
      mapaId: MAPA,
      nucleo: 'Peiteiro',
      loQueLlego: versionQueLlego({ rumor: 'r1', origen: 'Monfrida', nivel: 0, signo: SIGNOS.BUENO, hechos: { asunto: 'la verdad' } }),
    });
    assert.equal(JSON.stringify(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Peiteiro' })), antes, 'una versión más veraz no puede pisar la que ya se oyó');
    assert.equal(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Peiteiro' }).length, 1);
  });

  test('Una versión sin identidad de rumor, sin nivel o con un signo inválido no se puede guardar', () => {
    const bien = { rumor: 'r1', origen: 'Monfrida', nivel: 1, signo: SIGNOS.BUENO, hechos: { asunto: 'x' } };
    assert.throws(() => versionQueLlego({ ...bien, rumor: '' }), /sin identidad de rumor/);
    assert.throws(() => versionQueLlego({ ...bien, nivel: 9 }), /"r1"/);
    assert.throws(() => versionQueLlego({ ...bien, signo: 'neutro' }), /"neutro"/);
    // El texto sí puede faltar: viaja aparte y el dato sigue completo sin él.
    const sinTexto = versionQueLlego(bien);
    assert.equal(sinTexto.texto, null);
    assert.equal(sinTexto.nivel, 1);
    assert.equal(sinTexto.plantilla, null, 'de qué plantilla salió es lo que permite caer a su texto de fallback');
  });
});

describe('Los rumores no viajan entre mapas', () => {
  test('El rango no viaja entre mapas', () => {
    // La mitad `@nucleo`: la propagación es sobre el árbol de **un** mapa, y dos
    // mapas no comparten árbol. Los dos estados son los mismos objetos de partida.
    const estado = estadoDeRumores();
    const nucleos = estadoDeNucleos();
    const casa = propagacionSobre(mundoLineal(CADENA), { tramo: 2000, mapaId: 'casa', estado, nucleos });
    const lejos = propagacionSobre(mundoLineal(['Ribeira', 'Cambados', 'Vilanova']), { tramo: 2000, mapaId: 'lejos', estado, nucleos });

    casa.prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(casa.prop, 10);
    avanza(lejos.prop, 10);

    assert.ok(loQueSeCuentaEn(nucleos, { mapaId: 'casa', nucleo: 'Vilanova' }).length > 0);
    for (const n of ['Ribeira', 'Cambados', 'Vilanova']) {
      assert.deepEqual(loQueSeCuentaEn(nucleos, { mapaId: 'lejos', nucleo: n }), [], `en el mapa de lejos no se puede saber nada, y "${n}" hasta comparte nombre`);
    }
    assert.deepEqual(lejos.prop.activos(), [], 'el rumor de casa no puede estar viajando por el mapa nuevo');
  });

  test('En un mapa nuevo levantado en otro sitio no se cuenta nada de la jugadora', () => {
    const { nucleos } = partidaConRumor();
    for (const n of ['Ribeira', 'Cambados', 'Monfrida']) {
      assert.deepEqual(loQueSeCuentaEn(nucleos, { mapaId: 'mapa-nuevo', nucleo: n }), []);
    }
  });
});

describe('Dónde vive lo que se cuenta', () => {
  test('Lo que se cuenta viaja con la partida y nunca dentro del documento de una celda', async () => {
    const { registro, arbol } = await mundoReal(CELDA_COSIDA);
    const antes = textoDeCelda(registro);
    const { prop, nucleos } = propagacionSobre(null, { arbol, tramo: 2000 });
    prop.nace(desenlaceEn('Covatoño da Brétema'), 0);
    avanza(prop, 30);

    assert.equal(textoDeCelda(registro), antes, 'lo que hizo la jugadora ha repintado el mapa del mundo');
    const documentoDeLaPartida = JSON.stringify(congelaNucleos(nucleos));
    assert.ok(documentoDeLaPartida.includes('"nivel"'), 'lo sedimentado tiene que estar en el documento de la partida');
    assert.ok(!antes.includes('"oidoEn"'), 'el documento del mundo trae versiones oídas');
  });

  test('Lo sedimentado vuelve de la partida con su nivel y su signo intactos', () => {
    const { nucleos } = partidaConRumor();
    const doc = JSON.parse(JSON.stringify(congelaNucleos(nucleos)));
    const vuelto = levantaNucleos(doc);
    assert.equal(JSON.stringify(congelaNucleos(vuelto)), JSON.stringify(congelaNucleos(nucleos)));
    for (const n of ['Vilanova', 'Cadaval', 'Peiteiro']) {
      const [a] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n });
      const [b] = loQueSeCuentaEn(vuelto, { mapaId: MAPA, nucleo: n });
      assert.equal(b.nivel, a.nivel);
      assert.equal(b.signo, a.signo);
    }
  });

  test('Lo que se cuenta en un núcleo se devuelve congelado y no se puede reescribir por fuera', () => {
    const { nucleos } = partidaConRumor();
    const versiones = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Cadaval' });
    assert.ok(Object.isFrozen(versiones));
    assert.ok(Object.isFrozen(versiones[0]));
    assert.throws(() => { 'use strict'; versiones[0].nivel = 0; }, TypeError);
    assert.equal(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Cadaval' })[0].nivel, 2);
  });

  test('El módulo dice en voz alta que no exporta ninguna consulta por mapa', () => {
    // La decisión está escrita en el propio módulo, y esta prueba existe para que
    // borrarla no salga gratis: la ausencia es la pieza.
    const texto = fuente('packages/nucleo/partida/nucleos.js');
    assert.ok(/núcleo a núcleo y nunca por mapa/.test(texto));
    assert.ok(/no hay ninguna función que devuelva el estado de todos los núcleos/.test(texto));
  });

  test('Un mundo de un solo núcleo también responde a la consulta, con lo suyo', () => {
    const { prop, nucleos } = propagacionSobre(mundoDe([], { sueltos: ['Monfrida'] }), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 5);
    const [v] = loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Monfrida' });
    assert.equal(v.nivel, 0);
    assert.equal(v.origen, 'Monfrida');
  });
});
