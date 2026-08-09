// El filtro por el que pasa **todo** texto que escriba el narrador antes de que
// nadie lo lea: las tres listas por locale, el tope de longitud del hueco, las
// cifras que ninguna pantalla lleva, la voz de aplicación dentro del juego y el
// cribado contra los datos reales del mundo, por si un nombre real volviera dentro
// de la respuesta.
//
// Se llama `aptitud-de-texto.js` y no `aptitud.js` a propósito: `world/aptitud.js`
// ya existe y habla de escalones, firme y bordillos. Dos módulos con el mismo nombre
// corto y significados distintos es una confusión barata de evitar aquí.
//
// Dos decisiones gobiernan lo de abajo:
//
//   · **El motivo es una clave de catálogo cerrado, nunca una frase.** Es el mismo
//     trato que `quests/motivos.js` da al casting, y por el mismo motivo: lo que se
//     cuenta se agrega, lo que se lee se parsea. Una causa que no esté en el catálogo
//     hace fallar la entrega nombrándola, en vez de salir con una clave genérica.
//   · **Las listas se inyectan y no se escriben dentro de la comprobación.**
//     `game-design/lenguaje.md` deja abierto su pendiente 2 —qué fórmulas entran y
//     cuáles son falsos positivos— y una spec de código no cierra un pendiente de
//     diseño. Lo que se entrega es un valor por defecto justificado, que vive en
//     `listasDeAptitud` y no dentro de `valida`.
//
// No importa la red ni el reloj, y no puede: el paquete entero no habla con nadie.

import { congelaHondo } from '../core/congelar.js';
import { FAMILIAS_DE_REGLA, reglaDeFormula, reglasDeLenguaje } from './lenguaje.js';

/**
 * El catálogo cerrado de motivos de rechazo. Cada clave es una manera distinta de
 * que un texto no llegue a pantalla, y ninguna es una frase redactada.
 */
export const MOTIVOS_DE_APTITUD = Object.freeze({
  /** Llegó vacío o solo con espacios. */
  TEXTO_VACIO: 'texto-vacio',
  /** Pasa del tope de longitud de su hueco: en pantalla se recortaría a mitad de frase. */
  FUERA_DE_TOPE: 'fuera-de-tope',
  /** Léxico no apto para menores. */
  LEXICO_NO_APTO: 'lexico-no-apto',
  /** Manda a consumir en el sitio real, que es lo que `progresion.md` prohíbe. */
  CONSUMO_EN_EL_ANCLAJE: 'consumo-en-el-anclaje',
  /** Una fórmula de masculino genérico evitable, de las que `lenguaje.md` reformula. */
  MASCULINO_GENERICO: 'masculino-generico',
  /** Morfología inventada: la `-e`, la `-x` y la arroba como marca de género. */
  MORFOLOGIA_INVENTADA: 'morfologia-inventada',
  /** Desdoblamiento: decir dos veces lo mismo en vez de reformular. */
  DESDOBLAMIENTO: 'desdoblamiento',
  /** Una cifra de distancia, esfuerzo, ritmo o progreso: ninguna pantalla las lleva. */
  CIFRA_PROHIBIDA: 'cifra-prohibida',
  /** Nombra la aplicación, la red, un permiso o una carga: dentro del juego solo habla el mundo. */
  VOZ_DE_APLICACION: 'voz-de-aplicacion',
  /** Nombra el hoy con sus palabras —el bar, la farmacia—, que el mundo no dice. */
  REGISTRO_DE_HOY: 'registro-de-hoy',
  /** Trae dentro un dato real del mundo congelado: el nombre del anclaje, un identificador. */
  DATO_REAL: 'dato-real',
  /** Caracteres que el locale no usa, o cifras dentro de un nombre propio. */
  CARACTER_AJENO: 'caracter-ajeno',
  /** Un nombre propuesto que el índice global del mundo ya tenía. */
  NOMBRE_QUE_CHOCA: 'nombre-que-choca',
});

/** Las claves válidas, en el orden en que se declaran. Es lo que enumera el histograma. */
export const CLAVES_DE_APTITUD = congelaHondo(Object.values(MOTIVOS_DE_APTITUD));

/**
 * Las familias de lista, en **el orden en que se comprueban**.
 *
 * El orden se declara porque el motivo que sale es el de la primera que casa, y un
 * orden que dependiera de cómo se escribió el objeto daría dos motivos distintos para
 * el mismo texto según el día.
 */
export const FAMILIAS_DE_APTITUD = congelaHondo([
  'lexicoNoApto',
  'consumoEnElAnclaje',
  'masculinoGenerico',
  'morfologiaInventada',
  'desdoblamiento',
  'cifras',
  'vozDeAplicacion',
  'registroDeHoy',
]);

/** Qué motivo produce cada familia. Uno por familia, y todos del catálogo cerrado. */
export const MOTIVO_POR_FAMILIA = congelaHondo({
  lexicoNoApto: MOTIVOS_DE_APTITUD.LEXICO_NO_APTO,
  consumoEnElAnclaje: MOTIVOS_DE_APTITUD.CONSUMO_EN_EL_ANCLAJE,
  masculinoGenerico: MOTIVOS_DE_APTITUD.MASCULINO_GENERICO,
  morfologiaInventada: MOTIVOS_DE_APTITUD.MORFOLOGIA_INVENTADA,
  desdoblamiento: MOTIVOS_DE_APTITUD.DESDOBLAMIENTO,
  cifras: MOTIVOS_DE_APTITUD.CIFRA_PROHIBIDA,
  vozDeAplicacion: MOTIVOS_DE_APTITUD.VOZ_DE_APLICACION,
  registroDeHoy: MOTIVOS_DE_APTITUD.REGISTRO_DE_HOY,
});

// --- las listas por defecto ---------------------------------------------------
//
// Tres de las ocho familias ya viven en el paquete de idioma y **no se reescriben**:
// masculino genérico, morfología inventada, desdoblamiento, cifras y registro de hoy
// salen de `reglasDeLenguaje`, que es lo que valida también el catálogo de plantillas.
// Un texto de plantilla y uno del modelo se miden con la misma vara, que es la única
// manera de que «el juego habla igual con red y sin ella» sea cierto.

/**
 * Léxico no apto para menores.
 *
 * Es contenido, no estilo: bebida, tabaco, apuestas, sexo, violencia gráfica y
 * exabruptos. Va por palabras y fórmulas cortas porque aquí un falso positivo cuesta
 * una frase de plantilla —que siempre existe— y un falso negativo cuesta que un
 * exabrupto llegue a la pantalla de una niña de once años.
 */
const LEXICO_NO_APTO_ES = [
  'aguardiente', 'orujo', 'licor', 'ron', 'whisky', 'ginebra', 'vodka', 'coñac',
  'cerveza', 'cervezas', 'vino', 'vinos', 'chupito', 'chupitos', 'alcohol',
  'borracho', 'borracha', 'borrachos', 'borrachas', 'borrachera', 'emborracharse',
  'tabaco', 'cigarro', 'cigarrillo', 'porro', 'droga', 'drogas',
  'apuesta', 'apuestas', 'apostar', 'casino', 'timba',
  'burdel', 'prostituta', 'prostituto', 'sexo', 'desnuda', 'desnudo',
  'asesinar', 'asesinato', 'degollar', 'apuñalar', 'cadáver', 'cadáveres',
  'suicidio', 'suicidarse', 'tortura', 'torturar', 'mutilar',
  'puta', 'puto', 'joder', 'jodido', 'mierda', 'cabrón', 'cabrona', 'coño',
  'gilipollas', 'hostia', 'hostias', 'capullo', 'imbécil', 'idiota',
];

const LEXICO_NO_APTO_GL = [
  'augardente', 'augardente', 'licor', 'ron', 'whisky', 'xenebra', 'vodka',
  'cervexa', 'cervexas', 'viño', 'viños', 'chupito', 'alcol', 'alcohol',
  'borracho', 'borracha', 'borrachos', 'borrachas', 'borracheira',
  'tabaco', 'cigarro', 'droga', 'drogas',
  'aposta', 'apostas', 'apostar', 'casino',
  'bordel', 'prostituta', 'sexo', 'espida', 'espido',
  'asasinar', 'asasinato', 'degolar', 'apuñalar', 'cadáver', 'cadáveres',
  'suicidio', 'tortura', 'torturar', 'mutilar',
  'puta', 'puto', 'merda', 'cabrón', 'cona', 'parvo', 'idiota',
];

/**
 * Mandar a consumir en el sitio real.
 *
 * `progresion.md` lo prohíbe expresamente —el oro no toca dinero real ni manda a
 * gastar en el negocio del anclaje— y es la mitad de «el chiste nunca es a costa del
 * sitio real» que sí se puede comprobar. Van fórmulas y no palabras sueltas: «ronda»
 * a secas es un nombre de calzada perfectamente honesto.
 */
const CONSUMO_ES = [
  'una ronda', 'otra ronda', 'invita a una', 'te invita a tomar', 'toma algo',
  'tómate algo', 'tomarte algo', 'pide una copa', 'pide algo', 'consumición',
  'consumiciones', 'a consumir', 'entra a tomar', 'entra a beber', 'paga la cuenta',
  'deja propina', 'compra algo allí', 'gasta unas monedas allí',
];

const CONSUMO_GL = [
  'unha rolda', 'outra rolda', 'convídate a', 'toma algo', 'tomar algo',
  'pide unha copa', 'pide algo', 'consumición', 'consumicións', 'a consumir',
  'entra a tomar', 'entra a beber', 'paga a conta', 'deixa propina',
];

/**
 * La voz de la aplicación, que dentro del juego no habla.
 *
 * `lenguaje.md` lo dice sin matices: dentro del juego solo habla el mundo. Un texto
 * que nombra la red, un permiso o una carga rompe la ficción justo en el momento en
 * que la ficción es lo único que hay, que es cuando no hay cobertura.
 */
const VOZ_DE_APLICACION = [
  'aplicación', 'app', 'aplicativo', 'pantalla', 'botón', 'menú', 'ajustes',
  'red', 'conexión', 'cobertura', 'internet', 'wifi', 'datos móviles', 'servidor',
  'permiso', 'permisos', 'notificación', 'notificaciones', 'batería',
  'cargando', 'carga', 'descarga', 'descargando', 'actualización', 'actualizar',
  'sin conexión', 'modo avión', 'gps', 'satélite', 'ubicación', 'sincronizar',
  'inténtalo de nuevo', 'vuelve a intentarlo', 'error',
];

const POR_LOCALE = congelaHondo({
  es: { lexicoNoApto: LEXICO_NO_APTO_ES, consumoEnElAnclaje: CONSUMO_ES, vozDeAplicacion: VOZ_DE_APLICACION },
  gl: { lexicoNoApto: LEXICO_NO_APTO_GL, consumoEnElAnclaje: CONSUMO_GL, vozDeAplicacion: VOZ_DE_APLICACION },
});

/** Los idiomas con listas de aptitud declaradas, en orden declarado. */
export const IDIOMAS_CON_APTITUD = congelaHondo(Object.keys(POR_LOCALE));

/**
 * Las listas por defecto de un locale, ya compiladas.
 *
 * **Falla nombrando el locale** en lugar de caer al castellano: un idioma sin listas
 * daría por apto todo lo que no ha podido comprobar, que es exactamente la
 * degradación silenciosa de `pipeline/decisiones-orquestador.md` §6h.
 */
export function listasDeAptitud(locale) {
  const propias = Object.prototype.hasOwnProperty.call(POR_LOCALE, locale) ? POR_LOCALE[locale] : null;
  if (!propias) {
    throw new Error(
      `el idioma ${JSON.stringify(locale) ?? String(locale)} no declara listas de aptitud: los declarados son ${IDIOMAS_CON_APTITUD.join(', ')}. ` +
      'Un idioma nuevo trae las suyas, en vez de dar por apto lo que no ha podido comprobar',
    );
  }
  // Las cinco familias que ya vienen del paquete de idioma se toman tal cual: el
  // texto del modelo y el de la plantilla se miden con la misma vara.
  const deLenguaje = reglasDeLenguaje(locale);
  const listas = {};
  for (const familia of FAMILIAS_DE_APTITUD) {
    if (FAMILIAS_DE_REGLA.includes(familia)) listas[familia] = deLenguaje[familia];
    else listas[familia] = propias[familia].map(reglaDeFormula);
  }
  return congelaHondo({ locale, ...listas });
}

// --- el motivo, como dato -----------------------------------------------------

/**
 * Compone un motivo del catálogo, validándolo.
 *
 * Una causa que no esté en el catálogo **hace fallar la entrega nombrándola**. Es la
 * diferencia entre un filtro que se puede auditar y uno que devuelve «no apto» para
 * todo y no dice nada de nada.
 */
export function motivoDeAptitud({ clave, familia = null, fragmento = null, detalle = null }) {
  if (!CLAVES_DE_APTITUD.includes(clave)) {
    throw new Error(
      `motivo de aptitud desconocido ${JSON.stringify(clave) ?? String(clave)}: el catálogo cerrado es ${CLAVES_DE_APTITUD.join(', ')}. ` +
      'Una causa nueva se añade al catálogo, no se entrega con una clave genérica',
    );
  }
  return congelaHondo({ clave, familia, fragmento, detalle });
}

/** La clave pelada de un rechazo, que es lo que se cuenta. */
export function claveDeAptitud(motivo) {
  if (!motivo || !CLAVES_DE_APTITUD.includes(motivo.clave)) {
    throw new Error(`esto no es un motivo de aptitud del catálogo: ${JSON.stringify(motivo)}`);
  }
  return motivo.clave;
}

/** El histograma de una lista de rechazos, por clave y sin parsear ninguna frase. */
export function histogramaDeAptitud(motivos) {
  const cuenta = {};
  for (const clave of CLAVES_DE_APTITUD) cuenta[clave] = 0;
  for (const m of motivos ?? []) cuenta[claveDeAptitud(m)] += 1;
  return congelaHondo(cuenta);
}

// --- el cribado contra los datos reales ---------------------------------------

/** Sin acentos y en minúsculas, que es como se comparan dos nombres que son el mismo. */
export function normaliza(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * La longitud mínima de un dato real para entrar en el cribado.
 *
 * Por debajo de tres caracteres, cribar un dato real es cribar una sílaba: un anclaje
 * llamado «Ao» tumbaría cualquier texto en gallego. El cribado es deliberadamente
 * estricto, no absurdo.
 */
export const MINIMO_DEL_DATO = 3;

/** Si un dato real aparece dentro de un texto, comparando como palabra y sin acentos. */
export function apareceDato(texto, dato) {
  const aguja = normaliza(dato).trim();
  if (aguja.length < MINIMO_DEL_DATO) return false;
  const escapado = aguja.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escapado}(?![a-z0-9])`).test(normaliza(texto));
}

/**
 * El primer dato real que asoma dentro de un texto, con de dónde salió, o `null`.
 *
 * Devuelve **el primero en el orden en que llegó la lista**, que por eso se construye
 * ordenada: dos ejecuciones tienen que nombrar el mismo dato.
 */
export function datoRealEn(texto, datosReales = []) {
  for (const entrada of datosReales) {
    const dato = typeof entrada === 'string' ? entrada : entrada?.dato;
    if (dato == null) continue;
    if (apareceDato(texto, dato)) {
      return congelaHondo({ dato, de: typeof entrada === 'string' ? null : entrada?.de ?? null });
    }
  }
  return null;
}

// --- el filtro ----------------------------------------------------------------

/** Los caracteres que un nombre propio puede llevar. Ni cifras, ni signos raros. */
const CARACTERES_DE_NOMBRE = /^[\p{L}\p{M}][\p{L}\p{M} '’·-]*$/u;

/**
 * Crea el filtro con sus listas y sus datos reales ya inyectados.
 *
 * `valida` no lee nada que no le hayan pasado: es lo que hace que ampliar la lista de
 * masculino genérico —el pendiente 2 de `lenguaje.md`— no toque ni una línea de la
 * comprobación.
 *
 * @param opciones
 *   `locale` el idioma del mundo; `listas` las compiladas, o las de por defecto de ese
 *   locale; `datosReales` la lista de datos del mundo congelado contra la que se criba.
 */
export function creaFiltroDeAptitud({ locale, listas = null, datosReales = [] } = {}) {
  const suyas = listas ?? listasDeAptitud(locale);
  if (!suyas || typeof suyas !== 'object') {
    throw new Error(`el filtro de aptitud necesita sus listas y llegó ${JSON.stringify(listas) ?? String(listas)}`);
  }
  for (const familia of FAMILIAS_DE_APTITUD) {
    if (!Array.isArray(suyas[familia])) {
      throw new Error(
        `las listas del filtro de aptitud no declaran la familia "${familia}" para el idioma ${JSON.stringify(suyas.locale ?? locale)}: ` +
        `las ocho son ${FAMILIAS_DE_APTITUD.join(', ')}`,
      );
    }
  }

  /**
   * Valida un texto. Devuelve `{ apto: true }` o `{ apto: false, motivo }`, y el
   * motivo es siempre una clave del catálogo cerrado.
   *
   * @param texto  el texto a validar.
   * @param opciones  `tope` el máximo de caracteres del hueco; `esNombre` si además
   *   tiene que cumplir la forma de un nombre propio.
   */
  function valida(texto, { tope = null, esNombre = false } = {}) {
    if (typeof texto !== 'string' || texto.trim().length === 0) {
      return { apto: false, motivo: motivoDeAptitud({ clave: MOTIVOS_DE_APTITUD.TEXTO_VACIO }) };
    }
    if (tope != null && texto.length > tope) {
      return {
        apto: false,
        motivo: motivoDeAptitud({ clave: MOTIVOS_DE_APTITUD.FUERA_DE_TOPE, detalle: { longitud: texto.length, tope } }),
      };
    }
    if (esNombre && !CARACTERES_DE_NOMBRE.test(texto.trim())) {
      return {
        apto: false,
        motivo: motivoDeAptitud({ clave: MOTIVOS_DE_APTITUD.CARACTER_AJENO, fragmento: texto }),
      };
    }
    for (const familia of FAMILIAS_DE_APTITUD) {
      for (const regla of suyas[familia]) {
        const casa = texto.match(regla.re);
        if (casa) {
          return {
            apto: false,
            motivo: motivoDeAptitud({ clave: MOTIVO_POR_FAMILIA[familia], familia, fragmento: casa[0], detalle: { formula: regla.formula } }),
          };
        }
      }
    }
    // Y encima de las listas, el mundo: por si un nombre real llegara de vuelta
    // dentro de la respuesta, que es la puerta de atrás que el prompt tiene cerrada.
    const real = datoRealEn(texto, datosReales);
    if (real) {
      return {
        apto: false,
        motivo: motivoDeAptitud({ clave: MOTIVOS_DE_APTITUD.DATO_REAL, fragmento: real.dato, detalle: { de: real.de } }),
      };
    }
    return { apto: true, motivo: null };
  }

  return congelaHondo({ locale: suyas.locale ?? locale ?? null, listas: suyas, datosReales, valida });
}
