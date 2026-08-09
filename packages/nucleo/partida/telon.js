// El telón: la secuencia que se lee al volver a casa, sus dos ramas, y los tres
// vocabularios que convierten sus reglas de tono en criterios que se pueden poner rojos.
//
// Aquí no se escribe nada en la partida: esta capa **compone** lo que ya calculó el cierre
// de la salida (`cierre-de-salida.js`). La partición es la de siempre en este paquete —
// quien escribe el estado y quien redacta la pantalla no son el mismo módulo— y aquí es
// además lo que hace que el telón se pueda componer dos veces y salir idéntico.
//
// La secuencia es una y tiene dos ramas (`bucle-jugable.md` §8):
//
//   1 · **el mapa entintado**, siempre, haya aventura o no y se haya vuelto entera o a
//       mitad; con descubrimientos o sin ellos, que solo cambia el título;
//   2 · **el desenlace**, si había aventura y se terminó;
//   3 · **o el cierre en corto en su lugar**, que ocupa el sitio del desenlace y no el del
//       mapa;
//   4 · **lo que se pone en camino**, solo si el desenlace era notable, y nunca detrás de
//       un cierre en corto;
//   5 · **la entrada del diario**, siempre, y cierra.
//
// Un paseo sin aventura es 1 y 5, y no una pantalla distinta con su propio título: la
// diferencia entre un paseo y una aventura no es cómo se cierran, es que uno tiene
// desenlace y el otro no.

import { congelaHondo } from '../core/congelar.js';
import { reglaDeFormula } from '../names/lenguaje.js';
import { PALABRAS_DEL_MUNDO } from './conocimiento.js';
import { PROTAGONISTAS, SIGNOS, exigeSigno } from './deformacion.js';
import { CLASES_DE_ENTRADA, FUENTES, entradaDeDiario } from './diario.js';
import { exigeMapaId } from './pasos.js';
import { ESCALONES_DE_RANGO, TONOS_DE_RANGO, exigeEscalonDeRango } from './rango.js';

/** Los estados del momento del telón, vocabulario cerrado. Es lo que expone `telon-estado`. */
export const ESTADOS_DEL_TELON = congelaHondo([
  'mapa', 'mapa-sin-tinta', 'desenlace', 'cierre-en-corto', 'rumor', 'diario',
]);

/** El estado de la primera pantalla según haya habido descubrimientos o no. */
export function estadoDelMapa(ascensos = []) {
  return ascensos.length ? 'mapa' : 'mapa-sin-tinta';
}

// --- Los tres vocabularios ------------------------------------------------------
//
// Tres listas cerradas, escritas como dato, cada una con su comprobación sobre todos los
// textos que esta capa produce. Son lo que convierte tres reglas de tono en criterios que
// pueden ponerse rojos, que es la diferencia entre una regla y una intención.

/**
 * **Reproche**, para el título del día flojo, el cierre en corto y los sesenta textos de
 * repuesto del catálogo.
 *
 * La cuerda floja es la de `accesibilidad.md` §1: la línea del día sin descubrimientos
 * tiene que sonar a constatación y no a reproche, y la única manera de sostenerlo es que
 * un texto que la cruce haga fallar la comprobación nombrando el texto y la palabra.
 */
export const VOCABULARIO_DE_REPROCHE = congelaHondo([
  'no llegaste', 'te volviste', 'abandonaste', 'dejaste', 'poco', 'deberías', 'podrías haber',
  'la próxima vez', 'inténtalo',
]);

/**
 * **Propagación**, para la pantalla de lo que se pone en camino.
 *
 * El rumor se ve salir y no se ve llegar, y jamás se ve deformarse: enseñar la propagación
 * sería el panel del estado del mundo que se descartó, y enseñar el nivel explicaría el
 * mejor truco del juego en lugar de ponerlo en escena. Cualquier núcleo que no sea el de
 * origen cuenta como infracción y se comprueba aparte, porque no es una palabra fija.
 */
export const VOCABULARIO_DE_PROPAGACION = congelaHondo([
  'llegará', 'llegar a', 'dentro de', 'saltos', 'nivel', 'abultado', 'trastocado', 'leyenda',
  'fiel', 'deformación',
]);

/**
 * **Logro**, para la cartela del hito y su página del diario.
 *
 * `arranque.md` §3: el hito se marca narrativamente y dice que el mundo cambió, no que
 * quien juega aprobó. Un «tutorial completado» con otras palabras sigue siendo un logro.
 */
export const VOCABULARIO_DE_LOGRO = congelaHondo([
  'tutorial', 'completado', 'nivel', 'logro', 'desbloqueado', 'enhorabuena', 'dominas', 'aprendiste',
]);

const REGLAS_DE_REPROCHE = congelaHondo(VOCABULARIO_DE_REPROCHE.map(reglaDeFormula));
const REGLAS_DE_PROPAGACION = congelaHondo(VOCABULARIO_DE_PROPAGACION.map(reglaDeFormula));
const REGLAS_DE_LOGRO = congelaHondo(VOCABULARIO_DE_LOGRO.map(reglaDeFormula));

function infracciones(reglas, texto, quien) {
  if (typeof texto !== 'string') {
    throw new Error(`la comprobación de ${quien} necesita un texto y llegó ${JSON.stringify(texto) ?? String(texto)}`);
  }
  const out = [];
  for (const regla of reglas) {
    const casa = texto.match(regla.re);
    if (casa) out.push({ formula: regla.formula, fragmento: casa[0] });
  }
  return congelaHondo(out);
}

/** Las palabras de reproche que usa un texto, como datos. */
export function infraccionesDeReproche(texto) {
  return infracciones(REGLAS_DE_REPROCHE, texto, 'reproche');
}

/**
 * Las palabras de propagación que usa un texto, más **cualquier núcleo que no sea el de
 * origen**: enseñar a dónde llega el rumor es lo que la decisión prohíbe, y un nombre de
 * pueblo lo enseña igual de bien que la palabra «llegará».
 */
export function infraccionesDePropagacion(texto, { origen = null, nucleos = [] } = {}) {
  const out = infracciones(REGLAS_DE_PROPAGACION, texto, 'propagación').slice();
  for (const nucleo of nucleos.slice().sort()) {
    if (nucleo === origen) continue;
    if (reglaDeFormula(nucleo).re.test(texto)) out.push({ formula: nucleo, fragmento: nucleo });
  }
  return congelaHondo(out);
}

/** Las palabras de la escalera de logro que usa un texto, como datos. */
export function infraccionesDeLogro(texto) {
  return infracciones(REGLAS_DE_LOGRO, texto, 'logro');
}

/** Falla **nombrando el texto y la palabra**, que es lo que permite poner el criterio rojo. */
export function exigeSinReproche(texto, quien = 'un texto del telón') {
  const malas = infraccionesDeReproche(texto);
  if (malas.length) {
    throw new Error(`${quien} reprocha: "${texto}" contiene ${malas.map((m) => `"${m.fragmento}"`).join(', ')}, y este momento constata, nunca juzga`);
  }
  return texto;
}

/** Igual, para la pantalla del rumor. */
export function exigeSinPropagacion(texto, { origen = null, nucleos = [], quien = 'un texto del rumor' } = {}) {
  const malas = infraccionesDePropagacion(texto, { origen, nucleos });
  if (malas.length) {
    throw new Error(
      `${quien} enseña la propagación: "${texto}" contiene ${malas.map((m) => `"${m.fragmento}"`).join(', ')}, ` +
      'y el rumor se ve salir y no se ve llegar',
    );
  }
  return texto;
}

/** Igual, para el hito. */
export function exigeSinLogro(texto, quien = 'un texto del hito') {
  const malas = infraccionesDeLogro(texto);
  if (malas.length) {
    throw new Error(
      `${quien} habla como un logro: "${texto}" contiene ${malas.map((m) => `"${m.fragmento}"`).join(', ')}, ` +
      'y el hito dice que el mundo cambió, no que quien juega aprobó',
    );
  }
  return texto;
}

// --- Los textos, que son de esta capa --------------------------------------------

/**
 * Los textos del telón, en la voz del mundo y **sin una sola cifra**. La única cifra de
 * toda la secuencia es la del oro, y esa la pone el desenlace.
 */
export const TEXTOS = congelaHondo({
  situacion: 'Ya estás en casa',
  tituloConTinta: 'Hoy has ensanchado el mapa',
  tituloSinTinta: 'Hoy no has visto nada que no supieras',
  lineaSinTinta: 'Andaste por sitios tuyos. El mundo, mientras, anduvo lo suyo.',
  seguir: 'Seguir',
  titularDelDesenlace: 'Acabó como acaban estas cosas',
  titularDelCierreEnCorto: 'Se resolvió sin ti',
  cierreDelCierreEnCorto: 'Y hoy has andado, que es lo que mueve el mundo.',
  rotuloDelRumor: 'Y ahora',
  consecuenciaDelRumor: 'De ahí sale por donde salen estas cosas. Tú ya no puedes hacer nada.',
  esperaDelRumor: 'Ya te enterarás de cómo lo cuentan.',
  rotuloDelDiario: 'Tu diario',
  tituloDelDiaSinAventura: 'Lo andado hoy',
  verElDiarioEntero: 'Ver el diario entero',
  cerrar: 'Cerrar',
  hitoCartela: 'En algún sitio de este mapa hay quien cuenta cosas tuyas.',
  hitoRemate: 'No las contaste tú. El mundo ha empezado a hablar de ti por su cuenta.',
});

/** Cómo se dice el rango cuando se movió. Una frase por escalón, y ninguna lista de pueblos. */
export const FRASES_DE_RANGO = congelaHondo({
  nombradia: (nucleo) => `En ${nucleo} ya saben quién eres. En el resto del mapa, todavía no.`,
  pertenencia: (nucleo) => `En ${nucleo} ya eres de la casa. En el resto del mapa, todavía no.`,
});

// El guion se revisa **al cargarse el módulo**, como el catálogo de plantillas y el guion
// del arranque: un texto de esta capa que reprochara tiene que fallar aquí y no en la
// pantalla de alguien. La frase de rango se revisa con un núcleo de mentira, que es lo que
// hace comprobable la plantilla y no un caso suelto.
for (const clave of Object.keys(TEXTOS).sort()) exigeSinReproche(TEXTOS[clave], `el texto "${clave}" del telón`);
for (const clave of ['rotuloDelRumor', 'consecuenciaDelRumor', 'esperaDelRumor']) {
  exigeSinPropagacion(TEXTOS[clave], { quien: `el texto "${clave}" de lo que se pone en camino` });
}
for (const clave of ['hitoCartela', 'hitoRemate']) exigeSinLogro(TEXTOS[clave], `el texto "${clave}" del hito`);
for (const escalon of Object.keys(FRASES_DE_RANGO).sort()) {
  exigeSinReproche(FRASES_DE_RANGO[escalon]('Monfrida'), `la frase de rango de "${escalon}"`);
}

/**
 * La frase del rango: **una sola, y nombra un solo núcleo**.
 *
 * Con el rango movido en varios sitios se elige por regla estable declarada —el escalón
 * más alto y, a igualdad, el orden canónico del mapa— y nunca por orden de recorrido. Una
 * frase por pueblo sería la lista que `progresion.md` §1 llama «la barra escrita con
 * palabras», y con el desempate por orden de iteración la pantalla dependería de por dónde
 * se hubiera empezado a mirar.
 *
 * Sin ningún movimiento devuelve `null`, y `null` no se sustituye por una frase que diga
 * que no subió: eso sería el medidor con signo negativo.
 */
export function fraseDelRango(subidas = []) {
  if (!Array.isArray(subidas) || !subidas.length) return null;
  const ordenadas = subidas.slice().sort((a, b) => {
    const da = ESCALONES_DE_RANGO.indexOf(exigeEscalonDeRango(b.escalon, 'el escalón al que subió un núcleo'));
    const db = ESCALONES_DE_RANGO.indexOf(exigeEscalonDeRango(a.escalon, 'el escalón al que subió un núcleo'));
    if (da !== db) return da - db;
    return a.nucleo < b.nucleo ? -1 : a.nucleo > b.nucleo ? 1 : 0;
  });
  const elegida = ordenadas[0];
  const molde = FRASES_DE_RANGO[elegida.escalon];
  if (!molde) return null; // forastería no es una subida: es donde nace todo el mundo
  return congelaHondo({
    nucleo: elegida.nucleo,
    escalon: elegida.escalon,
    tono: TONOS_DE_RANGO[elegida.escalon],
    texto: molde(elegida.nucleo),
  });
}

// --- La hoja de hoy, que es la clase «lo propio» ---------------------------------

/**
 * Los hechos de lo propio: **lo que pasó, una vez, protagonizado por quien juega**.
 *
 * Se construyen siempre con esta forma y por eso el hecho del registro no tiene que
 * llevarlos dentro: reproducirlos es derivarlos, no inventárselos. Es la diferencia con
 * `version-oida`, que sí los lleva porque lo oído puede venir deformado de mil maneras.
 */
export function hechosDeLoPropio({ asunto, lugar }) {
  return congelaHondo({
    asunto,
    escala: { veces: 1 },
    protagonista: { tipo: PROTAGONISTAS.JUGADORA, ref: null },
    detalle: { con: null, lugar, motivo: null },
    trastocado: null,
    fundidoCon: null,
  });
}

/**
 * La hoja de hoy: la entrada del diario de clase «lo propio», que **escribe esta capa y
 * solo esta**.
 *
 * Va en nivel 0 —es lo que se vivió, no lo que contaron— y por eso convive con las
 * versiones oídas del mismo suceso sin marcar ninguna como la correcta: la clave de una
 * entrada es suceso más fuente, y aquí la fuente es quien juega.
 */
export function hojaDelDia({ mapaId, hoja, asunto, lugar, dia, paso, signo = SIGNOS.BUENO }) {
  const id = exigeMapaId(mapaId, 'la hoja de hoy del diario');
  if (typeof hoja !== 'string' || !hoja) {
    throw new Error(`la hoja de hoy se apunta con la identidad de lo que se hizo y llegó ${JSON.stringify(hoja) ?? String(hoja)}`);
  }
  if (typeof asunto !== 'string' || !asunto) {
    throw new Error(`la hoja "${hoja}" no dice de qué va: el asunto es lo que permite agrupar dos versiones de lo mismo`);
  }
  if (typeof lugar !== 'string' || !lugar) {
    throw new Error(
      `la hoja "${hoja}" no dice dónde se cierra el día: llegó ${JSON.stringify(lugar) ?? String(lugar)}. ` +
      'Es el identificador de un sitio del mundo congelado y nunca una coordenada',
    );
  }
  return entradaDeDiario({
    mapa: id,
    clase: CLASES_DE_ENTRADA.PROPIO,
    suceso: hoja,
    // La fuente es el sitio desde el que se cuenta, y la clase ya dice que quien lo cuenta
    // es quien juega: sin fuente propia, lo propio pisaría la versión del pueblo.
    fuente: { tipo: FUENTES.NUCLEO, sitio: lugar },
    lugar,
    dia,
    paso,
    hechos: hechosDeLoPropio({ asunto, lugar }),
    nivel: 0,
    signo: exigeSigno(signo, `el signo de la hoja "${hoja}"`),
  });
}

/** El hecho que deja la hoja de hoy en el registro. */
export function hechoDeHoja(entrada) {
  return {
    tipo: 'hoja-propia',
    mapa: entrada.mapa,
    dia: entrada.dia,
    paso: entrada.paso,
    carga: {
      hoja: entrada.suceso,
      asunto: entrada.hechos.asunto,
      lugar: entrada.lugar,
      signo: entrada.signo,
    },
  };
}

/** La hoja que reconstruye un hecho `hoja-propia`. Es la inversa exacta. */
export function hojaDeHecho(h) {
  return hojaDelDia({
    mapaId: h.mapa,
    hoja: h.carga.hoja,
    asunto: h.carga.asunto,
    lugar: h.carga.lugar,
    dia: h.dia,
    paso: h.paso,
    signo: h.carga.signo,
  });
}

/**
 * Cómo se dice lo propio en primera persona. Es lo único de la hoja que redacta esta capa,
 * y no lleva ni una cifra: lo que se anduvo se dice en palabras del mundo.
 */
export function loPropioEnPrimeraPersona({ titulo = null, cierreEnCorto = false }) {
  if (!titulo) return 'Hoy salí a andar y volví por donde vine.';
  if (cierreEnCorto) return `Hoy salí a andar. Lo de «${titulo}» se resolvió sin mí.`;
  return `Hoy salí a andar y lo de «${titulo}» quedó cerrado.`;
}

/** La autoridad de cada clase de entrada: lo que se hizo se sabe, lo que contaron no. */
export const AUTORIDADES = congelaHondo({ 'lo-propio': 'lo-se', 'lo-oido': 'me-lo-contaron' });

// --- La composición de la secuencia ------------------------------------------------

/**
 * Compone el telón entero a partir de lo que el cierre de la salida ya resolvió.
 *
 * No escribe nada y no lee el reloj: **dos composiciones del mismo estado son idénticas**,
 * frase de rango incluida. Lo que decide la secuencia es el par (hubo desenlace, hubo
 * cierre en corto), y de ahí salen las dos ramas y ninguna más.
 *
 * @param {object} piezas
 *   `mapaId`, `dia`; `ascensos` lo que subió hoy; `entintado` la tinta de cada elemento;
 *   `porDondeSePaso` los nombres de los sitios del día, que es lo que enseña la lista
 *   cuando no hubo ascensos; `aventura` `{ id, titulo }` o `null`; `desenlace` lo que la
 *   plantilla declara, o `null`; `cierreEnCorto` `{ texto }` o `null`; `progresion` lo que
 *   ingresó la bolsa; `rango` las subidas de rango; `rumor` el recién nacido o `null`;
 *   `entradaDelDiario` la hoja de hoy; `oido` lo que se apuntó de oídas; `hito` si la
 *   cartela toca.
 */
export function componeElTelon({
  mapaId,
  dia,
  ascensos = [],
  entintado = [],
  porDondeSePaso = [],
  aventura = null,
  desenlace = null,
  cierreEnCorto = null,
  progresion = null,
  rango = [],
  rumor = null,
  entradaDelDiario = null,
  oido = [],
  hito = false,
  nucleos = [],
}) {
  const id = exigeMapaId(mapaId, 'el telón');
  if (desenlace && cierreEnCorto) {
    throw new Error(
      'el telón recibe a la vez un desenlace y un cierre en corto: el cierre en corto ocupa el sitio del desenlace, ' +
      'así que los dos a la vez significan que quien cierra la salida no resolvió cómo acabó la aventura',
    );
  }
  if (!entradaDelDiario) {
    throw new Error('el telón no tiene entrada del diario: la hoja de hoy cierra todo telón, y un día sin hoja sería un día que no pasó');
  }

  const pantallas = [];

  // 1 · El mapa. Siempre, y el día sin descubrimientos enseña el mismo mapa con otro
  // título: saltárselo haría desaparecer el objeto central del juego justo el día en que
  // menos apetece salir.
  const conTinta = ascensos.length > 0;
  pantallas.push(congelaHondo({
    estado: estadoDelMapa(ascensos),
    situacion: TEXTOS.situacion,
    titulo: conTinta ? TEXTOS.tituloConTinta : TEXTOS.tituloSinTinta,
    entintado,
    // Una línea por elemento, con su nombre y a qué escalón subió **en palabras del
    // mundo**. Sin ascensos la lista está vacía y no se sustituye por ninguna disculpa:
    // lo que se enseña entonces son los sitios por los que se pasó, sin nivel al lado.
    ascensos: ascensos.map((a) => ({ clave: a.clave, nombre: a.nombre, escalon: PALABRAS_DEL_MUNDO[a.escalon] })),
    porDondeSePaso: conTinta ? [] : porDondeSePaso.slice(),
    linea: conTinta ? null : TEXTOS.lineaSinTinta,
    accion: TEXTOS.seguir,
  }));

  // 2 · El desenlace, o 3 · el cierre en corto en su lugar.
  if (desenlace) {
    pantallas.push(congelaHondo({
      estado: 'desenlace',
      aventura: aventura?.titulo ?? null,
      titular: TEXTOS.titularDelDesenlace,
      parrafo: desenlace.texto ?? null,
      oro: progresion ? { cantidad: progresion.oro } : null,
      objetos: (progresion?.objetos ?? []).map((o) => ({ id: o.id, clase: o.clase, procedencia: o.procedencia ?? null })),
      rango: fraseDelRango(rango),
      accion: TEXTOS.seguir,
    }));
  } else if (cierreEnCorto) {
    pantallas.push(congelaHondo({
      estado: 'cierre-en-corto',
      aventura: aventura?.titulo ?? null,
      titular: TEXTOS.titularDelCierreEnCorto,
      parrafo: exigeSinReproche(cierreEnCorto.texto ?? '', `el desenlace de repuesto de "${aventura?.id ?? '(sin aventura)'}"`),
      oro: progresion ? { cantidad: progresion.oro } : null,
      objetos: (progresion?.objetos ?? []).map((o) => ({ id: o.id, clase: o.clase, procedencia: o.procedencia ?? null })),
      rango: fraseDelRango(rango),
      cierre: TEXTOS.cierreDelCierreEnCorto,
      accion: TEXTOS.seguir,
    }));
  }

  // 4 · Lo que se pone en camino. Solo con desenlace notable, y por construcción nunca
  // detrás de un cierre en corto: quien cierra en corto no hace nacer ningún rumor, así
  // que aquí `rumor` llega en nulo y esta pantalla no existe.
  if (rumor) {
    if (cierreEnCorto) {
      throw new Error(
        `el telón trae el rumor "${rumor.id}" detrás de un cierre en corto: un cierre en corto no genera rumor, ` +
        'porque el mundo no comenta que quien juega no fuese',
      );
    }
    const titular = `Ya se cuenta en ${rumor.origen}.`;
    exigeSinPropagacion(titular, { origen: rumor.origen, nucleos, quien: 'el titular de lo que se pone en camino' });
    pantallas.push(congelaHondo({
      estado: 'rumor',
      rotulo: TEXTOS.rotuloDelRumor,
      titular,
      consecuencia: TEXTOS.consecuenciaDelRumor,
      // Lo único que se le entrega para pintar: **el núcleo de origen y nada más**. Ni
      // destinos, ni saltos, ni nivel, ni el árbol de calzadas.
      sale: { origen: rumor.origen },
      espera: TEXTOS.esperaDelRumor,
      accion: TEXTOS.seguir,
    }));
  }

  // 5 · La entrada del diario. Siempre, y cierra.
  pantallas.push(congelaHondo({
    estado: 'diario',
    rotulo: TEXTOS.rotuloDelDiario,
    dia,
    titulo: aventura?.titulo ?? TEXTOS.tituloDelDiaSinAventura,
    propio: {
      autoridad: AUTORIDADES['lo-propio'],
      texto: loPropioEnPrimeraPersona({ titulo: aventura?.titulo ?? null, cierreEnCorto: !!cierreEnCorto }),
    },
    // Lo oído va aparte, entrecomillado y con **otra autoridad declarada**, y sin el nivel
    // de deformación: el diario registra lo oído, no lo cierto, y decir cuál es la buena
    // sería el tutorial que `quests.md` decisión 3 se niega a dar.
    oido: oido.map((e) => ({ autoridad: AUTORIDADES['lo-oido'], suceso: e.suceso, lugar: e.lugar, texto: e.texto ?? null })),
    entrada: entradaDelDiario.id,
    acciones: [TEXTOS.verElDiarioEntero, TEXTOS.cerrar],
  }));

  return congelaHondo({
    mapa: id,
    dia,
    pantallas,
    estados: pantallas.map((p) => p.estado),
    // La cartela del hito **no es una pantalla más**: es una capa que aparece una sola vez
    // entre el desenlace y el diario, sin acción propia y sin quedar en ningún sitio
    // consultable, porque un hito consultable es un logro con otro nombre.
    hito: hito
      ? { cartela: TEXTOS.hitoCartela, remate: TEXTOS.hitoRemate, entre: ['desenlace', 'diario'], acciones: [] }
      : null,
  });
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión:
//
//   · No hay ninguna leyenda de tintas, ni una función que las explique. La diferencia se
//     ve, y una leyenda convertiría el mapa ganado en un cuadro de mandos.
//   · No hay ninguna proyección del rumor que lleve destinos, saltos o nivel: la pantalla
//     recibe el núcleo de origen y nada más, así que no hay por dónde colarlo.
//   · No hay ninguna frase que diga que el rango no subió, ni ninguna que enumere pueblos.
