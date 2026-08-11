// SPEC-049 · **La secuencia del telón y el cierre que la echa**, desde el lado de la app.
//
// Qué se prueba aquí y qué no. Qué entra en un telón, en qué orden van sus pantallas, cómo
// acabó la aventura, qué se ingresa y qué se entinta es del paquete y está probado de arriba
// abajo en `test/nucleo/telon.test.mjs` desde SPEC-036. Lo que faltaba, y esta fila entrega,
// es **alguien que lo llame**: `app/marcha/cierre.js`, la identidad única de
// `app/marcha/identidad.js`, la pantalla de `app/pantallas/telon.jsx` y su montaje. Aquí se
// prueba ese cableado, que es el único sitio donde se puede equivocar.
//
// Tres decisiones de este fichero que no son de estilo:
//
// - **El telón se echa por la puerta de la app y no por la del paquete.** `echaElTelon` recibe
//   catorce cosas; lo que esta fila entrega es quién las reúne. Llamar al paquete directamente
//   —que es lo que hace `bucle-completo.test.mjs`— habría vuelto a pasar en verde con el telón
//   sin echarse nunca en el aparato.
// - **Las pantallas se afirman leyendo su fuente.** `app/pantallas/telon.jsx` lleva JSX y no se
//   puede importar desde `node --test` sin toolchain, así que lo que se comprueba es lo que
//   monta y lo que **no** monta.
// - **Ni red, ni reloj, ni azar.** El día y la vía llegan inyectados y los datos de OSM salen
//   de los fixtures congelados.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «El mapa se entinta al
// echar el telón», «El mapa no cambia durante la salida», «Un paseo sin aventura tiene telón
// completo menos desenlace», «El rumor solo aparece si el desenlace era notable», «El cierre en
// corto ocupa el sitio del desenlace», «Un día sin descubrir nada enseña el mapa igual», «El
// telón no enseña la propagación», «El telón espera a que lo leas» y «Volver a casa cierra la
// salida». Lo demás va declarado como hueco de la batería en `test/spec-test-map.json`: la
// batería describe qué hace el juego, no cómo está cableado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEL_NUCLEO,
  echaElTelonDeLaSalida,
  laEntradaDelDiaRecompuesta,
  llegadasDeLaSalida,
  lugarDelCierre,
  nucleoDelCierre,
  pendientesDeLaSalida,
  plantillaDelCatalogo,
  porDondeSePaso,
  viaDelCierre,
} from '../../app/marcha/cierre.js';
import { identidadDeLaSalidaViva, identidadDeSalida } from '../../app/marcha/identidad.js';
import { congelaConocimiento } from '../../packages/nucleo/partida/conocimiento.js';
import { congelaDiario } from '../../packages/nucleo/partida/diario.js';
import { salidaAbierta } from '../../packages/nucleo/partida/salida-abierta.js';
import {
  MOTIVOS_DE_CIERRE,
  abreSalida as abreLaVidaDeLaSalida,
  cierraLaSalida as cierraLaVidaDeLaSalida,
  estadoDeSalidas,
  marcaElTelonComoLeido,
  queOfreceAlAbrirLaApp,
  telonPendiente,
} from '../../packages/nucleo/partida/salidas.js';
import { ESTADOS_DEL_TELON, TEXTOS as TEXTOS_DEL_TELON } from '../../packages/nucleo/partida/telon.js';
import { VIAS_DE_CIERRE } from '../../packages/nucleo/partida/salida-abierta.js';
import { fuenteDePosiciones, rotuloQueFunciona } from '../dobles/rotulo-del-sistema.mjs';
import { DIA, NUCLEO_DEL_CIERRE_DE_SALIDA, andaElLazoConLaApp, partidaAbierta } from './cableado-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';

const TELON = 'app/pantallas/telon.jsx';
const MONTADO = 'app/pantallas/telon-montado.jsx';
const LAMINA = 'app/render/lamina.jsx';

/** El calendario de la partida, parado en su día. Llega inyectado: el núcleo no lee el reloj. */
const calendario = (dia = DIA) => ({ dia: () => dia });

/** El punto de partida y la marca con los que se abre la vida de una salida. */
const PARTIDA = { lat: 42.40, lon: -8.81 };
const T0 = 1_000_000;

/** La primera casteada del mundo, que es con la que se anda cuando da igual cuál sea. */
const LA_PRIMERA = () => true;

/** Lo mismo que la fuente, sin comentarios: las cabeceras nombran lo que la pantalla no lleva. */
const sinComentarios = (ruta) => fuente(ruta)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\s\/\/.*$/gm, '');

/**
 * Deja la vida de la salida cerrada sin leer, que es lo que hace que la app enseñe el telón.
 *
 * Va por las transiciones de verdad de `partida/salidas.js` y no escribiendo el área a mano:
 * el motivo que se anota ahí es lo único de lo que sale la vía del cierre, y escribirlo a mano
 * probaría la traducción contra una idea de los motivos en vez de contra ellos.
 */
function cierraLaVida(estado, { motivo = MOTIVOS_DE_CIERRE.REGRESO, salida = 'casa/s1', mapa = 'casa' } = {}) {
  const rotulo = rotuloQueFunciona();
  const abre = abreLaVidaDeLaSalida(estado.salidas, {
    salida, mapa, partida: PARTIDA, tMs: T0, mundo: 'Reinos da Brétema', rotulo, fuente: fuenteDePosiciones(),
  });
  assert.equal(abre.abierta, true, `la vida de la salida no se abrió: ${abre.motivo ?? ''}`);
  return cierraLaVidaDeLaSalida(estado.salidas, { motivo, rotulo });
}

/** Echa el telón de una partida ya andada, por la puerta de la app. */
function echa(p, { dia = DIA } = {}) {
  return echaElTelonDeLaSalida({
    nucleo: NUCLEO_DEL_CIERRE_DE_SALIDA,
    estado: p.estado,
    registro: p.registro,
    calendario: calendario(dia),
    mundo: p.mundo,
    mapaId: p.mapaId,
  });
}

// ── El telón se echa, y quién lo echa ──────────────────────────────────────────

describe('El telón se echa, y quién lo echa', () => {
  test('Volver a casa cierra la salida', async () => {
    // La vida de la salida queda con el telón **sin leer** y el registro de la salida abierta
    // **sigue abierto**, esperando a que el telón se eche. Hasta esta fila `antes-de-salir.jsx`
    // lo cerraba por su cuenta y `echaElTelon` fallaba con «su telón ya se echó».
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const cerrada = cierraLaVida(p.estado);

    assert.equal(cerrada.notifica, false, 'cerrar la salida ha emitido una notificación');
    assert.equal(cerrada.ponePrimerPlano, false, 'cerrar la salida ha puesto la app en primer plano');
    assert.equal(queOfreceAlAbrirLaApp(p.estado.salidas), 'telon', 'con la salida cerrada sin leer la app no ofrece el telón');
    assert.ok(salidaAbierta(p.estado.aventuras), 'el registro de la salida abierta se cerró antes de echar el telón, y entonces el telón ya no se puede echar');
  });

  test('«Dejarlo aquí» entra por la misma puerta y no cierra el registro de la salida abierta', () => {
    // Se lee de la fuente porque quien lo hacía era la pantalla, y lo que esta fila corrige es
    // exactamente esa llamada: dos caminos serían dos sitios donde equivocarse con la identidad.
    const antesDeSalir = sinComentarios('app/pantallas/antes-de-salir.jsx');
    assert.ok(
      !/cierraLaSalida\(/.test(antesDeSalir),
      'el momento antes de salir vuelve a cerrar el registro de la salida abierta por su cuenta, y con eso el telón no se puede echar',
    );
    assert.ok(!/VIAS_DE_CIERRE/.test(antesDeSalir), 'la pantalla vuelve a elegir la vía del cierre, que la decide el cierre');
    assert.match(antesDeSalir, /alEcharElTelon\(\)/, '«dejarlo aquí» ya no dispara el mismo cierre que volver a casa');
  });

  test('Las tres vías de cierre echan el telón por la misma puerta, y la vía sale del motivo anotado', async () => {
    const vias = [
      [MOTIVOS_DE_CIERRE.REGRESO, VIAS_DE_CIERRE.VOLVER],
      [MOTIVOS_DE_CIERRE.ROTULO, VIAS_DE_CIERRE.DEJARLO_AQUI],
      [MOTIVOS_DE_CIERRE.PORTADA, VIAS_DE_CIERRE.DEJARLO_AQUI],
    ];
    // Volver es volver; las otras dos son dejarlo. Son dos vocabularios distintos a propósito.
    for (const [motivo, via] of vias) {
      assert.equal(viaDelCierre(NUCLEO_DEL_CIERRE_DE_SALIDA, motivo), via, `el motivo "${motivo}" no se traduce a la vía "${via}"`);
    }

    for (const [motivo] of vias) {
      const p = await partidaAbierta({ cumple: LA_PRIMERA });
      andaElLazoConLaApp({ ...p, casteada: p.casteada });
      cierraLaVida(p.estado, { motivo });
      const echado = echa(p);
      assert.ok(echado.telon, `la vía "${motivo}" no ha echado ningún telón`);
      assert.ok(echado.telon.pantallas.length >= 2, `la vía "${motivo}" ha echado un telón con ${echado.telon.pantallas.length} pantalla(s)`);
      assert.equal(telonPendiente(p.estado.salidas)?.motivo, motivo);
    }
  });

  test('El telón se echa una sola vez: volver a pedirlo no entinta dos veces ni ingresa el oro dos veces', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    andaElLazoConLaApp({ ...p, casteada: p.casteada });
    cierraLaVida(p.estado);

    const primero = echa(p);
    assert.ok(primero.telon, 'el primer telón no se ha echado');
    const conocimiento = JSON.stringify(congelaConocimiento(p.estado.conocimiento));
    const oro = p.estado.oro ? JSON.stringify(p.estado.oro) : null;

    // Quien decide si ya se echó no es una bandera de la capa: es el propio estado. `echaElTelon`
    // cierra el registro de la salida abierta en su paso 9, así que pedirlo otra vez falla.
    assert.equal(salidaAbierta(p.estado.aventuras), null, 'el cierre no ha cerrado el registro de la salida abierta en su paso 9');
    assert.throws(() => echa(p), /ninguna salida abierta cuyo telón echar/);
    assert.equal(JSON.stringify(congelaConocimiento(p.estado.conocimiento)), conocimiento, 'pedir el telón dos veces ha vuelto a entintar');
    if (oro) assert.equal(JSON.stringify(p.estado.oro), oro, 'pedir el telón dos veces ha vuelto a ingresar el oro');
  });

  test('Una aventura terminada compone su desenlace desde la plantilla del catálogo', async () => {
    const p = await partidaAbierta({ cumple: (c) => c.tpl.rumor?.notable });
    const andado = andaElLazoConLaApp({ ...p, casteada: p.casteada });
    assert.equal(andado.terminada, true, 'la aventura del caso no se ha terminado y el desenlace no mediría nada');
    cierraLaVida(p.estado);

    const echado = echa(p);
    assert.equal(echado.aventura.comoAcabo, 'terminada', 'la aventura andada entera no se cierra como terminada');
    const estados = echado.telon.pantallas.map((pantalla) => pantalla.estado);
    assert.ok(estados.includes('desenlace'), `el telón de una aventura terminada enseña ${JSON.stringify(estados)}`);
    assert.equal(estados.includes('cierre-en-corto'), false, 'el telón de una aventura terminada enseña el cierre en corto');
    assert.ok(echado.progresion.oro > 0, 'el oro del desenlace no ha ingresado');
  });

  test('El cierre en corto ocupa el sitio del desenlace', async () => {
    // Medio lazo y a casa. La aventura queda a medias y **lo declara el motor**: no se le dice
    // desde fuera, y el texto que se pinta es el de repuesto que la plantilla declara.
    const p = await partidaAbierta({ cumple: (c) => c.tpl.rumor?.notable });
    const andado = andaElLazoConLaApp({ ...p, casteada: p.casteada, hastaBeat: 1 });
    assert.equal(andado.terminada, false, 'medio lazo ha terminado la aventura y el caso no mide nada');
    cierraLaVida(p.estado);

    const echado = echa(p);
    assert.equal(echado.aventura.comoAcabo, 'a-medias');
    const estados = echado.telon.pantallas.map((pantalla) => pantalla.estado);
    assert.equal(estados.indexOf('cierre-en-corto'), 1, `el cierre en corto no ocupa el sitio del desenlace: ${JSON.stringify(estados)}`);
    assert.equal(estados.includes('desenlace'), false, 'el telón enseña el desenlace de una aventura que no se terminó');

    const pantalla = echado.telon.pantallas.find((x) => x.estado === 'cierre-en-corto');
    assert.equal(typeof pantalla.parrafo, 'string');
    assert.ok(pantalla.parrafo.length > 0, 'el cierre en corto llega sin su texto de repuesto');
    // Y el texto es **de la plantilla**, no redactado en `app/`.
    const repuesto = NUCLEO_DEL_CIERRE_DE_SALIDA.repuestoDe(plantillaDelCatalogo(NUCLEO_DEL_CIERRE_DE_SALIDA, p.casteada.plantilla));
    assert.ok(
      [repuesto.sinTi, repuesto.conLoConseguido].includes(pantalla.parrafo),
      'el texto del cierre en corto no es ninguno de los dos repuestos que declara la plantilla',
    );
  });

  test('Un cierre en corto no genera rumor', async () => {
    const p = await partidaAbierta({ cumple: (c) => c.tpl.rumor?.notable });
    andaElLazoConLaApp({ ...p, casteada: p.casteada, hastaBeat: 1 });
    cierraLaVida(p.estado);

    const echado = echa(p);
    assert.equal(echado.rumor, null, 'un cierre en corto ha hecho nacer un rumor');
    assert.equal(echado.telon.pantallas.some((x) => x.estado === 'rumor'), false, 'el telón de un cierre en corto enseña lo que se pone en camino');
  });

  test('Un paseo sin aventura tiene telón completo menos desenlace', async () => {
    const p = await partidaAbierta();
    cierraLaVida(p.estado);
    const echado = echa(p);
    assert.deepEqual(
      echado.telon.pantallas.map((x) => x.estado),
      ['mapa-sin-tinta', 'diario'],
      'un paseo sin aventura y sin llegadas no enseña el mapa y la entrada del diario y nada más',
    );
  });

  test('Un día sin descubrir nada enseña el mapa igual', async () => {
    const p = await partidaAbierta();
    cierraLaVida(p.estado);
    const echado = echa(p);
    const mapa = echado.telon.pantallas[0];
    assert.equal(mapa.estado, 'mapa-sin-tinta');
    assert.deepEqual(mapa.ascensos, [], 'el día sin descubrimientos trae ascensos');
    assert.equal(typeof mapa.titulo, 'string');
    assert.ok(mapa.titulo.length > 0, 'el día sin tinta llega sin título, y entonces el mapa desaparece el día que menos apetece salir');
  });
});

// ── El conocimiento se cobra al telón ──────────────────────────────────────────

describe('El conocimiento se cobra al telón', () => {
  test('El mapa no cambia durante la salida', async () => {
    // El libro de pendientes vive **fuera del estado** a propósito: es lo que hace que esto sea
    // comprobable en vez de una intención escrita.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const antes = JSON.stringify(congelaConocimiento(p.estado.conocimiento));
    const andado = andaElLazoConLaApp({ ...p, casteada: p.casteada });
    assert.ok(andado.validadas.length >= 2, 'no se ha llegado a ningún sitio y el caso no mediría nada');
    assert.equal(JSON.stringify(congelaConocimiento(p.estado.conocimiento)), antes, 'el mapa se ha entintado durante la salida');
  });

  test('El mapa se entinta al echar el telón', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    andaElLazoConLaApp({ ...p, casteada: p.casteada });

    // El libro de pendientes **se deriva** de las llegadas que el área ya guarda: hasta esta
    // fila `apuntaHaberEstado` no tenía ningún llamador de producción y la lista de ascensos
    // habría salido siempre vacía, con RF-BUCLE-012 sin cumplirse nunca.
    const libro = pendientesDeLaSalida(NUCLEO_DEL_CIERRE_DE_SALIDA, { estado: p.estado, mundo: p.mundo, mapaId: p.mapaId });
    assert.ok(NUCLEO_DEL_CIERRE_DE_SALIDA.libroDePendientes, 'el libro de pendientes no está inyectado');
    assert.ok(libro, 'no se ha derivado ningún libro de pendientes de las llegadas de la salida');

    cierraLaVida(p.estado);
    const echado = echa(p);
    assert.ok(echado.ascensos.length >= 1, 'echar el telón no ha entintado ni un sitio, y a esta salida se llegó a varios');
    const mapa = echado.telon.pantallas[0];
    assert.equal(mapa.estado, 'mapa', 'con sitios entintados la primera pantalla sigue siendo la del día sin tinta');
    for (const ascenso of mapa.ascensos) {
      assert.equal(typeof ascenso.nombre, 'string');
      assert.equal(typeof ascenso.escalon, 'string');
      // En palabras del mundo: ni un porcentaje, ni un kilómetro, ni un tiempo, ni una barra.
      assert.ok(!/\d|%/.test(`${ascenso.nombre} ${ascenso.escalon}`), `la lista de ascensos lleva una cifra: ${JSON.stringify(ascenso)}`);
    }
  });

  test('Lo pendiente se reconstruye de las llegadas que el estado guarda y no se pierde con el proceso', async () => {
    // La app puede morir a mitad de camino. Lo que entinta no vive en la memoria de la salida:
    // se deriva del área `llegadas`, así que reconstruirlo es derivarlo y no inventárselo.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    andaElLazoConLaApp({ ...p, casteada: p.casteada });

    const suyas = llegadasDeLaSalida(p.estado, p.mapaId);
    assert.ok(suyas.length >= 2, 'la salida del caso no guardó llegadas y la reconstrucción no mediría nada');
    const derivado = NUCLEO_DEL_CIERRE_DE_SALIDA.libroDePendientes();
    assert.notEqual(
      JSON.stringify(pendientesDeLaSalida(NUCLEO_DEL_CIERRE_DE_SALIDA, { estado: p.estado, mundo: p.mundo, mapaId: p.mapaId })),
      JSON.stringify(derivado),
      'el libro derivado de las llegadas está tan vacío como uno recién hecho',
    );

    // Y los sitios por los que se pasó salen del mismo sitio, en orden y sin repetir.
    const paso = porDondeSePaso(p.estado, p.mapaId);
    assert.deepEqual(paso, [...new Set(paso)], 'la lista de sitios por los que se pasó repite alguno');
    assert.ok(paso.length >= 1);
    // Dónde se cierra el día es el último sitio al que se llegó, y nunca una coordenada.
    assert.equal(lugarDelCierre({ estado: p.estado, mundo: p.mundo, mapaId: p.mapaId, abierta: salidaAbierta(p.estado.aventuras) }), suyas[suyas.length - 1].sitio);
    const nucleo = nucleoDelCierre(NUCLEO_DEL_CIERRE_DE_SALIDA, { estado: p.estado, mundo: p.mundo, mapaId: p.mapaId });
    assert.ok(nucleo === null || typeof nucleo === 'string');
  });

  test('Una salida sin ninguna llegada validada tiene la lista de ascensos vacía y no se disculpa', async () => {
    const p = await partidaAbierta();
    cierraLaVida(p.estado);
    const echado = echa(p);
    assert.deepEqual(echado.ascensos, [], 'una salida sin llegadas ha entintado algo');
    assert.deepEqual(echado.telon.pantallas[0].ascensos, []);
    assert.equal(echado.telon.pantallas[0].estado, 'mapa-sin-tinta');
  });
});

// ── El telón se marca leído con una sola acción, y nunca deja la app encallada ──

describe('El telón se marca leído con una sola acción, y nunca deja la app encallada', () => {
  test('El telón espera a que lo leas', async () => {
    const p = await partidaAbierta();
    cierraLaVida(p.estado);
    assert.equal(queOfreceAlAbrirLaApp(p.estado.salidas), 'telon', 'con el telón sin leer la app abre en la portada');
    marcaElTelonComoLeido(p.estado.salidas);
    assert.equal(queOfreceAlAbrirLaApp(p.estado.salidas), 'portada', 'marcado el telón como leído la app sigue enseñándolo');
  });

  test('Leer el telón deja abrir otra salida', () => {
    // §10h en su forma más barata de romper: si una de las dos salidas no marcara, la app
    // quedaría sin poder abrir ninguna salida jamás, que es un fallo silencioso con forma de
    // app muerta. La mitad de la app se lee de la fuente porque quien lo cablea es `App.js`;
    // la mitad del estado se anda con las transiciones de verdad, al final del caso.
    const app = sinComentarios('app/App.js');
    const bloque = app.slice(app.indexOf('<TelonMontado'), app.indexOf('<TelonMontado') + 1400);
    for (const salida of ['alLeido', 'alDiario']) {
      assert.match(bloque, new RegExp(`${salida}=\\{\\(\\) => \\{[\\s\\S]*?marcaElTelonComoLeido\\(\\)`), `la salida "${salida}" del telón no marca el telón como leído`);
    }
    assert.match(bloque, /alDiario=\{\(\) => \{[\s\S]*?setConsulta\('diario'\)/, '«Ver el diario entero» no lleva al diario');

    // Y avanzar de pantalla **no marca nada**: lo marca un toque de quien lo lee.
    const montado = sinComentarios(MONTADO);
    const avanzar = montado.split('\n').filter((l) => l.includes('alSeguir={'));
    assert.equal(avanzar.length, 1, `el montaje del telón cablea "alSeguir" en ${avanzar.length} sitios`);
    assert.ok(!/alLeido|marcaElTelon/.test(avanzar[0]), 'avanzar de pantalla marca el telón como leído, y entonces lo marca el paso de algo');
    assert.match(avanzar[0], /setPasada/, 'avanzar de pantalla no mueve la secuencia');

    // Y la otra mitad del escenario, sobre el estado: con el telón sin leer no se abre nada y
    // el motivo es el del vocabulario cerrado; marcado, la salida nueva se abre.
    const estado = { salidas: estadoDeSalidas() };
    cierraLaVida(estado);
    assert.throws(
      () => abreLaVidaDeLaSalida(estado.salidas, {
        salida: 'casa/s2', mapa: 'casa', partida: PARTIDA, tMs: T0, mundo: 'Reinos da Brétema', rotulo: rotuloQueFunciona(), fuente: fuenteDePosiciones(),
      }),
      /todavía sin leer/,
      'se ha podido abrir una salida nueva con el telón sin leer',
    );
    marcaElTelonComoLeido(estado.salidas);
    const otra = abreLaVidaDeLaSalida(estado.salidas, {
      salida: 'casa/s2', mapa: 'casa', partida: PARTIDA, tMs: T0, mundo: 'Reinos da Brétema', rotulo: rotuloQueFunciona(), fuente: fuenteDePosiciones(),
    });
    assert.equal(otra.abierta, true, `marcado el telón como leído la salida nueva sigue sin abrirse: ${otra.motivo ?? ''}`);
  });

  test('La avería del telón conserva la acción que lo marca como leído', () => {
    // Una app que no puede marcar el telón como leído no puede volver a salir nunca. Por eso la
    // avería se enseña **con su acción**, y su rótulo sale del paquete como todo lo demás.
    const montado = sinComentarios(MONTADO);
    const averia = montado.slice(montado.indexOf('testID="telon-sin-cablear"'));
    assert.match(averia, /testID="telon-cerrar"/, 'la avería del telón no lleva la acción que lo marca como leído');
    assert.match(averia, /onPress=\{alLeido\}/, 'la acción de la avería no marca el telón como leído');
    assert.match(averia, /TEXTOS_DEL_TELON\.cerrar/, 'el rótulo de la avería se redacta en app/');
    assert.equal(typeof TEXTOS_DEL_TELON.cerrar, 'string');
  });

  test('La app cerrada entre echar el telón y marcarlo como leído enseña la entrada del día recompuesta', async () => {
    // La decisión asumida de la spec, y no un hueco: volver a echarlo entintaría dos veces e
    // ingresaría el oro dos veces, y una avería sin acción dejaría la app encallada.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    andaElLazoConLaApp({ ...p, casteada: p.casteada });
    cierraLaVida(p.estado);
    echa(p);

    // Ya no hay salida abierta: el telón se echó y el telón sigue sin leerse.
    assert.equal(salidaAbierta(p.estado.aventuras), null);
    assert.equal(queOfreceAlAbrirLaApp(p.estado.salidas), 'telon');

    const ultima = laEntradaDelDiaRecompuesta({ nucleo: NUCLEO_DEL_CIERRE_DE_SALIDA, estado: p.estado, mapaId: p.mapaId });
    assert.equal(ultima.estado, 'diario', 'lo que se recompone no es la entrada del día');
    assert.equal(ultima.acciones.length, 2, 'la entrada del día recompuesta ha perdido alguna de sus dos salidas');

    // Y el montaje lo intenta **en ese orden**: echarlo, y si no se pudiera, recomponerlo.
    const montado = sinComentarios(MONTADO);
    assert.ok(montado.indexOf('echaElTelonDeLaSalida') < montado.indexOf('laEntradaDelDiaRecompuesta'), 'el montaje recompone antes de intentar echar el telón');
  });

  test('Sin la entrada del diario en la partida, recomponer falla en vez de inventarse lo que pasó', async () => {
    const p = await partidaAbierta();
    assert.throws(
      () => laEntradaDelDiaRecompuesta({ nucleo: NUCLEO_DEL_CIERRE_DE_SALIDA, estado: p.estado, mapaId: p.mapaId }),
      /no hay ninguna manera honesta de recomponer/,
    );
    assert.deepEqual(JSON.parse(JSON.stringify(congelaDiario(p.estado.diario))).mapas?.[p.mapaId] ?? [], []);
  });
});

// ── La secuencia del telón en pantalla ─────────────────────────────────────────

describe('La secuencia del telón en pantalla', () => {
  test('Cada estado del vocabulario cerrado tiene su dibujo y ninguno se salta', () => {
    const pantalla = sinComentarios(TELON);
    for (const estado of ESTADOS_DEL_TELON) {
      assert.match(pantalla, new RegExp(`'${estado}'`), `el telón no dibuja el estado "${estado}", que el paquete emite`);
    }
    // Y un estado que no esté en la lista **se enseña** en lugar de saltarse.
    assert.match(pantalla, /ESTADOS_DEL_TELON\.includes/, 'un estado desconocido se saltaría en silencio');
  });

  test('Toda pantalla del telón salvo la última tiene una sola acción y ninguna flecha de volver', () => {
    const pantalla = sinComentarios(TELON);
    assert.match(pantalla, /testID="telon-seguir"/, 'las pantallas intermedias no tienen la acción de seguir');
    assert.match(pantalla, /pantalla\.estado === 'diario' \?/, 'las dos salidas no cuelgan de que la pantalla sea la del diario');
    for (const patron of [/testID="(volver|atras|cabecera-atras|boton-atras|saltar)"/, /barra-de-pestanas/, /indicador-de-pantalla/]) {
      assert.ok(!patron.test(pantalla), `el telón monta ${patron}, y la secuencia no se navega`);
    }

    // Ni una palabra redactada aquí: todo lo que se pinta es una expresión.
    const literales = [...pantalla.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/g)]
      .map((m) => m[1].trim())
      .filter((c) => c && !c.startsWith('{'));
    assert.deepEqual(literales, [], 'la pantalla del telón redacta texto propio, y los textos son del paquete');
  });

  test('El mapa del telón no lleva ninguna leyenda de tintas, y la lámina recibe el entintado', () => {
    const pantalla = sinComentarios(TELON);
    assert.match(pantalla, /entintado=\{pantalla\.entintado\}/, 'la lámina del telón no recibe el entintado, y entonces el mapa no se entinta');
    assert.match(pantalla, /\btelon\b/, 'la lámina del telón no se marca como la del telón');
    for (const patron of [/leyenda/i, /significa/i]) {
      assert.ok(!patron.test(pantalla), `el mapa del telón monta ${patron}: las tres tintas se ven y no se explican`);
    }

    // Y la lámina las pasa al render, que las acepta desde SPEC-036. Aquí no entra ni un color.
    const lamina = sinComentarios(LAMINA);
    assert.match(lamina, /entintado,\s*\n?\s*telon,?/, 'la lámina no pasa el entintado y la marca del telón a la composición de la escena');
    assert.ok(!/#[0-9a-fA-F]{6}/.test(lamina), 'ha entrado un color en el código de dibujo, y ninguno vive ahí');
  });

  test('El telón no enseña la propagación', () => {
    // Al fragmento de A5P3 se le entrega el núcleo de origen y nada más: ni destinos, ni saltos,
    // ni nivel, ni el árbol de calzadas. Se afirma sobre lo que la pantalla le pasa a la lámina.
    const pantalla = sinComentarios(TELON);
    const rumor = pantalla.slice(pantalla.indexOf("pantalla.estado === 'rumor'"), pantalla.indexOf("pantalla.estado === 'diario'"));
    assert.match(rumor, /vistaDelFragmento\(documento, pantalla\.sale\.origen\)/, 'el fragmento no se centra en el núcleo de origen');
    for (const prohibido of ['destino', 'nivel', 'arbol', 'salto', 'llegara']) {
      assert.ok(!new RegExp(`sale\\.${prohibido}`).test(rumor), `el fragmento del rumor pinta "${prohibido}", que la decisión prohíbe`);
    }
    // Y la vista no lleva foco ni escala: es la misma lámina con una vista, no otro dibujo.
    assert.match(pantalla, /foco: null, paraje: null, escala: false/, 'la vista del fragmento lleva algo más que el centro y el radio');
  });

  test('La única cifra de la pantalla del desenlace es la del oro', () => {
    const pantalla = sinComentarios(TELON);
    const desenlace = pantalla.slice(pantalla.indexOf("pantalla.estado === 'desenlace'"), pantalla.indexOf("pantalla.estado === 'rumor'"));
    assert.match(desenlace, /testID="desenlace-oro"/, 'el desenlace no monta la cifra del oro');
    assert.match(desenlace, /pantalla\.rango \?/, 'la frase del rango no es condicional, y sin movimiento no hay frase');
    for (const prohibido of [/porcentaje/i, /\bkm\b/, /barra/i, /progreso/i]) {
      assert.ok(!prohibido.test(desenlace), `el desenlace monta ${prohibido}`);
    }
  });

  test('La cartela del hito aparece una sola vez entre el desenlace y la entrada del diario', () => {
    const pantalla = sinComentarios(TELON);
    assert.match(pantalla, /testID="hito-arranque"/, 'la cartela del hito no se monta');
    assert.match(pantalla, /onPress=\{alCerrarHito\}/, 'la cartela no se cierra tocando');

    // Y una sola vez: el montaje la retira al cerrarla y no la vuelve a poner.
    const montado = sinComentarios(MONTADO);
    assert.match(montado, /const \[hitoCerrado, setHitoCerrado\] = useState\(false\)/, 'el montaje no recuerda que la cartela ya se cerró');
    assert.match(montado, /compuesto\.hito && !hitoCerrado && pantalla\.estado === 'diario'/, 'la cartela no aparece una sola vez entre el desenlace y la entrada del diario');
  });

  test('Los identificadores del telón que SPEC-036 declaró están todos montados', () => {
    // No se inventa ninguno: son los que aquella spec escribió y esta reutiliza literalmente.
    // Que `partida/telon.js` no los declare como dato, al contrario que `quests/escena.js`, es
    // una asimetría real y está anotada en la spec como frontera con dueño.
    const pantalla = fuente(TELON);
    const montado = fuente(MONTADO);
    const declarados = [
      'telon-estado', 'telon-mapa', 'telon-ascensos', 'telon-titulo', 'desenlace-oro',
      'desenlace-rango', 'desenlace-objetos', 'rumor-sale', 'diario-del-dia',
      'diario-lo-propio', 'diario-lo-oido', 'hito-arranque',
    ];
    for (const testid of declarados) {
      assert.match(`${pantalla}${montado}`, new RegExp(`testID="${testid}"`), `falta el data-testid "${testid}" que SPEC-036 declaró`);
    }
    // Y la marca de la salida sigue alcanzable desde el telón, con el mismo valor y el mismo sitio.
    assert.match(montado, /testID="salida-situacion"/, 'la marca de la situación de la salida ha desaparecido del telón');
  });
});

// ── La identidad de una salida, que ahora es una sola ──────────────────────────

describe('Una sola función de identidad de salida', () => {
  test('La identidad la compone una sola función y la salida abierta manda sobre el cálculo', () => {
    // Hasta esta fila había dos —`mapa/dN/sN` sobre `aventuras` y `mapa/sN` sobre `salidas`— y
    // `echaElTelon` comparaba una con otra: la salida no se podía cerrar nunca.
    assert.equal(identidadDeSalida({ mapaId: 'casa', hechos: 0 }), 'casa/s1');
    assert.equal(identidadDeSalida({ mapaId: 'casa', hechos: 7 }), 'casa/s8');
    assert.equal(identidadDeSalida({ mapaId: null, hechos: 0 }), 'sin-mapa/s1');
    assert.throws(() => identidadDeSalida({ mapaId: 'casa', hechos: null }), /contador de hechos/);

    // Con una salida ya abierta se **lee de ella** en lugar de recalcularse: aceptar una
    // aventura anexa un hecho, así que recalcular entre aceptar y echar a andar volvería a dar
    // dos cadenas distintas.
    const abierta = { abierta: { salida: 'casa/s3' } };
    assert.equal(identidadDeLaSalidaViva({ aventuras: abierta, mapaId: 'casa', hechos: 99 }), 'casa/s3');
    assert.equal(identidadDeLaSalidaViva({ aventuras: null, mapaId: 'casa', hechos: 2 }), 'casa/s3');

    // Ninguna marca de tiempo, que es lo cómodo y lo que RF-PRIV-002 prohíbe.
    assert.ok(!/\d{10,}/.test(identidadDeSalida({ mapaId: 'casa', hechos: 4 })), 'la identidad de una salida lleva una marca de tiempo dentro');
  });

  test('Las dos áreas piden la identidad a la misma función', () => {
    const app = sinComentarios('app/App.js');
    assert.match(app, /identidadDeLaSalidaViva\(/, 'la raíz de la app vuelve a componer la identidad por su cuenta');
    assert.ok(
      !/`\$\{mapa\}\/s\$\{cuantos \+ 1\}`/.test(app),
      'la raíz de la app vuelve a componer la cadena de la identidad a mano, y con dos el cierre no encuentra la salida que tiene abierta',
    );
    const antesDeSalir = sinComentarios('app/pantallas/antes-de-salir.jsx');
    assert.ok(!/export function identidadDeSalida/.test(antesDeSalir), 'la pantalla vuelve a tener su propia identidad de salida');
    assert.match(antesDeSalir, /abreSalida\(estado\.aventuras, \{ salida: identidad\(\)/, 'el registro de la salida no se abre con la identidad inyectada');
  });
});

// ── Nada degrada por falta de cableado ─────────────────────────────────────────

describe('Nada degrada por falta de cableado', () => {
  test('Sin cada una de las piezas del cierre, echar el telón falla nombrándola', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    cierraLaVida(p.estado);
    const base = { nucleo: NUCLEO_DEL_CIERRE_DE_SALIDA, estado: p.estado, registro: p.registro, calendario: calendario(), mundo: p.mundo, mapaId: p.mapaId };

    assert.throws(() => echaElTelonDeLaSalida({ ...base, nucleo: null }), /necesita el núcleo inyectado/);
    assert.throws(() => echaElTelonDeLaSalida({ ...base, mundo: null }), /documento del mundo congelado/);
    // Sin el calendario cableado, el cierre falla nombrándolo y no apunta el día cero.
    assert.throws(() => echaElTelonDeLaSalida({ ...base, calendario: null }), /calendario/);

    for (const pieza of DEL_NUCLEO) {
      const cojo = { ...NUCLEO_DEL_CIERRE_DE_SALIDA };
      delete cojo[pieza];
      assert.throws(() => echaElTelonDeLaSalida({ ...base, nucleo: cojo }), new RegExp(pieza), `quitar "${pieza}" no falla nombrándola`);
    }
  });

  test('Sin la plantilla del catálogo de la aventura, el cierre falla nombrándola', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    assert.throws(() => plantillaDelCatalogo(NUCLEO_DEL_CIERRE_DE_SALIDA, 'una-que-no-existe'), /una-que-no-existe/);
    assert.equal(plantillaDelCatalogo(NUCLEO_DEL_CIERRE_DE_SALIDA, p.casteada.plantilla).id, p.casteada.plantilla);

    // Y el cierre entero falla en vez de echar un telón sin desenlace.
    cierraLaVida(p.estado);
    const sinCatalogo = { ...NUCLEO_DEL_CIERRE_DE_SALIDA, CATALOGO: [] };
    assert.throws(() => echaElTelonDeLaSalida({
      nucleo: sinCatalogo, estado: p.estado, registro: p.registro, calendario: calendario(), mundo: p.mundo, mapaId: p.mapaId,
    }), new RegExp(p.casteada.plantilla));
  });

  test('Lo que el cierre le pide al núcleo está enumerado y es lo mismo que se le inyecta', () => {
    const piezas = fuente('app/nucleo/piezas.js');
    const bloque = piezas.slice(piezas.indexOf('export const NUCLEO_DEL_CIERRE_DE_SALIDA'));
    for (const nombre of DEL_NUCLEO) {
      assert.match(bloque, new RegExp(`\\b${nombre}\\b`), `NUCLEO_DEL_CIERRE_DE_SALIDA no inyecta "${nombre}", que cierre.js enumera`);
      assert.ok(NUCLEO_DEL_CIERRE_DE_SALIDA[nombre], `el núcleo de esta prueba no trae "${nombre}"`);
    }
  });
});

// ── Determinismo y privacidad ──────────────────────────────────────────────────

describe('Determinismo y privacidad del telón', () => {
  test('El mismo estado y las mismas entradas componen el mismo telón dos veces', async () => {
    // `@determinismo`, bloqueante. Se compara por serialización completa, que es lo único que
    // afirma «idéntico» de verdad, y **frase de rango incluida**.
    const vuelta = async () => {
      const p = await partidaAbierta({ cumple: (c) => c.tpl.rumor?.notable });
      andaElLazoConLaApp({ ...p, casteada: p.casteada });
      cierraLaVida(p.estado);
      return JSON.stringify(echa(p).telon);
    };
    const primera = await vuelta();
    assert.match(primera, /"estado":"desenlace"/, 'el telón de referencia no trae desenlace y el caso no mediría el determinismo');
    for (let k = 0; k < 2; k += 1) assert.equal(await vuelta(), primera, 'dos telones de la misma partida han salido distintos');
  });

  test('Lo que la partida escribe al echar el telón no lleva ninguna coordenada ni ninguna marca de tiempo', async () => {
    // `@privacidad`, bloqueante. Se mira lo escrito y no el código.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    andaElLazoConLaApp({ ...p, casteada: p.casteada });
    cierraLaVida(p.estado);
    echa(p);

    const escrito = JSON.stringify({
      conocimiento: congelaConocimiento(p.estado.conocimiento),
      diario: congelaDiario(p.estado.diario),
      hechos: p.registro.hechos,
    });
    assert.ok(!/"(lat|lon|latitude|longitude)"\s*:/.test(escrito), 'lo que el cierre escribe lleva una coordenada');
    assert.ok(!/\b1[6-9]\d{11}\b/.test(escrito), 'lo que el cierre escribe lleva una marca de tiempo de época');
    assert.ok(!/"(hora|minuto|tMs|timestamp|instante)"\s*:/.test(escrito), 'lo que el cierre escribe lleva una hora');
  });

  test('Ni el cierre ni el telón hacen ninguna petición de red', () => {
    // `@privacidad`, bloqueante. Ninguna de las tres capas de esta fila importa nada de red ni
    // llama a `fetch`: se afirma sobre la fuente, que es donde una petición tendría que estar.
    for (const ruta of ['app/marcha/cierre.js', 'app/marcha/aventura.js', TELON, MONTADO, 'app/pantallas/escena.js']) {
      const codigo = sinComentarios(ruta);
      assert.ok(!/\bfetch\(/.test(codigo), `${ruta} hace una petición de red`);
      assert.ok(!/XMLHttpRequest|WebSocket|axios/.test(codigo), `${ruta} abre un canal de red`);
    }
  });
});
