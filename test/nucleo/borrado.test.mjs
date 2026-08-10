// SPEC-040 · Empezar de nuevo, que es **borrar y no reiniciar**: lo que se pierde
// enumerado en cosas, la marca que se escribe antes de borrar, el encadenado con la copia
// de SPEC-039 y que después no quede nada de la partida anterior.
//
// Casi todo cae aquí y no en Maestro por el reparto que eligió la spec: lo que se pierde
// es **dato estructurado** y no una frase, así que «los mapas se nombran por su título»,
// «una partida del primer día no enumera ceros» y «si la copia falla no se borra» se
// pueden poner rojos sin dispositivo. Lo único que necesita simulador es la jerarquía
// visual de las tres acciones, y vive en `test/app/empezar-de-nuevo.yaml`.
//
// La frontera con `copia.test.mjs` es la de SPEC-039: allí se afirma qué hace la app con
// el fichero —empaquetar, avisar, sustituir—; aquí solo que la copia se ofrece antes de
// borrar, que una copia fallida **no** borra y que la que sí se guardó se vuelve a abrir
// con la partida ya destruida.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: la partida la monta
// `copia-de-prueba.mjs`, la hoja de compartir es un doble y las dos semillas están
// escritas a mano.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ACCIONES,
  CLAVE_DE_BORRADO_EN_CURSO,
  COSAS,
  DESTINO_TRAS_BORRAR,
  ESTADOS_DE_EMPEZAR,
  IDS_DE_ESTADO,
  MOMENTO,
  ORDEN_DE_LAS_COSAS,
  SITIO,
  TESTIDS,
  borraPartida,
  clavesABorrar,
  componeEmpezarDeNuevo,
  diasDeDiario,
  documentoDeBorrado,
  exigeSinBorradoAMedias,
  hayBorradoAMedias,
  hayMotes,
  loQueSePierde,
  mapasDeLaPartida,
  marcaBorrado,
  terminaBorrado,
  terminaBorradoPendiente,
} from '../../packages/nucleo/partida/borrado.js';
import { REGISTROS, TIPOGRAFIAS, coloca, textoConRegistro } from '../../packages/nucleo/lenguaje/registro.js';
import { cifrasDeTexto } from '../../packages/nucleo/partida/guion-de-arranque.js';
import { PREFIJOS_DE_LA_PARTIDA } from '../../packages/nucleo/partida/exportacion.js';
import { CLAVES_DE_PARTIDA, cargaPartida, guardaPartida } from '../../packages/nucleo/partida/reconstruccion.js';
import { AJUSTES_DE_ORIGEN, cambiaAjuste } from '../../packages/nucleo/partida/ajustes.js';
import { estadoInicial } from '../../packages/nucleo/partida/estado.js';
import { declaraCandidato } from '../../packages/nucleo/partida/motes.js';
import { CLAVES } from '../../packages/nucleo/partida/mapa.js';
import {
  BLOQUES,
  DEL_NUCLEO,
  TEXTOS_DE_EMPEZAR_DE_NUEVO,
  creaEmpezarDeNuevo,
  fraseDeLaPerdida,
  fraseDelMundoCongelado,
} from '../../app/datos/empezar-de-nuevo.js';
import { creaCopia } from '../../app/datos/copia.js';
import { creaAlmacenDeBinarios } from '../../app/recursos/almacen-de-binarios.js';
import { SEMILLA_B } from './celda-de-prueba.mjs';
import {
  ANCLAJE_DE_CASA,
  NUCLEO_DE_LA_COPIA,
  SEMILLA_A,
  almacenEnMemoria,
  mapaGuardado,
  partidaCompleta,
  volcado,
} from './copia-de-prueba.mjs';

/**
 * El generador armado como `creaEmpezarDeNuevo` lo exige, con rutas relativas.
 *
 * Es el mismo objeto que `app/nucleo/piezas.js` monta para la app
 * —`NUCLEO_DE_EMPEZAR_DE_NUEVO`—, con la diferencia deliberada de siempre: allí las
 * importaciones citan el paquete por su nombre y aquí van por ruta relativa, que es lo
 * que deja estas pruebas arrancando sin resolver ningún especificador instalado.
 */
const NUCLEO_DE_EMPEZAR = Object.freeze({
  REGISTROS,
  coloca,
  textoConRegistro,
  ESTADOS_DE_EMPEZAR,
  TESTIDS,
  ACCIONES,
  DESTINO_TRAS_BORRAR,
  SITIO,
  componeEmpezarDeNuevo,
  loQueSePierde,
  mapasDeLaPartida,
  borraPartida,
  terminaBorradoPendiente,
  exigeSinBorradoAMedias,
  hayBorradoAMedias,
});

/** Los tres ficheros de la entrega de SPEC-040, para las afirmaciones sobre la fuente. */
const ENTREGA = [
  'packages/nucleo/partida/borrado.js',
  'app/datos/empezar-de-nuevo.js',
  'app/pantallas/empezar-de-nuevo.jsx',
];

/** La fuente de un fichero del repo. */
const fuente = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

/**
 * La fuente sin las líneas que son comentario entero.
 *
 * Se quitan líneas completas y no comentarios de final de línea a propósito: los
 * comentarios de este repo explican decisiones y **citan la semilla por su nombre**
 * —«no hay ninguna ruta que conserve la semilla anterior»—, así que buscar la palabra
 * sobre la fuente cruda daría siempre positivo. Lo que se quiere afirmar es que no
 * aparece en el **código**.
 */
function codigoDe(ruta) {
  return fuente(ruta)
    .split('\n')
    .filter((linea) => {
      const l = linea.trim();
      return l !== '' && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*') && !l.startsWith('*/');
    })
    .join('\n');
}

/**
 * La hoja de compartir del sistema, doblada. Apunta lo que recibe y nada más.
 *
 * `falla` es la hoja que se cae y `cancelada` la que vuelve sin haber guardado: son los
 * dos caminos que sostienen «si la copia no se guarda, no se borra nada».
 */
function hojaDeCompartir({ falla = false, cancelada = false } = {}) {
  const compartido = [];
  const comparte = async ({ nombre, contenido }) => {
    if (falla) throw new Error('la hoja de compartir del sistema se ha caído');
    if (cancelada) return { compartida: false };
    compartido.push({ nombre, contenido });
    return { compartida: true };
  };
  comparte.compartido = compartido;
  return comparte;
}

/** Empezar de nuevo sobre una partida, con la copia de SPEC-039 de verdad detrás. */
function empezarSobre({ almacen, binarios = creaAlmacenDeBinarios(), comparte = hojaDeCompartir() } = {}) {
  const copia = creaCopia({ almacen, binarios, comparte, elige: async () => ({ cancelada: true }), nucleo: NUCLEO_DE_LA_COPIA });
  return { comparte, copia, empezar: creaEmpezarDeNuevo({ almacen, binarios, copia, nucleo: NUCLEO_DE_EMPEZAR }) };
}

/** Una partida del primer día: personaje con nombre, ningún mapa, ningún día, ningún mote. */
function delPrimerDia({ semilla = SEMILLA_A } = {}) {
  const estado = estadoInicial({ semilla });
  estado.personaje.nombre = 'Sabela';
  return estado;
}

/** El texto de un bloque de la pantalla ya compuesta. */
const textoDe = (pantalla, id) => (pantalla.textos.find((t) => t.id === id) ?? null);

describe('Empezar de nuevo borra y no reinicia', () => {
  test('Se explica que el mundo no se puede rehacer', async () => {
    // El escenario entero de la batería: que el mapa no se puede volver a generar, y que
    // lo que se pierde va enumerado en cosas y no en datos.
    const partida = await partidaCompleta();
    const { empezar } = empezarSobre(partida);
    const pantalla = await empezar.pregunta({ estado: partida.estado });

    const congelado = textoDe(pantalla, BLOQUES.CONGELADO);
    assert.ok(congelado, 'la pantalla no explica por qué el mundo no se puede rehacer');
    // Nombra el mapa por su título, dice con qué datos se dibujó y que ya han cambiado.
    assert.match(congelado.texto, /Marcas de Vaeloria/, 'el párrafo del mundo congelado no nombra el mapa por su título');
    assert.match(congelado.texto, /datos de aquel d[ií]a/, 'no se dice con qué datos se dibujó el mapa');
    assert.match(congelado.texto, /ya han cambiado/, 'no se dice que esos datos ya han cambiado');
    assert.match(congelado.texto, /no se puede volver a generar/i, 'no se dice que el mapa no se puede volver a generar');
    // Y que empezar otra vez en la misma calle daría otro sitio con otros nombres.
    assert.match(congelado.texto, /misma calle/, 'no se dice qué pasa si se empieza otra vez en la misma calle');
    assert.match(congelado.texto, /otro sitio/, 'no se dice que saldría otro sitio');
    assert.match(congelado.texto, /otros nombres/, 'no se dice que saldría con otros nombres');

    // Se enumera lo que pierde: personaje, mapas por su nombre, días de diario y lo que
    // la gente sabe de él. Sobre el dato, que es donde se puede afirmar de verdad.
    assert.deepEqual(pantalla.perdida.map((p) => p.cosa), [COSAS.PERSONAJE, COSAS.MAPAS, COSAS.DIARIO]);
    assert.deepEqual(ORDEN_DE_LAS_COSAS, [COSAS.PERSONAJE, COSAS.MAPAS, COSAS.DIARIO, COSAS.MOTES]);
    const personaje = pantalla.perdida.find((p) => p.cosa === COSAS.PERSONAJE);
    assert.equal(personaje.nombre, 'Sabela', 'el personaje no se enumera por su nombre');
    const mapas = pantalla.perdida.find((p) => p.cosa === COSAS.MAPAS);
    assert.deepEqual(mapas.titulos, ['Marcas de Vaeloria', 'Marcas do Carballo Eterno'], 'los dos mapas no se enumeran por su título');

    // Y la frase que lo dice los nombra a los tres, y al personaje por su nombre.
    const perdida = textoDe(pantalla, BLOQUES.PERDIDA);
    assert.match(perdida.texto, /Sabela/, 'la frase no nombra al personaje');
    assert.doesNotMatch(perdida.texto, /tu personaje/i, 'el personaje aparece como «tu personaje» y no por su nombre');
    for (const titulo of mapas.titulos) {
      assert.ok(perdida.texto.includes(titulo), `la frase no nombra el mapa "${titulo}" por su título`);
    }
    assert.match(perdida.texto, /d[ií]a de diario/, 'la frase no dice cuántos días de diario se pierden');
    assert.match(perdida.texto, /primera pantalla/, 'la frase no dice que después se vuelve a la primera pantalla');
  });

  test('La copia se ofrece pero no se hace sola', async () => {
    const partida = await partidaCompleta();
    const { comparte, empezar } = empezarSobre(partida);
    partida.almacen.registro.length = 0;

    // Se le ofrece guardar una copia, y es la acción principal.
    const pantalla = await empezar.pregunta({ estado: partida.estado });
    const guardar = pantalla.acciones.find((a) => a.id === 'guardar');
    assert.ok(guardar, 'la pantalla no ofrece guardar una copia');
    assert.equal(guardar.orden, 1);
    assert.equal(guardar.peso, 'principal');
    assert.equal(TEXTOS_DE_EMPEZAR_DE_NUEVO.guardar, 'Guardar una copia primero');
    // Y se dice que el fichero se puede volver a abrir cuando se quiera.
    assert.match(textoDe(pantalla, BLOQUES.SALIDA).texto, /volver a abrir/, 'no se dice que la copia se puede volver a abrir');

    // Entrar en la pantalla no ha guardado nada por su cuenta: la copia se ofrece y no
    // se hace sola. Ni un fichero, ni una escritura en la partida.
    assert.deepEqual(comparte.compartido, [], 'la pantalla ha guardado una copia antes de que nadie la pidiera');
    assert.deepEqual(partida.almacen.operaciones('escribe'), [], 'entrar en la pantalla ha escrito en la partida');

    // Y si elige borrar sin guardar, no queda ningún fichero.
    const resultado = await empezar.borra();
    assert.equal(resultado.borrado, true);
    assert.deepEqual(comparte.compartido, [], 'borrar sin guardar ha dejado un fichero que nadie pidió');
    assert.deepEqual(await partida.almacen.lista(''), [], 'borrar sin guardar ha dejado documentos de la partida');
    assert.deepEqual(partida.binarios.guardados(), [], 'borrar sin guardar ha dejado los binarios del mundo congelado');
  });

  test('La copia guardada se puede volver a abrir', async () => {
    // Frontera con la fila 39: aquí se afirma el camino entero de esta pantalla —guardar
    // primero, borrar después— y que el fichero que salió sigue sirviendo cuando ya no
    // queda partida que lo respalde.
    const partida = await partidaCompleta();
    const { comparte, empezar } = empezarSobre(partida);

    const resultado = await empezar.guardaCopiaYBorra();
    assert.equal(resultado.borrado, true, 'la exportación fue bien y el borrado no ha continuado');
    assert.equal(comparte.compartido.length, 1, 'no se ha entregado ningún fichero a la hoja de compartir');
    assert.deepEqual(await partida.almacen.lista(''), [], 'la partida sigue en el almacén después de guardar la copia y borrar');

    // Y el fichero se vuelve a abrir en un móvil limpio: el mundo, el personaje, el
    // diario y los rangos.
    const limpio = almacenEnMemoria();
    const binarios = creaAlmacenDeBinarios();
    const { copia } = empezarSobre({ almacen: limpio, binarios });
    const abierta = await copia.valida(comparte.compartido[0].contenido);
    assert.equal(abierta.error, null, 'la copia guardada no se puede volver a abrir');

    const nueva = creaCopia({
      almacen: limpio,
      binarios,
      comparte: hojaDeCompartir(),
      elige: async () => ({ cancelada: false, nombre: comparte.compartido[0].nombre, contenido: comparte.compartido[0].contenido }),
      nucleo: NUCLEO_DE_LA_COPIA,
    });
    await nueva.abre();

    const vuelta = await cargaPartida({ almacen: limpio, semilla: partida.semilla });
    assert.equal(vuelta.estado.personaje.nombre, 'Sabela', 'no ha vuelto el personaje');
    assert.equal(vuelta.estado.diario.entradas.length, partida.estado.diario.entradas.length, 'no ha vuelto el diario');
    assert.deepEqual(
      JSON.stringify(vuelta.estado.nucleos),
      JSON.stringify(partida.estado.nucleos),
      'no han vuelto los rangos de los núcleos',
    );
    assert.ok((await limpio.lista('mapa/')).includes(CLAVES.indice(partida.casa.id)), 'no ha vuelto el mundo');
    assert.equal(binarios.tiene(partida.referencia), true, 'no ha vuelto el recurso binario residente');
  });

  test('Borrar lleva al arranque', async () => {
    const partida = await partidaCompleta();
    // Los ajustes de esta partida no son los de origen, para que «vuelven a los de una
    // instalación nueva» diga algo y no sea una comparación consigo misma.
    cambiaAjuste(partida.estado.ajustes, 'soloDeDia', false);
    await guardaPartida({ estado: partida.estado, registro: partida.registro, almacen: partida.almacen });
    assert.notEqual(JSON.stringify(partida.estado.ajustes), JSON.stringify(AJUSTES_DE_ORIGEN));
    const { empezar } = empezarSobre(partida);

    const resultado = await empezar.borra();

    // Está en la primera pantalla del arranque, y en ninguna otra.
    assert.equal(resultado.destino, DESTINO_TRAS_BORRAR);
    assert.equal(DESTINO_TRAS_BORRAR, 'arranque');
    assert.equal(resultado.estado, ESTADOS_DE_EMPEZAR.BORRANDO);

    // Y no queda nada de la partida anterior bajo ningún prefijo.
    for (const prefijo of PREFIJOS_DE_LA_PARTIDA) {
      assert.deepEqual(await partida.almacen.lista(prefijo), [], `queda algo de la partida anterior bajo "${prefijo}"`);
    }
    assert.deepEqual(await partida.almacen.lista(''), [], 'queda algo en el almacén después de borrar');
    assert.deepEqual(partida.binarios.guardados(), [], 'quedan binarios del mundo congelado después de borrar');
    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), false, 'la marca de borrado sigue puesta con el borrado terminado');

    // Y no hay ninguna partida que ofrecer: lo siguiente es una instalación nueva, con
    // los ajustes en sus valores de origen y no en los que tenía la partida borrada.
    await assert.rejects(
      () => cargaPartida({ almacen: partida.almacen, semilla: partida.semilla }),
      /no hay ninguna partida que ofrecer/,
      'después de borrar todavía se puede cargar una partida',
    );
    const nueva = estadoInicial({ semilla: partida.semilla });
    assert.equal(JSON.stringify(nueva.ajustes), JSON.stringify(AJUSTES_DE_ORIGEN), 'los ajustes de una instalación nueva no son los de origen');
  });
});

describe('Dos registros con una sola frontera', () => {
  test('Los ajustes son la única excepción', async () => {
    // El escenario de la batería, verificado en `@nucleo` sobre el dato como ya hace
    // `lenguaje.test.mjs`. Esta pantalla es el caso extremo: aquí se habla como
    // aplicación sin disfraz, porque disfrazar de mundo la destrucción de un mundo sería
    // una trampa. Lo que no se puede ver sin dispositivo —la sans efectiva— vive en
    // `test/app/empezar-de-nuevo.yaml`.
    const partida = await partidaCompleta();
    const { empezar } = empezarSobre(partida);
    const pantalla = await empezar.pregunta({ estado: partida.estado });

    assert.equal(pantalla.sitio, SITIO);
    assert.equal(SITIO, 'ajustes', 'la pantalla cuelga de un sitio que no es el de los ajustes');
    assert.equal(pantalla.registro, REGISTROS.APLICACION, 'la pantalla no declara voz de aplicación');
    assert.equal(pantalla.tipografia, TIPOGRAFIAS.SANS, 'la tipografía no sale del registro');
    for (const texto of pantalla.textos) {
      assert.equal(texto.registro, REGISTROS.APLICACION, `el texto "${texto.id}" no habla como aplicación`);
      assert.equal(texto.tipografia, TIPOGRAFIAS.SANS, `el texto "${texto.id}" no sale en la sans`);
      assert.equal(texto.pantalla, 'a6p7', `el texto "${texto.id}" no se coloca en A6P7`);
    }
    // Y la pantalla no elige su fuente: la coge del registro que declara la composición.
    assert.doesNotMatch(codigoDe('app/pantallas/empezar-de-nuevo.jsx'), /fontFamily:\s*'/, 'la pantalla escoge una tipografía a mano');
    assert.match(codigoDe('app/pantallas/empezar-de-nuevo.jsx'), /familiaDe\(pantalla\.registro\)/, 'la tipografía de la pantalla no sale de su registro');
  });
});

describe('Lo que se pierde, enumerado en cosas', () => {
  test('La enumeración se compone en tiempo de ejecución y omite lo que no hay', async () => {
    // Hueco de la batería: ningún escenario afirma que la enumeración salga de la
    // partida, ni en su caso normal ni en el de la partida del primer día.
    const partida = await partidaCompleta();
    const mapas = await mapasDeLaPartida({ almacen: partida.almacen });

    // La cuenta de días sale del diario de la partida, no de una cifra escrita a mano.
    assert.equal(diasDeDiario(partida.estado.diario), 1);
    const uno = loQueSePierde({ personaje: partida.estado.personaje, mapas, diario: partida.estado.diario, motes: partida.estado.motes });
    assert.equal(uno.find((p) => p.cosa === COSAS.DIARIO).dias, 1);

    // Y si el diario crece, la cuenta crece con él: nada está congelado en el texto.
    const conCuatroDias = { entradas: [1, 2, 3, 4, 4].map((dia, i) => ({ dia, paso: i })) };
    assert.equal(diasDeDiario(conCuatroDias), 4, 'los días de diario no se cuentan por días distintos');
    const cuatro = loQueSePierde({ personaje: partida.estado.personaje, mapas, diario: conCuatroDias, motes: partida.estado.motes });
    assert.equal(cuatro.find((p) => p.cosa === COSAS.DIARIO).dias, 4);
    assert.match(fraseDeLaPerdida(cuatro), /4 d[ií]as de diario/, 'la frase no lleva la cuenta que trae el dato');
    assert.match(fraseDeLaPerdida(uno), /1 d[ií]a de diario/, 'con un solo día la frase no va en singular');

    // Lo que la gente sabe de ti se dice en esos términos, y no como rangos ni escalones
    // ni porcentajes.
    const motes = { mapas: {} };
    declaraCandidato(motes, { mapaId: partida.casa.id, rumor: 'las-campanas', candidato: 'el-de-las-campanas' });
    assert.equal(hayMotes(motes), true, 'un mote candidato declarado no cuenta como algo que la gente sabe de ti');
    const conMotes = loQueSePierde({ personaje: partida.estado.personaje, mapas, diario: partida.estado.diario, motes });
    assert.deepEqual(conMotes.map((p) => p.cosa), [COSAS.PERSONAJE, COSAS.MAPAS, COSAS.DIARIO, COSAS.MOTES]);
    assert.deepEqual(Object.keys(conMotes.find((p) => p.cosa === COSAS.MOTES)), ['cosa'], 'lo que la gente sabe de ti viaja con una cifra al lado');
    const frase = fraseDeLaPerdida(conMotes);
    assert.match(frase, /lo que la gente sabe de ti/, 'lo que la gente sabe no se dice en esos términos');
    assert.doesNotMatch(frase, /rango|escal[oó]n|nivel|%|por ciento|reputaci[oó]n/i, 'lo que la gente sabe se dice como rangos, escalones o porcentajes');
  });

  test('Una partida del primer día enumera lo que hay y nada aparece con cuenta cero', async () => {
    // Hueco de la batería, y es la regla que decide si el aviso se lee: «pierdes 0 días
    // de diario» es exactamente la línea que garantiza que nadie lea el resto.
    const almacen = almacenEnMemoria();
    const estado = delPrimerDia();
    const { empezar } = empezarSobre({ almacen });

    const pantalla = await empezar.pregunta({ estado });

    assert.deepEqual(pantalla.perdida.map((p) => p.cosa), [COSAS.PERSONAJE], 'una partida del primer día enumera cosas que no tiene');
    assert.equal(diasDeDiario(estado.diario), 0);
    assert.equal(hayMotes(estado.motes), false);
    const perdida = textoDe(pantalla, BLOQUES.PERDIDA);
    assert.doesNotMatch(perdida.texto, /\b0\b|ning[uú]n d[ií]a|cero/i, 'la frase de una partida del primer día enumera un cero');
    assert.doesNotMatch(perdida.texto, /diario/, 'sin días de diario la frase sigue hablando del diario');
    assert.doesNotMatch(perdida.texto, /la gente sabe/, 'sin motes la frase sigue hablando de lo que la gente sabe');
    assert.match(perdida.texto, /Sabela/, 'la frase no nombra al personaje');

    // Y sin ningún mapa levantado no hay mundo congelado que explicar: el párrafo **no
    // existe**, y la enumeración sigue siendo correcta.
    assert.equal(pantalla.congelado, null, 'sin mapas se compone un mundo congelado que no existe');
    assert.equal(textoDe(pantalla, BLOQUES.CONGELADO), null, 'sin mapas aparece el párrafo del mundo congelado');
    assert.deepEqual(pantalla.textos.map((t) => t.id), [BLOQUES.PERDIDA, BLOQUES.SALIDA], 'la pantalla sin mundo no se queda en dos bloques');
  });

  test('Un mapa sin título en su índice falla nombrando el mapa en lugar de enumerarlo sin nombre', async () => {
    // Hueco de la batería. Enumerar «se pierde un mapa» es justo lo que esta pantalla no
    // puede decir, así que la composición se cae antes de llegar a la frase.
    const partida = await partidaCompleta();
    const clave = CLAVES.indice(partida.casa.id);
    const indice = JSON.parse(await partida.almacen.lee(clave));
    delete indice.titulo;
    await partida.almacen.escribe(clave, JSON.stringify(indice));

    const mapas = await mapasDeLaPartida({ almacen: partida.almacen });
    assert.equal(mapas.find((m) => m.id === partida.casa.id).titulo, null);
    assert.throws(
      () => loQueSePierde({ personaje: partida.estado.personaje, mapas, diario: partida.estado.diario, motes: partida.estado.motes }),
      new RegExp(partida.casa.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'la enumeración no nombra el mapa que no tiene título',
    );

    const { empezar } = empezarSobre(partida);
    await assert.rejects(() => empezar.pregunta({ estado: partida.estado }), /no tiene t[ií]tulo/, 'la pantalla se compone con un mapa sin nombre');

    // Y un índice declarado que no se puede leer tampoco se salta en silencio.
    await partida.almacen.escribe(clave, 'esto no es JSON');
    await assert.rejects(() => mapasDeLaPartida({ almacen: partida.almacen }), /no se puede leer/, 'un índice ilegible se salta sin decir nada');
  });

  test('Sin el nombre del personaje la enumeración no se compone', async () => {
    // Hueco de la batería. «Tu personaje» a secas es exactamente lo que el diseño
    // prohíbe, así que no hay camino en el que la frase salga sin nombre.
    assert.throws(() => loQueSePierde({ personaje: null, mapas: [] }), /nombre del personaje/);
    assert.throws(() => loQueSePierde({ personaje: { nombre: '' }, mapas: [] }), /nombre del personaje/);
    assert.throws(() => loQueSePierde({ personaje: { nombre: 'Sabela' }, mapas: 'dos' }), /lista de mapas/);
  });

  test('Las únicas cifras de la pantalla son cuentas de cuánto hay dentro', async () => {
    // Hueco de la batería: `design-system.md` no permite ninguna cifra de distancia,
    // tiempo, ritmo ni progreso, y aquí se afirma sobre los textos ya compuestos.
    const partida = await partidaCompleta();
    const { empezar } = empezarSobre(partida);
    const pantalla = await empezar.pregunta({ estado: partida.estado });

    const fijos = Object.values(TEXTOS_DE_EMPEZAR_DE_NUEVO);
    for (const texto of [...pantalla.textos.map((t) => t.texto), ...fijos]) {
      assert.deepEqual(
        cifrasDeTexto(texto, { salvo: ['digitos'] }),
        [],
        `un texto de la pantalla lleva una cifra de distancia, tiempo o progreso: ${JSON.stringify(texto)}`,
      );
    }
    // Los dígitos que sí hay son cuentas de cuánto hay dentro, y ninguno más: el único
    // texto con un número es la frase de lo que se pierde, y el número son los días.
    const conDigitos = pantalla.textos.filter((t) => /\d/.test(t.texto));
    assert.deepEqual(conDigitos.map((t) => t.id), [BLOQUES.PERDIDA], 'hay cifras fuera de la enumeración de lo que se pierde');
    assert.deepEqual(conDigitos[0].texto.match(/\d+/g), ['1'], 'la enumeración lleva alguna cifra que no es la cuenta de días');
    for (const texto of fijos) {
      assert.doesNotMatch(texto, /\d/, `el texto fijo ${JSON.stringify(texto)} lleva una cifra escrita a mano`);
    }
  });

  test('La frase de que no se puede deshacer no aparece nunca sola', async () => {
    // Hueco de la batería. `partida-guardada.md` §4: «esta acción no se puede deshacer»
    // sin las cosas al lado no dice nada que nadie lea, así que va dentro de la misma
    // frase que las enumera y no en un texto propio.
    const partida = await partidaCompleta();
    const { empezar } = empezarSobre(partida);
    const pantalla = await empezar.pregunta({ estado: partida.estado });

    const conDeshacer = pantalla.textos.filter((t) => /no se puede deshacer/i.test(t.texto));
    assert.deepEqual(conDeshacer.map((t) => t.id), [BLOQUES.PERDIDA], 'la frase de que no se puede deshacer vive en un bloque propio');
    assert.match(conDeshacer[0].texto, /Sabela/, 'la frase de que no se puede deshacer no va acompañada de lo que se pierde');
    for (const texto of Object.values(TEXTOS_DE_EMPEZAR_DE_NUEVO)) {
      assert.doesNotMatch(texto, /no se puede deshacer/i, 'un texto fijo dice que no se puede deshacer sin enumerar nada');
    }
  });
});

describe('Las tres salidas de empezar de nuevo, y cuál es la principal', () => {
  test('Las acciones son tres, guardar va primero y dejarlo como está no desaparece', async () => {
    // Hueco de la batería. La jerarquía va como dato para poder ponerla roja sin abrir un
    // simulador; lo que solo se ve en pantalla —el color y el relleno— vive en Maestro.
    const partida = await partidaCompleta();
    const { empezar } = empezarSobre(partida);
    const pantalla = await empezar.pregunta({ estado: partida.estado });

    assert.deepEqual(pantalla.acciones.map((a) => a.id), ['guardar', 'borrar', 'dejarlo'], 'las acciones no son las tres, en su orden');
    assert.deepEqual(pantalla.acciones.map((a) => a.orden), [1, 2, 3]);
    assert.deepEqual(pantalla.acciones.map((a) => a.peso), ['principal', 'hueca', 'texto']);
    assert.deepEqual(
      pantalla.acciones.filter((a) => a.peso === 'principal').map((a) => a.id),
      ['guardar'],
      'guardar una copia no es la única acción con forma de acción principal',
    );
    // Lo destructivo es la hueca y no la sólida: el gesto fácil no es el que borra.
    const borrar = pantalla.acciones.find((a) => a.id === 'borrar');
    assert.equal(borrar.destructiva, true);
    assert.equal(borrar.peso, 'hueca');
    assert.deepEqual(pantalla.acciones.filter((a) => a.destructiva).map((a) => a.id), ['borrar']);
    // Dejarlo como está está siempre disponible, y es la única que lo está.
    assert.deepEqual(pantalla.acciones.filter((a) => a.siempreDisponible).map((a) => a.id), ['dejarlo']);
    // Y en la pantalla, «dejarlo como está» se pinta fuera del bloque que se sustituye
    // por la línea de espera: no desaparece en ningún estado.
    const jsx = fuente('app/pantallas/empezar-de-nuevo.jsx');
    const espera = jsx.indexOf('enEspera ? (');
    const dejarlo = jsx.indexOf('testids.dejarlo');
    const cierre = jsx.indexOf('</>', espera);
    assert.ok(espera > 0 && dejarlo > cierre, '«dejarlo como está» se pinta dentro del bloque que la espera sustituye');
  });

  test('No hay segundo aviso, ni casilla, ni texto que teclear, ni cuenta atrás', async () => {
    // Hueco de la batería, y su ausencia es una afirmación: el vocabulario de estados es
    // cerrado y no tiene ninguno de confirmación, y no hay ningún `data-testid` para él.
    assert.deepEqual(IDS_DE_ESTADO, ['preguntando', 'guardando-copia', 'borrando', 'no-se-pudo']);
    assert.deepEqual(Object.values(ESTADOS_DE_EMPEZAR).sort(), ['borrando', 'guardando-copia', 'no-se-pudo', 'preguntando']);
    assert.equal(Object.isFrozen(ESTADOS_DE_EMPEZAR), true, 'un vocabulario cerrado que se puede ampliar en caliente no es cerrado');
    assert.deepEqual(
      Object.keys(TESTIDS).sort(),
      ['borrar', 'congelado', 'dejarlo', 'estado', 'guardar', 'momento', 'pantalla', 'perdida'],
      'la pantalla declara un localizador que la spec no tiene, o le falta uno',
    );
    for (const [nombre, valor] of Object.entries(TESTIDS)) {
      assert.doesNotMatch(valor, /confirma|casilla|escribe|teclea|seguro/i, `el localizador "${nombre}" es de una confirmación secundaria`);
    }
    for (const ruta of ENTREGA) {
      assert.doesNotMatch(codigoDe(ruta), /confirmaci[oó]n|casilla|checkbox|cuenta atr[aá]s|setTimeout|setInterval/i, `${ruta} monta una confirmación secundaria o una cuenta atrás`);
    }
    assert.equal(MOMENTO, 'de-consulta');
    assert.equal(TESTIDS.momento, 'momento');

    // Y borrar borra: la acción no devuelve ningún estado intermedio que pida confirmar.
    const partida = await partidaCompleta();
    const { empezar } = empezarSobre(partida);
    const resultado = await empezar.borra();
    assert.equal(resultado.borrado, true, 'borrar sin guardar nada no ha borrado a la primera');
    assert.deepEqual(await partida.almacen.lista(''), []);
  });

  test('Dejar la pantalla sin hacer nada no toca la partida ni deja marca de haber entrado', async () => {
    // Hueco de la batería. Es lo que hace que «dejarlo como está» sea de verdad una
    // salida: entrar y salirse tiene que ser indistinguible de no haber entrado.
    const partida = await partidaCompleta();
    const antes = await volcado(partida.almacen);
    const { comparte, empezar } = empezarSobre(partida);
    partida.almacen.registro.length = 0;

    await empezar.pregunta({ estado: partida.estado });
    await empezar.pregunta({ estado: partida.estado });

    assert.deepEqual(partida.almacen.operaciones('escribe'), [], 'entrar en la pantalla ha escrito en la partida');
    assert.deepEqual(partida.almacen.operaciones('borra'), [], 'entrar en la pantalla ha borrado algo');
    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), false, 'entrar en la pantalla ha marcado la partida como en borrado');
    assert.equal(JSON.stringify(await volcado(partida.almacen)), JSON.stringify(antes), 'la partida no es idéntica byte a byte después de entrar y salirse');
    assert.deepEqual(comparte.compartido, [], 'entrar en la pantalla ha guardado una copia');
    assert.equal(await exigeSinBorradoAMedias({ almacen: partida.almacen }), true, 'la partida no se puede abrir después de haber entrado en la pantalla');
  });
});

describe('La copia se ofrece pero no se hace sola, y si no se guarda no se borra', () => {
  test('Una exportación que falla antes de borrar deja la partida entera y sin marca', async () => {
    // Hueco de la batería, y la decisión más cara de la spec: encadenar el borrado a una
    // exportación fallida sería la peor degradación posible del proyecto.
    const partida = await partidaCompleta();
    const antes = await volcado(partida.almacen);
    const { comparte, empezar } = empezarSobre({ ...partida, comparte: hojaDeCompartir({ falla: true }) });

    const resultado = await empezar.guardaCopiaYBorra();

    assert.equal(resultado.borrado, false, 'la exportación ha fallado y la partida se ha borrado igual');
    assert.equal(resultado.estado, ESTADOS_DE_EMPEZAR.NO_SE_PUDO);
    assert.equal(resultado.destino, null, 'una exportación fallida lleva al arranque');
    assert.match(resultado.aviso, /No se ha borrado nada/, 'no se dice que no se ha borrado nada');
    assert.match(resultado.aviso, /sigue como estaba/, 'no se dice que la partida sigue como estaba');
    assert.deepEqual(comparte.compartido, [], 'ha salido un fichero de una exportación que falló');

    // Byte a byte igual, sin marca de borrado y sin binarios olvidados.
    assert.equal(JSON.stringify(await volcado(partida.almacen)), JSON.stringify(antes), 'la partida ha cambiado al fallar la copia');
    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), false, 'una copia fallida ha dejado la partida marcada como en borrado');
    assert.equal(partida.binarios.tiene(partida.referencia), true, 'una copia fallida se ha llevado los binarios del mundo congelado');
    assert.equal(await exigeSinBorradoAMedias({ almacen: partida.almacen }), true, 'la partida no se puede volver a abrir después de una copia fallida');
  });

  test('Cancelar la hoja del sistema deja la partida entera y las tres acciones vuelven', async () => {
    // Hueco de la batería, y la otra mitad del mismo criterio: quien se echa atrás en la
    // hoja del sistema no ha decidido borrar.
    const partida = await partidaCompleta();
    const antes = await volcado(partida.almacen);
    const { comparte, empezar } = empezarSobre({ ...partida, comparte: hojaDeCompartir({ cancelada: true }) });

    const resultado = await empezar.guardaCopiaYBorra();

    assert.equal(resultado.borrado, false, 'cancelar la hoja del sistema ha borrado la partida');
    assert.equal(resultado.cancelada, true);
    // Vuelve a preguntar: las tres acciones están, y no se queda en un estado de error.
    assert.equal(resultado.estado, ESTADOS_DE_EMPEZAR.PREGUNTANDO, 'cancelar deja la pantalla en un estado que no es el de las tres acciones');
    assert.equal(resultado.error, null, 'cancelar se cuenta como un error');
    assert.equal(resultado.aviso, TEXTOS_DE_EMPEZAR_DE_NUEVO.sinGuardar);
    assert.match(resultado.aviso, /No se ha guardado nada/, 'no se dice que no se ha guardado nada');
    assert.match(resultado.aviso, /sigue como estaba/, 'no se dice que la partida sigue');
    assert.deepEqual(comparte.compartido, [], 'una hoja cancelada ha dejado un fichero');

    assert.equal(JSON.stringify(await volcado(partida.almacen)), JSON.stringify(antes), 'la partida ha cambiado al cancelar la hoja del sistema');
    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), false, 'una hoja cancelada ha dejado la partida marcada como en borrado');
    assert.equal(partida.binarios.tiene(partida.referencia), true, 'una hoja cancelada se ha llevado los binarios');
  });

  test('Los ficheros que se exportaron no se tocan al borrar', async () => {
    // Hueco de la batería, y es lo que convierte «guardar una copia» en una salida real:
    // el fichero vive fuera del directorio de la partida y es de quien juega.
    const partida = await partidaCompleta();
    const { comparte, empezar } = empezarSobre(partida);

    await empezar.guardaCopiaYBorra();

    assert.equal(comparte.compartido.length, 1);
    const fichero = comparte.compartido[0].contenido;
    assert.ok(fichero.length > 0, 'el fichero exportado ha quedado vacío');

    // Nada de lo que se borró vive fuera del directorio de la partida.
    const borradas = partida.almacen.operaciones('borra');
    assert.ok(borradas.length > 0, 'no se ha borrado nada');
    for (const clave of borradas) {
      assert.ok(
        PREFIJOS_DE_LA_PARTIDA.some((p) => clave.startsWith(p)),
        `el borrado ha alcanzado "${clave}", que está fuera del directorio de la partida`,
      );
    }
    // Y el fichero sigue entero después: nadie lo ha vuelto a tocar.
    assert.equal(comparte.compartido[0].contenido, fichero, 'el fichero exportado ha cambiado después del borrado');
  });

  test('Empezar de nuevo no se construye sin la copia, sin el almacén o sin el núcleo entero', async () => {
    // Hueco de la batería. Una pantalla que borrase sin poder ofrecer la copia
    // convertiría «guardar una copia primero» en una promesa que no se puede cumplir, y
    // eso se protesta al construir y no al borrar, que es cuando ya no hay a quién.
    const partida = await partidaCompleta();
    const { copia } = empezarSobre(partida);
    const completo = { almacen: partida.almacen, binarios: partida.binarios, copia, nucleo: NUCLEO_DE_EMPEZAR };

    assert.throws(() => creaEmpezarDeNuevo(), /almac[eé]n/i);
    assert.throws(() => creaEmpezarDeNuevo({ ...completo, almacen: null }), /almac[eé]n/i);
    assert.throws(() => creaEmpezarDeNuevo({ ...completo, copia: null }), /guardar una copia/);
    assert.throws(() => creaEmpezarDeNuevo({ ...completo, nucleo: null }), /n[uú]cleo inyectado/);

    assert.equal(DEL_NUCLEO.length, 15, `empezar de nuevo enumera ${DEL_NUCLEO.length} piezas y la comprobación esperaba 15`);
    assert.deepEqual([...DEL_NUCLEO].sort(), Object.keys(NUCLEO_DE_EMPEZAR).sort(), 'el bundle de prueba y lo que la pantalla exige han dejado de ser lo mismo');
    for (const pieza of DEL_NUCLEO) {
      assert.throws(
        () => creaEmpezarDeNuevo({ ...completo, nucleo: { ...NUCLEO_DE_EMPEZAR, [pieza]: undefined } }),
        new RegExp(pieza),
        `empezar de nuevo se ha construido con un núcleo sin "${pieza}"`,
      );
    }

    // Y lo que expone es esto y nada más: cualquier ruta nueva tiene que ponerse roja
    // aquí antes de existir.
    const { empezar } = empezarSobre(partida);
    assert.deepEqual(Object.keys(empezar).sort(), ['borra', 'guardaCopiaYBorra', 'hayPendiente', 'pregunta', 'terminaPendiente']);
  });
});

describe('El borrado no se queda a medias', () => {
  test('Primero se marca la partida como en borrado y después se borra', async () => {
    // Hueco de la batería, y aplicación directa de §6h: sin la marca, una interrupción
    // deja una partida con parte de sus documentos, que se abre y parece jugable.
    const partida = await partidaCompleta();
    partida.almacen.registro.length = 0;

    const claves = await marcaBorrado({ almacen: partida.almacen });
    const primeras = partida.almacen.registro.filter((o) => o.op === 'escribe' || o.op === 'borra');
    assert.equal(primeras[0].op, 'escribe', 'lo primero que hace un borrado no es escribir la marca');
    assert.equal(primeras[0].clave, CLAVE_DE_BORRADO_EN_CURSO, 'lo primero que se escribe no es la marca de borrado');
    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), true);

    // La marca declara qué había cuando se decidió borrar, con el estado y el registro
    // los primeros: mientras el estado esté, la partida podría parecer abrible.
    const doc = JSON.parse(await partida.almacen.lee(CLAVE_DE_BORRADO_EN_CURSO));
    assert.deepEqual(doc.claves, claves);
    assert.deepEqual(doc.claves.slice(0, 2), [CLAVES_DE_PARTIDA.estado, CLAVES_DE_PARTIDA.registro], 'el estado y el registro no se borran los primeros');
    assert.equal(doc.claves.includes(CLAVE_DE_BORRADO_EN_CURSO), false, 'la marca se declara a sí misma entre lo que hay que borrar');
    assert.equal(doc.clase, JSON.parse(JSON.stringify(documentoDeBorrado(claves))).clase);

    // Y la marca se quita la última, cuando ya no queda nada.
    partida.almacen.registro.length = 0;
    await terminaBorrado({ almacen: partida.almacen, binarios: partida.binarios });
    const borradas = partida.almacen.operaciones('borra');
    assert.equal(borradas[borradas.length - 1], CLAVE_DE_BORRADO_EN_CURSO, 'la marca no se quita la última');
    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), false);
    assert.deepEqual(await partida.almacen.lista(''), []);
  });

  test('Un borrado interrumpido por un cierre de la app se termina al volver a abrir', async () => {
    // Hueco de la batería, y es el único camino por el que puede quedar una partida a
    // medias. Se corta a mitad de verdad: el almacén se cae al borrar la tercera clave.
    const partida = await partidaCompleta();
    let caidas = 0;
    const borra = partida.almacen.borra.bind(partida.almacen);
    partida.almacen.borra = async (clave) => {
      caidas += 1;
      if (caidas === 3) throw new Error('la app se ha cerrado a mitad del borrado');
      return borra(clave);
    };
    const { empezar } = empezarSobre(partida);

    const cortado = await empezar.borra();
    assert.equal(cortado.borrado, false, 'un borrado que se cae a mitad se declara terminado');
    assert.equal(cortado.estado, ESTADOS_DE_EMPEZAR.NO_SE_PUDO);
    assert.match(cortado.aviso, /Se terminar[aá] de borrar al volver a abrir/, 'no se dice que el borrado se terminará al volver a abrir');
    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), true, 'un borrado cortado a mitad ha dejado la partida sin marca');
    assert.ok((await partida.almacen.lista('')).length > 1, 'la prueba no ha llegado a cortar el borrado a mitad');

    // Al volver a abrir: se remata y se llega al arranque, no a una partida a medias.
    partida.almacen.borra = borra;
    const rematado = await empezar.terminaPendiente();
    assert.equal(rematado.habia, true, 'al volver a abrir no se ha visto el borrado pendiente');
    assert.equal(rematado.destino, DESTINO_TRAS_BORRAR, 'un borrado rematado no lleva al arranque');
    assert.deepEqual(await partida.almacen.lista(''), [], 'queda algo de la partida después de rematar el borrado');
    assert.deepEqual(partida.binarios.guardados(), [], 'quedan binarios después de rematar el borrado');

    // Y rematar es idempotente: llamarlo dos veces no es un error, que es lo que hace
    // que abrir la app termine el trabajo sin saber por dónde se quedó.
    const otra = await empezar.terminaPendiente();
    assert.deepEqual(JSON.parse(JSON.stringify(otra)), { habia: false, borradas: 0, destino: null });
    assert.equal(await empezar.hayPendiente(), false);
  });

  test('Una partida marcada como en borrado no se abre por ninguna ruta', async () => {
    // Hueco de la batería. A medio borrar no queda partida que rescatar, solo documentos
    // sueltos, y ofrecer rescatarla sería prometer algo que no se puede cumplir.
    const partida = await partidaCompleta();
    await marcaBorrado({ almacen: partida.almacen });

    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), true);
    await assert.rejects(
      () => exigeSinBorradoAMedias({ almacen: partida.almacen }),
      (e) => {
        assert.match(e.message, /borrado a medio hacer/, 'el error no dice que hay un borrado a medias');
        assert.ok(e.message.includes(CLAVE_DE_BORRADO_EN_CURSO), 'el error no nombra la marca');
        assert.match(e.message, /no se abre/, 'el error no dice que la partida no se abre');
        assert.doesNotMatch(e.message, /rescat\w+ (la|esta) partida/i, 'el error ofrece rescatar la partida a medio borrar');
        return true;
      },
    );

    // Ni siquiera con el estado todavía en el almacén: la marca manda sobre lo que quede.
    assert.notEqual(await partida.almacen.lee(CLAVES_DE_PARTIDA.estado), null, 'la prueba no ha llegado a dejar el estado en su sitio');
    // Y una marca ilegible sigue siendo una marca: lo que dice no depende de poder leerla.
    await partida.almacen.escribe(CLAVE_DE_BORRADO_EN_CURSO, 'esto no es JSON');
    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), true, 'una marca ilegible deja de ser una marca');
    await assert.rejects(() => exigeSinBorradoAMedias({ almacen: partida.almacen }), /borrado a medio hacer/);
    const rematado = await terminaBorrado({ almacen: partida.almacen });
    assert.equal(rematado.destino, DESTINO_TRAS_BORRAR);
    assert.deepEqual(await partida.almacen.lista(''), [], 'una marca ilegible impide terminar el borrado');
  });

  test('Un almacén que falla al borrar una clave la nombra y la partida sigue marcada', async () => {
    // Hueco de la batería. No se reintenta en bucle: con la marca puesta, volver a entrar
    // termina el trabajo.
    const partida = await partidaCompleta();
    const diana = CLAVES.indice(partida.casa.id);
    const borra = partida.almacen.borra.bind(partida.almacen);
    partida.almacen.borra = async (clave) => {
      if (clave === diana) throw new Error('el almacén se ha caído');
      return borra(clave);
    };

    await assert.rejects(
      () => borraPartida({ almacen: partida.almacen, binarios: partida.binarios }),
      (e) => {
        assert.ok(e.message.includes(diana), 'el error no nombra la clave que no se pudo borrar');
        assert.match(e.message, /sigue marcada como en borrado/, 'el error no dice que la partida sigue marcada');
        return true;
      },
    );
    assert.equal(await hayBorradoAMedias({ almacen: partida.almacen }), true, 'un borrado que falló ha quitado la marca');
    assert.equal(partida.binarios.tiene(partida.referencia), true, 'los binarios se han olvidado antes de terminar de borrar');

    // El error no se traga y no se reintenta solo: la pantalla lo cuenta en una línea.
    const { empezar } = empezarSobre(partida);
    const resultado = await empezar.borra();
    assert.equal(resultado.borrado, false);
    assert.equal(resultado.aviso, TEXTOS_DE_EMPEZAR_DE_NUEVO.noSePudoBorrar);
    assert.doesNotMatch(resultado.aviso, /reintent|volver a intentarlo/i, 'el aviso ofrece reintentar');
    assert.ok(resultado.error.detalle.includes(diana), 'el detalle no nombra la clave');
  });
});

describe('Borrar no es reiniciar', () => {
  test('Después de borrar la semilla de la partida anterior no está en ninguna clave ni en ningún valor', async () => {
    // Hueco de la batería: «y no queda nada de la partida anterior» es una línea del
    // escenario de borrado, pero nada afirma que la semilla no sobreviva, que es la forma
    // en que este requisito se rompería de verdad.
    const partida = await partidaCompleta();
    const antes = await volcado(partida.almacen);
    assert.ok(
      antes.some(([clave, valor]) => clave.includes(partida.semilla) || String(valor).includes(partida.semilla)),
      'la prueba no ha llegado a tener la semilla dentro del almacén',
    );

    const { empezar } = empezarSobre(partida);
    await empezar.borra();

    const despues = await volcado(partida.almacen, ['']);
    assert.deepEqual(despues, [], 'queda algo en el almacén después de borrar');
    for (const [clave, valor] of despues) {
      assert.doesNotMatch(clave, new RegExp(partida.semilla), `la semilla sobrevive en la clave "${clave}"`);
      assert.doesNotMatch(String(valor), new RegExp(partida.semilla), `la semilla sobrevive dentro de "${clave}"`);
    }
    assert.deepEqual(partida.binarios.guardados(), [], 'quedan binarios de la partida anterior');
  });

  test('No hay ninguna ruta que cree una partida conservando la semilla ni que regenere el mismo mapa', async () => {
    // Hueco de la batería. La forma de romper «borrar y no reiniciar» es ofrecer «el
    // mismo mundo otra vez», así que se afirma sobre el código de la entrega: ninguno de
    // sus tres ficheros toca una semilla fuera de sus comentarios.
    for (const ruta of ENTREGA) {
      assert.doesNotMatch(codigoDe(ruta), /semilla|seed/i, `${ruta} toca la semilla de la partida en su código`);
      assert.doesNotMatch(codigoDe(ruta), /regenera|rehac[eé]|mismo mundo|mismo mapa/i, `${ruta} ofrece regenerar el mismo mundo`);
    }
    // Y lo que el paquete expone para esta pantalla es una lista cerrada, sin ninguna
    // función de rearranque: una ruta nueva tiene que ponerse roja aquí antes de existir.
    const paquete = await import('../../packages/nucleo/partida/borrado.js');
    assert.deepEqual(
      Object.keys(paquete).filter((k) => typeof paquete[k] === 'function').sort(),
      [
        'borraPartida', 'clavesABorrar', 'componeEmpezarDeNuevo', 'diasDeDiario', 'documentoDeBorrado',
        'exigeSinBorradoAMedias', 'hayBorradoAMedias', 'hayMotes', 'loQueSePierde', 'mapasDeLaPartida',
        'marcaBorrado', 'terminaBorrado', 'terminaBorradoPendiente',
      ],
      'empezar de nuevo expone una función que la spec no declara',
    );
    // El único destino que declara es el arranque.
    assert.equal(DESTINO_TRAS_BORRAR, 'arranque');
    const partida = await partidaCompleta();
    const resultado = await borraPartida({ almacen: partida.almacen, binarios: partida.binarios });
    assert.deepEqual(Object.keys(resultado).sort(), ['borradas', 'destino'], 'el borrado devuelve algo más que cuánto borró y adónde va');
  });

  test('Empezar otra vez en la misma calle da otra semilla y otro mundo', async () => {
    // Hueco de la batería. Con el mundo congelado, la misma coordenada con otra semilla
    // no reproduce nada: es lo que hace falsa la promesa de «el mismo mundo otra vez».
    const partida = await partidaCompleta();
    const antes = JSON.stringify(JSON.parse(await partida.almacen.lee(CLAVES.celda(partida.casa.id, '0,0'))).mundo);
    const semillaAnterior = partida.semilla;

    const { empezar } = empezarSobre(partida);
    await empezar.borra();
    assert.deepEqual(await partida.almacen.lista(''), []);

    // La misma calle, otra semilla: el mapa se levanta igual y el mundo es otro.
    assert.notEqual(SEMILLA_B, semillaAnterior);
    const otra = await mapaGuardado({ almacen: partida.almacen, arranque: ANCLAJE_DE_CASA, semilla: SEMILLA_B });
    const despues = JSON.stringify(JSON.parse(await partida.almacen.lee(CLAVES.celda(otra.id, '0,0'))).mundo);
    assert.notEqual(despues, antes, 'empezar otra vez en la misma calle ha reproducido el mismo mundo');
  });
});
