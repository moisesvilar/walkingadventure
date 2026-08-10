// Empezar de nuevo, del lado de la app: **la frase que enumera lo que se pierde** y el
// encadenado de las tres acciones con la exportación de SPEC-039 y el borrado del
// núcleo.
//
// La redacción vive aquí y no en el paquete a propósito: el núcleo entrega lo que se
// pierde como **lista estructurada** —el personaje con su nombre, los mapas con sus
// títulos, los días de diario con su cuenta y si hay motes—, que es lo que hace que
// «los mapas se nombran por su título» y «una partida del primer día no enumera ceros»
// se puedan poner rojos; la frase es voz, y la voz se decide donde se escribe.
//
// Dos reglas de encadenado que no son de estilo, y las dos son de `partida-guardada.md`
// §4:
//
// - **La copia se ofrece y no se hace sola**, y si falla o se cancela **no se borra
//   nada**. Quien elige guardar copia primero no puede perderla por un fallo
//   silencioso; encadenar el borrado a una exportación fallida sería la peor
//   degradación posible del proyecto.
// - **Se marca antes de borrar**, y de eso se encarga el núcleo: aquí solo se llama en
//   orden y se lleva al arranque cuando termina.
//
// Y la regla de cableado de siempre (SPEC-020, repetida en SPEC-039 y en §6u): **el
// núcleo entra por la puerta**. Esto orquesta y no compone nada, así que recibe el
// generador igual que recibe el almacén o la copia. Quien lo monta lo cita por su
// nombre, en `app/nucleo/piezas.js`.

/** Los textos fijos de A6P7, en voz de aplicación, que es la voz de esta pantalla. */
export const TEXTOS_DE_EMPEZAR_DE_NUEVO = Object.freeze({
  volver: '‹ Ajustes',
  titulo: 'Empezar de nuevo',
  guardar: 'Guardar una copia primero',
  borrar: 'Borrar sin guardar nada',
  dejarlo: 'Dejarlo como está',
  salida: 'Si guardas una copia, el fichero se puede volver a abrir cuando quieras.',
  guardando: 'Preparando la copia…',
  borrando: 'Borrando la partida…',
  sinGuardar: 'No se ha guardado nada. Tu partida sigue como estaba.',
  noSePudoGuardar: 'No se ha podido guardar la copia. No se ha borrado nada y tu partida sigue como estaba.',
  noSePudoBorrar: 'No se ha podido borrar del todo. Se terminará de borrar al volver a abrir.',
});

/** Los identificadores de los tres bloques de texto, en el orden en que se leen. */
export const BLOQUES = Object.freeze({ PERDIDA: 'perdida', CONGELADO: 'congelado', SALIDA: 'salida' });

/**
 * Los cuatro nombres de cosa que la lista del núcleo puede traer.
 *
 * Están repetidos aquí y no importados porque este módulo **no cita el paquete**, y lo
 * que se repite es un enumerado de cuatro palabras: si un día aparece una quinta, la
 * frase se queda sin escribirla y eso se ve en la pantalla.
 */
const COSAS = Object.freeze({ PERSONAJE: 'personaje', MAPAS: 'mapas', DIARIO: 'diario', MOTES: 'motes' });

/**
 * Lo que esto le pide al generador, enumerado. Va escrito y no sobreentendido por lo
 * mismo que en `copia.js`: un núcleo al que le falte media interfaz fallaría al borrar
 * una partida y no al construir la pantalla, que es el peor momento posible.
 */
export const DEL_NUCLEO = Object.freeze([
  'REGISTROS', 'coloca', 'textoConRegistro',
  'ESTADOS_DE_EMPEZAR', 'TESTIDS', 'ACCIONES', 'DESTINO_TRAS_BORRAR', 'SITIO',
  'componeEmpezarDeNuevo', 'loQueSePierde', 'mapasDeLaPartida',
  'borraPartida', 'terminaBorradoPendiente', 'exigeSinBorradoAMedias', 'hayBorradoAMedias',
]);

/** La pantalla, para que el error de colocación de un texto la nombre. */
const PANTALLA = 'a6p7';

/**
 * Una enumeración castellana: comas y una «y» antes del último.
 *
 * Con dos mapas, un elemento ya lleva su propia «y» dentro —«los mapas de A y B»— y la
 * conjunción final se apoya en una coma, que es lo que la gramática pide para deshacer
 * esa ambigüedad: «Sabela, los mapas de A y B, y 4 días de diario».
 */
function enumera(partes) {
  if (partes.length <= 1) return partes[0] ?? '';
  const previas = partes.slice(0, -1);
  const ultima = partes[partes.length - 1];
  const coma = partes.length > 2 && partes.some((p) => p.includes(' y ')) ? ',' : '';
  return `${previas.join(', ')}${coma} y ${ultima}`;
}

/** Los mapas por su título, en singular o en plural. Nunca «un mapa» a secas. */
function frasesDeMapas(titulos) {
  return titulos.length === 1 ? `el mapa de ${titulos[0]}` : `los mapas de ${enumera(titulos)}`;
}

/**
 * La frase de lo que se pierde, **compuesta en tiempo de ejecución** desde la lista del
 * núcleo: ninguna cifra escrita a mano, y lo que no hay no aparece.
 *
 * La frase de que no se puede deshacer va **dentro** de esta y no suelta: «esta acción
 * no se puede deshacer» sin las cosas al lado no dice nada que nadie lea.
 */
export function fraseDeLaPerdida(perdida) {
  const partes = [];
  for (const cosa of perdida ?? []) {
    if (cosa.cosa === COSAS.PERSONAJE) partes.push(cosa.nombre);
    else if (cosa.cosa === COSAS.MAPAS) partes.push(frasesDeMapas(cosa.titulos));
    else if (cosa.cosa === COSAS.DIARIO) partes.push(`${cosa.dias} ${cosa.dias === 1 ? 'día' : 'días'} de diario`);
    else if (cosa.cosa === COSAS.MOTES) partes.push('lo que la gente sabe de ti');
    else throw new Error(`la enumeración de lo que se pierde trae "${cosa.cosa}", que esta pantalla no sabe escribir: la frase y la lista se tocan juntas`);
  }
  return `Se pierde todo esto: ${enumera(partes)}. No se puede deshacer, y después vuelves a la primera pantalla.`;
}

/**
 * El párrafo del mundo congelado, con el título del mapa dentro.
 *
 * Es el único sitio del juego donde una decisión técnica se le explica a quien juega, y
 * se explica porque **cambia lo que está a punto de hacer**: quien cree que puede
 * rehacer su mapa toma esta decisión con datos falsos.
 */
export function fraseDelMundoCongelado(titulo) {
  return (
    `El mapa de ${titulo} se dibujó con los datos de aquel día, y esos datos ya han cambiado. `
    + 'No se puede volver a generar: si empiezas otra vez en la misma calle saldrá otro sitio, con otros nombres.'
  );
}

/**
 * Los bloques de texto de A6P7, ya colocados con su registro.
 *
 * Son dos o tres: el del mundo congelado **no existe** si no hay ningún mapa levantado,
 * porque sin mundo congelado no hay nada irrepetible que perder.
 */
export function bloquesDe(compuesta, nucleo) {
  const { REGISTROS, coloca, textoConRegistro } = nucleo;
  const textos = [
    textoConRegistro({ id: BLOQUES.PERDIDA, registro: REGISTROS.APLICACION, texto: fraseDeLaPerdida(compuesta.perdida) }),
  ];
  if (compuesta.congelado) {
    textos.push(textoConRegistro({
      id: BLOQUES.CONGELADO,
      registro: REGISTROS.APLICACION,
      texto: fraseDelMundoCongelado(compuesta.congelado.titulo),
    }));
  }
  textos.push(textoConRegistro({ id: BLOQUES.SALIDA, registro: REGISTROS.APLICACION, texto: TEXTOS_DE_EMPEZAR_DE_NUEVO.salida }));
  return coloca(textos, { sitio: compuesta.sitio, pantalla: PANTALLA });
}

/**
 * Empezar de nuevo, sobre un almacén, con el borrado del núcleo y —si se quiere ofrecer
 * la copia— con `creaCopia` de SPEC-039.
 *
 * @param {object} piezas
 *   `almacen` el almacén duradero de la partida; `binarios` el almacén de recursos
 *   binarios residentes, que se van con el mundo congelado; `copia` lo que devuelve
 *   `creaCopia`, que es quien sabe guardar el fichero; `nucleo` el generador con las
 *   piezas de `DEL_NUCLEO` y ni una menos.
 */
export function creaEmpezarDeNuevo({ almacen, binarios = null, copia = null, nucleo } = {}) {
  if (!almacen) throw new Error('empezar de nuevo necesita el almacén de la partida inyectado: sin él no hay nada que borrar');
  if (!copia) {
    throw new Error(
      'empezar de nuevo necesita guardar una copia inyectado: la copia se ofrece antes de borrar, y una pantalla que borrase sin poder ' +
      'ofrecerla convertiría «guardar una copia primero» en una promesa que no se puede cumplir',
    );
  }
  if (!nucleo) throw new Error('empezar de nuevo necesita el núcleo inyectado: es quien enumera lo que se pierde, marca el borrado y borra');
  const faltan = DEL_NUCLEO.filter((n) => nucleo[n] === undefined);
  if (faltan.length) {
    throw new Error(`al núcleo de empezar de nuevo le faltan ${faltan.length} pieza(s): ${faltan.join(', ')}`);
  }

  const { ESTADOS_DE_EMPEZAR, DESTINO_TRAS_BORRAR } = nucleo;

  /**
   * La pantalla entera: lo que se pierde, el mapa congelado si lo hay, las tres
   * acciones y los bloques de texto ya escritos.
   *
   * **No toca nada y no marca nada**: entrar aquí y salirse deja la partida igual que
   * estaba, sin ninguna huella de haber entrado.
   */
  async function pregunta({ estado = null } = {}) {
    const mapas = await nucleo.mapasDeLaPartida({ almacen });
    const compuesta = nucleo.componeEmpezarDeNuevo({
      personaje: estado?.personaje ?? null,
      mapas,
      diario: estado?.diario ?? null,
      motes: estado?.motes ?? null,
    });
    const textos = bloquesDe(compuesta, nucleo);
    // El registro de la pantalla entera es el de sus textos, y no un campo aparte que
    // alguien pudiera dejar en desacuerdo con ellos. De él sale la tipografía, que
    // ninguna pantalla elige a mano.
    return { ...compuesta, textos, registro: nucleo.REGISTROS.APLICACION, tipografia: textos[0].tipografia };
  }

  /** Borra sin guardar nada. Es la elección explícita, y no lleva un segundo aviso. */
  async function borra() {
    try {
      const { borradas } = await nucleo.borraPartida({ almacen, binarios });
      return { estado: ESTADOS_DE_EMPEZAR.BORRANDO, borrado: true, destino: DESTINO_TRAS_BORRAR, borradas, aviso: null, error: null };
    } catch (e) {
      return {
        estado: ESTADOS_DE_EMPEZAR.NO_SE_PUDO,
        borrado: false,
        destino: null,
        aviso: TEXTOS_DE_EMPEZAR_DE_NUEVO.noSePudoBorrar,
        error: { detalle: e?.message ?? String(e) },
      };
    }
  }

  /**
   * Guarda una copia y, **solo si se guardó de verdad**, borra.
   *
   * Los dos caminos que no borran son los que sostienen la decisión más discutible de
   * esta pantalla: la exportación que falla y la hoja del sistema que se cancela. En
   * los dos la partida sigue entera y se dice en una línea.
   */
  async function guardaCopiaYBorra() {
    let guardada;
    try {
      guardada = await copia.guarda();
    } catch (e) {
      return {
        estado: ESTADOS_DE_EMPEZAR.NO_SE_PUDO,
        borrado: false,
        destino: null,
        aviso: TEXTOS_DE_EMPEZAR_DE_NUEVO.noSePudoGuardar,
        error: { detalle: e?.message ?? String(e) },
      };
    }
    if (guardada?.compartida === false) {
      return {
        estado: ESTADOS_DE_EMPEZAR.PREGUNTANDO,
        borrado: false,
        cancelada: true,
        destino: null,
        aviso: TEXTOS_DE_EMPEZAR_DE_NUEVO.sinGuardar,
        error: null,
      };
    }
    return { ...(await borra()), copia: { nombre: guardada?.nombre ?? null, bytes: guardada?.bytes ?? 0 } };
  }

  /**
   * Termina el borrado que un cierre de la app dejó a medias, si lo hay.
   *
   * Se llama **al abrir**, antes de leer nada de la partida: una partida marcada como
   * en borrado no se abre por ninguna ruta, se termina de borrar.
   */
  async function terminaPendiente() {
    return nucleo.terminaBorradoPendiente({ almacen, binarios });
  }

  /** Si hay un borrado a medias. Lo consume quien decide si abrir la partida o rematarla. */
  async function hayPendiente() {
    return nucleo.hayBorradoAMedias({ almacen });
  }

  return { pregunta, borra, guardaCopiaYBorra, terminaPendiente, hayPendiente };
}
