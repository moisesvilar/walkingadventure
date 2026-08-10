// Empezar de nuevo, que es **borrar y no reiniciar**: qué se pierde —como dato y no
// como frase—, la marca de borrado en curso, las claves que se borran y el orden en
// que se borran.
//
// Tres decisiones que no son de estilo, y las tres salen de `partida-guardada.md` §4:
//
// - **Lo que se pierde se entrega enumerado en cosas**: el personaje con su nombre, los
//   mapas con su título, los días de diario con su cuenta y si hay motes. La redacción
//   la monta la pantalla; lo que vive aquí es el dato, porque «la enumeración nombra
//   los mapas por su título» se puede poner rojo y sobre una frase montada a mano no.
// - **Lo que no hay no se enumera**, jamás con un cero. Una partida del primer día
//   enseña una frase más corta, y no «pierdes 0 días de diario», que es exactamente el
//   tipo de línea que garantiza que nadie lea el resto del aviso.
// - **Se marca antes de borrar.** La marca se escribe la primera y se quita la última,
//   así que una interrupción en cualquier punto tiene un único final posible: al volver
//   a abrir, la marca está, el borrado se termina y se llega al arranque. Sin ella, una
//   interrupción deja una partida con parte de sus documentos, que se abre, que parece
//   jugable y que falla más tarde por una celda que el índice declara y el almacén no
//   tiene — la familia de fallo de `pipeline/decisiones-orquestador.md` §6h.
//
// Y lo que aquí **no** se toca en ningún caso: los ficheros que quien juega exportó.
// Viven fuera del directorio de la partida —el almacén no los alcanza— y son suyos.
// Borrarlos convertiría «guardar una copia primero» en una trampa.

import { congelaHondo } from '../core/congelar.js';
import {
  CLASES,
  VERSION_FORMATO,
  VERSION_GENERADOR,
  campos,
  declaraEsquema,
  escribe,
  lista,
  texto as textoCanonico,
} from './formato.js';
import { PREFIJOS_DE_LA_PARTIDA } from './exportacion.js';
import { exigeAlmacen } from './mapa.js';
import { CLAVES_DE_PARTIDA } from './reconstruccion.js';

/** El sitio del juego del que cuelga esta pantalla. El mismo de A6P6, y por eso habla como aplicación. */
export const SITIO = 'ajustes';

/** El momento del bucle que declara A6P7. El mismo que los ajustes de los que cuelga. */
export const MOMENTO = 'de-consulta';

/** Los localizadores de A6P7. Los consume la pantalla y no se inventa ninguno. */
export const TESTIDS = congelaHondo({
  momento: 'momento',
  pantalla: 'empezar-de-nuevo',
  perdida: 'empezar-de-nuevo-perdida',
  congelado: 'empezar-de-nuevo-congelado',
  guardar: 'empezar-de-nuevo-guardar',
  borrar: 'empezar-de-nuevo-borrar',
  dejarlo: 'empezar-de-nuevo-dejarlo',
  estado: 'empezar-de-nuevo-estado',
});

/**
 * El vocabulario cerrado del estado de la pantalla, y ninguno más.
 *
 * No hay ningún estado de confirmación: **no hay segundo aviso, ni casilla, ni texto
 * que teclear**. Un segundo aviso es la manera de no tener que escribir bien el
 * primero, y además enseña a confirmar sin leer.
 */
export const ESTADOS_DE_EMPEZAR = Object.freeze({
  PREGUNTANDO: 'preguntando',
  GUARDANDO_COPIA: 'guardando-copia',
  BORRANDO: 'borrando',
  NO_SE_PUDO: 'no-se-pudo',
});

/** Los cuatro estados, en el orden en que se declaran. */
export const IDS_DE_ESTADO = congelaHondo(Object.values(ESTADOS_DE_EMPEZAR));

/** Adónde lleva un borrado terminado. A la primera pantalla, y a ninguna otra. */
export const DESTINO_TRAS_BORRAR = 'arranque';

/** Las cuatro cosas que se pierden. Lista cerrada y en su orden de lectura. */
export const COSAS = Object.freeze({
  PERSONAJE: 'personaje',
  MAPAS: 'mapas',
  DIARIO: 'diario',
  MOTES: 'motes',
});

/** El orden en que se enumeran. Del personaje hacia fuera, que es como se pierde una partida. */
export const ORDEN_DE_LAS_COSAS = congelaHondo([COSAS.PERSONAJE, COSAS.MAPAS, COSAS.DIARIO, COSAS.MOTES]);

/**
 * Las tres salidas de A6P7, en su orden y con su peso.
 *
 * El orden vertical es el que fija la jerarquía y **el color de lo destructivo va en el
 * botón hueco y no en el sólido**, para que el gesto fácil no sea el que borra. Va como
 * dato y no como maquetación porque «guardar una copia va primero y es la única con
 * forma de acción principal» tiene que poder ponerse rojo sin abrir un simulador.
 */
export const ACCIONES = congelaHondo([
  { id: 'guardar', testid: TESTIDS.guardar, orden: 1, peso: 'principal', destructiva: false, siempreDisponible: false },
  { id: 'borrar', testid: TESTIDS.borrar, orden: 2, peso: 'hueca', destructiva: true, siempreDisponible: false },
  { id: 'dejarlo', testid: TESTIDS.dejarlo, orden: 3, peso: 'texto', destructiva: false, siempreDisponible: true },
]);

// --- La marca de borrado en curso --------------------------------------------

/** Dónde vive la marca de que hay un borrado a medias. */
export const CLAVE_DE_BORRADO_EN_CURSO = 'partida/borrando.json';

/** El documento de la marca: qué claves había cuando se decidió borrar. */
export const ESQUEMA_BORRADO = campos({
  version: 'entero',
  generador: 'texto',
  clase: 'texto',
  claves: lista('texto'),
});

declaraEsquema(CLASES.BORRADO, ESQUEMA_BORRADO);

/** El documento de la marca, validado contra su esquema cerrado. */
export function documentoDeBorrado(claves) {
  const doc = {
    version: VERSION_FORMATO,
    generador: VERSION_GENERADOR,
    clase: CLASES.BORRADO,
    claves: (claves ?? []).slice(),
  };
  escribe(doc, ESQUEMA_BORRADO, 'documento borrado-en-curso');
  return congelaHondo(doc);
}

/**
 * Las claves de la partida, **en el orden en que se borran**.
 *
 * El estado y el registro van los primeros y la marca no va: se quita la última, cuando
 * ya no queda nada. Ese orden no es cosmético — mientras el estado esté, una partida a
 * medio borrar podría parecer abrible; en cuanto se va, lo único que queda son
 * documentos sueltos que nadie confunde con una partida.
 */
export async function clavesABorrar({ almacen } = {}) {
  exigeAlmacen(almacen, 'clavesABorrar');
  const primeras = [CLAVES_DE_PARTIDA.estado, CLAVES_DE_PARTIDA.registro];
  const vistas = new Set();
  const ordenadas = [];
  const todas = new Set();
  for (const prefijo of PREFIJOS_DE_LA_PARTIDA) {
    for (const clave of (await almacen.lista(prefijo)) ?? []) todas.add(clave);
  }
  for (const clave of primeras) {
    if (todas.has(clave) && !vistas.has(clave)) {
      vistas.add(clave);
      ordenadas.push(clave);
    }
  }
  for (const clave of [...todas].sort()) {
    if (clave === CLAVE_DE_BORRADO_EN_CURSO || vistas.has(clave)) continue;
    vistas.add(clave);
    ordenadas.push(clave);
  }
  return congelaHondo(ordenadas);
}

/** Si hay un borrado a medio hacer. Es lo único que decide si al abrir se termina. */
export async function hayBorradoAMedias({ almacen } = {}) {
  exigeAlmacen(almacen, 'hayBorradoAMedias');
  return (await almacen.lee(CLAVE_DE_BORRADO_EN_CURSO)) != null;
}

/**
 * Que no haya ningún borrado a medias, o un error que lo nombra.
 *
 * Se llama antes de abrir la partida por cualquier ruta: **a medio borrar no hay
 * partida que rescatar**, solo documentos sueltos, y ofrecer rescatarla sería prometer
 * algo que no se puede cumplir.
 */
export async function exigeSinBorradoAMedias({ almacen } = {}) {
  exigeAlmacen(almacen, 'exigeSinBorradoAMedias');
  if (await hayBorradoAMedias({ almacen })) {
    throw new Error(
      `hay un borrado a medio hacer (${CLAVE_DE_BORRADO_EN_CURSO}): esta partida no se abre, se termina de borrar. ` +
      'A medio borrar no queda partida que rescatar, solo documentos sueltos',
    );
  }
  return true;
}

/** Escribe la marca. Es lo primero que ocurre en un borrado, antes de borrar nada. */
export async function marcaBorrado({ almacen } = {}) {
  exigeAlmacen(almacen, 'marcaBorrado');
  const claves = await clavesABorrar({ almacen });
  await almacen.escribe(CLAVE_DE_BORRADO_EN_CURSO, textoCanonico(documentoDeBorrado(claves)));
  return claves;
}

/**
 * Termina un borrado ya marcado: borra lo que quede y quita la marca la última.
 *
 * **Se vuelve a listar en lugar de fiarse de la marca**, y la lista de la marca se une
 * a lo que haya: entre las dos cubren tanto lo que se escribió después de marcar como
 * lo que ya no está. Llamarlo dos veces es inofensivo, que es lo que hace que abrir la
 * app termine el trabajo sin saber por dónde se quedó.
 *
 * Si el almacén falla al borrar una clave, **el error se propaga nombrándola y la marca
 * se queda puesta**: la partida sigue declarada en borrado y el siguiente arranque lo
 * remata. No se reintenta en bucle.
 *
 * `borradas` cuenta operaciones de borrado y no claves que existieran: al rematar un
 * borrado interrumpido, la marca declara claves que ya no están y volver a borrarlas no
 * es un error. Es diagnóstico, nunca parte del juego.
 */
export async function terminaBorrado({ almacen, binarios = null } = {}) {
  exigeAlmacen(almacen, 'terminaBorrado');
  const marca = await almacen.lee(CLAVE_DE_BORRADO_EN_CURSO);
  const declaradas = leeClavesDeLaMarca(marca);
  const vivas = await clavesABorrar({ almacen });
  const todas = [...vivas];
  for (const clave of declaradas) if (!todas.includes(clave)) todas.push(clave);

  let borradas = 0;
  for (const clave of todas) {
    try {
      await almacen.borra(clave);
      borradas += 1;
    } catch (e) {
      throw new Error(
        `el borrado de la partida no ha podido borrar la clave ${clave}: ${e?.message ?? String(e)}. ` +
        'La partida sigue marcada como en borrado y se terminará de borrar al volver a abrir',
      );
    }
  }
  // Los binarios residentes son parte del mundo congelado y se van con él. Si no hay
  // almacén de binarios, no hay nada que olvidar: viven en memoria y no sobreviven.
  if (binarios && typeof binarios.olvidaTodo === 'function') binarios.olvidaTodo();

  await almacen.borra(CLAVE_DE_BORRADO_EN_CURSO);
  return congelaHondo({ borradas, destino: DESTINO_TRAS_BORRAR });
}

/**
 * Borra la partida entera: **primero se marca y después se borra**.
 *
 * Lo que devuelve dice cuántas claves se fueron y adónde se va, que es el arranque y
 * ningún otro sitio: no hay ninguna ruta que cree una partida conservando la semilla
 * anterior ni que regenere el mismo mapa, porque con el mundo congelado la semilla no
 * reproduce nada (`partida-guardada.md` §1) y ese atajo sería una promesa falsa.
 */
export async function borraPartida({ almacen, binarios = null } = {}) {
  exigeAlmacen(almacen, 'borraPartida');
  await marcaBorrado({ almacen });
  return terminaBorrado({ almacen, binarios });
}

/**
 * Termina el borrado que quedó a medias, si lo hay. Es lo que se llama **al abrir**.
 *
 * Devuelve si había algo que terminar, para que quien abre pueda ir al arranque en
 * lugar de a una partida que ya no existe.
 */
export async function terminaBorradoPendiente({ almacen, binarios = null } = {}) {
  exigeAlmacen(almacen, 'terminaBorradoPendiente');
  if (!(await hayBorradoAMedias({ almacen }))) return congelaHondo({ habia: false, borradas: 0, destino: null });
  const { borradas } = await terminaBorrado({ almacen, binarios });
  return congelaHondo({ habia: true, borradas, destino: DESTINO_TRAS_BORRAR });
}

function leeClavesDeLaMarca(marca) {
  if (marca == null) return [];
  try {
    const doc = JSON.parse(marca);
    return Array.isArray(doc?.claves) ? doc.claves.filter((c) => typeof c === 'string') : [];
  } catch {
    // Una marca ilegible sigue siendo una marca: lo que dice —que hay un borrado a
    // medias— no depende de poder leer su lista, y lo que hay que borrar se vuelve a
    // listar de todas formas.
    return [];
  }
}

// --- Lo que se pierde, como dato ---------------------------------------------

/**
 * Los mapas de la partida con su título, leídos del índice de cada uno.
 *
 * Un índice que no se puede leer **no se salta en silencio**: sube el error. Enumerar
 * lo que se pierde con un mapa de menos sería peor que no enumerar nada.
 */
export async function mapasDeLaPartida({ almacen } = {}) {
  exigeAlmacen(almacen, 'mapasDeLaPartida');
  const indices = ((await almacen.lista('mapa/')) ?? []).filter((c) => /^mapa\/[^/]+\/indice\.json$/.test(c)).sort();
  const mapas = [];
  for (const clave of indices) {
    const id = /^mapa\/([^/]+)\/indice\.json$/.exec(clave)[1];
    const crudo = await almacen.lee(clave);
    if (crudo == null) {
      throw new Error(`el índice del mapa "${id}" está declarado en el almacén y no se puede leer: la enumeración de lo que se pierde no puede saltárselo`);
    }
    let doc;
    try {
      doc = JSON.parse(crudo);
    } catch (e) {
      throw new Error(`el índice del mapa "${id}" no se puede leer (${e?.message ?? String(e)}): la enumeración de lo que se pierde no puede saltárselo`);
    }
    mapas.push({ id, titulo: doc?.titulo ?? null });
  }
  return congelaHondo(mapas);
}

/** Cuántos días de diario tiene la partida: días distintos con al menos una entrada. */
export function diasDeDiario(diario) {
  const entradas = diario?.entradas;
  if (!Array.isArray(entradas)) return 0;
  const dias = new Set();
  for (const entrada of entradas) if (Number.isInteger(entrada?.dia)) dias.add(entrada.dia);
  return dias.size;
}

/** Si hay algo que la gente sepa de ti: un solo mote candidato declarado ya cuenta. */
export function hayMotes(motes) {
  const mapas = motes?.mapas;
  if (!mapas || typeof mapas !== 'object') return false;
  for (const id of Object.keys(mapas).sort()) {
    const candidatos = mapas[id]?.candidatos;
    if (candidatos && typeof candidatos === 'object' && Object.keys(candidatos).length > 0) return true;
  }
  return false;
}

/**
 * Lo que se pierde, **enumerado en cosas**: el personaje por su nombre, los mapas por
 * el suyo, los días de diario con su cuenta y lo que la gente sabe de ti.
 *
 * Omite lo que no hay en lugar de enumerarlo con cero, y **falla nombrando el mapa** si
 * uno no tiene título en su índice: enumerarlo sin nombre sería enseñar «se pierde un
 * mapa», que es justo lo que esta pantalla no puede decir.
 *
 * Ninguna entrada lleva cifra salvo los días de diario y la de mapas su cuenta: aquí no
 * hay distancia, ni tiempo, ni ritmo, ni progreso (`design-system.md`).
 */
export function loQueSePierde({ personaje = null, mapas = [], diario = null, motes = null } = {}) {
  const nombre = personaje?.nombre;
  if (typeof nombre !== 'string' || !nombre) {
    throw new Error(
      'la enumeración de lo que se pierde necesita el nombre del personaje: se nombra por su nombre y nunca como «tu personaje» a secas ' +
      '(game-design/partida-guardada.md §4)',
    );
  }
  if (!Array.isArray(mapas)) {
    throw new Error(`la enumeración de lo que se pierde espera la lista de mapas con su título y llegó ${JSON.stringify(mapas) ?? String(mapas)}`);
  }
  const titulos = [];
  for (const mapa of mapas) {
    const titulo = mapa?.titulo;
    if (typeof titulo !== 'string' || !titulo) {
      throw new Error(
        `el mapa "${mapa?.id ?? '(sin identificador)'}" no tiene título en su índice y la enumeración lo nombra por su título: ` +
        'un mapa enumerado sin nombre no dice qué se pierde',
      );
    }
    titulos.push(titulo);
  }

  const perdida = [];
  perdida.push({ cosa: COSAS.PERSONAJE, nombre });
  if (titulos.length) perdida.push({ cosa: COSAS.MAPAS, titulos, cuantos: titulos.length });
  const dias = diasDeDiario(diario);
  if (dias > 0) perdida.push({ cosa: COSAS.DIARIO, dias });
  if (hayMotes(motes)) perdida.push({ cosa: COSAS.MOTES });
  return congelaHondo(perdida);
}

/**
 * A6P7 entera como dato: el momento, el registro, lo que se pierde, el mapa congelado
 * —si lo hay— y las tres acciones.
 *
 * El párrafo del mundo congelado **no existe si no hay ningún mapa levantado**: sin
 * mundo congelado no hay nada irrepetible que perder y explicarlo sería un tecnicismo
 * gratuito. Cuando lo hay, se nombra el primero por su título, y que ese título se
 * repita en la enumeración es deliberado: la segunda frase explica algo que la primera
 * no dice.
 */
export function componeEmpezarDeNuevo({ personaje = null, mapas = [], diario = null, motes = null } = {}) {
  const perdida = loQueSePierde({ personaje, mapas, diario, motes });
  const conMapas = perdida.find((p) => p.cosa === COSAS.MAPAS) ?? null;
  return congelaHondo({
    momento: MOMENTO,
    // El sitio del que cuelga la pantalla, que es el que decide si admite voz de
    // aplicación. Aquí se habla como aplicación sin disfraz —es el caso que mejor
    // justifica la excepción de `lenguaje.md`, porque disfrazar de mundo la destrucción
    // de un mundo sería una trampa—, y **el registro lo declara cada texto donde se
    // escribe**, que es en la pantalla: de aquí solo sale el dato, sin una sola frase.
    sitio: SITIO,
    perdida,
    congelado: conMapas ? { titulo: conMapas.titulos[0] } : null,
    acciones: ACCIONES,
    testids: TESTIDS,
    // El vocabulario viaja dentro de la composición para que la pantalla no escriba
    // ninguna de las cuatro palabras a mano: una quinta palabra en el `data-testid` del
    // estado dejaría de ser un vocabulario cerrado sin que nada protestara.
    estados: ESTADOS_DE_EMPEZAR,
    estado: ESTADOS_DE_EMPEZAR.PREGUNTANDO,
    destino: DESTINO_TRAS_BORRAR,
  });
}
