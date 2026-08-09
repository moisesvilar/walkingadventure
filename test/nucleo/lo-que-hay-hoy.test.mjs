// SPEC-028 · Lo que hay hoy (A2P3), la oferta del estirón y la ficha de la aventura
// (A2P4).
//
// El tope de tres y la mezcla del recado son de SPEC-019, y la falta de reparto con su
// estirón de un tramo es de SPEC-008: aquí no se vuelven a probar como mecanismos, se
// prueba **lo que esta pantalla hace con ellos**. Que la lista nunca vuelva vacía, que un
// día con una sola aventura no estrene ninguna línea donde escribir una disculpa, que la
// oferta sustituya a la lista en vez de añadirse debajo, que no se encadene sola, y que
// la ficha falle antes que decir «vuelves donde empiezas» sobre un lazo abierto.
//
// Los mundos son de dos clases, con el criterio de `accesibilidad.test.mjs`: los cuatro
// congelados cuando lo que se mide es el dato real de OSM —los tres como mucho salen de
// un mundo con veintinueve plantillas que castean— y sintéticos cuando hace falta un
// reparto de tamaño exacto, que ningún fixture produce.
//
// Los escenarios que ya existían en `docs/testing.md` llevan su nombre literal; los
// demás van marcados como hueco de la batería en `test/spec-test-map.json`.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: los datos de OSM salen de
// fixtures congelados, el día se inyecta y el azar viene de la semilla.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCIONES_DE_LA_FICHA,
  BLOQUES_DE_LA_FICHA,
  BLOQUES_DE_LO_QUE_HAY_HOY,
  BLOQUES_QUE_NO_EXISTEN,
  CLASES_DE_ENTRADA,
  aceptaElEstironDeHoy,
  aceptaLaEntrada,
  componeFicha,
  componeLoQueHayHoy,
} from '../../packages/nucleo/partida/lo-que-hay-hoy.js';
import { MOTIVOS_DE_FALTA, TRAMOS_DEL_ESTIRON } from '../../packages/nucleo/partida/aventuras.js';
import { MEDIDA_DEL_RECADO, TOPE_DE_LA_LISTA } from '../../packages/nucleo/partida/recados.js';
import { estadoDeEntregas } from '../../packages/nucleo/partida/entregas.js';
import { abreSalida, estadoDeSalidaAbierta, salidaAbierta } from '../../packages/nucleo/partida/salida-abierta.js';
import { MEDIDA_DE_TAMANO, PALABRAS_DE_DISCULPA, disculpasDeTexto, vozDeTexto } from '../../packages/nucleo/partida/guion-de-antes-de-salir.js';
import { cifrasDeTexto } from '../../packages/nucleo/partida/guion-de-arranque.js';
import { CATALOGO } from '../../packages/nucleo/quests/catalogo.js';
import { OFICIOS, plantillasDeOficio } from '../../packages/nucleo/quests/oficios.js';
import { colaCon, oportunidad } from './entrega-de-prueba.mjs';
import {
  DIA,
  MAPA,
  TRAMO,
  TRAMO_QUE_NO_LLEGA,
  TRAMO_SIN_REPARTO,
  calendarioEn,
  huellaDelGrafo,
  mundoCongeladoGenerado,
  mundoDeUnaSola,
  mundoSinRepartoPorElFiltro,
  textosDe,
} from './antes-de-salir-de-prueba.mjs';

/** El mundo real de referencia de esta pantalla: costero, semilla 1, con reparto de sobra. */
const costero = () => mundoCongeladoGenerado('costero', '1');

/** La petición completa de la lista de hoy, con lo que casi todas estas pruebas comparten. */
const peticion = (mundo, extra = {}) => ({ mundo, oficio: 'taberna', tramo: TRAMO, calendario: calendarioEn(), ...extra });

/** Una cola con dos oportunidades pendientes, que es lo que puebla el recado suelto. */
function colaConDosRecados() {
  return colaCon(
    [oportunidad({ asunto: 'encargo-de-la-plaza' }), oportunidad({ asunto: 'encargo-del-muelle', paso: 2 })],
    { mapaId: MAPA },
  );
}

// ── La lista de hoy ─────────────────────────────────────────────────────────────

describe('Lo que hay hoy', () => {
  test('Se ofrecen tres aventuras como mucho', async () => {
    const mundo = await costero();
    // El mundo tiene veintinueve plantillas que castean, así que el tope es lo único que
    // puede estar decidiendo cuántas se ven.
    assert.equal(mundo.casting.filter((c) => c.ok).length, 29, 'el mundo de referencia ha dejado de tener veintinueve casteables');

    for (const oficio of OFICIOS) {
      const lista = componeLoQueHayHoy(peticion(mundo, { oficio }));
      assert.equal(lista.hayLista, true, `${oficio}: no hay lista en un mundo con veintinueve plantillas casteadas`);
      assert.equal(lista.entradas.length, 3, `${oficio}: la lista trae ${lista.entradas.length} entradas`);
      assert.equal(lista.tope, TOPE_DE_LA_LISTA);
      assert.ok(plantillasDeOficio(oficio, CATALOGO).length > 3, `${oficio}: el catálogo filtrado ya venía con tres o menos, así que el tope no está midiendo nada`);
    }

    // Y no se pagina: el tope existe precisamente para que no haga falta.
    const lista = componeLoQueHayHoy(peticion(mundo));
    for (const bloque of BLOQUES_QUE_NO_EXISTEN) {
      assert.equal(lista.bloques.includes(bloque), false, `la lista trae el bloque "${bloque}"`);
      assert.equal(BLOQUES_DE_LO_QUE_HAY_HOY.includes(bloque), false, `el vocabulario declara "${bloque}"`);
    }
    for (const campo of ['pagina', 'paginas', 'siguiente', 'verMas', 'orden', 'ordenadaPor']) {
      assert.equal(campo in lista, false, `la lista declara "${campo}"`);
    }
  });

  test('Un día con una sola aventura no es un día roto', () => {
    const mundo = mundoDeUnaSola();
    const lista = componeLoQueHayHoy(peticion(mundo));

    assert.equal(lista.hayLista, true);
    assert.equal(lista.entradas.length, 1, 'el mundo de una sola plantilla no ofrece exactamente una');

    // Los mismos bloques que con tres: la lista corta no estrena ninguna línea, y por eso
    // no hay ningún sitio donde escribir una disculpa.
    assert.deepEqual(lista.bloques, ['lista', 'andar-sin-nada']);
    assert.equal(lista.titulo, 'Lo que se cuenta hoy');
    assert.equal(lista.subtitulo, 'Por aquí hay quien necesita algo');
    assert.equal(lista.andarSinNada, 'Y puedes salir a andar sin coger ninguna. El mundo se mueve igual.');

    // Y ningún texto de la pantalla se disculpa por ello.
    for (const { ruta, texto } of textosDe(lista)) {
      assert.deepEqual(disculpasDeTexto(texto), [], `la lista se disculpa en ${ruta}: «${texto}»`);
    }
    // La comprobación de la comprobación: el guion sabe reconocer una disculpa.
    assert.ok(PALABRAS_DE_DISCULPA.length > 0);
    assert.deepEqual(disculpasDeTexto('Lo siento, hoy solo hay una.'), ['lo siento', 'solo hay']);
  });

  test('Cada aventura declara su tamaño con una palabra', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero()));

    for (const entrada of lista.entradas) {
      assert.equal(entrada.medida, MEDIDA_DE_TAMANO[entrada.tamano], `la entrada "${entrada.id}" no dice su tamaño con la palabra que le toca`);
      // Una palabra del mundo y su hora orientativa, que es literalmente lo que
      // `bucle-jugable.md` §3 pide al lado.
      assert.match(entrada.medida, /^(Un paseo|Una aventura|Una jornada|Un momento)/);
      // Y ninguna distancia en la medida, que es lo que esta pantalla escribe. El título y
      // el gancho salen del catálogo y los revisa SPEC-017 con las reglas de la prosa —
      // donde «te sale al paso» es castellano y no una cifra—, así que revisarlos otra vez
      // aquí con la vara del guion solo produciría falsos positivos.
      assert.deepEqual(
        cifrasDeTexto(entrada.medida, { salvo: ['tiempo'] }),
        [],
        `la medida de "${entrada.id}" lleva una cifra: «${entrada.medida}»`,
      );
      for (const campo of ['metros', 'km', 'distanciaM', 'pasos', 'minutos']) {
        assert.equal(campo in entrada, false, `la entrada "${entrada.id}" declara "${campo}"`);
      }
    }

    // Y los textos que sí escribe esta pantalla, enteros y sin excepción de tiempo.
    for (const texto of [lista.titulo, lista.subtitulo, lista.andarSinNada]) {
      assert.deepEqual(cifrasDeTexto(texto), [], `la pantalla lleva una cifra: «${texto}»`);
    }
  });

  test('El recado suelto comparte lista y ocupa un sitio del tope de tres', async () => {
    const mundo = await costero();
    const entregas = colaConDosRecados();
    const lista = componeLoQueHayHoy(peticion(mundo, { entregas, mapaId: MAPA }));

    assert.equal(lista.entradas.length, TOPE_DE_LA_LISTA, 'el recado ha añadido un cuarto sitio');
    const recados = lista.entradas.filter((e) => e.clase === CLASES_DE_ENTRADA.RECADO);
    assert.equal(recados.length, 1, 'la lista trae más de un recado suelto');
    // Ocupa el tercer sitio, que es el caso límite: dos aventuras y el recado.
    assert.equal(lista.entradas[2].clase, CLASES_DE_ENTRADA.RECADO);
    assert.equal(lista.entradas.filter((e) => e.clase === CLASES_DE_ENTRADA.AVENTURA).length, 2);

    // Mide «un momento», y su texto sale de la cola y no se vuelve a redactar aquí.
    assert.equal(recados[0].tamano, MEDIDA_DEL_RECADO);
    assert.equal(recados[0].medida, MEDIDA_DE_TAMANO['un-momento']);
    assert.equal(recados[0].medida, 'Un momento');
    assert.equal(recados[0].titulo, null);
    assert.equal(recados[0].gancho, null);
    assert.deepEqual([...Object.values(CLASES_DE_ENTRADA)].sort(), ['aventura', 'recado']);

    // Sin cola, la misma lista con tres aventuras: el recado quita sitio, no lo añade.
    const sinRecado = componeLoQueHayHoy(peticion(mundo));
    assert.equal(sinRecado.entradas.length, 3);
    assert.deepEqual(
      lista.entradas.slice(0, 2).map((e) => e.id),
      sinRecado.entradas.slice(0, 2).map((e) => e.id),
      'meter el recado ha cambiado qué aventuras se ofrecen',
    );
  });

  test('Un día con solo un recado pendiente sigue siendo un día con lista', () => {
    // Es la razón entera de que el recado exista: un mundo que no castea nada para este
    // oficio no deja el día vacío si hay algo en la cola.
    const mundo = mundoDeUnaSola();
    const entregas = colaConDosRecados();
    const lista = componeLoQueHayHoy(peticion(mundo, { oficio: 'forja', entregas, mapaId: MAPA }));

    assert.equal(lista.hayLista, true, 'un día con recado pendiente se ha entregado como día sin reparto');
    assert.equal(lista.entradas.length, 1);
    assert.equal(lista.entradas[0].clase, CLASES_DE_ENTRADA.RECADO);
  });

  test('El catálogo llega ya filtrado por la afinidad del oficio', () => {
    // `la-posada-sin-sitio` es exclusiva de taberna: con este personaje se ve, y con
    // cualquier otro no aparece nunca. El oficio filtra **lo que se ofrece**, no lo que
    // existe: el mundo es el mismo para los cuatro.
    const mundo = mundoDeUnaSola();
    const conTaberna = componeLoQueHayHoy(peticion(mundo, { oficio: 'taberna' }));
    assert.deepEqual(conTaberna.entradas.map((e) => e.id), ['la-posada-sin-sitio']);

    for (const oficio of OFICIOS.filter((o) => o !== 'taberna')) {
      const otra = componeLoQueHayHoy(peticion(mundo, { oficio }));
      assert.equal(otra.hayLista, false, `${oficio}: ve una aventura que su oficio no tiene`);
      assert.equal(otra.entradas.length, 0);
      assert.equal(plantillasDeOficio(oficio, CATALOGO).some((p) => p.id === 'la-posada-sin-sitio'), false);
    }

    // Y el mundo no se ha tocado: lo que cambia es la lista, nunca el casting.
    assert.equal(mundo.casting.length, 1);
    assert.equal(mundo.casting[0].tpl.id, 'la-posada-sin-sitio');
  });

  test('La última línea dice que se puede salir a andar sin coger ninguna', async () => {
    const mundo = await costero();
    const conLista = componeLoQueHayHoy(peticion(mundo));
    const sinLista = componeLoQueHayHoy(peticion(mundoSinRepartoPorElFiltro(), { tramo: TRAMO_SIN_REPARTO, criterios: ['escalones'] }));

    // Está en los dos casos, y es lo que impide que la oferta del estirón sea la única
    // salida: el último bloque de la pantalla, siempre.
    assert.equal(conLista.bloques[conLista.bloques.length - 1], 'andar-sin-nada');
    assert.equal(sinLista.bloques[sinLista.bloques.length - 1], 'andar-sin-nada');
    assert.equal(conLista.andarSinNada, sinLista.andarSinNada);
    assert.match(conLista.andarSinNada, /sin coger ninguna/);
  });

  test('El mismo mundo, el mismo día y la misma partida componen la misma lista, en el mismo orden', async () => {
    const mundo = await costero();
    const entregas = colaConDosRecados();
    const una = componeLoQueHayHoy(peticion(mundo, { entregas, mapaId: MAPA }));
    const otra = componeLoQueHayHoy(peticion(mundo, { entregas, mapaId: MAPA }));
    // Serialización completa, no campo a campo.
    assert.equal(JSON.stringify(otra), JSON.stringify(una));
    assert.deepEqual(otra.entradas.map((e) => e.id), una.entradas.map((e) => e.id));
    assert.equal(una.dia, DIA);
  });

  test('Un día sin ninguna aventura que castee y sin recado entrega la falta de reparto, nunca una lista vacía', () => {
    const lista = componeLoQueHayHoy(peticion(mundoDeUnaSola(), { oficio: 'botica' }));

    // La degradación silenciosa que §6h persigue sería devolver `entradas: []` con
    // `hayLista: true`: una lista vacía que parece una lista.
    assert.equal(lista.hayLista, false);
    assert.deepEqual(lista.bloques, ['sin-reparto', 'andar-sin-nada']);
    assert.equal(lista.bloques.includes('lista'), false, 'la pantalla monta la lista y la oferta a la vez');
    assert.ok(lista.motivo, 'la falta de reparto llega sin motivo');
    assert.ok(Object.values(MOTIVOS_DE_FALTA).includes(lista.motivo), `el motivo "${lista.motivo}" no está en el vocabulario`);
    assert.equal(lista.sinReparto.motivo, lista.motivo);
    assert.deepEqual(lista.entradas, []);
  });
});

// ── El estirón ──────────────────────────────────────────────────────────────────

describe('El estirón se ofrece y nunca se impone', () => {
  test('Si el filtro deja el mundo sin reparto, se ofrece el estirón', () => {
    const mundo = mundoSinRepartoPorElFiltro();
    const pet = peticion(mundo, { tramo: TRAMO_SIN_REPARTO, criterios: ['escalones'] });

    // Sin criterios este mundo sí reparte: es lo que permite atribuir la falta al filtro.
    const sinCriterios = componeLoQueHayHoy({ ...pet, criterios: [] });
    assert.equal(sinCriterios.hayLista, true);

    const falta = componeLoQueHayHoy(pet);
    assert.equal(falta.hayLista, false);
    assert.equal(falta.motivo, MOTIVOS_DE_FALTA.FILTRO);
    // El juego dice que por aquí cerca no hay hoy gran cosa que contar…
    assert.equal(falta.sinReparto.texto, 'Por aquí cerca no hay hoy gran cosa que contar.');
    // …y ofrece alejarse un tramo más…
    assert.ok(falta.estiron, 'no se ofrece ningún estirón');
    assert.equal(falta.estiron.tramosMas, TRAMOS_DEL_ESTIRON);
    assert.equal(falta.estiron.alcanceEnTramos, falta.alcanceEnTramos + TRAMOS_DEL_ESTIRON);
    assert.equal(falta.estiron.texto, 'Alejarse un poco más');
    // …pero no lo impone.
    assert.equal(falta.estiron.impuesto, false);
    assert.equal(falta.estiron.aceptado, false);
  });

  test('La oferta que no se acepta deja la lista como estaba y salir a andar sigue disponible', () => {
    const mundo = mundoSinRepartoPorElFiltro();
    const antes = huellaDelGrafo(mundo.viario);
    const pet = peticion(mundo, { tramo: TRAMO_SIN_REPARTO, criterios: ['escalones'] });

    const primera = componeLoQueHayHoy(pet);
    const otraVez = componeLoQueHayHoy(pet);
    assert.equal(JSON.stringify(otraVez), JSON.stringify(primera), 'algo se ha ampliado solo entre dos composiciones idénticas');
    assert.equal(primera.tramosDeMas, 0, 'no responder ha ampliado el alcance');
    assert.equal(huellaDelGrafo(mundo.viario), antes, 'ofrecer el estirón ha tocado el mundo');

    // Y la línea de siempre sigue ahí, que es lo que impide que la oferta sea la única salida.
    assert.equal(primera.bloques.includes('andar-sin-nada'), true);
    assert.match(primera.andarSinNada, /salir a andar sin coger ninguna/);
  });

  test('El estirón aceptado compone otra lista con un tramo más, y el mundo es idéntico byte a byte', () => {
    const mundo = mundoSinRepartoPorElFiltro();
    const antes = JSON.stringify(mundo.casting);
    const huella = huellaDelGrafo(mundo.viario);
    const pet = peticion(mundo, { tramo: TRAMO_SIN_REPARTO, criterios: ['escalones'] });

    const estirada = aceptaElEstironDeHoy(pet);
    assert.equal(estirada.hayLista, true, 'aceptar el estirón no compone ninguna lista');
    assert.equal(estirada.entradas.length, 1);
    assert.equal(estirada.tramosDeMas, TRAMOS_DEL_ESTIRON);
    assert.equal(estirada.alcanceEnTramos, componeLoQueHayHoy(pet).alcanceEnTramos + TRAMOS_DEL_ESTIRON);

    // El estirón alarga hasta dónde te mandan y nunca resiembra qué existe.
    assert.equal(huellaDelGrafo(mundo.viario), huella, 'aceptar el estirón ha generado o resembrado algo del mundo');
    assert.equal(JSON.stringify(mundo.casting), antes, 'aceptar el estirón ha cambiado el casting');

    // Y esa segunda lista se ofrece igual que la primera: los mismos dos bloques.
    assert.deepEqual(estirada.bloques, ['lista', 'andar-sin-nada']);
    assert.equal(estirada.andarSinNada, componeLoQueHayHoy(peticion(mundoDeUnaSola())).andarSinNada);
  });

  test('El estirón no se encadena solo', () => {
    // Un mundo al que no se llega ni con el tramo de más: la segunda falta se declara sin
    // ofrecer otro estirón, porque el alcance de más es de un tramo y encadenarlo sería el
    // juego decidiendo cuánto andas.
    const mundo = mundoSinRepartoPorElFiltro();
    const pet = peticion(mundo, { tramo: TRAMO_QUE_NO_LLEGA });

    const primera = componeLoQueHayHoy(pet);
    assert.equal(primera.hayLista, false);
    assert.ok(primera.estiron, 'la primera falta no ofrece estirón');
    assert.equal(primera.yaEstirado, false);

    const segunda = aceptaElEstironDeHoy(pet);
    assert.equal(segunda.hayLista, false, 'el mundo que no llega ha repartido con un tramo más');
    assert.equal(segunda.estiron, null, 'se encadena un segundo estirón automático');
    assert.equal(segunda.yaEstirado, true, 'la segunda falta no declara que ya se estiró');
    assert.equal(segunda.tramosDeMas, TRAMOS_DEL_ESTIRON);
    // Y la falta se sigue declarando entera: motivo y línea de andar sin coger nada.
    assert.ok(segunda.motivo);
    assert.equal(segunda.bloques.includes('andar-sin-nada'), true);
  });

  test('La oferta del estirón habla como mundo, sin cifras y sin nombrar el filtro', () => {
    const falta = componeLoQueHayHoy(peticion(mundoSinRepartoPorElFiltro(), { tramo: TRAMO_SIN_REPARTO, criterios: ['escalones'] }));

    for (const texto of [falta.sinReparto.texto, falta.estiron.texto, falta.andarSinNada]) {
      assert.deepEqual(cifrasDeTexto(texto), [], `la oferta lleva una cifra: «${texto}»`);
      assert.deepEqual(vozDeTexto(texto), [], `la oferta habla de lo que no habla el mundo: «${texto}»`);
      for (const palabra of ['filtro', 'accesibilidad', 'tramo', 'criterio', 'escalones']) {
        assert.equal(new RegExp(palabra, 'i').test(texto), false, `la oferta menciona "${palabra}": «${texto}»`);
      }
    }
    // El motivo sí viaja en el dato, que es donde tiene que estar: el silencio es hacia
    // quien juega, nunca hacia el dato.
    assert.equal(falta.motivo, MOTIVOS_DE_FALTA.FILTRO);
  });
});

// ── La ficha ────────────────────────────────────────────────────────────────────

describe('La ficha de la aventura', () => {
  test('La ficha enseña la forma del lazo entera y nombra solo la primera parada', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero()));
    const entrada = lista.entradas[0];
    const ficha = componeFicha({ entrada });

    assert.deepEqual(ficha.bloques, [...BLOQUES_DE_LA_FICHA]);
    assert.equal(ficha.lazo.cerrado, true);
    assert.equal(ficha.lazo.paradas.length, entrada.beats.length, 'el lazo no dibuja todas las paradas');
    assert.deepEqual(ficha.lazo.paradas.map((p) => p.n), entrada.beats.map((_, i) => i + 1), 'las paradas no van numeradas en orden');

    // Solo la primera lleva nombre; las demás están dibujadas y sin él.
    assert.ok(ficha.primeraParada, 'la primera parada no tiene nombre');
    assert.equal(ficha.lazo.paradas[0].nombre, ficha.primeraParada);
    for (const parada of ficha.lazo.paradas.slice(1)) {
      assert.equal(parada.nombre, null, `la parada ${parada.n} está rotulada y no debería`);
    }
    assert.match(ficha.empiezas, new RegExp(ficha.primeraParada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    // Y el recorrido entero viaja: el lazo va completo desde el principio, no revelado.
    assert.ok(ficha.lazo.recorrido.length >= 2);
  });

  test('El pie dice la palabra del mundo, el tiempo aproximado y «vuelves donde empiezas»', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero()));
    for (const entrada of lista.entradas.filter((e) => e.clase === CLASES_DE_ENTRADA.AVENTURA)) {
      const ficha = componeFicha({ entrada });
      assert.equal(ficha.pie, `${entrada.medida} · vuelves donde empiezas`);
      assert.match(ficha.pie, /vuelves donde empiezas$/);
      // Ninguna distancia: la hora orientativa es lo único de las mecánicas que se dice en
      // voz alta. Se revisan los textos que compone esta pantalla; el título y el gancho
      // son prosa del catálogo y los revisa SPEC-017 con sus propias reglas.
      const suyos = [ficha.pie, ...ficha.acciones.map((a) => a.texto)];
      for (const texto of suyos) {
        assert.deepEqual(
          cifrasDeTexto(texto, { salvo: ['tiempo'] }),
          [],
          `la ficha de "${entrada.id}" lleva una cifra de distancia o de progreso: «${texto}»`,
        );
      }
      // Y la línea de por dónde se empieza, con el nombre del sitio fuera: el nombre lo
      // pone el mundo y lo revisa el índice de nombres.
      const sinSitio = ficha.empiezas.replace(ficha.primeraParada, '');
      assert.deepEqual(cifrasDeTexto(sinSitio), [], `la línea de por dónde se empieza lleva una cifra: «${ficha.empiezas}»`);
    }
  });

  test('Una ficha sobre un lazo que no cierra falla antes que mentir', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero()));
    const entrada = lista.entradas[0];

    // SPEC-010 garantiza que todo lazo casteado cierra; una ficha que dijera «vuelves
    // donde empiezas» sobre uno abierto estaría mintiendo.
    const abierto = { ...entrada, lazo: { ...entrada.lazo, recorrido: entrada.lazo.recorrido.slice(0, -1) } };
    assert.throws(() => componeFicha({ entrada: abierto }), (e) => {
      assert.match(e.message, new RegExp(entrada.id));
      assert.match(e.message, /vuelves donde empiezas/);
      return true;
    });
    assert.throws(() => componeFicha({ entrada: { ...entrada, lazo: { trazado: false } } }), /no cierra/);
    assert.throws(() => componeFicha({ entrada: { ...entrada, beats: [] } }), /sin beats/);
    assert.throws(
      () => componeFicha({ entrada: { ...entrada, beats: [{ lugar: { x: 0, y: 0 } }, ...entrada.beats.slice(1)] } }),
      /primera parada/,
    );
  });

  test('Un recado no tiene ficha: se coge desde la lista', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero(), { entregas: colaConDosRecados(), mapaId: MAPA }));
    const recado = lista.entradas.find((e) => e.clase === CLASES_DE_ENTRADA.RECADO);
    assert.throws(() => componeFicha({ entrada: recado }), (e) => {
      assert.match(e.message, /recado/);
      assert.match(e.message, new RegExp(CLASES_DE_ENTRADA.RECADO));
      return true;
    });
    assert.throws(() => componeFicha({ entrada: null }), /no llegó ninguna/);
  });

  test('El gancho es el del narrador si lo hubo y el de plantilla si no, y la pantalla es la misma', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero()));
    const entrada = lista.entradas[0];

    const dePlantilla = componeFicha({ entrada });
    assert.equal(dePlantilla.gancho.origen, 'plantilla');
    assert.equal(dePlantilla.gancho.texto, entrada.gancho);

    const delNarrador = componeFicha({ entrada, gancho: { texto: 'Alguien te espera donde el camino se dobla.', origen: 'llm' } });
    assert.equal(delNarrador.gancho.origen, 'llm');
    assert.equal(delNarrador.gancho.texto, 'Alguien te espera donde el camino se dobla.');

    // La pantalla es la misma en los dos casos: quien pinta no puede distinguirlos, y por
    // eso el origen viaja al lado del texto y no dentro de él.
    assert.deepEqual(delNarrador.bloques, dePlantilla.bloques);
    assert.equal(JSON.stringify({ ...delNarrador, gancho: null }), JSON.stringify({ ...dePlantilla, gancho: null }));
    assert.deepEqual(Object.keys(delNarrador.gancho).sort(), ['origen', 'texto']);
  });

  test('Las dos acciones de la ficha son quedársela y volver a la lista', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero()));
    const ficha = componeFicha({ entrada: lista.entradas[0] });
    assert.deepEqual(ficha.acciones.map((a) => a.id), [...ACCIONES_DE_LA_FICHA]);
    assert.equal(ficha.acciones[0].texto, 'Me la quedo');
    assert.equal(ficha.acciones[1].texto, 'Otra cosa');
    assert.equal(ficha.acciones[0].nivel, 'primero');
    assert.equal(ficha.acciones[1].nivel, 'segundo');
    // Y no hay ninguna tercera: nada de cancelar, nada de guardar para luego.
    assert.equal(ficha.acciones.length, 2);
  });
});

// ── Aceptar ─────────────────────────────────────────────────────────────────────

describe('Aceptar una entrada de la lista', () => {
  /** Una partida con la salida ya abierta, que es como se llega a aceptar nada. */
  function partidaConSalida() {
    const salidas = estadoDeSalidaAbierta();
    abreSalida(salidas, { salida: 'casa/d23/s1', mapaId: MAPA });
    return salidas;
  }

  test('«Me la quedo» deja la aventura aceptada y pasa a la preparación', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero()));
    const salidas = partidaConSalida();
    const aceptada = aceptaLaEntrada({ lista, id: lista.entradas[0].id, salidas });

    assert.equal(aceptada.aceptada, lista.entradas[0].id);
    assert.equal(aceptada.clase, CLASES_DE_ENTRADA.AVENTURA);
    assert.equal(aceptada.siguiente, 'preparacion', 'lo siguiente a aceptar no es la preparación');
    assert.equal(salidaAbierta(salidas).aventura, lista.entradas[0].id);
  });

  test('«Otra cosa» vuelve a la lista con las mismas entradas y sin haber aceptado nada', async () => {
    const mundo = await costero();
    const lista = componeLoQueHayHoy(peticion(mundo));
    const salidas = partidaConSalida();

    // Abrir la ficha y volver no toca nada: la ficha se compone y se descarta.
    componeFicha({ entrada: lista.entradas[1] });
    assert.equal(salidaAbierta(salidas).aventura, null, 'mirar una ficha ha aceptado la aventura');

    const otraVez = componeLoQueHayHoy(peticion(mundo));
    assert.deepEqual(otraVez.entradas.map((e) => e.id), lista.entradas.map((e) => e.id));
  });

  test('Una aventura aceptada no admite una segunda: hay una salida y una aventura', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero()));
    const salidas = partidaConSalida();
    aceptaLaEntrada({ lista, id: lista.entradas[0].id, salidas });

    assert.throws(() => aceptaLaEntrada({ lista, id: lista.entradas[1].id, salidas }), (e) => {
      assert.match(e.message, new RegExp(lista.entradas[0].id));
      assert.match(e.message, /una salida y una aventura/);
      return true;
    });
    assert.equal(salidaAbierta(salidas).aventura, lista.entradas[0].id, 'la segunda aventura ha pisado a la primera');
  });

  test('Una entrada que ya no está en la lista falla nombrándola, y no acepta otra en su lugar', async () => {
    const lista = componeLoQueHayHoy(peticion(await costero()));
    const salidas = partidaConSalida();

    assert.throws(() => aceptaLaEntrada({ lista, id: 'la-que-ya-no-esta', salidas }), (e) => {
      assert.match(e.message, /la-que-ya-no-esta/);
      for (const entrada of lista.entradas) assert.ok(e.message.includes(entrada.id), `el error no enumera "${entrada.id}"`);
      return true;
    });
    assert.equal(salidaAbierta(salidas).aventura, null, 'se ha aceptado una aventura distinta en su lugar');
  });

  test('Un recado ya aceptado en otra salida falla nombrando el recado', async () => {
    const mundo = await costero();
    const entregas = colaConDosRecados();
    const lista = componeLoQueHayHoy(peticion(mundo, { entregas, mapaId: MAPA }));
    const recado = lista.entradas.find((e) => e.clase === CLASES_DE_ENTRADA.RECADO);

    const primera = partidaConSalida();
    aceptaLaEntrada({ lista, id: recado.id, salidas: primera, entregas, mapaId: MAPA });

    // Otra salida, otro día, el mismo recado: se coge una vez.
    const segunda = estadoDeSalidaAbierta();
    abreSalida(segunda, { salida: 'casa/d24/s1', mapaId: MAPA });
    assert.throws(() => aceptaLaEntrada({ lista, id: recado.id, salidas: segunda, entregas, mapaId: MAPA }), (e) => {
      assert.match(e.message, new RegExp(recado.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(e.message, /una vez/);
      return true;
    });
    assert.equal(salidaAbierta(segunda).aventura, null, 'el recado repetido se ha aceptado igualmente');
  });

  test('Aceptar sin salida abierta y aceptar un recado sin cola fallan nombrando lo que falta', async () => {
    const mundo = await costero();
    const entregas = colaConDosRecados();
    const lista = componeLoQueHayHoy(peticion(mundo, { entregas, mapaId: MAPA }));
    const recado = lista.entradas.find((e) => e.clase === CLASES_DE_ENTRADA.RECADO);

    assert.throws(
      () => aceptaLaEntrada({ lista, id: lista.entradas[0].id, salidas: estadoDeSalidaAbierta() }),
      /ninguna salida abierta/,
    );
    assert.throws(
      () => aceptaLaEntrada({ lista, id: recado.id, salidas: estadoDeSalidaAbierta(), entregas: estadoDeEntregas(), mapaId: null }),
      /cola de entregas/,
    );
  });
});
