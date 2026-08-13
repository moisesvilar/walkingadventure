// SPEC-049 · **A4P3 y A4P4, y el motor que las alcanza**, desde el lado de la app.
//
// Qué se prueba aquí y qué no. La composición de la escena y de lo que te llevas —el titular
// de cada tipo, el cierre por resultado, la variante de franja, las dos vías del objeto, la
// escala de tamaño de letra y que ningún texto se disculpe— es del paquete y está probada de
// arriba abajo en `test/nucleo/escena.test.mjs` desde SPEC-034. Lo que faltaba, y esta fila
// entrega, es **alguien que la llame**: `app/marcha/aventura.js`, el reparto que se recupera
// del mundo congelado en `app/marcha/llegadas.js`, y la pantalla de `app/pantallas/escena.js`
// que se inyecta en la llegada por su tipo de paso. Aquí se prueba ese cableado, que es el
// único sitio donde se puede equivocar.
//
// Tres decisiones de este fichero que no son de estilo:
//
// - **Se anda el lazo por la capa de la app, no por la del paquete.** `bucle-completo.test.mjs`
//   recorre el mismo camino llamando a `creaLlegadas` y a `resuelveBeat` directamente, y por eso
//   pasaba en verde con `estado.aventuras.enCurso` siempre en nulo en el aparato: el defecto
//   vivía en que nadie los llamaba. Aquí se monta `creaLasLlegadas` con su motor colgado, que es
//   exactamente lo que `App.js` monta.
// - **La pantalla se afirma leyendo su fuente.** `app/pantallas/escena.js` lleva JSX y no se
//   puede importar desde `node --test` sin toolchain, así que lo que se comprueba es lo que la
//   pantalla monta y lo que **no** monta. Es el mismo mecanismo con el que `llegadas.test.mjs`
//   afirmaba el hueco declarado que esta fila retira.
// - **Ni red, ni reloj, ni azar.** Los datos de OSM salen de los fixtures congelados, el día y
//   el minuto llegan inyectados y el tiempo del sensor viaja dentro de cada posición.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «La escena queda
// disponible y espera» y «El visor es una capa y debajo está el beat». Lo demás va declarado
// como hueco de la batería en `test/spec-test-map.json`: la batería describe qué hace el juego,
// no cómo está cableado, y el cableado es justo lo que esta fila entrega.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { creaLaAventuraEnCurso, descartesDeLaAventura, DEL_NUCLEO } from '../../app/marcha/aventura.js';
import { REPARTO_SIN_AVENTURA, casteadaDelMundo, repartoDeLaAventuraEnCurso } from '../../app/marcha/llegadas.js';
import {
  acepta,
  aventuraEnCurso,
  cierra,
  congelaAventuras,
  descartesDelCasting,
  levantaAventuras,
} from '../../packages/nucleo/partida/aventura-en-curso.js';
import { IDS_DE_MOTIVO, anclajesDe, anotaDescarte, vistaDeDescartes } from '../../packages/nucleo/partida/descartes.js';
import { PUESTOS, ROTULOS_DE_PUESTO, rotuloDePuesto } from '../../packages/nucleo/partida/puestos.js';
import { componeLoQueHayHoy } from '../../packages/nucleo/partida/lo-que-hay-hoy.js';
import { TIPOS_DE_PASO } from '../../packages/nucleo/partida/secuencia.js';
import { CATALOGO } from '../../packages/nucleo/quests/catalogo.js';
import {
  ESCALA_DE_TEXTO,
  IDS_DE_TAMANO_DE_TEXTO,
  LO_QUE_LA_ESCENA_NO_LLEVA,
  TAMANO_DE_TEXTO_DE_ORIGEN,
  TESTIDS,
  TEXTOS_DEL_TAMANO,
  siguienteTamanoDeTexto,
} from '../../packages/nucleo/quests/escena.js';
import { relojDePared } from '../dobles/reloj-de-pared.mjs';
import {
  DIA,
  MEDIODIA,
  NUCLEO_DE_LA_AVENTURA_EN_CURSO,
  andaElLazoConLaApp,
  capaDeLaApp,
  elCasting,
  partidaAbierta,
} from './cableado-de-prueba.mjs';
import { LOS_CUATRO, fuente } from './mundo-de-prueba.mjs';

/** La fuente de un fichero de la app, sin la coletilla de la ruta en cada aserción. */
const codigoDe = (ruta) => fuente(ruta);

/**
 * Lo mismo sin comentarios.
 *
 * Hace falta porque estas pantallas **nombran lo que no llevan** en su cabecera —«sin retrato»,
 * «nunca Continuar»— y una aserción que buscara esas palabras en el fichero entero se caería
 * por el comentario que las prohíbe, que es medir exactamente lo contrario de lo que dice.
 */
const sinComentarios = (ruta) => codigoDe(ruta)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\s\/\/.*$/gm, '');

const ESCENA = 'app/pantallas/escena.js';
const LLEGADA = 'app/pantallas/llegada.js';
const MONTADA = 'app/pantallas/llegada-montada.jsx';

/** La aventura con la que se anda: la primera casteada del mundo, y la misma siempre. */
const LA_PRIMERA = () => true;

// ── El hueco que esta fila retira, y lo que había debajo ───────────────────────

describe('El paso de beat se monta con su pantalla y no con un hueco', () => {
  test('En el sitio del hueco declarado hay pantalla, y el paso sigue sin poder saltarse', () => {
    const llegada = codigoDe(LLEGADA);

    // El hueco de la fila 44 ya no está, ni su manera de nombrar el paso. Lo que queda en su
    // sitio es la avería de un paso al que no se le inyectó pantalla —`llegada-sin-pantalla`—,
    // que es otra cosa: aquello declaraba que la pantalla no existía y esto declara que
    // alguien montó la llegada a medias.
    assert.ok(!llegada.includes('testID="llegada-hueco"'), 'el hueco declarado de la fila 44 sigue montado y esta fila lo retira por criterio de aceptación');
    assert.ok(!/export function nombraElPaso/.test(llegada), '`nombraElPaso` era del hueco y se va con él');
    assert.match(llegada, /testID="llegada-sin-pantalla"/, 'la avería del paso sin pantalla inyectada ha desaparecido con el hueco, y sin ella el paso se saltaría en silencio');

    // Y el paso sigue nombrándose y sigue teniendo su acción: enseñarlo sin decir cuál es lo
    // haría indistinguible de una pantalla vacía, y enseñarlo sin acción dejaría la app
    // encallada dentro de una salida abierta.
    assert.match(llegada, /testID="llegada-sin-pantalla"[^>]*accessibilityLabel=\{[^}]*tipo\}/, 'la avería no nombra el paso que se quedó sin pantalla');
    assert.match(llegada, /testID="llegada-seguir"/, 'la avería del paso sin pantalla no lleva la acción que lo cierra');

    // La escena entra **por la puerta que la pantalla ya tenía abierta**: por tipo de paso, y
    // no por una ruta. Sin ruta no hay manera de llegar a A4P3 sin haber llegado al sitio.
    assert.match(codigoDe(MONTADA), /\[TIPOS_DE_PASO\.BEAT\]:/, 'la escena no se inyecta por su tipo de paso');
    assert.match(codigoDe(MONTADA), /<PantallaEscena/, 'la llegada montada no monta la pantalla de la escena');
  });

  test('El hueco del telón tampoco queda, y su acción sigue marcando el leído', () => {
    const app = codigoDe('app/App.js');
    assert.ok(!app.includes('telon-sin-pantalla'), 'el hueco del telón que dejó la fila 48 sigue en App.js y esta fila lo sustituye por su pantalla');
    assert.match(app, /<TelonMontado/, 'el telón pendiente ya no monta ninguna pantalla, y con él la app se queda encallada');
    assert.match(app, /marcaElTelonComoLeido\(\)/, 'nadie marca el telón como leído desde la raíz de la app');
  });
});

// ── La pantalla de la escena — A4P3 ────────────────────────────────────────────

describe('La escena de un beat en pantalla', () => {
  test('La escena pinta lo que compone el paquete y no redacta ni una palabra', () => {
    const pantalla = codigoDe(ESCENA);

    // Los ocho identificadores que `quests/escena.js` declara **como dato**, uno a uno: son
    // los que la automatización usa y los que la spec cita, y ninguno se inventa aquí.
    for (const [campo, testid] of Object.entries(TESTIDS)) {
      assert.match(pantalla, new RegExp(`TESTIDS\\.${campo}\\b`), `la pantalla de la escena no monta el identificador "${testid}"`);
    }

    // Y **ningún texto se escribe aquí**: todo lo que se pinta es una expresión, así que no
    // hay una sola cadena redactada en `app/`. Es la regla de `lenguaje.md` convertida en algo
    // que se puede poner rojo, y vale también para la avería.
    const literales = [...pantalla.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/g)]
      .map((m) => m[1].trim())
      .filter((c) => c && !c.startsWith('{'));
    assert.deepEqual(literales, [], 'la pantalla de la escena redacta texto propio, y los textos son del paquete');
  });

  test('La escena tiene una sola acción, con el verbo del marco, y ninguna manera de volver', () => {
    const pantalla = sinComentarios(ESCENA);

    // El rótulo de la acción sale del verbo que declara el marco de la escena, y nunca es un
    // literal: «Continuar» sería un botón de aplicación y desperdiciaría la única línea de
    // acción que tiene la pantalla.
    assert.match(pantalla, /accion\.verbo/, 'la acción de la escena no lleva el verbo que declara el marco');
    // Sobre las cadenas y no sobre el fichero entero: la cabecera nombra «Continuar» para
    // decir que no se usa, y un caso que se cayera por eso estaría midiendo un comentario.
    assert.ok(!/['"`]Continuar['"`]/.test(pantalla), 'la escena rotula su acción con «Continuar», que es un botón de aplicación');

    // Y lo que `LO_QUE_LA_ESCENA_NO_LLEVA` enumera se pone rojo elemento a elemento.
    const prohibidos = {
      'retrato-de-la-cara': /retrato|Image\b|source=\{/i,
      'flecha-de-volver': /testID="(volver|atras|cabecera-atras|boton-atras)"/i,
      'segunda-accion': null,
      'aviso-de-franja': /testID="escena-reloj"|Llegas tarde/i,
      'reloj-en-pantalla': /testID="escena-reloj"/i,
      'lista-de-requisitos': /candado|necesitas|requisito/i,
      'cuantos-beats-quedan': /quedan \d|de \{?\d/i,
    };
    assert.deepEqual(Object.keys(prohibidos).sort(), [...LO_QUE_LA_ESCENA_NO_LLEVA].sort(), 'la lista de ausencias del paquete y la de este caso se han desincronizado');
    for (const [que, patron] of Object.entries(prohibidos)) {
      if (patron) assert.ok(!patron.test(pantalla), `la escena monta "${que}", que el paquete enumera como lo que no lleva`);
    }

    // La segunda acción se cuenta y no se busca por su nombre: en la escena hay exactamente
    // dos elementos tocables —el ajuste de tamaño de letra y la acción— y ninguno más.
    const bloque = pantalla.slice(pantalla.lastIndexOf('testID={TESTIDS.escena}'));
    const tocables = [...bloque.matchAll(/<Pressable\b/g)].length;
    assert.equal(tocables, 2, `la escena tiene ${tocables} elementos tocables y son dos: el tamaño de letra y la única acción`);
  });

  test('El único registro de aplicación de la escena es el ajuste de tamaño de letra', () => {
    const pantalla = codigoDe(ESCENA);

    // La sans es la voz de la aplicación, y **solo el ajuste la tiene**: si otro elemento la
    // llevara, habría dos cosas hablando como aplicación dentro del juego.
    const enSans = [...pantalla.matchAll(/fontFamily: 'sans-serif'/g)].length;
    assert.equal(enSans, 1, `${enSans} elementos de la escena hablan con la voz de la aplicación y solo el ajuste puede`);
    assert.match(pantalla, /TEXTOS_DEL_TAMANO\.etiqueta/, 'la etiqueta del ajuste no sale del paquete');

    // Y su etiqueta no menciona accesibilidad, ni dificultad de lectura, ni ningún modo: es un
    // ajuste del momento para leerle a alguien, no una declaración sobre quien lo toca.
    for (const palabra of ['accesib', 'legib', 'dislex', 'vista cansada', 'modo']) {
      assert.ok(!TEXTOS_DEL_TAMANO.etiqueta.toLowerCase().includes(palabra), `la etiqueta del ajuste menciona "${palabra}"`);
      assert.ok(!TEXTOS_DEL_TAMANO.ayuda.toLowerCase().includes(palabra), `la ayuda del ajuste menciona "${palabra}"`);
    }
  });

  test('El escalón de tamaño de letra vive fuera de la escena y recorre la escala en ciclo', () => {
    // El recorrido cíclico es del paquete: tantos toques como escalones más uno dejan el de
    // origen. Se afirma aquí porque es lo que la pantalla promete y lo que `@app` no puede
    // medir —Maestro no mide tipografías—.
    let vigente = TAMANO_DE_TEXTO_DE_ORIGEN;
    for (let i = 0; i < IDS_DE_TAMANO_DE_TEXTO.length + 1; i += 1) vigente = siguienteTamanoDeTexto(vigente);
    assert.equal(vigente, siguienteTamanoDeTexto(TAMANO_DE_TEXTO_DE_ORIGEN), 'el recorrido del ajuste no es cíclico');
    assert.equal(ESCALA_DE_TEXTO.length, IDS_DE_TAMANO_DE_TEXTO.length);

    // Y **el escalón no vive dentro de la escena**: vive en quien monta el paso. Cada escena se
    // compone de nuevo al repintarse el montaje, así que con el estado dentro el escalón se
    // habría reiniciado al entrar en la escena siguiente, que es justo lo contrario del
    // criterio.
    const montada = codigoDe(MONTADA);
    assert.match(montada, /useState\(TAMANO_DE_TEXTO_DE_ORIGEN\)/, 'el escalón de tamaño de letra no vive en quien monta el paso');
    assert.match(montada, /siguienteTamanoDeTexto/, 'cambiar el tamaño no usa el recorrido que declara el paquete');
    assert.ok(!/useState/.test(codigoDe(ESCENA)), 'la pantalla de la escena guarda estado propio, y entonces el escalón se reiniciaría en cada escena');
  });

  test('El bloque de quien habla se pinta con el rótulo del puesto y nunca con la clave', () => {
    // SPEC-051. Es la mitad que la guarda de recuento dejaba pendiente —«alguien mire si la
    // cara llega a pantalla»— por el lado de la pantalla: la composición se afirma con beats
    // casteados de verdad, y aquí se afirma que A4P3 **monta** ese bloque y **cómo**.
    const pantalla = sinComentarios(ESCENA);

    // El bloque existe, es condicional y no se atenúa: sin cara no se pinta nada. Un
    // marcador de posición o un «anónimo» harían que las escenas sin cara dejaran de verse
    // como hasta hoy, que es justo lo que el patrón de interacción prohíbe.
    assert.match(pantalla, /escena\.cara \?[\s\S]{0,200}testID=\{TESTIDS\.cara\}/, 'el bloque de quien habla no es condicional, y sin cara pintaría un hueco');
    assert.match(pantalla, /escena\.cara\.nombre/, 'la línea de quien habla no pinta el nombre');
    assert.match(pantalla, /escena\.cara\.puesto/, 'la línea de quien habla no pinta el puesto');

    // **La clave del catálogo no aparece en ninguna parte del árbol.** Ni traducida aquí ni
    // escrita a mano: la pantalla pinta lo que el paquete compuso, que ya es el rótulo.
    for (const clave of PUESTOS) {
      assert.ok(!new RegExp(`['"\`]${clave}['"\`]`).test(pantalla), `la escena escribe la clave de puesto "${clave}", que es una etiqueta de catálogo y no una presentación`);
    }
    assert.ok(!/rotuloDePuesto|ROTULOS_DE_PUESTO/.test(pantalla), 'la pantalla traduce el puesto por su cuenta, y entonces hay dos traducciones del mismo dato');

    // Y **no escala con el tamaño de letra**: es un rótulo, no prosa. El escalón se aplica al
    // titular, a la línea que sitúa, al cuerpo y al cierre, y a esta línea no.
    const linea = pantalla.slice(pantalla.indexOf('TESTIDS.cara'));
    assert.ok(!/^[^\n]*escala\(/.test(linea), 'la línea de quien habla escala con el tamaño de letra, y es un rótulo');
  });

  test('En qué mitad del paso de beat se va es del paso y no de la escena', () => {
    // El defecto que la propia fila midió y arregló: la escena se inyecta por tipo de paso, así
    // que React la remonta en cada repintado del montaje —y tocar el ajuste de tamaño de letra
    // provoca uno—. Con el «voy por A4P3 o por A4P4» dentro de la escena, agrandar el texto
    // habría devuelto de lo que te llevas a la escena.
    const montada = codigoDe(MONTADA);
    assert.match(montada, /const \[enLoQueTeLlevas, setEnLoQueTeLlevas\] = useState\(false\)/, 'en qué mitad del paso se va no vive en quien monta el paso');
    assert.match(montada, /setEnLoQueTeLlevas\(false\)/, 'avanzar de paso no reinicia en qué mitad se va, y la escena siguiente abriría por lo que te llevas');
    assert.match(codigoDe(ESCENA), /enLoQueTeLlevas = false/, 'la escena no recibe en qué mitad del paso va: entonces la decide ella');
  });
});

// ── Lo que te llevas — A4P4 ────────────────────────────────────────────────────

describe('Lo que te llevas en pantalla', () => {
  test('Lo que te llevas se pinta con lo suyo, y el último beat no nombra ningún sitio siguiente', async () => {
    const pantalla = codigoDe(ESCENA);
    assert.match(pantalla, /testID=\{TESTIDS\.loQueTeLlevas\}/, 'la segunda mitad del paso no monta su propia pantalla');
    assert.match(pantalla, /loQueTeLlevas\.rotulo/, 'el rótulo «Llevas encima» no sale del paquete');
    assert.match(pantalla, /loQueTeLlevas\.siguienteSitio \?/, 'el bloque de sitio siguiente no es condicional, y en el último beat no lo hay');
    // Un tramo sin nombre propio simplemente no se nombra, y ningún texto lo llama falta.
    assert.match(pantalla, /calzadas\.filter\(Boolean\)/, 'la línea de calzadas no descarta los tramos sin nombre propio');

    // Y sobre lo compuesto de verdad: el último beat de la cadena no trae sitio siguiente y su
    // acción es la misma que la de los demás.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const andado = andaElLazoConLaApp({ ...p, casteada: p.casteada });
    const ultimos = andado.montajes.filter((m) => m.loQueTeLlevas?.ultimo);
    assert.ok(ultimos.length >= 1, 'no se ha llegado a componer lo que te llevas del último beat y el caso no mediría nada');
    for (const m of ultimos) {
      assert.equal(m.loQueTeLlevas.siguienteSitio, null, 'el último beat de la cadena nombra un sitio siguiente que no existe');
      assert.equal(m.loQueTeLlevas.accion.verbo, 'Seguir andando', 'la acción del último beat no es la misma que la de los demás');
    }
  });

  test('Ningún texto de la escena ni de lo que te llevas lleva una cifra', async () => {
    // Sobre lo que se compone de verdad al andar el lazo, y no sobre un ejemplo: ni cuánto
    // falta, ni cuántos beats quedan, ni cuánto oro se lleva.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const andado = andaElLazoConLaApp({ ...p, casteada: p.casteada });
    assert.ok(andado.montajes.length >= 2, 'no se han compuesto escenas suficientes para mirar sus cifras');

    for (const { escena, loQueTeLlevas } of andado.montajes) {
      const textos = [
        escena.sitio, escena.titular, escena.situacion, escena.cuerpo.texto, escena.cierre, escena.accion.verbo,
        loQueTeLlevas.rotulo, loQueTeLlevas.empuje, loQueTeLlevas.accion.verbo,
        loQueTeLlevas.siguienteSitio?.nombre ?? null,
      ].filter((t) => typeof t === 'string');
      for (const texto of textos) {
        assert.ok(!/\d/.test(texto), `un texto de la escena lleva una cifra: ${JSON.stringify(texto)}`);
      }
    }
  });
});

// ── La aventura en curso, cableada en la app ───────────────────────────────────

describe('La aventura en curso, cableada en la app', () => {
  test('Aceptar una entrada deja la aventura en curso en su primer beat, con su hecho anexado', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const enCurso = aventuraEnCurso(p.estado.aventuras);
    assert.ok(enCurso, 'aceptar una entrada de la lista no ha dejado ninguna aventura en curso, que es lo que medía §6h en esta fila');
    assert.equal(enCurso.plantilla, p.casteada.plantilla);
    assert.equal(enCurso.beatEnCurso, p.casteada.aventura.beats[0].n, 'el beat en curso no es el primero de la cadena');
    assert.deepEqual(enCurso.resueltos, []);
    assert.deepEqual(p.registro.hechos.map((h) => h.tipo), ['aventura-aceptada'], 'aceptar no anexa su hecho, o anexa alguno más');
  });

  test('Cerrar el paso de un beat resuelve el que toca y la cadena entera se anda por la capa de la app', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const andado = andaElLazoConLaApp({ ...p, casteada: p.casteada });

    assert.equal(
      andado.terminada,
      true,
      `"${p.casteada.plantilla}" no se ha podido terminar andando su lazo con la capa de la app montada, y sin eso A4P3 no tendría beat que pintar`,
    );
    assert.equal(andado.resueltos, p.casteada.aventura.beats.length, 'no se han resuelto todos los beats de la cadena');

    // Y cada paso de beat trajo su escena compuesta, que es lo que la pantalla pinta.
    for (const montaje of andado.montajes) {
      assert.equal(montaje.motivoDeEscena, null, `un paso de beat llegó con avería: ${montaje.motivoDeEscena}`);
      assert.ok(montaje.escena, 'un paso de beat llegó sin escena compuesta');
      assert.ok(montaje.loQueTeLlevas, 'un paso de beat llegó sin la segunda mitad compuesta');
      assert.equal(montaje.escena.estado, 'escena');
      assert.equal(montaje.loQueTeLlevas.estado, 'lo-que-te-llevas');
    }
  });

  test('El beat que no toca se queda esperando a la llegada que sí le toque y la app no falla', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const { aventura } = capaDeLaApp(p);
    const beats = p.casteada.aventura.beats;
    assert.ok(beats.length >= 2, 'la aventura del caso tiene un solo beat y no habría ninguno fuera de turno');

    // El segundo beat, ofrecido cuando el que toca es el primero: **no se resuelve y no falla**.
    // El mecanismo de esperar es de `partida/llegadas.js` y aquí no se reimplementa.
    assert.equal(aventura.resuelve(beats[1]), null, 'resolver un beat que no toca ha movido el motor');
    assert.equal(aventuraEnCurso(p.estado.aventuras).beatEnCurso, beats[0].n, 'el beat en curso se ha movido con un beat que no tocaba');

    // Y un beat que no es de la cadena tampoco mueve nada: un micro-encuentro de la cola
    // produce paso de beat igual y no pertenece a ninguna aventura.
    const ajeno = { ...beats[0], n: 99 };
    assert.equal(aventura.esDelLazo(ajeno), false);
    assert.equal(aventura.resuelve(ajeno), null, 'un beat que no es del lazo ha movido el motor de la aventura');
  });

  test('Resolver dos veces el mismo beat no cambia nada ni duplica ningún hecho', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const { aventura } = capaDeLaApp(p);
    const primero = p.casteada.aventura.beats[0];

    aventura.resuelve(primero);
    const despues = JSON.stringify(congelaAventuras(p.estado.aventuras));
    const hechos = p.registro.hechos.length;

    // Es lo que pasa al cerrarse y abrirse la app con la escena a medio leer: la escena se
    // compone otra vez y su acción vuelve a cerrar el paso.
    assert.equal(aventura.resuelve(primero), null, 'resolver otra vez el beat ya resuelto ha vuelto a mover el motor');
    assert.equal(JSON.stringify(congelaAventuras(p.estado.aventuras)), despues, 'resolver dos veces el mismo beat ha cambiado el estado');
    assert.equal(p.registro.hechos.length, hechos, 'resolver dos veces el mismo beat ha duplicado un hecho');
  });

  test('La escena se compone con la cara del reparto, con su nombre y su puesto', async () => {
    // La cara se resuelve con la misma función pura con la que el casting resolvió el rol
    // humano —`identidadDeCara`, sobre la misma semilla y el mismo mundo—, así que es **la
    // misma cara** y no una parecida.
    //
    // **El beat de este caso ya no se fabrica** (SPEC-051). Hasta la fila 51 había que
    // inventarlo, porque ninguna de las 30 plantillas ponía un beat sobre su rol humano y en
    // los cuatro mundos de referencia no había ni un `lugar.tipo === 'humano'`; desde que las
    // dos cláusulas del catálogo los ponen, el cableado se afirma sobre uno **casteado de
    // verdad**, que es lo que convierte «respondería si lo hubiera» en «responde».
    const p = await partidaAbierta({ cumple: (c) => c.aventura.beats.some((b) => b.lugar?.tipo === 'humano') });
    assert.ok(p.casteada, 'ninguna aventura de costero trae un beat con cara y el caso no mediría nada');
    const { aventura } = capaDeLaApp(p);
    const beat = p.casteada.aventura.beats.find((b) => b.lugar?.tipo === 'humano');
    const deSitio = p.casteada.aventura.beats.find((b) => b.lugar?.tipo !== 'humano');
    assert.ok(deSitio, 'la aventura del caso es toda de caras y no hay contraste que medir');

    const { escena } = aventura.escenaDe(beat, { tamanoDeTexto: TAMANO_DE_TEXTO_DE_ORIGEN });
    assert.ok(escena.cara, 'el beat tiene una cara del reparto y la escena la ha compuesto sin nadie');
    assert.equal(typeof escena.cara.nombre, 'string');
    assert.ok(escena.cara.nombre.length > 0, 'la cara de la escena llega sin nombre');
    // **El rótulo de mundo y nunca la clave**: lo que llega a esta línea es «al frente», no
    // `regencia`. La traducción vive en la declaración de puestos y la pantalla no traduce.
    assert.equal(escena.cara.puesto, rotuloDePuesto(beat.lugar.cara.puesto), 'el puesto de quien habla no es el rótulo del que el casting asignó');
    assert.ok(Object.values(ROTULOS_DE_PUESTO).includes(escena.cara.puesto));
    assert.ok(!PUESTOS.includes(escena.cara.puesto), `la clave interna "${escena.cara.puesto}" ha salido a la escena`);
    // Con cara el cuerpo es parlamento; sin ella, párrafo. Es el único elemento que cambia de
    // forma, y ninguno de los demás cambia de sitio.
    assert.equal(escena.cuerpo.forma, 'parlamento');
    assert.equal(aventura.escenaDe(deSitio, {}).escena.cuerpo.forma, 'parrafo');
    assert.equal(aventura.escenaDe(deSitio, {}).escena.cara, null);
  });

  test('Veintiún beats del catálogo caen sobre un rol humano, y sus escenas tienen cara', async () => {
    // **La medida, con su número delante, y con el número viejo al lado para que se vea qué
    // se movió y qué no.** Hasta SPEC-051: veinte de las treinta plantillas declaraban un rol
    // humano y **ninguna** ponía un beat encima, así que `escena.cara` era siempre nula en
    // los cuatro mundos de referencia, el bloque de quien habla no se pintaba nunca y el
    // cuerpo era siempre párrafo. La cifra era 0 de 506.
    //
    // **Lo que la fila 51 cambió, y solo eso**: las dos cláusulas de `quests/caras.js`
    // escriben **21 beats con cara en 19 plantillas** del catálogo, y sobre los cuatro mundos
    // de referencia eso da **69 instancias casteadas**. Las plantillas con rol humano siguen
    // siendo 20 —la fila no añade ni retira ningún rol— y los beats casteados siguen siendo
    // 506 —la fila no cambia el veredicto de ninguna plantilla—, así que las dos mitades que
    // esta guarda vigilaba siguen puestas y solo se ha movido la que tenía que moverse.
    //
    // Y la exigencia que el comentario viejo dejaba pendiente —«alguien mire si la cara llega
    // a pantalla»— **no se retira, se cumple**: la composición se afirma en el caso de
    // arriba y en `test/nucleo/caras.test.mjs`, y que A4P3 monte el bloque de quien habla con
    // el rótulo y sin la clave se afirma en «El bloque de quien habla se pinta con el rótulo
    // del puesto y nunca con la clave», más abajo en este mismo fichero.
    const conRolHumano = CATALOGO.filter((p) => Object.values(p.roles ?? {}).some((r) => r.tipo === 'humano'));
    assert.equal(conRolHumano.length, 20, `${conRolHumano.length} de ${CATALOGO.length} plantillas declaran un rol humano y se midieron 20`);

    const escritos = CATALOGO.flatMap((p) => p.beats.filter((b) => p.roles[b.rol]?.tipo === 'humano').map(() => p.id));
    assert.equal(escritos.length, 21, `el catálogo escribe ${escritos.length} beats sobre un rol humano y las dos cláusulas dan 21`);
    assert.equal(new Set(escritos).size, 19, `esos beats se reparten en ${new Set(escritos).size} plantillas y se midieron 19`);

    let beats = 0;
    let humanos = 0;
    let conCara = 0;
    let aventuras = 0;
    for (const nombre of LOS_CUATRO) {
      const { mundo } = await partidaAbierta({ nombre });
      for (const casteada of (mundo.casting ?? []).filter((c) => c.ok)) {
        aventuras += 1;
        const suyos = casteada.aventura.beats.filter((b) => b.lugar?.tipo === 'humano');
        beats += casteada.aventura.beats.length;
        humanos += suyos.length;
        if (suyos.length) conCara += 1;
      }
    }
    assert.equal(aventuras, 103, `los cuatro mundos de referencia castean ${aventuras} aventuras y se midieron 103 de 120`);
    assert.equal(beats, 506, `los cuatro mundos de referencia castean ${beats} beats y se midieron 506`);
    assert.equal(
      humanos,
      69,
      `${humanos} de ${beats} beats caen sobre un rol humano y SPEC-051 midió 69 (antes 0): si el número baja, alguna plantilla ha dejado de ` +
      'poner su cara delante; si sube, alguien ha escrito un beat humano fuera de las dos cláusulas',
    );
    assert.equal(conCara, 63, `${conCara} de ${aventuras} aventuras casteadas tienen al menos una cara y se midieron 63`);
  });
});

// ── El reparto casteado, que ya no se pierde al cerrar la app ──────────────────

describe('El reparto casteado sobrevive a cerrar la app', () => {
  test('El reparto se recupera del mundo congelado y es idéntico beat a beat', async () => {
    // `@determinismo`, bloqueante. Es la deuda §10g: hasta esta fila el reparto viajaba con la
    // salida que se echó a andar, y al reabrir la app la capa se montaba con el reparto vacío,
    // así que el paso de beat de una secuencia guardada llegaba **con el beat dentro en nulo**.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const antes = repartoDeLaAventuraEnCurso({ mundo: p.mundo, aventuras: p.estado.aventuras });

    // Cerrar y abrir la app: el área se congela y se levanta, y la cadena **no viaja dentro**.
    const documento = congelaAventuras(p.estado.aventuras);
    assert.ok(!JSON.stringify(documento).includes(antes.beats[0].escena.texto), 'la cadena de beats se está persistiendo en la partida, con sus textos de plantilla dentro');

    const despues = repartoDeLaAventuraEnCurso({ mundo: p.mundo, aventuras: p.estado.aventuras });
    assert.equal(JSON.stringify(despues), JSON.stringify(antes), 'el reparto recuperado del mundo congelado no es idéntico beat a beat');
    assert.equal(despues.beats.length, p.casteada.aventura.beats.length);
  });

  test('Sin ninguna aventura aceptada el reparto sigue declarándose vacío explícitamente', async () => {
    const p = await partidaAbierta();
    assert.equal(aventuraEnCurso(p.estado.aventuras), null, 'la partida del caso trae aventura en curso y no debería');
    assert.equal(repartoDeLaAventuraEnCurso({ mundo: p.mundo, aventuras: p.estado.aventuras }), REPARTO_SIN_AVENTURA);
    assert.deepEqual(REPARTO_SIN_AVENTURA.beats, [], 'el reparto sin aventura ha dejado de ser una declaración y es otra cosa');
  });

  test('Una aventura en curso que el mundo congelado no puede castear falla nombrando la plantilla', async () => {
    // Un reparto vacío ahí dentro sería la degradación de §10g otra vez, solo que en silencio.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const sinCasting = { ...p.mundo, casting: [] };
    assert.throws(
      () => repartoDeLaAventuraEnCurso({ mundo: sinCasting, aventuras: p.estado.aventuras }),
      new RegExp(p.casteada.plantilla),
    );
    assert.equal(casteadaDelMundo(sinCasting, p.casteada.plantilla), null);
  });

  test('El estado de una aventura en curso no guarda ninguna coordenada ni ninguna marca de tiempo', async () => {
    // `@privacidad`, bloqueante. Se mira lo escrito y no el código: lo que sobrevive a la copia
    // exportada es el documento, no la intención.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    andaElLazoConLaApp({ ...p, casteada: p.casteada });
    const documento = JSON.stringify(congelaAventuras(p.estado.aventuras));

    assert.ok(!/"(lat|lon|latitude|longitude|x|y)"\s*:/.test(documento), `el área de aventuras guarda una coordenada: ${documento.slice(0, 300)}`);
    assert.ok(!/\b1[6-9]\d{11}\b/.test(documento), 'el área de aventuras guarda una marca de tiempo de época');
    assert.ok(!/"(hora|minuto|tMs|timestamp|instante)"\s*:/.test(documento), 'el área de aventuras guarda una hora');
  });
});

// ── Nada degrada por falta de cableado ─────────────────────────────────────────

describe('Nada degrada por falta de cableado', () => {
  test('El motor de la aventura en curso no se monta sin el núcleo, el mundo ni el estado', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const reparto = repartoDeLaAventuraEnCurso({ mundo: p.mundo, aventuras: p.estado.aventuras });
    const completo = { nucleo: NUCLEO_DE_LA_AVENTURA_EN_CURSO, mundo: p.mundo, estado: p.estado, reparto, reloj: relojDePared(MEDIODIA) };

    assert.throws(() => creaLaAventuraEnCurso({ ...completo, nucleo: null }), /necesita el núcleo inyectado/);
    assert.throws(() => creaLaAventuraEnCurso({ ...completo, mundo: null }), /mundo congelado/);
    assert.throws(() => creaLaAventuraEnCurso({ ...completo, estado: {} }), /estado de la partida/);

    // Y cada pieza que falte se dice **por su nombre**, que es lo que distingue «no lo cableó
    // nadie» de «esto no hace nada».
    for (const pieza of DEL_NUCLEO) {
      const cojo = { ...NUCLEO_DE_LA_AVENTURA_EN_CURSO };
      delete cojo[pieza];
      assert.throws(() => creaLaAventuraEnCurso({ ...completo, nucleo: cojo }), new RegExp(pieza), `quitar "${pieza}" no falla nombrándola`);
    }
  });

  test('Sin el reloj de pared, la escena de un beat de franja se enseña como avería y el paso no se salta', async () => {
    // El reloj **se exige**: sin él el núcleo falla nombrándolo, que es lo que impide resolver
    // todas las llegadas como si fueran dentro de la franja. Y la avería se enseña con su
    // motivo literal en lugar de propagarse, porque una escena que revienta sin acción deja la
    // app encallada dentro de una salida abierta.
    const p = await partidaAbierta({ cumple: (c) => c.aventura.beats.some((b) => b.disparador?.tipo === 'franja') });
    assert.ok(p.casteada, 'ningún mundo de referencia castea una aventura con franja y el caso no mediría nada');

    const { llegadas } = capaDeLaApp({ ...p, reloj: null });
    const conFranja = p.casteada.aventura.beats.find((b) => b.disparador?.tipo === 'franja');
    const destino = { x: conFranja.lugar.x, y: conFranja.lugar.y };
    llegadas.comprueba(posicionesQueValidan(destino));

    const montaje = llegadas.montaje();
    assert.ok(montaje, 'no ha validado ninguna llegada y el caso no mediría nada');
    if (montaje.llegada.secuencia.some((paso) => paso.tipo === TIPOS_DE_PASO.BEAT)) {
      assert.equal(montaje.escena, null, 'la escena se ha compuesto sin reloj de pared cableado');
      assert.match(montaje.motivoDeEscena ?? '', /reloj de pared/, `la avería de la escena no nombra el reloj: ${montaje.motivoDeEscena}`);
      // Y el paso se cierra igual: la avería lleva su acción.
      assert.equal(typeof llegadas.avanza, 'function');
      assert.ok(llegadas.avanza(), 'el paso de la avería no se puede cerrar, y la app se queda encallada');
    }
  });

  test('La capa de llegadas con beats y sin motor de aventura falla nombrándolo', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    assert.throws(
      () => capaDeLaApp({ ...p, conMotor: false }),
      /motor de la aventura en curso/,
      'la capa se monta con beats y sin motor, y entonces cerrar el paso de un beat no resolvería nada y nadie protestaría',
    );

    // Y sin beats no hace falta ninguno: salir a andar sin aventura es un caso normal del juego.
    const paseo = await partidaAbierta();
    assert.ok(capaDeLaApp({ ...paseo, conMotor: false }).llegadas, 'un paseo sin aventura exige motor de aventura y no debería');
  });

  test('Lo que el motor de la aventura le pide al núcleo está enumerado y es lo mismo que se le inyecta', () => {
    // La regla de SPEC-020 (§6u), repetida en once filas: el generador entra por la puerta y
    // enumerado. Que la lista de `app/nucleo/piezas.js` y la de `aventura.js` digan lo mismo se
    // comprueba leyendo la fuente, porque `piezas.js` cita el paquete por su nombre y no
    // resuelve sin instalación.
    const piezas = fuente('app/nucleo/piezas.js');
    const bloque = piezas.slice(piezas.indexOf('export const NUCLEO_DE_LA_AVENTURA_EN_CURSO'));
    for (const nombre of DEL_NUCLEO) {
      assert.match(bloque, new RegExp(`\\b${nombre}\\b`), `NUCLEO_DE_LA_AVENTURA_EN_CURSO no inyecta "${nombre}", que aventura.js enumera`);
      assert.ok(NUCLEO_DE_LA_AVENTURA_EN_CURSO[nombre], `el núcleo de esta prueba no trae "${nombre}"`);
    }
  });
});

// ── La escena que espera, y la segunda sin pasar por el mapa ───────────────────

describe('La escena que espera manda sobre todo lo demás', () => {
  test('La escena queda disponible y espera', async () => {
    // El escenario de la batería, ahora con la escena **compuesta de verdad** al otro lado:
    // hasta esta fila el paso de beat llegaba y el beat de dentro no se podía pintar.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const { llegadas } = capaDeLaApp(p);
    const primero = p.casteada.aventura.beats[0];
    llegadas.comprueba(posicionesQueValidan({ x: primero.lugar.x, y: primero.lugar.y }));

    const espera = llegadas.espera();
    assert.ok(espera, 'pararse dentro del geofence del primer beat no ha dejado ninguna escena esperando');
    const montaje = llegadas.montaje();
    assert.ok(montaje.beat, 'la escena que espera llega sin beat dentro, que es exactamente la deuda §10g');
    assert.equal(montaje.beat.n, primero.n);
  });

  test('El visor es una capa y debajo está el beat', async () => {
    // La mitad de la escena del escenario, y la que esta fila hace verdad: cerrado el visor,
    // debajo hay un paso de beat **con su escena compuesta** y no un hueco con el paso nombrado.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const andado = andaElLazoConLaApp({ ...p, casteada: p.casteada });
    assert.ok(andado.montajes.length >= 1, 'no se ha compuesto ninguna escena al andar el lazo');
    for (const montaje of andado.montajes) {
      assert.ok(montaje.llegada.secuencia.some((paso) => paso.tipo === TIPOS_DE_PASO.BEAT));
      assert.ok(montaje.escena, 'debajo del visor hay un paso de beat sin escena');
    }
  });
});

// ── Los cuatro mundos de referencia ────────────────────────────────────────────

describe('La escena se compone en los cuatro mundos de referencia', () => {
  test('Toda aventura casteada de los cuatro mundos compone la escena de todos sus beats', async () => {
    // Una por mundo y no las 102: lo que aquí se mide es el cableado, y las 102 ya se andan en
    // `bucle-completo.test.mjs`. Lo que sí se exige de los cuatro es que la escena se componga,
    // porque los cuatro tienen repartos distintos y una cara que no resuelve pone rojo uno solo.
    for (const nombre of LOS_CUATRO) {
      const p = await partidaAbierta({ nombre, cumple: LA_PRIMERA });
      assert.ok(p.casteada, `${nombre} no castea ninguna aventura y el caso no mediría nada`);
      const andado = andaElLazoConLaApp({ ...p, casteada: p.casteada });
      assert.equal(andado.terminada, true, `${nombre}/${p.casteada.plantilla} no se ha podido terminar con la capa de la app`);
      assert.ok(andado.montajes.length >= 1, `${nombre}: no se ha compuesto ninguna escena`);
      for (const montaje of andado.montajes) {
        assert.equal(montaje.motivoDeEscena, null, `${nombre}: un paso de beat llegó con avería: ${montaje.motivoDeEscena}`);
        assert.equal(montaje.escena.tamanoDeTexto, TAMANO_DE_TEXTO_DE_ORIGEN);
      }
    }
  });
});

// ── El decorado ───────────────────────────────────────────────────────────────

/** Quien llega andando a un punto y se para el tiempo de permanencia entero. */
function posicionesQueValidan(destino) {
  const posiciones = [];
  const desde = { x: destino.x + 300, y: destino.y + 300 };
  const metros = Math.hypot(300, 300);
  const duracionS = metros / 1.39;
  for (let t = 2000; t < duracionS * 1000; t += 2000) {
    const recorrido = ((t / 1000) * 1.39) / metros;
    posiciones.push({ x: desde.x + (destino.x - desde.x) * recorrido, y: desde.y + (destino.y - desde.y) * recorrido, tMs: t, precisionM: 3, clasificacion: 'andando' });
  }
  const t0 = Math.round(duracionS * 1000);
  posiciones.push({ x: destino.x, y: destino.y, tMs: t0, precisionM: 3, clasificacion: 'andando' });
  for (let t = 5000; t <= 60_000; t += 5000) posiciones.push({ x: destino.x, y: destino.y, tMs: t0 + t, precisionM: 3, clasificacion: 'parada' });
  return posiciones;
}

// ── La huella de descartes de la aventura aceptada ─────────────────────────────
//
// La novena costura, y la que obligó a la primera migración de formato del proyecto. Desde
// que la lista de hoy respeta los sitios marcados, `repartoDeAventuras` vuelve a castear
// cuando los hay; sin congelar contra qué se casteó, marcar un sitio a mitad de camino le
// cambiaba la cadena a la aventura que ya estabas andando. Medido antes de coserlo, marcando
// **un solo sitio**: en `costero` 14 de 29 volvían con otra cadena y 4 reventaban, y en
// `suelo-250m` 9 de 19 reventaban y la salida quedaba encallada.

describe('La huella de descartes con la que se aceptó la aventura', () => {
  test('Marcar un sitio a mitad de camino no le cambia la cadena a la aventura aceptada', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const casting = elCasting();
    const antes = repartoDeLaAventuraEnCurso({ mundo: p.mundo, aventuras: p.estado.aventuras });
    assert.deepEqual(descartesDelCasting(p.estado.aventuras), [], 'la aventura se aceptó sin ningún sitio marcado y su huella no está vacía');

    // Se marca **un sitio del propio lazo**, que es el caso que rompía: el que peor le sienta
    // a la cadena que se está andando.
    const marcado = p.casteada.aventura.beats[1].lugar.nombre;
    anotaDescarte(p.estado.anclajes, { mapaId: p.mapaId, anclaje: marcado, porque: IDS_DE_MOTIVO[0] });

    // **La mitad que hace que esto mida algo**: con el mundo de ahora la cadena es otra. Sin
    // este contraste, el caso pasaría también si nadie estuviera recasteando nada.
    const vigente = casting.mundoVigente({ mundo: p.mundo, anclajes: p.estado.anclajes, mapaId: p.mapaId });
    assert.notEqual(vigente, p.mundo, 'marcar un sitio no ha hecho recastear, y entonces no hay nada que congelar');
    let conElVigente = null;
    try {
      conElVigente = JSON.stringify(repartoDeLaAventuraEnCurso({ mundo: vigente, aventuras: p.estado.aventuras }));
    } catch {
      conElVigente = 'la plantilla deja de castear';
    }
    assert.notEqual(conElVigente, JSON.stringify(antes), 'con el mundo de ahora la cadena sale igual, así que el caso no distingue congelar de no congelar');

    // Y con la huella congelada, la misma cadena beat a beat.
    const suyo = casting.mundoDeLaAventura({ mundo: p.mundo, marcados: descartesDeLaAventura(p.estado.aventuras) });
    assert.equal(
      JSON.stringify(repartoDeLaAventuraEnCurso({ mundo: suyo, aventuras: p.estado.aventuras })),
      JSON.stringify(antes),
      'marcar un sitio le ha cambiado la cadena a la aventura que ya se estaba andando',
    );
  });

  test('La huella sobrevive a congelar y levantar el área, que es el día siguiente de verdad', async () => {
    // Congelando y levantando, no leyendo el objeto vivo: lo que hay que proteger es que la
    // cadena sea la misma **al reabrir la app**, y eso pasa por el documento.
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    const casting = elCasting();
    const antes = repartoDeLaAventuraEnCurso({ mundo: p.mundo, aventuras: p.estado.aventuras });
    anotaDescarte(p.estado.anclajes, { mapaId: p.mapaId, anclaje: p.casteada.aventura.beats[1].lugar.nombre, porque: IDS_DE_MOTIVO[0] });

    const vuelta = levantaAventuras(JSON.parse(JSON.stringify(congelaAventuras(p.estado.aventuras))));
    assert.deepEqual(descartesDelCasting(vuelta), descartesDelCasting(p.estado.aventuras), 'la huella no cruza el viaje de ida y vuelta del documento');
    assert.equal(aventuraEnCurso(vuelta).plantilla, p.casteada.plantilla, 'la aventura en curso no vuelve de su documento');

    const suyo = casting.mundoDeLaAventura({ mundo: p.mundo, marcados: descartesDeLaAventura(vuelta) });
    assert.equal(
      JSON.stringify(repartoDeLaAventuraEnCurso({ mundo: suyo, aventuras: vuelta })),
      JSON.stringify(antes),
      'al reabrir la app la aventura vuelve con otra cadena',
    );
  });

  test('Una aventura aceptada con sitios ya marcados congela esos y no la lista vacía', async () => {
    // El otro lado: la huella no es siempre `[]`. Se marca **antes** de aceptar, y lo que se
    // congela es lo que había, que es lo que hace que la cadena de la ficha y la que se
    // recorre sean la misma.
    const base = await partidaAbierta();
    const marcado = (base.mundo.settlements ?? [])[0]?.name;
    assert.ok(marcado, 'el mundo de referencia no tiene ningún núcleo que marcar');
    anotaDescarte(base.estado.anclajes, { mapaId: base.mapaId, anclaje: marcado, porque: IDS_DE_MOTIVO[0] });

    const casting = elCasting();
    const vigente = casting.mundoVigente({ mundo: base.mundo, anclajes: base.estado.anclajes, mapaId: base.mapaId });
    const suya = (vigente.casting ?? []).find((c) => c.ok);
    assert.ok(suya, 'con un sitio marcado el mundo no castea ninguna aventura y el caso no mediría nada');

    acepta(base.estado.aventuras, {
      aventura: suya.aventura,
      mapaId: base.mapaId,
      registro: base.registro,
      dia: DIA,
      paso: 1,
      descartes: anclajesDe(vistaDeDescartes(base.estado.anclajes, base.mapaId)),
    });
    assert.deepEqual([...descartesDelCasting(base.estado.aventuras)], [marcado], 'la aventura no ha congelado el sitio que ya estaba marcado');

    // Y su cadena se recupera con esa foto, no con el mundo pelado.
    const suyo = casting.mundoDeLaAventura({ mundo: base.mundo, marcados: descartesDeLaAventura(base.estado.aventuras) });
    assert.equal(
      JSON.stringify(repartoDeLaAventuraEnCurso({ mundo: suyo, aventuras: base.estado.aventuras })),
      JSON.stringify({ beats: suya.beats }),
      'la cadena recuperada no es la que se aceptó',
    );
  });

  test('Cerrar la aventura vacía la huella, y la siguiente no se castea contra lo de la anterior', async () => {
    const p = await partidaAbierta({ cumple: LA_PRIMERA });
    anotaDescarte(p.estado.anclajes, { mapaId: p.mapaId, anclaje: p.casteada.aventura.beats[1].lugar.nombre, porque: IDS_DE_MOTIVO[0] });

    cierra(p.estado.aventuras, { registro: p.registro, dia: DIA, paso: 1, motivo: 'volver' });
    assert.equal(aventuraEnCurso(p.estado.aventuras), null);
    assert.deepEqual(descartesDelCasting(p.estado.aventuras), [], 'la foto de la aventura cerrada sigue puesta, y la siguiente se castearía contra ella');
    assert.deepEqual(descartesDeLaAventura(p.estado.aventuras), [], 'la app sigue leyendo la foto de una aventura que ya no está');
  });

  test('Aceptar una aventura sin declarar contra qué se casteó falla nombrándolo', async () => {
    const p = await partidaAbierta();
    const suya = p.mundo.casting.find((c) => c.ok);
    assert.throws(
      () => acepta(p.estado.aventuras, { aventura: suya.aventura, mapaId: p.mapaId, registro: p.registro, dia: DIA, paso: 1, descartes: 'ninguno' }),
      /contra qué sitios marcados se casteó/,
    );
    // Y el mundo de una aventura tampoco se recupera con cualquier cosa: sin lista, falla.
    assert.throws(() => elCasting().mundoDeLaAventura({ mundo: p.mundo, marcados: null }), /no ha llegado/);
  });

  test('La huella se lee del área y no se recalcula, que es lo que la app hace', () => {
    // `descartesDeLaAventura` es la puerta de la app y lee el campo tal cual, como
    // `identidadDeLaSalidaViva` lee la salida abierta: sin aventura en curso, la lista vacía es
    // la respuesta correcta y no un valor por defecto tragado.
    assert.deepEqual(descartesDeLaAventura(null), []);
    assert.deepEqual(descartesDeLaAventura({ descartesDelCasting: ['b', 'a'] }), ['b', 'a']);
    // Y es una copia: quien la reciba no puede mutar el área desde fuera.
    const area = { descartesDelCasting: ['a'] };
    descartesDeLaAventura(area).push('b');
    assert.deepEqual(area.descartesDelCasting, ['a'], 'la lectura de la huella deja mutar el área desde fuera');
  });
});

// ── La memoria de la lista y los sitios marcados ───────────────────────────────
//
// Los dos parámetros que `componeLoQueHayHoy` espera, que tienen valor por defecto inocuo y
// que nadie le pasaba desde `app/`. Eran invisibles: la memoria porque hasta esta fila
// ninguna aventura podía cerrarse nunca, y los descartes porque nadie recasteaba.

describe('La lista de hoy recibe la memoria y los sitios marcados', () => {
  test('Una plantilla ya vivida no se vuelve a ofrecer', async () => {
    const p = await partidaAbierta();
    const peticion = (extra) => componeLoQueHayHoy({
      mundo: p.mundo, oficio: 'taberna', tramo: 2000, mapaId: p.mapaId, calendario: { dia: () => 1 }, ...extra,
    });

    const sinMemoria = peticion({});
    assert.equal(sinMemoria.hayLista, true, 'el mundo de referencia no ofrece lista y el caso no mediría nada');
    assert.ok(sinMemoria.entradas.length >= 1);

    // Se vive la primera: aceptada y cerrada. Cómo acabó da igual —terminarla y que se
    // resolviera sin ti son dos finales, y ninguno de los dos se repite.
    const vivida = sinMemoria.entradas[0].id;
    acepta(p.estado.aventuras, {
      aventura: { id: vivida, plantilla: vivida, beats: sinMemoria.entradas[0].beats },
      mapaId: p.mapaId, registro: p.registro, dia: 1, paso: 1, descartes: [],
    });
    cierra(p.estado.aventuras, { registro: p.registro, dia: 1, paso: 1, motivo: 'volver' });

    const conMemoria = peticion({ aventuras: p.estado.aventuras });
    assert.ok(!conMemoria.entradas.map((e) => e.id).includes(vivida), `la lista vuelve a ofrecer "${vivida}", que ya se vivió`);
    // Y el contraste, que es lo que separa «la memoria funciona» de «la lista cambia sola»:
    // sin pasarle el área, la misma plantilla sigue ahí.
    assert.ok(peticion({}).entradas.map((e) => e.id).includes(vivida), 'la lista cambia sola sin registro de aventuras, así que la memoria no es lo que la está cambiando');
  });

  test('Un anclaje marcado no castea, y sin pasarle los descartes sí', async () => {
    const p = await partidaAbierta();
    const peticion = (extra) => componeLoQueHayHoy({
      mundo: p.mundo, oficio: 'taberna', tramo: 2000, mapaId: p.mapaId, calendario: { dia: () => 1 }, ...extra,
    });
    const antes = peticion({});
    assert.ok(antes.entradas.length >= 1, 'sin lista no se puede medir el efecto de marcar un sitio');

    // Se marca un sitio del lazo de la primera entrada: el que de verdad la puede tumbar.
    const suyo = antes.entradas[0].beats[0].lugar.nombre;
    anotaDescarte(p.estado.anclajes, { mapaId: p.mapaId, anclaje: suyo, porque: IDS_DE_MOTIVO[0] });
    const descartes = vistaDeDescartes(p.estado.anclajes, p.mapaId);
    assert.equal(descartes.descartado(suyo), true, 'marcar el sitio no lo ha dejado marcado');

    const despues = peticion({ descartes });
    const mismoLazo = (a, b) => JSON.stringify(a?.beats?.map((x) => x.lugar.nombre)) === JSON.stringify(b?.beats?.map((x) => x.lugar.nombre));
    const suya = despues.entradas.find((e) => e.id === antes.entradas[0].id);
    assert.ok(
      !suya || !mismoLazo(suya, antes.entradas[0]),
      `la lista sigue ofreciendo "${antes.entradas[0].id}" con el mismo lazo, que pasa por el sitio que se marcó`,
    );

    // Y ningún lazo de la lista pisa el sitio marcado, que es lo que RF-PRIV-004 pide.
    for (const entrada of despues.entradas) {
      const sitios = (entrada.beats ?? []).map((b) => b.lugar.nombre);
      assert.ok(!sitios.includes(suyo), `la aventura "${entrada.id}" sigue mandando al sitio marcado "${suyo}"`);
    }
  });

  test('La petición de la lista lleva la memoria y los descartes, y no una copia rancia', () => {
    // Se lee de la fuente porque quien compone la petición es la pantalla, y lo que esta fila
    // corrige es exactamente que esos dos campos no viajaban.
    const pantalla = codigoDe('app/pantallas/antes-de-salir.jsx');
    assert.match(pantalla, /aventuras: estado\.aventuras,/, 'la petición de la lista no lleva el registro de aventuras, y una aventura vivida se vuelve a ofrecer');
    assert.match(pantalla, /descartes: vistaDeDescartes\(estado\.anclajes, mapaId\)/, 'la petición de la lista no lleva los sitios marcados');
    // Es la vista y no la lista pelada: `exigeDescartes` pide `descartado()`, y
    // `descartesDeMapa` se le parece y no lo cumple.
    assert.ok(!/descartes: descartesDeMapa\(/.test(pantalla), 'la petición lleva la lista pelada de descartes en vez de la vista con descartado()');
    // Y la aventura se acepta declarando contra qué se casteó, por la misma puerta.
    assert.match(pantalla, /descartes: anclajesDe\(vistaDeDescartes\(estado\.anclajes, mapaId\)\)/, 'la aventura se acepta sin declarar contra qué sitios marcados se casteó');
  });
});
