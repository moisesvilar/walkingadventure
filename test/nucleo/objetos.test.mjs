// SPEC-015 · Los objetos: **llaves que abren otra puerta al mismo beat, nunca un
// requisito**, y recuerdos que solo están y cuentan de dónde vinieron.
//
// Lo que aquí se mide con números, porque es la afirmación que sostiene la regla
// entera: el catálogo del prototipo tiene **26 beats**, de los cuales **2 disparan
// `con_objeto`** y **ninguno queda cerrado** por no llevar la llave. La lista de
// beats sin salida es vacía por construcción —`validaPlantilla` ya no ofrece una
// plantilla así—, y se mide sobre el catálogo entero en lugar de confiar en que
// nadie escriba el primero.
//
// Y la otra mitad de la regla, que es la que hace testeable el casting: **con
// objetos y sin ninguno salen los mismos beats, en el mismo orden y con el mismo
// lazo**. Lo único que cambia es por qué vía se atraviesa uno.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás
// van declarados como huecos de la batería en test/spec-test-map.json.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as moduloDeObjetos from '../../packages/nucleo/partida/objetos.js';
import {
  CLASES_DE_OBJETO,
  CLASE_QUE_ABRE,
  SIN_OBJETOS,
  VIAS_DEL_BEAT,
  beatsSinSalida,
  congelaObjetos,
  estadoDeObjetos,
  exigeClaseDeObjeto,
  guarda,
  levantaObjetos,
  objetoPersistente,
  objetosDe,
  resuelveBifurcacion,
  tieneObjeto,
  vistaDeTenencia,
} from '../../packages/nucleo/partida/objetos.js';
import { cierraSalidaDeProgresion, congelaOro, estadoDeOro, levantaOro, saldoDe } from '../../packages/nucleo/partida/oro.js';
import { estadoDeMotes } from '../../packages/nucleo/partida/motes.js';
import { castAll, castTemplate } from '../../packages/nucleo/quests/casting.js';
import { TEMPLATES } from '../../packages/nucleo/quests/templates.js';
import { fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import { MAPA, OTRO_MAPA, codigoDe } from './progresion-de-prueba.mjs';

/** Los 26 beats del catálogo del prototipo, con la plantilla de la que salen. */
const TODOS_LOS_BEATS = TEMPLATES.flatMap((t) => t.beats.map((b, i) => ({ plantilla: t.id, n: i + 1, beat: b })));

/** Los que disparan con objeto, que son los dos que encienden el mecanismo. */
const BEATS_CON_OBJETO = TODOS_LOS_BEATS.filter(({ beat }) => beat.disparador.tipo === 'con_objeto');

/** Un beat `con_objeto` ya casteado, tal y como lo recibe quien lo resuelve. */
function beatDeLlave({ tenencia = SIN_OBJETOS, objeto = 'paquete', siguienteBeat = 4 } = {}) {
  return {
    n: 3,
    rol: 'contacto',
    disparador: {
      tipo: 'con_objeto',
      objeto,
      viaAlternativa: { texto: 'Le cuentas de quién vienes y te deja pasar igual.' },
      via: tenencia.tiene(objeto) ? 'objeto' : 'alternativa',
    },
    escena: { texto: 'Enseñas el paquete y se aparta.' },
    resultado: { tipo: 'informacion', siguienteBeat },
  };
}

// El día de un objeto es **el del calendario de la partida**: un entero no negativo,
// el mismo que cuenta el diario. Nunca una fecha del reloj real, que es lo que aquí
// se escribía cuando `objetoPersistente` y `entradaDeDiario` tenían dos contratos
// distintos del mismo dato.

/** Una repisa con los objetos que se le pidan, todos del mismo día. */
function repisaCon(objetos, dia = 8) {
  const estado = estadoDeObjetos();
  for (const o of objetos) guarda(estado, { dia, ...o });
  return estado;
}

describe('Los objetos son llaves, no requisitos', () => {
  test('Sin el objeto hay otro camino al mismo beat', () => {
    const conLlave = vistaDeTenencia(repisaCon([{ id: 'paquete', clase: 'llave' }]));
    const sinNada = SIN_OBJETOS;

    const llevando = resuelveBifurcacion({ beat: beatDeLlave({ tenencia: conLlave }), tenencia: conLlave });
    const sinLlevar = resuelveBifurcacion({ beat: beatDeLlave(), tenencia: sinNada });

    // A quien lo lleva se le ofrece la vía del objeto...
    assert.equal(llevando.conObjeto, true);
    assert.equal(llevando.via, 'objeto');
    // ...y a quien no, existe otra manera de resolver el beat.
    assert.equal(sinLlevar.via, 'alternativa');
    assert.ok(sinLlevar.texto, 'la vía alternativa no cuenta nada y el beat queda mudo');
    assert.deepEqual(VIAS_DEL_BEAT, ['objeto', 'alternativa']);

    // Y las dos resuelven el beat y empujan al mismo siguiente: es otra puerta al
    // mismo sitio y no una rama.
    assert.equal(llevando.siguienteBeat, sinLlevar.siguienteBeat);
    assert.equal(llevando.siguienteBeat, 4);
    assert.equal(llevando.objeto, sinLlevar.objeto);
    assert.notEqual(llevando.texto, sinLlevar.texto, 'las dos vías cuentan lo mismo y entonces el objeto no aporta nada');
  });

  test('Con objetos y sin ninguno salen los mismos beats, en el mismo orden y con el mismo lazo', async () => {
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    const todo = vistaDeTenencia(repisaCon(BEATS_CON_OBJETO.map(({ beat }) => ({ id: beat.disparador.objeto, clase: 'llave' }))));

    const sin = castAll(mundo);
    const con = castAll(mundo, mundo.seed, { tenencia: todo });
    assert.equal(sin.length, con.length);

    const esqueleto = (r) => JSON.stringify(r.map((c) => ({
      plantilla: c.plantilla,
      ok: c.ok,
      beats: (c.beats ?? []).map((b) => ({ n: b.n, rol: b.rol, lugar: b.lugar?.nombre ?? null, siguiente: b.resultado.siguienteBeat })),
      presupuesto: c.presupuesto ?? null,
      motivo: c.motivo ?? null,
    })));
    assert.equal(esqueleto(con), esqueleto(sin), 'llevar objetos ha cambiado el reparto, el orden o el lazo');

    // Lo único que cambia es por dónde se pasa.
    const vias = (r) => r.filter((c) => c.ok).flatMap((c) => c.beats.filter((b) => b.disparador.tipo === 'con_objeto').map((b) => b.disparador.via));
    assert.equal(vias(sin).length, BEATS_CON_OBJETO.length, 'en este mundo no castea ningún beat con objeto y el caso no compara nada');
    assert.deepEqual(vias(sin), vias(sin).map(() => 'alternativa'));
    assert.deepEqual(vias(con), vias(con).map(() => 'objeto'));
  });

  test('Ninguna aventura pide un objeto para ser ofrecida', async () => {
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    const sinNada = castAll(mundo, mundo.seed, { tenencia: SIN_OBJETOS });
    const ofrecidas = sinNada.filter((c) => c.ok).map((c) => c.plantilla);
    assert.ok(ofrecidas.length > 0, 'en este mundo no castea ninguna y el caso no afirma nada');

    // Ninguna de las que traen un beat `con_objeto` se queda fuera por eso: el motivo
    // de fallo, si lo hay, nunca habla de un objeto.
    for (const casteo of sinNada) {
      if (casteo.ok) continue;
      assert.equal(JSON.stringify(casteo.motivo).includes('objeto'), false, `"${casteo.plantilla}" no se ofrece por un objeto`);
    }
    const conObjeto = new Set(BEATS_CON_OBJETO.map((b) => b.plantilla));
    const casteadas = new Set(ofrecidas);
    assert.ok([...conObjeto].some((p) => casteadas.has(p)), 'ninguna plantilla con beat de objeto castea y el caso no afirma nada');
  });

  test('Ningún beat del catálogo se puede resolver solo llevando un objeto', () => {
    // Las dos cifras, remedidas sobre el catálogo de treinta plantillas de SPEC-017
    // (§6s) y remedidas otra vez tras el reequilibrio que pide `personaje.md` §3:
    // 147 beats escritos, de los cuales 3 disparan con objeto. Van clavadas y no como
    // umbral porque son el denominador de la afirmación siguiente —**ninguno** de los
    // beats del catálogo queda cerrado detrás de una llave—, y una lista vacía sobre
    // un catálogo que se ha encogido sin que nadie lo mire no afirma nada.
    assert.equal(TODOS_LOS_BEATS.length, 147, 'el catálogo ha cambiado de tamaño y las cifras de este caso hay que volver a medirlas');
    assert.equal(BEATS_CON_OBJETO.length, 3, 'el catálogo ya no tiene tres beats con objeto');

    // Ninguno queda cerrado: los tres declaran su vía alternativa.
    assert.deepEqual(TEMPLATES.flatMap((t) => beatsSinSalida(t.beats)), []);
    for (const { plantilla, beat } of BEATS_CON_OBJETO) {
      assert.ok(beat.disparador.viaAlternativa, `el beat con objeto de "${plantilla}" no declara otra manera de resolverse`);
      assert.equal(typeof beat.disparador.viaAlternativa, 'object');
    }
    // Y uno que no la declarara sí saldría en la lista, que es lo que hace que la
    // lista vacía signifique algo.
    const cerrado = { n: 3, rol: 'contacto', disparador: { tipo: 'con_objeto', objeto: 'paquete' } };
    assert.deepEqual(beatsSinSalida([cerrado]), [{ n: 3, rol: 'contacto', objeto: 'paquete' }]);
  });

  test('La llave no se gasta al usarse', () => {
    const repisa = repisaCon([{ id: 'paquete', clase: 'llave' }]);
    const tenencia = vistaDeTenencia(repisa);
    for (let k = 0; k < 20; k++) {
      const paso = resuelveBifurcacion({ beat: beatDeLlave({ tenencia }), tenencia });
      assert.equal(paso.via, 'objeto', `la llave ha dejado de abrir en el uso ${k + 1}`);
    }
    assert.equal(tieneObjeto(repisa, 'paquete'), true, 'la llave se ha gastado al usarse');
    assert.equal(objetosDe(repisa).length, 1);

    // Y no existe la operación que la quitaría: no es una regla que haya que vigilar.
    for (const nombre of Object.keys(moduloDeObjetos)) {
      assert.equal(/tira|gasta|consume|quita|suelta|borra|vende/i.test(nombre), false, `"${nombre}" permite deshacerse de un objeto`);
    }
  });

  test('La repisa no es un inventario', () => {
    const repisa = repisaCon([
      { id: 'hebilla-de-laton', clase: 'recuerdo', procedencia: { desenlace: 'd1', lugar: 'A Furna' } },
      { id: 'paquete', clase: 'llave', procedencia: { desenlace: 'd2', lugar: 'Monfrida' } },
    ], 1);

    // Ni peso, ni huecos, ni manera de tirar nada.
    for (const objeto of objetosDe(repisa)) {
      assert.deepEqual(Object.keys(objeto).sort(), ['clase', 'dia', 'id', 'procedencia']);
      for (const delator of ['peso', 'huecos', 'capacidad', 'tope', 'cantidad', 'apilado']) {
        assert.equal(Object.prototype.hasOwnProperty.call(objeto, delator), false, `un objeto declara "${delator}"`);
      }
      // Y cada objeto dice de quién viene y de qué día.
      assert.ok(objeto.procedencia, `el objeto "${objeto.id}" no dice de dónde vino`);
      assert.equal(objeto.dia, 1);
      assert.ok(CLASES_DE_OBJETO.includes(objeto.clase));
    }
    assert.deepEqual(CLASES_DE_OBJETO, ['llave', 'recuerdo']);
    assert.deepEqual(Object.keys(repisa), ['objetos'], 'la repisa guarda algo más que la lista');
    const codigo = codigoDe(fuente('packages/nucleo/partida/objetos.js'));
    for (const delator of ['peso', 'huecos', 'capacidad']) {
      assert.equal(codigo.includes(delator), false, `objetos.js implementa "${delator}"`);
    }
  });

  test('Un objeto de clase recuerdo no abre ningún beat', () => {
    assert.equal(CLASE_QUE_ABRE, 'llave');
    const soloRecuerdos = vistaDeTenencia(repisaCon([{ id: 'hebilla-de-laton', clase: 'recuerdo' }]));
    // El recuerdo que se tiene no es la llave que pide el beat, así que se resuelve
    // por la vía alternativa como quien no lleva nada.
    const paso = resuelveBifurcacion({ beat: beatDeLlave({ objeto: 'paquete' }), tenencia: soloRecuerdos });
    assert.equal(paso.via, 'alternativa');

    // Y ningún beat del catálogo pide un objeto de clase recuerdo: la clase la
    // declara quien lo entrega, y solo la llave abre.
    for (const { beat } of BEATS_CON_OBJETO) {
      assert.notEqual(beat.disparador.objeto, 'hebilla-de-laton');
    }
  });

  test('Un objeto que ya se tiene no se apila al volver a entregarlo', () => {
    const estado = { oro: estadoDeOro(), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    const desenlace = { id: 'd1', objetos: [{ id: 'paquete', clase: 'llave' }] };
    cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace, dia: 1 });
    cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { ...desenlace, id: 'd2' }, dia: 60 });

    const repisa = objetosDe(estado.objetos);
    assert.equal(repisa.length, 1, 'el objeto se ha apilado');
    assert.equal(repisa[0].dia, 1, 'la procedencia es la de la primera vez, que es de cuando viene');
    assert.equal(tieneObjeto(estado.objetos, 'paquete'), true);
  });

  test('Un objeto sin clase declarada falla nombrando el objeto', () => {
    assert.throws(() => objetoPersistente({ id: 'llave-del-molino', dia: 8 }), /"llave-del-molino"/);
    assert.throws(() => objetoPersistente({ id: 'llave-del-molino', clase: 'reliquia', dia: 8 }), /"llave-del-molino"/);
    assert.throws(() => guarda(estadoDeObjetos(), { id: 'llave-del-molino', dia: 8 }), /"llave-del-molino"/);
    // Y no se supone que sea un recuerdo, que es lo que dejaría muda una llave.
    assert.throws(() => exigeClaseDeObjeto(undefined), /llave y recuerdo/);
  });

  test('Los objetos viajan con la jugadora al levantar otro mapa', () => {
    const estado = { oro: estadoDeOro(), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { id: 'd1', objetos: [{ id: 'paquete', clase: 'llave' }] }, dia: 1 });

    // Se levanta otro mapa: la repisa no sabe de mapas, así que sigue entera.
    cierraSalidaDeProgresion({ ...estado, mapaId: OTRO_MAPA, desenlace: { id: 'd2', objetos: [{ id: 'hebilla-de-laton', clase: 'recuerdo' }] }, dia: 2 });
    assert.deepEqual(objetosDe(estado.objetos).map((o) => o.id), ['paquete', 'hebilla-de-laton']);
    assert.equal(tieneObjeto(estado.objetos, 'paquete'), true, 'levantar otro mapa ha confiscado un objeto');
    assert.equal(codigoDe(fuente('packages/nucleo/partida/objetos.js')).includes('mapaId'), false, 'la repisa se guarda por mapa');
  });

  test('Un beat con_objeto sin vía alternativa falla nombrando el beat', () => {
    const cerrado = { n: 5, rol: 'contacto', disparador: { tipo: 'con_objeto', objeto: 'paquete' }, resultado: { siguienteBeat: 6 } };
    assert.throws(() => resuelveBifurcacion({ beat: cerrado }), /el beat 5/);
    assert.throws(() => resuelveBifurcacion({ beat: cerrado }), /"paquete"/);
    assert.throws(() => resuelveBifurcacion({ beat: cerrado }), /llave y no un requisito/);
    // Y falla igual llevando el objeto: no es que exija la llave, es que el beat está
    // mal escrito.
    const conLlave = vistaDeTenencia(repisaCon([{ id: 'paquete', clase: 'llave' }]));
    assert.throws(() => resuelveBifurcacion({ beat: cerrado, tenencia: conLlave }), /el beat 5/);
  });

  test('Una partida sin ningún objeto devuelve la repisa vacía y no falla', () => {
    const estado = estadoDeObjetos();
    assert.deepEqual(objetosDe(estado), []);
    assert.equal(tieneObjeto(estado, 'paquete'), false);
    assert.equal(vistaDeTenencia(estado).tiene('paquete'), false);
    assert.equal(SIN_OBJETOS.tiene('paquete'), false);
    assert.deepEqual(congelaObjetos(estado), { objetos: [] });
  });
});

describe('La procedencia de un objeto y su vuelta del documento', () => {
  test('El día de un objeto llega como argumento de quien cierra la salida', () => {
    // Sin día no se puede guardar, y el día no se lee dentro del núcleo.
    assert.throws(() => objetoPersistente({ id: 'paquete', clase: 'llave' }), /de qué día/);
    const estado = { oro: estadoDeOro(), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { id: 'd1', objetos: [{ id: 'paquete', clase: 'llave' }] }, dia: 8 });
    assert.equal(objetosDe(estado.objetos)[0].dia, 8);
    // Y el día es un entero del calendario de la partida, no una fecha del reloj.
    assert.equal(Number.isInteger(objetosDe(estado.objetos)[0].dia), true);
    assert.throws(() => objetoPersistente({ id: 'paquete', clase: 'llave', dia: '2026-08-08' }), /entero no negativo/);

    for (const ruta of ['packages/nucleo/partida/objetos.js', 'packages/nucleo/partida/oro.js']) {
      const codigo = codigoDe(fuente(ruta));
      for (const prohibido of ['Date.now', 'new Date', 'toISOString']) {
        assert.equal(codigo.includes(prohibido), false, `${ruta} lee el reloj para poner el día de un objeto`);
      }
    }
  });

  test('La bolsa y los objetos vuelven de su documento con la misma procedencia', () => {
    const estado = { oro: estadoDeOro(), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    cierraSalidaDeProgresion({
      ...estado,
      mapaId: MAPA,
      desenlace: {
        id: 'd1',
        oro: 17,
        lugar: { id: 'A Furna' },
        objetos: [{ id: 'hebilla-de-laton', clase: 'recuerdo' }, { id: 'paquete', clase: 'llave' }],
      },
      dia: 8,
    });

    const doc = JSON.parse(JSON.stringify({ oro: congelaOro(estado.oro), objetos: congelaObjetos(estado.objetos) }));
    const bolsa = levantaOro(doc.oro);
    const repisa = levantaObjetos(doc.objetos);

    assert.equal(saldoDe(bolsa), 17);
    assert.deepEqual(objetosDe(repisa), objetosDe(estado.objetos));
    for (const objeto of objetosDe(repisa)) {
      assert.deepEqual(objeto.procedencia, { desenlace: 'd1', plantilla: null, lugar: 'A Furna' }, `el objeto "${objeto.id}" ha perdido su procedencia`);
      assert.equal(objeto.dia, 8);
    }
    // La repisa y la bolsa son estado guardado: no se derivan de nada.
    assert.ok(JSON.stringify(doc).includes('procedencia'));
  });
});

describe('La frontera de inyección del casting', () => {
  test('La vista que recibe el casting solo responde si un objeto se tiene y no puede escribir nada', () => {
    const repisa = repisaCon([{ id: 'paquete', clase: 'llave' }]);
    const vista = vistaDeTenencia(repisa);
    assert.deepEqual(Object.keys(vista), ['tiene']);
    assert.equal(vista.tiene('paquete'), true);
    assert.equal(vista.tiene('llave-del-molino'), false);
    assert.equal(Object.isFrozen(vista), true, 'la vista de tenencia se puede ampliar por fuera');

    // Y una vista mal formada falla nombrando lo que llegó, en vez de suponer que no
    // se lleva nada.
    assert.throws(() => resuelveBifurcacion({ beat: beatDeLlave(), tenencia: {} }), /vistaDeTenencia/);
    assert.throws(() => castTemplate({ casteo: { tramoM: 1000, partida: { x: 0, y: 0 } }, seed: 's' }, TEMPLATES[0], 's', { tenencia: {} }), /vistaDeTenencia/);
  });
});
