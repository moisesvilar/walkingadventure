// El zurrón, A2P2: **si hay algo que contar, qué se cuenta, y el vaciado que ocurre al
// leerlo**. Es el resumen de apertura de `quests.md` decisión 3 —marco propio, entradas
// prestadas— sobre la reserva de pasos de fondo que dejó SPEC-011.
//
// Esta capa **no ejecuta ni un paso**. Los de la reserva ya ocurrieron, con su número
// correlativo y su azar, en el momento en que llegaron los metros; lo que la reserva
// guarda es lo que queda **por narrar**. Aquí se coge lo que ya pasó y se cuenta.
//
// Tres decisiones que están aquí y no en la pantalla, porque son las que se pueden poner
// rojas sin dispositivo:
//
//   1. **Si hay zurrón o no.** Tres motivos de que no lo haya, enumerados: el modo apagado,
//      la reserva vacía y la reserva cuyos pasos no produjeron nada narrable. El tercero
//      **vacía igual y no gasta ninguna llamada**: una pantalla que dice que no pasó nada
//      es peor que ninguna pantalla.
//   2. **Una sola llamada agrupada**, la de SPEC-018, y ninguna si no hay entradas. El
//      envoltorio y los textos de las entradas van en la misma petición, y si se cae
//      entera el zurrón se lee igual con textos de plantilla.
//   3. **El vaciado ocurre al confirmar y va con su hecho, entero o nada.** Vaciar al
//      componer perdería en silencio lo único que el mundo hizo mientras nadie miraba si
//      la app muere entre la composición y la pantalla (§6h).
//
// Y una ausencia deliberada: aquí no hay ninguna función que devuelva un zurrón ya leído.
// «Se lee una vez y se va» es lo que impide que esto se convierta en el panel del estado
// del mundo que `design-system.md` descarta.

import { congelaHondo } from '../core/congelar.js';
import { REGISTROS } from '../lenguaje/registro.js';
import { infraccionesDeReproche } from '../quests/escena.js';
import { FALLBACK_DEL_ZURRON, redactaZurron } from '../quests/narrador.js';
import { textoConSitio, textoDelGuion } from './guion-de-antes-de-salir.js';
import { anexa } from './hechos.js';
import { TOPE_DE_RESERVA, vaciaReserva } from './kilometros.js';

/** La pantalla que esta capa compone, y el momento del bucle que declara. */
export const PANTALLA = 'a2p2';

/** El momento: el mismo de la portada y de lo que hay hoy. El zurrón se intercala entre las dos. */
export const MOMENTO = 'antes-de-salir';

/** Los localizadores de A2P2. Los consume la pantalla y no se inventa ninguno. */
export const TESTIDS = congelaHondo({
  momento: 'momento',
  zurron: 'zurron',
  envoltorio: 'zurron-envoltorio',
  entrada: 'zurron-entrada',
  seguir: 'zurron-seguir',
});

/**
 * La única acción. **Una y no dos**: con cinco entradas como mucho, un botón de saltar
 * solo serviría para garantizar que nadie lo lea.
 */
export const ACCIONES = congelaHondo(['zurron-seguir']);

/** Como mucho cinco entradas, y el número sale del tope de la reserva y no de aquí. */
export const TOPE_DE_ENTRADAS = TOPE_DE_RESERVA;

/**
 * Los motivos de que no haya zurrón, enumerados.
 *
 * Enumerarlos es lo que separa «no aparece porque no hay nada» de «no aparece porque
 * alguien no lo cableó», que es la forma de fallo que este repo ya ha pagado siete veces.
 */
export const MOTIVOS_SIN_ZURRON = congelaHondo({
  MODO_APAGADO: 'modo-apagado',
  RESERVA_VACIA: 'reserva-vacia',
  NADA_QUE_CONTAR: 'nada-que-contar',
});

/** Las claves válidas, en orden declarado. */
export const CLAVES_SIN_ZURRON = congelaHondo(Object.values(MOTIVOS_SIN_ZURRON));

/**
 * De qué campo de cada tipo de efecto sale **dónde ocurrió**, en orden de preferencia.
 *
 * Un efecto que no nombre ningún sitio **no produce entrada**, y se cuenta en el
 * diagnóstico en lugar de inventarle un lugar: la entrada dice dónde ocurrió y qué
 * ocurrió, y una sin dónde no es una entrada a medias, es otra cosa.
 */
export const CAMPOS_DE_SITIO = congelaHondo(['nucleo', 'lugar', 'origen']);

/**
 * Los textos de plantilla de una entrada, por tipo de efecto.
 *
 * **No llevan el sitio dentro**: el sitio va aparte, en su rótulo, y repetirlo en el
 * cuerpo lo diría dos veces. La variante `sin` es para un efecto sin asunto declarado
 * —`razon-para-volver` no lo exige—, que es un caso legítimo y no un hueco.
 *
 * Ninguna reprocha nada ni dice lo que quien juega se ha perdido, y eso se comprueba al
 * cargar el módulo contra el vocabulario de reproche de SPEC-017.
 */
export const PLANTILLAS_DE_ENTRADA = congelaHondo({
  rumor: {
    con: 'Se habla de {asunto}.',
    sin: 'Se habla de algo que pasó por ahí.',
  },
  oportunidad: {
    con: 'Hay quien anda con {asunto}.',
    sin: 'Hay quien anda buscando unas manos.',
  },
  'razon-para-volver': {
    con: 'Quedó pendiente {asunto}.',
    sin: 'Quedó algo a medias.',
  },
});

/** Los tipos de efecto que el zurrón sabe contar, en orden estable. */
export const TIPOS_NARRABLES = congelaHondo(Object.keys(PLANTILLAS_DE_ENTRADA).sort());

const HUECO_DEL_ASUNTO = '{asunto}';

// El catálogo de plantillas se revisa a sí mismo al cargarse, igual que los dos guiones:
// una entrada que reprochara llegar tarde tiene que fallar aquí y no en la pantalla de
// alguien. Es la mitad estructural de «ninguna entrada reprocha nada».
for (const tipo of TIPOS_NARRABLES) {
  for (const cual of ['con', 'sin']) {
    const texto = PLANTILLAS_DE_ENTRADA[tipo][cual];
    if (typeof texto !== 'string' || !texto.trim()) {
      throw new Error(`la plantilla "${cual}" del tipo de entrada "${tipo}" del zurrón no trae texto: sin fallback no se pide nada al narrador`);
    }
    const reproches = infraccionesDeReproche(texto);
    if (reproches.length) {
      throw new Error(
        `la plantilla "${cual}" del tipo de entrada "${tipo}" del zurrón reprocha (${reproches.map((r) => `"${r.fragmento}"`).join(', ')}): ` +
        'el mundo hizo lo suyo, quien juega no estaba y no pasa nada',
      );
    }
  }
  if (!PLANTILLAS_DE_ENTRADA[tipo].con.includes(HUECO_DEL_ASUNTO)) {
    throw new Error(`la plantilla "con" del tipo de entrada "${tipo}" del zurrón no deja hueco para el asunto`);
  }
}

// --- De la reserva a las entradas ------------------------------------------------

/** Dónde ocurrió un efecto, o `null` si no nombra ningún sitio. */
export function sitioDelEfecto(efecto) {
  for (const campo of CAMPOS_DE_SITIO) {
    const valor = efecto?.[campo];
    if (typeof valor === 'string' && valor) return valor;
  }
  return null;
}

/** Si un efecto se puede contar: tipo del catálogo y un sitio que nombrar. */
export function esNarrable(efecto) {
  return TIPOS_NARRABLES.includes(efecto?.tipo) && sitioDelEfecto(efecto) !== null;
}

/** El texto de plantilla de un efecto ya declarado narrable. */
export function textoDePlantilla(efecto) {
  const plantillas = PLANTILLAS_DE_ENTRADA[efecto.tipo];
  const asunto = typeof efecto.asunto === 'string' && efecto.asunto ? efecto.asunto : null;
  return asunto ? plantillas.con.replace(HUECO_DEL_ASUNTO, asunto) : plantillas.sin;
}

/**
 * La entrada de un paso de la reserva, o `null` si ese paso no produjo nada narrable.
 *
 * **Una entrada por paso y no una por efecto.** El tope de cinco es el de la reserva, y
 * `quests.md` decisión 3 dice que el resumen lo acota; con una entrada por efecto, cinco
 * pasos podrían dar quince y el resumen dejaría de caber. Lo que no cabe **no se pierde**:
 * sigue sedimentado en su núcleo y se oye llegando allí, que es el juego entero.
 */
export function entradaDelPaso(paso) {
  if (!paso || typeof paso !== 'object' || !Number.isInteger(paso.n)) {
    throw new Error(`la reserva del zurrón trae ${JSON.stringify(paso) ?? String(paso)} donde va un paso ejecutado { n, efectos }`);
  }
  const efectos = Array.isArray(paso.efectos) ? paso.efectos : [];
  // El primero en el orden en que el motor los produjo, que es declarado: dos veces la
  // misma reserva tiene que dar la misma entrada.
  const efecto = efectos.find(esNarrable) ?? null;
  if (!efecto) return null;
  const sitio = sitioDelEfecto(efecto);
  return congelaHondo({
    paso: paso.n,
    tipo: efecto.tipo,
    sitio,
    rotulo: textoConSitio(PANTALLA, 'sitio', sitio),
    fallback: textoDePlantilla(efecto),
    // Lo que viaja al narrador es **inerte**: el tipo abstracto, el sitio y el asunto. Ni
    // el nivel de deformación, ni el signo, ni el número del paso.
    hechos: { tipo: efecto.tipo, sitio, asunto: efecto.asunto ?? null },
  });
}

/**
 * Las entradas de una reserva, **en el orden en que se ejecutaron sus pasos**.
 *
 * El orden es el de la reserva y no el de nada más: los pasos entraron en ella según se
 * daban, y contarlos en otro orden sería contar otra historia.
 */
export function entradasDeLaReserva(reserva = []) {
  if (!Array.isArray(reserva)) {
    throw new Error(`la reserva del zurrón llega como ${JSON.stringify(reserva) ?? String(reserva)}: se espera la lista de pasos sin narrar, aunque esté vacía`);
  }
  if (reserva.length > TOPE_DE_ENTRADAS) {
    throw new Error(
      `la reserva trae ${reserva.length} pasos sin narrar y el tope es ${TOPE_DE_ENTRADAS} (SPEC-011): ` +
      'una reserva por encima del tope significa que alguien la llenó sin pasar por el motor',
    );
  }
  return congelaHondo(reserva.map(entradaDelPaso).filter((e) => e !== null));
}

/**
 * Si hay zurrón, y si no lo hay, por qué. **No llama a nadie y no toca nada.**
 *
 * `vaciar` va aparte de `hay` a propósito: la reserva con pasos que no produjeron nada se
 * vacía **sin pantalla y sin llamada**, y sin ese campo ese caso sería indistinguible del
 * de la reserva vacía, que no tiene nada que vaciar.
 */
export function decideElZurron({ modoDeFondo = false, reserva = [] } = {}) {
  if (modoDeFondo !== true && modoDeFondo !== false) {
    throw new Error(
      `el zurrón necesita saber si el modo de pasos de fondo está activo y llegó ${JSON.stringify(modoDeFondo) ?? String(modoDeFondo)}: ` +
      'es un dato de la partida —viene apagado de origen— y el núcleo no lo consulta a ninguna capa de la plataforma',
    );
  }
  // Con el modo apagado no se mira siquiera la reserva: lo que hubiera se queda como
  // estaba, sin borrarse y sin ejecutarse, hasta que el modo vuelva a encenderse.
  if (!modoDeFondo) {
    return congelaHondo({ hay: false, motivo: MOTIVOS_SIN_ZURRON.MODO_APAGADO, vaciar: false, entradas: [] });
  }
  const pasos = Array.isArray(reserva) ? reserva : [];
  if (pasos.length === 0) {
    return congelaHondo({ hay: false, motivo: MOTIVOS_SIN_ZURRON.RESERVA_VACIA, vaciar: false, entradas: [] });
  }
  const entradas = entradasDeLaReserva(pasos);
  if (entradas.length === 0) {
    return congelaHondo({ hay: false, motivo: MOTIVOS_SIN_ZURRON.NADA_QUE_CONTAR, vaciar: true, entradas: [] });
  }
  return congelaHondo({ hay: true, motivo: null, vaciar: true, entradas });
}

// --- La composición ---------------------------------------------------------------

/**
 * El texto de un hueco dentro de una redacción, con su origen. Sin redacción, la plantilla.
 */
function textoDeHueco(redaccion, clave, fallback) {
  const encontrado = (redaccion?.textos ?? []).find((t) => t.clave === clave);
  if (!encontrado) return { texto: fallback, origen: 'plantilla' };
  return { texto: encontrado.texto, origen: encontrado.origen };
}

/** La clave con la que cada entrada pide su texto en la llamada agrupada. */
export function claveDeEntrada(indice) {
  return `zurron:entrada:${indice + 1}`;
}

/**
 * Viste la decisión con lo que haya escrito el narrador. **Sin narrador da lo mismo, con
 * texto de plantilla**: las entradas son las mismas y solo cambia la piel.
 */
export function componeElZurron({ decision, redaccion = null }) {
  if (!decision || typeof decision.hay !== 'boolean') {
    throw new Error('el zurrón se compone sobre lo que decidió decideElZurron y no llegó ninguna decisión');
  }
  if (!decision.hay) {
    throw new Error(
      `no hay zurrón que componer (${decision.motivo}): la pantalla no existe cuando el modo está apagado, cuando la reserva está vacía ` +
      'y cuando ninguno de sus pasos produjo nada. Componer un zurrón vacío sería la pantalla que dice que no pasó nada',
    );
  }
  const envoltorio = textoDeHueco(redaccion, 'zurron', FALLBACK_DEL_ZURRON);
  const entradas = decision.entradas.map((entrada, i) => {
    const { texto, origen } = textoDeHueco(redaccion, claveDeEntrada(i), entrada.fallback);
    return {
      testid: TESTIDS.entrada,
      // El número del paso que la generó: es lo que hace localizable una entrada sin
      // pintar ninguna cifra, porque no sale a pantalla.
      paso: entrada.paso,
      sitio: entrada.sitio,
      rotulo: entrada.rotulo,
      texto,
      origen,
      // Ninguna entrada se puede tocar: lo que cuenta sigue sedimentado en su núcleo y
      // atenderlo es ir andando (`design-system.md`).
      tocable: false,
    };
  });

  return congelaHondo({
    testid: TESTIDS.zurron,
    momento: MOMENTO,
    // La voz del mundo, como el resto del bucle. Aquí no habla la aplicación.
    registro: REGISTROS.MUNDO,
    rotulo: textoDelGuion(PANTALLA, 'rotulo'),
    envoltorio: { testid: TESTIDS.envoltorio, texto: envoltorio.texto, origen: envoltorio.origen },
    entradas,
    cierre: textoDelGuion(PANTALLA, 'cierre'),
    accion: { id: ACCIONES[0], testid: TESTIDS.seguir, texto: textoDelGuion(PANTALLA, 'seguir') },
    // Los pasos que el vaciado se llevará, para que quien confirme no vuelva a decidirlo.
    pasos: decision.entradas.map((e) => e.paso),
  });
}

/**
 * El esqueleto de un zurrón: todo lo que **no** es texto del narrador.
 *
 * Existe para poder afirmar sin comparar a ojo que con narrador y sin él el zurrón es el
 * mismo: mismas entradas, mismo orden, mismos sitios y mismos pasos.
 */
export function esqueletoDelZurron(zurron) {
  return congelaHondo({
    momento: zurron?.momento ?? null,
    pasos: [...(zurron?.pasos ?? [])],
    entradas: (zurron?.entradas ?? []).map((e) => ({ paso: e.paso, sitio: e.sitio, tocable: e.tocable })),
    accion: zurron?.accion?.id ?? null,
  });
}

/**
 * Abre el zurrón: decide, pide **una sola llamada agrupada** si hay algo que contar, y
 * compone.
 *
 * Sin entradas no se pide nada y **no se llama a nadie**, que es lo que exige «con el modo
 * apagado no se hace ninguna llamada del zurrón» y su hermana, la reserva cuyos pasos no
 * produjeron nada. Con entradas, la llamada es una: el envoltorio y los textos de las
 * entradas van juntos, y si se cae entera cada hueco vuelve con el suyo de plantilla.
 *
 * @returns `{ hay, motivo, vaciar, zurron, redaccion }`, congelado. `zurron` es `null`
 *   cuando no hay pantalla, que es distinto de una pantalla vacía.
 */
export async function abreElZurron({
  mundo = null,
  locale = 'es',
  modoDeFondo = false,
  reserva = [],
  momento = MOMENTO,
  llamada = null,
  presupuestoMs,
  filtro = null,
  topicos = null,
  semillaDeMundo = null,
  ya = null,
  espera,
}) {
  const decision = decideElZurron({ modoDeFondo, reserva });
  if (!decision.hay) {
    return congelaHondo({ hay: false, motivo: decision.motivo, vaciar: decision.vaciar, zurron: null, redaccion: null, llamo: false });
  }
  const redaccion = await redactaZurron({
    mundo,
    locale,
    momento,
    modoDeFondo: true,
    reserva: decision.entradas.map((e) => ({ fallback: e.fallback, hechos: e.hechos })),
    llamada,
    presupuestoMs,
    filtro,
    topicos,
    semillaDeMundo,
    ya,
    ...(espera ? { espera } : {}),
  });
  return Object.freeze({
    hay: true,
    motivo: null,
    vaciar: true,
    zurron: componeElZurron({ decision, redaccion }),
    redaccion,
    llamo: redaccion.llamo,
  });
}

// --- El vaciado, que ocurre al confirmar ------------------------------------------

/**
 * Vacía la reserva: **anexa el hecho y solo entonces la vacía**.
 *
 * Ese orden es la atomicidad entera: el hecho se valida y se escribe primero, así que un
 * hecho mal formado deja la reserva intacta y el zurrón vuelve a salir. Al revés, un fallo
 * al registrar habría perdido lo único que el mundo hizo mientras nadie miraba.
 *
 * Vale también para la reserva que no produjo nada: se vacía igual, con `narrados` a cero
 * y sin haber enseñado ninguna pantalla.
 *
 * @param {object} opciones
 *   `motor` el del mapa activo; `registro` el de hechos de la partida; `dia` el del
 *   calendario —el día de partida, jamás una marca del reloj real—; `narrados` cuántas
 *   entradas se llegaron a enseñar.
 */
export function vaciaElZurron({ motor, registro, mapa = null, dia, narrados = 0 }) {
  if (!motor || typeof motor.registro !== 'function') {
    throw new Error('vaciar el zurrón necesita el motor de pasos del mapa activo: la reserva es la de ese mapa');
  }
  const mapaId = mapa ?? motor.mapaId;
  const pendientes = motor.registro().reserva;
  if (!pendientes.length) {
    // No es un error y no se disimula: se declara. Confirmar dos veces el mismo zurrón
    // —o volver tras un vaciado ya escrito— no puede anexar dos hechos del mismo vaciado.
    return congelaHondo({ vaciados: [], hecho: null, yaEstaba: true });
  }
  if (!Number.isInteger(narrados) || narrados < 0 || narrados > pendientes.length) {
    throw new Error(
      `el vaciado del zurrón declara ${JSON.stringify(narrados) ?? String(narrados)} entradas narradas y la reserva tiene ${pendientes.length} pasos: ` +
      'se narran como mucho tantas entradas como pasos hay',
    );
  }
  const primerPaso = pendientes[0].n;
  const ultimoPaso = pendientes[pendientes.length - 1].n;
  const anexados = anexa(registro, [{
    tipo: 'reserva-vaciada',
    mapa: mapaId,
    dia,
    // El momento del hecho es el último paso de la reserva: el reloj del mundo son los
    // kilómetros de quien anda, y aquí el vaciado ocurre justo detrás de ellos.
    paso: ultimoPaso,
    carga: { narrados, primerPaso, ultimoPaso },
  }]);
  const vaciados = vaciaReserva(motor);
  return congelaHondo({ vaciados, hecho: anexados[0], yaEstaba: false });
}
