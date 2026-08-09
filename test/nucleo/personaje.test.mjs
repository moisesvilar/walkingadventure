// SPEC-027 · Quién juega: el nombre y su sorteo, el género gramatical, el oficio
// permanente y la regla que sostiene todo lo demás — el personaje tiene identidad y
// **no tiene cuerpo**.
//
// Está separado de `onboarding.test.mjs` a propósito: aquello es la secuencia de las
// siete pantallas y esto es el área del estado que la secuencia rellena. Una spec
// puede tocar varias áreas y un área la tocan varias specs; atar los ficheros a las
// specs los vuelve inservibles a las tres iteraciones.
//
// Los casos con nombre de escenario son los de `docs/testing.md`, literales: «El
// personaje llega en femenino», «La pantalla de elección dice qué implica el oficio»
// y «Nada del personaje afecta al cuerpo». El resto va marcado como hueco de la
// batería en `test/spec-test-map.json`.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema: las sugerencias salen de
// la semilla y el filtro de aptitud entra inyectado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMPOS_DEL_PERSONAJE,
  CAMPOS_DE_CUERPO_PROHIBIDOS,
  GENERO_DE_ORIGEN,
  IDS_DE_GENERO,
  MOTIVOS_DEL_NOMBRE,
  REPARTO_DE_SUGERENCIAS,
  SUGERENCIAS_DE_NOMBRE,
  TOPE_DEL_NOMBRE,
  comoTeLlaman,
  congelaPersonaje,
  estadoDePersonaje,
  fijaElOficio,
  levantaPersonaje,
  marcaOficio,
  ponGenero,
  ponNombre,
  ponTramo,
  sinCuerpo,
  sugerenciasDeNombre,
  validaNombre,
} from '../../packages/nucleo/partida/personaje.js';
import { creaArranque } from '../../packages/nucleo/partida/onboarding.js';
import { textoDelGuion } from '../../packages/nucleo/partida/guion-de-arranque.js';
import { creaFiltroDeAptitud } from '../../packages/nucleo/names/aptitud-de-texto.js';
import { IDIOMAS, exigeNombres } from '../../packages/nucleo/names/index.js';
import { GENERO_POR_DEFECTO } from '../../packages/nucleo/names/lenguaje.js';
import { CATALOGO } from '../../packages/nucleo/quests/catalogo.js';
import { OFICIOS, exclusivasDeOficio, plantillasDeOficio } from '../../packages/nucleo/quests/oficios.js';
import { TAMANOS_DE_SALIDA, dimensionaSalida } from '../../packages/nucleo/partida/salida.js';
import { declaraTramo } from '../../packages/nucleo/partida/tramo.js';
import { ENTROPIA_A, ENTROPIA_B, SEMILLA_A, SEMILLA_B } from './celda-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import { PUNTO_POR_DEFECTO, ubicacionQueConcede } from '../dobles/ubicacion.mjs';

const serializado = (valor) => JSON.stringify(valor);

/** El filtro de aptitud del idioma, que es lo que criba el nombre escrito a mano. */
const filtroDe = (locale = 'gl') => creaFiltroDeAptitud({ locale });

function montaArranque({ locale = 'gl', entropia = ENTROPIA_A } = {}) {
  const arranque = creaArranque({ ubicacion: ubicacionQueConcede(), entropia, locale, puntoPorDefecto: PUNTO_POR_DEFECTO });
  arranque.empieza();
  return arranque;
}

// ── El nombre ──────────────────────────────────────────────────────────────────

describe('Quién eres: el nombre', () => {
  test('El campo de nombre llega relleno con un nombre del paquete del sitio', () => {
    const arranque = montaArranque({ locale: 'gl' });
    const puesto = arranque.vista().precubierto.nombre;
    assert.equal(typeof puesto, 'string');
    // Del paquete gallego y no del castellano: el nombre tiene que pegar con el
    // sitio, y por eso el arranque exige el paquete en vez de caer al de siempre.
    assert.ok(exigeNombres('gl').personNames('femenino').includes(puesto), `"${puesto}" no sale del repertorio gallego`);
    // Y llega puesto, que es media decisión: se puede empezar sin escribir nada, y de
    // paso nadie teclea su nombre real por inercia.
    assert.equal(arranque.vista().sinContestar.includes('nombre'), false);
  });

  test('El personaje llega en femenino', () => {
    // Las dos cláusulas del escenario, y las dos son de este módulo.
    assert.equal(GENERO_DE_ORIGEN, 'femenino');
    assert.equal(GENERO_DE_ORIGEN, GENERO_POR_DEFECTO, 'el femenino de origen se ha escrito dos veces en vez de derivarse');
    assert.equal(estadoDePersonaje().genero, 'femenino');
    assert.equal(montaArranque().vista().precubierto.genero, 'femenino');

    // Y las sugerencias muestran femeninos primero.
    for (const locale of IDIOMAS) {
      const paquete = exigeNombres(locale);
      const sugerencias = sugerenciasDeNombre({ semilla: SEMILLA_A, locale, paquete });
      const femeninos = paquete.personNames('femenino');
      const masculinos = paquete.personNames('masculino');
      const generos = sugerencias.map((n) => (femeninos.includes(n) ? 'femenino' : masculinos.includes(n) ? 'masculino' : '?'));
      assert.deepEqual(generos, [...REPARTO_DE_SUGERENCIAS], `en "${locale}" las sugerencias no salen femeninas primero: ${sugerencias.join(', ')}`);
    }
    assert.deepEqual([...REPARTO_DE_SUGERENCIAS], ['femenino', 'femenino', 'masculino', 'masculino']);
  });

  test('Las sugerencias son cuatro y no hay dos iguales', () => {
    assert.equal(SUGERENCIAS_DE_NOMBRE, 4);
    assert.equal(REPARTO_DE_SUGERENCIAS.length, SUGERENCIAS_DE_NOMBRE);
    for (const locale of IDIOMAS) {
      for (const semilla of [SEMILLA_A, SEMILLA_B]) {
        for (const ronda of [0, 1, 2, 3]) {
          const sugerencias = sugerenciasDeNombre({ semilla, locale, ronda });
          assert.equal(sugerencias.length, 4);
          assert.equal(new Set(sugerencias).size, 4, `hay sugerencias repetidas en ${locale}/${semilla}/${ronda}: ${sugerencias.join(', ')}`);
        }
      }
    }
  });

  test('«↻ otro» saca otras cuatro sugerencias y el campo se rellena con la primera', () => {
    const arranque = montaArranque();
    const primeras = arranque.vista().sugerencias;
    const segunda = arranque.resortea();
    assert.notDeepEqual([...segunda.sugerencias], [...primeras], 'resortear ha devuelto las mismas cuatro');
    assert.equal(segunda.sugerencias.length, 4);
    assert.equal(segunda.precubierto.nombre, segunda.sugerencias[0], 'el campo no se ha rellenado con la primera sugerencia');
  });

  test('La misma semilla sortea las mismas sugerencias y en el mismo orden', () => {
    for (const ronda of [0, 1, 5]) {
      const una = sugerenciasDeNombre({ semilla: SEMILLA_A, locale: 'gl', ronda });
      const otra = sugerenciasDeNombre({ semilla: SEMILLA_A, locale: 'gl', ronda });
      assert.deepEqual([...una], [...otra], 'dos sorteos con la misma semilla y la misma ronda no coinciden');
      // Y otra semilla, otras sugerencias: si no, la semilla no estaría haciendo nada.
      const deOtra = sugerenciasDeNombre({ semilla: SEMILLA_B, locale: 'gl', ronda });
      assert.notDeepEqual([...una], [...deOtra]);
    }
    // El arranque entero, dos veces con la misma entropía, propone lo mismo.
    assert.deepEqual([...montaArranque().vista().sugerencias], [...montaArranque().vista().sugerencias]);
    assert.notDeepEqual([...montaArranque().vista().sugerencias], [...montaArranque({ entropia: ENTROPIA_B }).vista().sugerencias]);
  });

  test('Seguir sin escribir nada sigue con el nombre precargado', () => {
    const arranque = montaArranque();
    const precargado = arranque.vista().precubierto.nombre;
    // Lo que la pantalla envía al seguir es lo que hay en el campo, que es el
    // precargado mientras nadie escriba.
    const veredicto = arranque.escribeNombre(precargado);
    assert.equal(veredicto.ok, true, `el nombre precargado "${precargado}" no pasa su propio filtro`);
    assert.equal(arranque.vista().precubierto.nombre, precargado);
  });

  test('Un nombre escrito a mano que pasa el filtro se guarda tal cual', () => {
    const arranque = montaArranque();
    for (const escrito of ['Uxía', 'Álvaro', "O'Neill", 'Ana María']) {
      const veredicto = arranque.escribeNombre(escrito);
      assert.equal(veredicto.ok, true, `"${escrito}" no pasa el filtro`);
      // Con sus tildes y sus mayúsculas: normalizarlo sería cambiarle el nombre a
      // alguien sin avisar.
      assert.equal(veredicto.nombre, escrito);
      assert.equal(arranque.vista().precubierto.nombre, escrito);
    }
    // Los espacios de los bordes sí se recortan, y eso no es normalizar el nombre.
    assert.equal(arranque.escribeNombre('  Sabela  ').nombre, 'Sabela');
  });

  test('Un nombre más largo que el tope no se guarda y no se nombra ninguna cifra', () => {
    const arranque = montaArranque();
    const antes = arranque.vista().precubierto.nombre;
    const larguísimo = 'A'.repeat(TOPE_DEL_NOMBRE + 1);

    const veredicto = arranque.escribeNombre(larguísimo);
    assert.equal(veredicto.ok, false);
    assert.equal(veredicto.motivo, MOTIVOS_DEL_NOMBRE.DEMASIADO_LARGO);
    assert.equal(veredicto.nombre, null);
    assert.equal(arranque.vista().precubierto.nombre, antes, 'un nombre demasiado largo se ha guardado igual');
    // El veredicto es un motivo del catálogo cerrado y **nunca una frase redactada**:
    // la redacción es del guion, y lo que se lee no nombra ningún número interno.
    const texto = textoDelGuion('quien-eres', 'nombre-demasiado-largo');
    assert.equal(/\d/.test(texto), false, `el aviso dice una cifra interna: «${texto}»`);
    assert.equal(String(veredicto.motivo).includes(String(TOPE_DEL_NOMBRE)), false);
    // Y el tope justo se admite: el error es pasarse, no llegar.
    assert.equal(validaNombre('A'.repeat(TOPE_DEL_NOMBRE), { filtro: filtroDe() }).ok, true);
  });

  test('Un nombre que el filtro de aptitud rechaza no se guarda y no se repite', () => {
    const arranque = montaArranque();
    const antes = arranque.vista().precubierto.nombre;
    const veredicto = arranque.escribeNombre('Borracha');

    assert.equal(veredicto.ok, false);
    assert.equal(veredicto.motivo, MOTIVOS_DEL_NOMBRE.NO_VALE);
    assert.equal(arranque.vista().precubierto.nombre, antes, 'un nombre no apto se ha guardado igual');
    // El motivo de aptitud viaja como **detalle** y no como texto, y lo que se lee no
    // repite el nombre rechazado: repetirlo lo enseñaría otra vez justo cuando lo que
    // se está diciendo es que no se puede enseñar.
    assert.equal(typeof veredicto.detalle, 'string');
    const texto = textoDelGuion('quien-eres', 'nombre-que-no-vale');
    assert.equal(texto.includes('Borracha'), false, `el aviso repite el nombre rechazado: «${texto}»`);
    assert.equal(serializado(veredicto).includes('Borracha'), false, 'el veredicto devuelve el nombre rechazado');
    // Y un nombre con caracteres que no son de un nombre propio tampoco pasa.
    assert.equal(arranque.escribeNombre('Ana 3000').ok, false);
  });

  test('El campo de nombre vaciado del todo no guarda un nombre vacío', () => {
    const arranque = montaArranque();
    const antes = arranque.vista().precubierto.nombre;
    for (const vacío of ['', '   ', null, undefined]) {
      const veredicto = arranque.escribeNombre(vacío);
      assert.equal(veredicto.ok, false);
      assert.equal(veredicto.motivo, MOTIVOS_DEL_NOMBRE.VACIO);
    }
    // Vuelve el precargado, así vaciar el campo no deja a nadie sin nombre.
    assert.equal(arranque.vista().precubierto.nombre, antes);
  });

  test('Un paquete sin repertorio suficiente falla nombrando el paquete y la función', () => {
    // El estado vacío del sorteo: no se enseñan sugerencias repetidas ni una lista
    // corta, se dice qué paquete se queda corto y en qué función.
    const corto = { personNames: (genero) => (genero === 'femenino' ? ['Unha'] : ['Un', 'Outro']) };
    assert.throws(
      () => sugerenciasDeNombre({ semilla: SEMILLA_A, locale: 'xx', paquete: corto }),
      /"xx" se queda corto en personNames\("femenino"\)[\s\S]*declara 1 nombres[\s\S]*sortea 2 sin repetir/,
    );
    // Un paquete que ni siquiera implementa la función lo dice igual de claro.
    assert.throws(
      () => sugerenciasDeNombre({ semilla: SEMILLA_A, locale: 'xx', paquete: {} }),
      /"xx" no implementa personNames\(genero\)[\s\S]*lista vacía/,
    );
    // Y falla igual con suerte que sin ella: el repertorio se comprueba entero antes
    // de sortear nada.
    for (const semilla of [SEMILLA_A, SEMILLA_B]) {
      assert.throws(() => sugerenciasDeNombre({ semilla, locale: 'xx', paquete: corto }), /se queda corto/);
    }
  });

  test('La validación del nombre sin filtro cableado falla en vez de aceptar cualquier cosa', () => {
    assert.throws(() => validaNombre('Uxía', {}), /necesita el filtro de aptitud inyectado/);
    assert.throws(() => ponNombre(estadoDePersonaje(), 'Uxía', { filtro: { valida: null } }), /filtro de aptitud inyectado/);
  });
});

// ── El género gramatical ───────────────────────────────────────────────────────

describe('Quién eres: el género gramatical', () => {
  test('El género tiene dos opciones y se cambia en un toque', () => {
    assert.deepEqual([...IDS_DE_GENERO], ['femenino', 'masculino']);
    const arranque = montaArranque();
    assert.equal(arranque.eligeGenero('masculino').precubierto.genero, 'masculino');
    assert.equal(arranque.eligeGenero('femenino').precubierto.genero, 'femenino');
    // Y un tercero no se inventa aquí: `personaje.md` deja la forma neutra sin
    // decidir, y cerrarla por la puerta de atrás sería peor que no tenerla.
    assert.throws(() => ponGenero(estadoDePersonaje(), 'neutro'), /neutro/);
  });

  test('La línea del género habla de cómo se dirigen a ti dentro del juego', () => {
    const femenino = textoDelGuion('quien-eres', 'genero-femenino');
    assert.match(femenino, /se dirigen a ti/);
    assert.match(femenino, /en femenino/);
    assert.match(textoDelGuion('quien-eres', 'genero-masculino'), /en masculino/);
    // No habla de quién eres fuera: ni identidad, ni sexo, ni «eres».
    for (const pieza of ['genero-femenino', 'genero-masculino']) {
      assert.equal(/eres|identidad|sexo|hombre|mujer/i.test(textoDelGuion('quien-eres', pieza)), false, `${pieza} habla de quién eres fuera`);
    }
  });

  test('El género en masculino sale en masculino en todos los textos', () => {
    const personaje = estadoDePersonaje();
    personaje.nombre = 'Xoán';
    const enMarcha = { abierto: true, marcado: false };
    for (const locale of IDIOMAS) {
      ponGenero(personaje, 'femenino');
      const enFemenino = comoTeLlaman({ personaje, arranque: enMarcha, locale });
      ponGenero(personaje, 'masculino');
      const enMasculino = comoTeLlaman({ personaje, arranque: enMarcha, locale });
      assert.notEqual(enFemenino, enMasculino, `en "${locale}" el género no cambia cómo se dirigen a ti`);
      assert.match(enMasculino, /o$/, `en "${locale}" la concordancia no sale en masculino: «${enMasculino}»`);
      assert.match(enFemenino, /a$/, `en "${locale}" la concordancia no sale en femenino: «${enFemenino}»`);
    }
  });
});

// ── El oficio ──────────────────────────────────────────────────────────────────

describe('Quién eres: el oficio', () => {
  test('La pantalla de elección dice qué implica el oficio', () => {
    // Las tres cláusulas del escenario. Las dos primeras son del guion del núcleo.
    const implicacion = textoDelGuion('quien-eres', 'implicacion-del-oficio');
    assert.match(implicacion, /qué aventuras te va a ofrecer el mundo/);
    assert.match(implicacion, /no se cambia luego/);

    // Y la tercera —que el oficio marcado explica a qué tipo de aventuras manda— vive
    // en la pantalla, porque los nombres de oficio concuerdan con quien juega y el
    // núcleo declara claves sin género a propósito. Se lee en la fuente, que es lo
    // único que se puede hacer sin simulador.
    const pantalla = fuente('app/pantallas/arranque.jsx');
    assert.match(pantalla, /testID="oficio-implicacion"/);
    for (const oficio of OFICIOS) {
      assert.match(pantalla, new RegExp(`\\b${oficio}:\\s*\\{`), `el oficio "${oficio}" no tiene texto de pantalla`);
      assert.match(pantalla, new RegExp(`testID=\\{\`oficio-\\$\\{oficio\\}\`\\}`));
    }
    // El párrafo se despliega **en su sitio** y no abre otra pantalla: una pantalla de
    // detalle por oficio convertiría una decisión permanente en una navegación.
    assert.match(pantalla, /puesto\.oficio === oficio \? \(/);
  });

  test('Los oficios de la pantalla son los del enumerado cerrado del núcleo y ninguno más', () => {
    // El componente es JSX y no se puede importar en `node --test`, así que se lee su
    // fuente. Es lo mismo que hace `app.test.mjs` con el andamiaje, y por el mismo
    // motivo: sin simulador, la fuente es lo único que hay.
    const pantalla = fuente('app/pantallas/arranque.jsx');
    const desde = pantalla.indexOf('export const TEXTOS_DE_OFICIO');
    const hasta = pantalla.indexOf('export function nombreDeOficio');
    assert.ok(desde > 0 && hasta > desde, 'la pantalla ya no declara los textos de oficio donde se esperaba');
    const bloque = pantalla.slice(desde, hasta);

    const declarados = [...bloque.matchAll(/^ {2}([a-z]+): \{$/gm)].map((m) => m[1]);
    assert.deepEqual(declarados.slice().sort(), [...OFICIOS].sort(), 'la pantalla dibuja oficios que el núcleo no declara');
    for (const oficio of OFICIOS) {
      const suyo = bloque.slice(bloque.indexOf(`  ${oficio}: {`), bloque.indexOf('},', bloque.indexOf(`  ${oficio}: {`)));
      for (const clave of ['femenino', 'masculino', 'implicacion']) {
        assert.match(suyo, new RegExp(`\\n\\s{4}${clave}: '`), `"${oficio}" no dice su ${clave}`);
      }
      // La línea de sabor va con el nombre, en el género de quien juega, y el párrafo
      // que se despliega explica a qué tipo de aventuras manda.
      assert.match(suyo, /, de las que/);
      assert.match(suyo, /, de los que/);
      assert.ok(suyo.split('implicacion:')[1].length > 60, `la implicación de "${oficio}" no explica nada`);
    }
  });

  test('Un oficio ya fijado no se cambia, y el error nombra el que estaba', () => {
    const personaje = estadoDePersonaje();
    marcaOficio(personaje, 'taberna');
    fijaElOficio(personaje);
    assert.equal(personaje.oficioPermanente, true);
    // La permanencia es una regla del estado y no un botón que no se dibuja: un
    // oficio que solo fuera permanente porque los ajustes no lo ofrecen dejaría de
    // serlo el día que alguien añadiera otra pantalla.
    assert.throws(() => marcaOficio(personaje, 'botica'), /ya está fijado en "taberna"[\s\S]*empezar de nuevo/);
    assert.equal(personaje.oficio, 'taberna');
    // Y sellar sin oficio no sella nada.
    assert.throws(() => fijaElOficio(estadoDePersonaje()), /oficio/);
  });

  test('Un oficio que no está en el enumerado falla nombrando los que sí valen', () => {
    assert.throws(() => marcaOficio(estadoDePersonaje(), 'buhonera'), new RegExp(OFICIOS.join(', ')));
    assert.throws(() => montaArranque().eligeOficio('herrería'), new RegExp(OFICIOS.join(', ')));
    assert.equal(OFICIOS.length, 4);
  });

  test('El oficio marcado se puede cambiar hasta que el arranque se cierra', () => {
    const arranque = montaArranque();
    arranque.eligeOficio('taberna');
    arranque.avanza();
    // Se retrocede desde A1P2 y sigue marcado, y todavía se puede cambiar: la
    // permanencia empieza cuando el arranque se cierra, no antes.
    assert.equal(arranque.atras().precubierto.oficio, 'taberna');
    assert.equal(arranque.eligeOficio('mercado').precubierto.oficio, 'mercado');

    arranque.respondeTramo('otro-barrio');
    arranque.eligeAMano();
    arranque.confirmaElPunto();
    const cerrado = arranque.cierra();
    assert.equal(cerrado.personaje.oficioPermanente, true);
    assert.throws(() => arranque.eligeOficio('taberna'), /ya está fijado en "mercado"/);
  });

  test('El oficio del personaje filtra el reparto de aventuras que se le ofrece', () => {
    // El catálogo llega filtrado por afinidad, y hay plantillas que no aparecen nunca
    // con este oficio. Lo mismo que afirma «El oficio filtra el catálogo» de SPEC-017,
    // afirmado aquí desde el personaje que el arranque deja hecho.
    for (const oficio of OFICIOS) {
      const personaje = estadoDePersonaje();
      marcaOficio(personaje, oficio);
      const suyas = plantillasDeOficio(personaje.oficio, CATALOGO);
      assert.ok(suyas.length > 0, `"${oficio}" no tiene ninguna plantilla`);
      assert.ok(suyas.length < CATALOGO.length, `"${oficio}" ve el catálogo entero: el oficio no filtra nada`);
      const suyos = new Set(suyas.map((p) => p.id));
      const nunca = CATALOGO.filter((p) => !suyos.has(p.id));
      assert.ok(nunca.length > 0, `con "${oficio}" no hay ninguna plantilla que no aparezca nunca`);
      // Y hay al menos una que solo ve este oficio: el peso de la decisión está en lo
      // que con esta persona no verás.
      assert.ok(exclusivasDeOficio(oficio, CATALOGO).length > 0, `"${oficio}" no tiene ninguna plantilla exclusiva`);
    }
  });
});

// ── Nada del personaje toca el cuerpo ──────────────────────────────────────────

describe('Nada del personaje toca el cuerpo', () => {
  test('Nada del personaje afecta al cuerpo', () => {
    // El área es cerrada y corta, y esa es media garantía: no hay dónde poner una
    // velocidad ni una resistencia sin declararla, y declararla se ve en el diff.
    assert.deepEqual([...CAMPOS_DEL_PERSONAJE], ['nombre', 'genero', 'oficio', 'oficioPermanente', 'tramo']);
    const personaje = estadoDePersonaje();
    assert.deepEqual(Object.keys(personaje).sort(), [...CAMPOS_DEL_PERSONAJE].sort());

    // Y la otra media es la guarda, que se llama al congelar y no solo desde aquí:
    // una guarda que nadie invoca es decoración.
    for (const campo of ['velocidad', 'resistencia', 'fatiga', 'distancia']) {
      assert.ok(CAMPOS_DE_CUERPO_PROHIBIDOS.includes(campo));
      assert.throws(() => congelaPersonaje({ ...personaje, [campo]: 3 }), new RegExp(`declara "${campo}"`));
      assert.throws(() => sinCuerpo({ ...personaje, [campo]: 3 }), /identidad y no tiene cuerpo/);
    }
    // Ni el módulo declara ninguna aritmética de cuerpo por otro nombre.
    const modulo = fuente('packages/nucleo/partida/personaje.js');
    assert.equal(/km\/h|metrosPorSegundo|calorías/i.test(modulo), false, 'el personaje ha criado aritmética de cuerpo');
  });

  test('Dos personajes distintos con el mismo tramo dimensionan la misma salida', () => {
    const una = estadoDePersonaje();
    ponNombre(una, 'Sabela', { filtro: filtroDe() });
    marcaOficio(una, 'taberna');
    ponTramo(una, 'otro-barrio');

    const otro = estadoDePersonaje();
    ponGenero(otro, 'masculino');
    ponNombre(otro, 'Breogán', { filtro: filtroDe() });
    marcaOficio(otro, 'mercado');
    ponTramo(otro, 'otro-barrio');

    for (const tamano of TAMANOS_DE_SALIDA) {
      const deUna = dimensionaSalida(tamano.id, una.tramo);
      const deOtro = dimensionaSalida(tamano.id, otro.tramo);
      // Exactamente el mismo tamaño, en metros y en beats: el esfuerzo es del tramo,
      // que es del cuerpo de quien juega y no del personaje que interpreta.
      assert.equal(serializado(deUna), serializado(deOtro), `"${tamano.id}" sale distinto para dos personajes con el mismo tramo`);
    }
    // Y el tramo es lo único que lo mueve.
    ponTramo(otro, 'pueblo-de-al-lado');
    assert.notEqual(serializado(dimensionaSalida('paseo', una.tramo)), serializado(dimensionaSalida('paseo', otro.tramo)));
    assert.equal(serializado(declaraTramo('otro-barrio')), serializado(una.tramo));
  });

  test('Dos personajes con oficios distintos entregan el mismo mundo por levantar', async () => {
    const { levantaFixture, serializado: serializadoDelMapa } = await import('./levantamiento-de-prueba.mjs');
    // Lo que el arranque entrega al levantamiento es la semilla, el tramo y el
    // anclaje, y ninguno de los tres sale del oficio ni del género. Se comprueba
    // levantando de verdad el mismo fixture dos veces con lo que entregarían dos
    // personajes distintos.
    const uno = await levantaFixture('barrio-tres-calles', { tramoM: declaraTramo('otro-barrio').declaradoM });
    const otro = await levantaFixture('barrio-tres-calles', { tramoM: declaraTramo('otro-barrio').declaradoM });
    assert.equal(serializadoDelMapa(uno.resultado.documento), serializadoDelMapa(otro.resultado.documento), 'el mismo mundo sale distinto');

    // El oficio filtra **lo que se ofrece** y no lo que existe: el documento del
    // mundo no sabe quién juega. Se afirma sobre las claves y no sobre los valores,
    // porque «taberna» sí es un valor legítimo ahí dentro —es la clase de un servicio
    // real del mundo— y confundir las dos cosas sería probar otra.
    const texto = serializadoDelMapa(uno.resultado.documento);
    for (const clave of ['"oficio"', '"personaje"', '"nombreDelJugador"', '"oficioPermanente"']) {
      assert.equal(texto.includes(clave), false, `el mundo levantado guarda ${clave}`);
    }
  });

  test('Cambiar el nombre o el género después del arranque deja el mundo idéntico', () => {
    // El género es dato vivo y no siembra nada: no entra en ninguna semilla. La
    // manera de afirmarlo sin generar dos mundos es que no aparezca en el estado del
    // que cuelga el azar — la semilla de la partida — ni en lo que se le pasa al mapa.
    const arranque = montaArranque();
    arranque.eligeOficio('forja');
    arranque.respondeTramo('otro-barrio');
    arranque.eligeAMano();
    arranque.confirmaElPunto();
    const semilla = arranque.semilla();
    const mapaId = arranque.mapaId();

    arranque.eligeGenero('masculino');
    arranque.escribeNombre('Anxo');
    assert.equal(arranque.semilla(), semilla, 'cambiar el género ha movido la semilla');
    assert.equal(arranque.mapaId(), mapaId, 'cambiar el nombre ha movido el mapa');
    // Y el personaje viaja aparte del mundo: su área no se reproduce al rehacer una
    // partida desde su semilla.
    assert.match(fuente('packages/nucleo/partida/estado.js'), /id: 'personaje'[\s\S]*reproduce: false/);
  });
});

// ── El mundo no te llama por tu nombre todavía ─────────────────────────────────

describe('El mundo no te llama por tu nombre todavía', () => {
  test('Antes del hito el mundo te llama forastera o forastero según tu género', () => {
    const personaje = estadoDePersonaje();
    personaje.nombre = 'Sabela';
    const enMarcha = { abierto: true, marcado: false };
    assert.equal(comoTeLlaman({ personaje, arranque: enMarcha, locale: 'es' }), 'forastera');
    ponGenero(personaje, 'masculino');
    assert.equal(comoTeLlaman({ personaje, arranque: enMarcha, locale: 'es' }), 'forastero');
    // Y nunca por su nombre, en ninguno de los dos idiomas.
    for (const locale of IDIOMAS) {
      assert.notEqual(comoTeLlaman({ personaje, arranque: enMarcha, locale }), 'Sabela');
    }
  });

  test('Disparado el hito de fin de arranque, el mundo ya usa el nombre', () => {
    const personaje = estadoDePersonaje();
    personaje.nombre = 'Sabela';
    for (const arranque of [{ abierto: false, marcado: false }, { abierto: true, marcado: true }]) {
      assert.equal(comoTeLlaman({ personaje, arranque, locale: 'es' }), 'Sabela');
    }
    // Y si el hito llega sin nombre, se dice: a partir de ahí el mundo llama por el
    // nombre y no hay ninguno que usar.
    assert.throws(
      () => comoTeLlaman({ personaje: estadoDePersonaje(), arranque: { abierto: false, marcado: true } }),
      /no hay ninguno que usar/,
    );
  });
});

// ── Serialización ──────────────────────────────────────────────────────────────

describe('El personaje guardado', () => {
  test('El personaje va y vuelve de su documento sin perder ni ganar nada', () => {
    const personaje = estadoDePersonaje();
    ponNombre(personaje, 'Uxía', { filtro: filtroDe() });
    ponGenero(personaje, 'masculino');
    marcaOficio(personaje, 'botica');
    ponTramo(personaje, 'pueblo-de-al-lado');
    fijaElOficio(personaje);

    const doc = congelaPersonaje(personaje);
    const vuelto = levantaPersonaje(doc);
    assert.equal(serializado(congelaPersonaje(vuelto)), serializado(doc));
    // Un oficio ya sellado vuelve sellado: la permanencia sobrevive a guardar.
    assert.equal(vuelto.oficioPermanente, true);
    assert.throws(() => marcaOficio(vuelto, 'taberna'), /ya está fijado/);
    // Y un oficio guardado que ya no existe se dice al abrir, en vez de quedarse.
    assert.throws(() => levantaPersonaje({ ...doc, oficio: 'buhonera' }), /buhonera/);
    // Un documento vacío devuelve el personaje de origen, en femenino.
    assert.equal(levantaPersonaje(null).genero, GENERO_DE_ORIGEN);
  });
});
