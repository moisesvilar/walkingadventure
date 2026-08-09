// SPEC-038 · Los dos registros de voz, **como dato del propio texto**, y la tipografía
// que se deriva de ellos.
//
// `game-design/lenguaje.md` afirma algo sobre **todos** los textos del juego: se habla
// como mundo, y los ajustes son la única excepción. Un requisito global que solo se
// comprueba abriendo pantallas no se puede poner rojo nunca, y en esta máquina no hay
// simulador. Con el registro dentro del dato, «los ajustes son la única excepción» pasa
// a ser una consulta sobre el conjunto de textos, y eso es lo que se hace aquí: sobre
// las dos pantallas que esta fila entrega y sobre **el corpus entero del paquete**.
//
// Los dos escenarios de la característica «Dos registros con una sola frontera» que esta
// fila hace afirmables llevan aquí su nombre literal, aunque en `docs/testing.md` estén
// etiquetados `@app`: hoy se pueden ejecutar en `@nucleo` sobre el dato, que además es
// donde no se desactualizan. Lo que sigue necesitando dispositivo —la tipografía
// efectiva en pantalla— vive en `test/app/ajustes.yaml`.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  IDS_DE_REGISTRO,
  REGISTROS,
  SITIOS_DE_LA_VOZ_DE_APLICACION,
  TIPOGRAFIAS,
  TIPOGRAFIA_POR_REGISTRO,
  admiteVozDeAplicacion,
  coloca,
  exigeRegistro,
  exigeSitio,
  exigeTextoConRegistro,
  textoConRegistro,
  tipografiaDe,
  vozDeAplicacionEn,
} from '../../packages/nucleo/lenguaje/registro.js';
import { componeAjustes, estadoDeAjustes } from '../../packages/nucleo/partida/ajustes.js';
import { SIN_CARAS, componeRepisa } from '../../packages/nucleo/partida/repisa.js';
import { estadoDeMotes } from '../../packages/nucleo/partida/motes.js';
import { estadoDeNucleos } from '../../packages/nucleo/partida/nucleos.js';
import { estadoDeObjetos } from '../../packages/nucleo/partida/objetos.js';
import { estadoDeOro } from '../../packages/nucleo/partida/oro.js';
import { estadoDePersonaje, ponTramo } from '../../packages/nucleo/partida/personaje.js';
import { GENEROS } from '../../packages/nucleo/partida/puestos.js';
import { TEXTOS_DEL_TAMANO } from '../../packages/nucleo/quests/escena.js';
import { textosDelArranque } from '../../packages/nucleo/partida/guion-de-arranque.js';
import { IDS_DE_TAMANO_DE_TEXTO } from '../../packages/nucleo/quests/escena.js';
import { fuente, modulosDelPaquete } from './mundo-de-prueba.mjs';
import { MAPA, mapaDe } from './progresion-de-prueba.mjs';

/** Los ajustes compuestos con todas sus filas cableadas. */
function ajustesCompuestos() {
  const personaje = estadoDePersonaje();
  personaje.nombre = 'Sabela';
  personaje.genero = GENEROS.FEMENINO;
  ponTramo(personaje, 'otro-barrio');
  return componeAjustes({
    personaje,
    ajustes: estadoDeAjustes(),
    estilo: 'reino',
    tamanoDeTexto: IDS_DE_TAMANO_DE_TEXTO[0],
    criterios: ['escalones'],
    sitiosMarcados: 2,
    puertas: ['copia', 'empezar-de-nuevo'],
  });
}

/** La repisa compuesta, que es la pantalla del bucle que esta misma fila entrega. */
function repisaCompuesta() {
  return componeRepisa({
    objetos: estadoDeObjetos(),
    oro: estadoDeOro(),
    motes: estadoDeMotes(),
    nucleos: estadoDeNucleos(),
    mapaId: MAPA,
    mapa: mapaDe(),
    caras: SIN_CARAS,
  });
}

describe('Dos registros con una sola frontera', () => {
  test('Los ajustes son la única excepción', () => {
    // Escenario `@app` de la batería, verificado aquí en `@nucleo` sobre el conjunto de
    // textos, que es lo único que no se desactualiza cuando alguien añade una pantalla.
    const ajustes = ajustesCompuestos();
    assert.equal(ajustes.registro, REGISTROS.APLICACION);
    assert.ok(ajustes.textos.length, 'los ajustes no entregan ningún texto');
    for (const texto of ajustes.textos) {
      assert.equal(texto.registro, REGISTROS.APLICACION, `el texto "${texto.id}" de los ajustes no habla como aplicación`);
      assert.equal(texto.tipografia, TIPOGRAFIAS.SANS, `el texto "${texto.id}" de los ajustes no sale en la sans`);
      assert.equal(texto.pantalla, 'a6p6');
    }
    // Los 18 textos de la pantalla son exactamente los que la consulta de RF-LANG-002
    // devuelve: la portada, el titular, los cinco grupos y las once filas.
    assert.equal(vozDeAplicacionEn(ajustes.textos).length, ajustes.textos.length);

    // Y ese registro no aparece en ninguna otra pantalla del juego. Se afirma sobre el
    // corpus entero del paquete y no sobre las dos pantallas de esta fila.
    const permitidos = [
      'packages/nucleo/lenguaje/registro.js',
      'packages/nucleo/partida/ajustes.js',
      'packages/nucleo/partida/guion-de-arranque.js',
    ];
    const declaran = modulosDelPaquete().filter((ruta) => /REGISTROS\.APLICACION|'aplicacion'|"aplicacion"/.test(fuente(ruta)));
    assert.deepEqual(
      declaran.slice().sort(),
      permitidos.slice().sort(),
      'un módulo fuera del onboarding y de los ajustes declara voz de aplicación',
    );
    assert.deepEqual(SITIOS_DE_LA_VOZ_DE_APLICACION, ['onboarding', 'ajustes']);
    assert.equal(admiteVozDeAplicacion('ajustes'), true);
    assert.equal(admiteVozDeAplicacion('onboarding'), true);
  });

  test('El juego habla como mundo', () => {
    // La mitad que esta fila sostiene: ningún texto del bucle lleva registro de
    // aplicación. La repisa es la pantalla del bucle que esta misma fila entrega.
    const repisa = repisaCompuesta();
    assert.equal(repisa.registro, REGISTROS.MUNDO);
    for (const texto of repisa.textos) {
      assert.equal(texto.registro, REGISTROS.MUNDO, `el texto "${texto.id}" de la repisa habla como aplicación`);
      assert.equal(texto.tipografia, TIPOGRAFIAS.SERIF);
    }
    assert.deepEqual(vozDeAplicacionEn(repisa.textos), []);

    // Y colocar un texto de aplicación en una pantalla del mundo **falla nombrando el
    // texto y la pantalla**, en lugar de pintarse con la fuente de al lado y pasar
    // desapercibido. Es la comprobación entera de RF-LANG-002, y vive en el núcleo
    // porque una regla que solo vigila la batería deja de vigilar en cuanto alguien
    // añade una pantalla sin acordarse de la batería.
    const intruso = textoConRegistro({ id: 'permisos', registro: REGISTROS.APLICACION, texto: 'Activa los permisos de ubicación.' });
    for (const pantalla of ['repisa', 'en-marcha', 'llegada', 'mapa', 'diario', 'portada']) {
      assert.throws(() => coloca([intruso], { sitio: pantalla }), (e) => {
        assert.match(e.message, /permisos/, `el error de "${pantalla}" no nombra el texto`);
        assert.match(e.message, new RegExp(pantalla), 'el error no nombra la pantalla');
        return true;
      }, `un texto de aplicación se ha colocado en "${pantalla}"`);
    }
    // Y ninguno de los textos del mundo protesta por colocarse donde le toca.
    assert.equal(coloca(repisa.textos, { sitio: 'repisa', pantalla: 'a6p5' }).length, repisa.textos.length);
  });

  test('El registro sale de un enumerado cerrado de dos valores', () => {
    assert.deepEqual(IDS_DE_REGISTRO, ['mundo', 'aplicacion']);
    assert.equal(Object.keys(REGISTROS).length, 2);
    // Un tercero —«voz de sistema», «voz de tutorial»— sería la grieta por la que la
    // frontera deja de ser una frontera.
    for (const inventado of ['sistema', 'tutorial', 'app', null, undefined, '']) {
      assert.throws(() => exigeRegistro(inventado), (e) => {
        assert.ok(IDS_DE_REGISTRO.every((id) => e.message.includes(id)), 'el error no enumera los dos registros');
        return true;
      }, `el registro ${JSON.stringify(inventado)} se ha aceptado`);
    }
    assert.throws(() => { REGISTROS.SISTEMA = 'sistema'; }, TypeError);
  });

  test('Todo texto que el juego entrega para pintar declara su registro', () => {
    // Un texto sin registro no se puede componer, y el error lo nombra: sin identidad
    // ni siquiera se podría decir cuál es.
    assert.throws(() => textoConRegistro({ id: 'x', texto: 'hola' }), /"x"/);
    assert.throws(() => textoConRegistro({ id: '', registro: REGISTROS.MUNDO, texto: 'hola' }), /sin identidad/);
    assert.throws(() => textoConRegistro({ id: 'x', registro: REGISTROS.MUNDO, texto: '' }), /"x"/);
    assert.throws(() => exigeTextoConRegistro({ id: 'x', texto: 'hola' }), /"x"/);
    assert.throws(() => exigeSitio(null), /sitio/);

    // Y no hay ninguna manera de ponerle registro a un texto a posteriori: lo declara
    // quien lo escribe, en el sitio donde lo escribe.
    const codigo = fuente('packages/nucleo/lenguaje/registro.js');
    assert.ok(!/function\s+(pon|marca|cambia)Registro/.test(codigo), 'hay una manera de ponerle registro a un texto después');

    // Los textos del arranque, que son el otro sitio con voz de aplicación, ya lo
    // declaran uno a uno.
    const arranque = textosDelArranque();
    assert.ok(arranque.length, 'el guion del arranque no entrega ningún texto');
    for (const texto of arranque) {
      assert.ok(IDS_DE_REGISTRO.includes(texto.registro), `el texto "${texto.id}" del arranque no declara registro`);
    }
    assert.ok(vozDeAplicacionEn(arranque.map((t) => textoConRegistro({ id: t.id, registro: t.registro, texto: t.texto }))).length,
      'el arranque no tiene ningún texto con voz de aplicación, y es uno de sus dos sitios');
  });

  test('La tipografía se deriva del registro y ninguna pantalla la elige a mano', () => {
    // La correspondencia es total: ningún registro sin tipografía y ninguna tipografía
    // sin registro. Es lo que impide elegir la fuente por cuenta propia «solo esta vez».
    assert.deepEqual(Object.keys(TIPOGRAFIA_POR_REGISTRO).sort(), IDS_DE_REGISTRO.slice().sort());
    assert.deepEqual(Object.values(TIPOGRAFIA_POR_REGISTRO).slice().sort(), Object.values(TIPOGRAFIAS).slice().sort());
    assert.equal(tipografiaDe(REGISTROS.MUNDO), TIPOGRAFIAS.SERIF);
    assert.equal(tipografiaDe(REGISTROS.APLICACION), TIPOGRAFIAS.SANS);
    // Un registro que no existe falla aquí, que es la única puerta a una tipografía.
    assert.throws(() => tipografiaDe('sistema'), /sistema/);

    // La tipografía viaja **dentro del texto ya resuelta**: quien pinta no la calcula, y
    // lo que no se resuelve en la pantalla no se puede resolver mal en una y bien en las
    // demás.
    for (const texto of [...ajustesCompuestos().textos, ...repisaCompuesta().textos]) {
      assert.equal(texto.tipografia, tipografiaDe(texto.registro), `el texto "${texto.id}" trae una tipografía que no sale de su registro`);
    }

    // Y las dos pantallas la piden por el registro, sin nombrar ninguna familia.
    for (const pantalla of ['app/pantallas/repisa.jsx', 'app/pantallas/ajustes.jsx']) {
      const codigo = fuente(pantalla);
      assert.ok(codigo.includes('familiaDe('), `${pantalla} no deriva la tipografía del registro`);
      assert.ok(!/fontFamily:\s*'serif'/.test(codigo), `${pantalla} elige la serif a mano`);
    }
    // La capa de plataforma traduce el nombre a una familia y no tiene voto sobre quién
    // es serif y quién sans.
    const familias = fuente('app/pantallas/tipografia.js');
    assert.ok(familias.includes('tipografiaDe'), 'la capa de familias no pasa por el registro');
    assert.ok(!/REGISTROS\./.test(familias), 'la capa de familias decide por registro en vez de por tipografía');
  });

  test('El tamaño de letra de la escena se cuela sin palabra de la voz de aplicación', () => {
    // El caso límite declarado: es el único ajuste que asoma dentro del bucle, y se cuela
    // sin ninguna palabra que suene a aplicación (`personaje.md` §4, `lenguaje.md`).
    const prohibidas = /aplicaci[oó]n|ajuste|configuraci[oó]n|preferencia|permiso|accesibilidad|men[uú]|opci[oó]n|activar|desactivar/i;
    for (const texto of Object.values(TEXTOS_DEL_TAMANO)) {
      assert.ok(!prohibidas.test(texto), `el control del tamaño de letra dice voz de aplicación: "${texto}"`);
    }
    // Y su fila de ajustes existe, en «El mapa», que es donde esta spec la coloca.
    const fila = ajustesCompuestos().filas.find((f) => f.id === 'tamano-de-letra');
    assert.equal(fila.grupo, 'el-mapa');
    assert.ok(!prohibidas.test(fila.etiqueta), `la fila del tamaño de letra dice voz de aplicación: "${fila.etiqueta}"`);
  });
});
