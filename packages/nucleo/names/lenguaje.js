// Las reglas de lenguaje que sí se pueden comprobar, por idioma: las fórmulas de
// masculino genérico evitable, la morfología que este proyecto no usa, el
// desdoblamiento, las cifras que ningún texto puede llevar dentro, el registro de
// hoy que el mundo no nombra, y el catálogo cerrado de ranuras de concordancia.
//
// Vive en el paquete de idioma y no dentro del catálogo de plantillas por dos
// motivos de `game-design/lenguaje.md`: las fórmulas son propias de cada lengua, y
// **el mismo filtro lo usará después el texto que escriba el LLM** (fila 18), que no
// puede depender del catálogo para validarse.
//
// Lo que aquí no está y no se pretende: si un chiste tiene gracia y a costa de qué.
// Eso es revisión a mano y no hay aserción que lo capture.

import { congelaHondo } from '../core/congelar.js';
import { GENEROS, IDS_DE_GENERO } from '../partida/puestos.js';

/**
 * El género con el que se resuelve una ranura cuando nadie lo inyecta.
 *
 * **Femenino**, y no es un valor por defecto silencioso que tape un olvido: es la
 * decisión declarada del proyecto —«quien no toque nada juega en femenino»—, y es
 * además como llega la creación de personaje.
 */
export const GENERO_POR_DEFECTO = GENEROS.FEMENINO;

/** Los dos géneros gramaticales, los mismos que el reparto de caras. */
export { GENEROS, IDS_DE_GENERO };

/**
 * Cómo se escribe una ranura dentro de un texto: `{forastera}`.
 *
 * Una sola marca y no dos textos ni una barra: duplicar los textos duplicaría el
 * catálogo entero, y «forastero/a» es ilegible en voz alta, que es la restricción
 * que `lenguaje.md` pone por encima de todo.
 */
export const MARCA_DE_RANURA = /\{([a-záéíóúüñ]+)\}/g;

/**
 * El catálogo cerrado de ranuras. Son **claves**, y la palabra con la que se dice
 * cada una la pone el paquete de idioma: la clave se escribe en femenino porque en
 * la duda el sesgo va hacia el femenino, no porque el femenino sea la forma base.
 */
export const RANURAS = congelaHondo([
  'forastera',
  'sola',
  'dispuesta',
  'atenta',
  'lista',
  'misma',
  'tranquila',
  'harta',
  'segura',
  'amiga',
]);

// Las formas de cada ranura, por idioma. Un idioma nuevo implementa el catálogo
// entero o falla nombrando la ranura que le falta: dejar el marcador dentro del
// texto sería enseñar la costura al jugador.
const FORMAS = congelaHondo({
  es: {
    forastera: { femenino: 'forastera', masculino: 'forastero' },
    sola: { femenino: 'sola', masculino: 'solo' },
    dispuesta: { femenino: 'dispuesta', masculino: 'dispuesto' },
    atenta: { femenino: 'atenta', masculino: 'atento' },
    lista: { femenino: 'lista', masculino: 'listo' },
    misma: { femenino: 'misma', masculino: 'mismo' },
    tranquila: { femenino: 'tranquila', masculino: 'tranquilo' },
    harta: { femenino: 'harta', masculino: 'harto' },
    segura: { femenino: 'segura', masculino: 'seguro' },
    amiga: { femenino: 'amiga', masculino: 'amigo' },
  },
  gl: {
    forastera: { femenino: 'forasteira', masculino: 'forasteiro' },
    sola: { femenino: 'soa', masculino: 'só' },
    dispuesta: { femenino: 'disposta', masculino: 'disposto' },
    atenta: { femenino: 'atenta', masculino: 'atento' },
    lista: { femenino: 'lista', masculino: 'listo' },
    misma: { femenino: 'mesma', masculino: 'mesmo' },
    tranquila: { femenino: 'tranquila', masculino: 'tranquilo' },
    harta: { femenino: 'farta', masculino: 'farto' },
    segura: { femenino: 'segura', masculino: 'seguro' },
    amiga: { femenino: 'amiga', masculino: 'amigo' },
  },
});

// Los límites de palabra de JavaScript son ASCII, así que «vecinos» dentro de
// «vecinosidad» casaría y «años» no casaría nunca. Estos dos miran la letra de al
// lado incluyendo las acentuadas, que es lo que hace falta en castellano y gallego.
const ANTES = '(?<![\\wáéíóúüñÁÉÍÓÚÜÑ])';
const DESPUES = '(?![\\wáéíóúüñÁÉÍÓÚÜÑ])';

/** Una fórmula literal como regla: la fórmula tal cual se dice, y su expresión. */
function formula(texto) {
  const escapado = texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Object.freeze({ formula: texto, re: new RegExp(ANTES + escapado + DESPUES, 'i') });
}

/** Una regla que no es una fórmula literal sino una forma: se nombra y se explica. */
function forma(nombre, re) {
  return Object.freeze({ formula: nombre, re });
}

// --- masculino genérico evitable -------------------------------------------
//
// La lista es **pendiente 2 de `lenguaje.md`** y esta no la cierra: recoge las
// fórmulas frecuentes que el propio documento propone reformular —«quien camina»,
// «la gente de aquí», «el vecindario», «quien llegue», «cualquiera»— y deja fuera
// lo que sería falso positivo, como el masculino de una persona concreta del
// reparto. Se amplía añadiendo una entrada, no reescribiendo el mecanismo.
const MASCULINO_GENERICO_ES = [
  'los vecinos', 'los aldeanos', 'los habitantes', 'los lugareños', 'los paisanos',
  'los viajeros', 'los caminantes', 'los peregrinos', 'los forasteros',
  'los mercaderes', 'los guardias', 'los soldados', 'los pastores', 'los criados',
  'los niños', 'los hombres', 'los chicos', 'los muchachos', 'los ancianos',
  'los amigos', 'los dueños', 'los clientes', 'los parroquianos', 'los hermanos',
  'los curiosos', 'los testigos', 'los culpables', 'los ladrones', 'los sabios',
  'los muertos', 'los demás', 'los que', 'todos los', 'todos', 'bienvenidos',
  'uno de ellos', 'alguno de ellos', 'cualquiera de ellos', 'el hombre',
];

const MASCULINO_GENERICO_GL = [
  'os veciños', 'os aldeáns', 'os habitantes', 'os viaxeiros', 'os camiñantes',
  'os peregrinos', 'os mercadores', 'os gardas', 'os soldados', 'os pastores',
  'os nenos', 'os homes', 'os rapaces', 'os anciáns', 'os amigos', 'os donos',
  'os clientes', 'os irmáns', 'os curiosos', 'os testemuñas', 'os culpables',
  'os ladróns', 'os sabios', 'os mortos', 'os demais', 'os que', 'todos os',
  'todos', 'benvidos', 'un deles', 'algún deles', 'o home',
];

// --- morfología que este proyecto no usa ------------------------------------
//
// «Nada de -e ni de -x»: choca de frente con leerse en voz alta. El `-x` y el `@`
// se reconocen por su forma; el `-e` no se puede reconocer por la terminación sin
// llevarse por delante media lengua, así que va como lista de las formas que de
// verdad aparecen.
const MORFOLOGIA_ES = [
  forma('terminación en -x como marca de género', new RegExp(`${ANTES}[a-záéíóúüñ]{2,}x(?:es|s)?${DESPUES}`, 'i')),
  forma('arroba como marca de género', new RegExp(`${ANTES}[a-záéíóúüñ]{2,}@s?${DESPUES}`, 'i')),
  ...['todes', 'elles', 'amigues', 'vecines', 'niñes', 'chiques', 'compañeres', 'nosotres', 'bienvenides'].map(formula),
];

const MORFOLOGIA_GL = [
  forma('terminación en -x como marca de género', new RegExp(`${ANTES}[a-záéíóúüñ]{2,}x(?:es|s)?${DESPUES}`, 'i')),
  forma('arroba como marca de género', new RegExp(`${ANTES}[a-záéíóúüñ]{2,}@s?${DESPUES}`, 'i')),
  ...['todes', 'elles', 'amigues', 'veciñes', 'nenes', 'benvides'].map(formula),
];

// --- desdoblamiento ---------------------------------------------------------
//
// «Antes de desdoblar, reformular»: el desdoblamiento en cada frase es ilegible en
// voz alta. La barra entra aquí y no en morfología porque es la misma decisión
// —decir dos veces lo mismo— con otra tipografía.
const DESDOBLAMIENTO = [
  forma('desdoblamiento «los X y las X»', new RegExp(`${ANTES}(?:los|unos|todos|estos|aquellos)\\s+[a-záéíóúüñ]+s\\s+y\\s+(?:las|unas|todas|estas|aquellas)\\s+[a-záéíóúüñ]+s${DESPUES}`, 'i')),
  forma('desdoblamiento «las X y los X»', new RegExp(`${ANTES}(?:las|unas|todas|estas|aquellas)\\s+[a-záéíóúüñ]+s\\s+y\\s+(?:los|unos|todos|estos|aquellos)\\s+[a-záéíóúüñ]+s${DESPUES}`, 'i')),
  forma('desdoblamiento con barra', new RegExp(`${ANTES}[a-záéíóúüñ]{3,}\\/(?:a|as|os|o)${DESPUES}`, 'i')),
];

// --- cifras -----------------------------------------------------------------
//
// «Ningún texto puede depender de un número que solo existe en la maqueta», y el
// juego no enseña distancia ni esfuerzo. Las dos reglas caen en la misma lista
// porque el remedio es el mismo: no escribir la cifra. El oro queda fuera y no por
// olvido — su cantidad la pone el desenlace en ejecución y nunca está dentro del
// texto.
const NUMERALES = [
  'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'veinte', 'treinta', 'cuarenta',
  'cincuenta', 'cien', 'ciento', 'mil', 'ambos', 'ambas', 'sendos', 'sendas',
  'docena', 'docenas', 'decena', 'decenas', 'centenar', 'centenares', 'millar',
  'primero', 'primera', 'primer', 'segundo', 'segunda', 'tercero', 'tercera',
  'tercer', 'cuarto', 'cuarta', 'quinto', 'quinta', 'último', 'última',
  'media', 'medio', 'mitad', 'doble', 'triple', 'par',
];

const UNIDADES_DE_ESFUERZO = [
  'metro', 'metros', 'kilómetro', 'kilómetros', 'legua', 'leguas', 'milla', 'millas',
  'minuto', 'minutos', 'hora', 'horas', 'pasos', 'zancadas', 'calorías',
  // El ritmo y el progreso entran aquí porque son las otras dos cifras que el juego
  // no enseña (`bucle-jugable.md` §3), y porque el núcleo entero se revisa contra
  // ellas: un texto que las nombre no llega a pantalla.
  'ritmo', 'ritmos', 'progreso', 'tramo', 'tramos',
];

const CIFRAS = [
  forma('cifra en dígitos', /\d/),
  ...NUMERALES.map(formula),
  ...UNIDADES_DE_ESFUERZO.map(formula),
];

// --- el registro de hoy -----------------------------------------------------
//
// El mundo se nombra en su propio registro. La lista es la mitad automatizable de
// «el chiste nunca es a costa del sitio real»: si el texto no puede nombrar el
// sitio, la mitad fea del riesgo desaparece sin depender de que alguien lo lea.
// No enumera marcas —son infinitas— sino las categorías con las que un anclaje
// real llega desde OpenStreetMap y los negocios que se nombran igual hoy.
const REGISTRO_DE_HOY = [
  'bar', 'bares', 'cafetería', 'cafeterías', 'café', 'cafés', 'restaurante', 'restaurantes',
  'pizzería', 'hamburguesería', 'heladería', 'cervecería', 'pub', 'discoteca',
  'supermercado', 'hipermercado', 'centro comercial', 'tienda', 'quiosco', 'estanco',
  'farmacia', 'parafarmacia', 'clínica', 'hospital', 'ambulatorio', 'consultorio',
  'gasolinera', 'aparcamiento', 'parking', 'autobús', 'estación', 'aeropuerto',
  'hotel', 'hostal', 'camping', 'apartamento', 'chiringuito',
  'banco', 'cajero', 'oficina', 'polígono', 'urbanización',
  'colegio', 'instituto', 'guardería', 'universidad', 'biblioteca', 'museo',
  'ayuntamiento', 'polideportivo', 'gimnasio', 'piscina', 'parque', 'peluquería',
  'panadería', 'carnicería', 'pescadería', 'frutería', 'ferretería', 'papelería',
  'óptica', 'lavandería', 'inmobiliaria', 'notaría', 'gestoría',
  'wifi', 'móvil', 'aplicación', 'internet',
];

const REGLAS = congelaHondo({
  es: {
    locale: 'es',
    masculinoGenerico: MASCULINO_GENERICO_ES.map(formula),
    morfologiaInventada: MORFOLOGIA_ES,
    desdoblamiento: DESDOBLAMIENTO,
    cifras: CIFRAS,
    registroDeHoy: REGISTRO_DE_HOY.map(formula),
  },
  gl: {
    locale: 'gl',
    masculinoGenerico: MASCULINO_GENERICO_GL.map(formula),
    morfologiaInventada: MORFOLOGIA_GL,
    desdoblamiento: DESDOBLAMIENTO,
    cifras: CIFRAS,
    registroDeHoy: REGISTRO_DE_HOY.map(formula),
  },
});

/** Los idiomas con reglas declaradas, en orden declarado. */
export const IDIOMAS_CON_REGLAS = congelaHondo(Object.keys(REGLAS));

/** Las familias de regla, en el orden en que se comprueban. Es lo que agrupa el informe. */
export const FAMILIAS_DE_REGLA = congelaHondo([
  'masculinoGenerico',
  'morfologiaInventada',
  'desdoblamiento',
  'cifras',
  'registroDeHoy',
]);

/**
 * Las reglas de un idioma. **Falla nombrando el idioma** en lugar de caer al
 * castellano: un idioma nuevo sin reglas pasaría todos los filtros y nadie lo
 * sabría, que es la forma de fallo de `pipeline/decisiones-orquestador.md` §6h.
 */
export function reglasDeLenguaje(locale) {
  const reglas = Object.prototype.hasOwnProperty.call(REGLAS, locale) ? REGLAS[locale] : null;
  if (!reglas) {
    throw new Error(
      `el idioma ${JSON.stringify(locale) ?? String(locale)} no declara reglas de lenguaje: los declarados son ${IDIOMAS_CON_REGLAS.join(', ')}. ` +
      'Un idioma nuevo trae las suyas, en vez de pasar todos los filtros por no tener ninguno',
    );
  }
  return reglas;
}

/**
 * Qué reglas rompe un texto, como **datos**: familia, fórmula y el fragmento que
 * casó. Nunca una frase redactada, por el mismo motivo por el que el motivo de
 * casting es una clave: lo que se cuenta se agrega, lo que se lee se parsea.
 *
 * `salvo` deja fuera familias concretas —el catálogo no comprueba las cifras de un
 * texto que declara oro— y se pasa siempre explícito.
 */
export function infraccionesDeTexto(texto, { locale = 'es', salvo = [] } = {}) {
  if (typeof texto !== 'string') {
    throw new Error(`la revisión de lenguaje necesita un texto y llegó ${JSON.stringify(texto) ?? String(texto)}`);
  }
  const reglas = reglasDeLenguaje(locale);
  const fuera = new Set(salvo);
  const out = [];
  for (const familia of FAMILIAS_DE_REGLA) {
    if (fuera.has(familia)) continue;
    for (const regla of reglas[familia]) {
      const casa = texto.match(regla.re);
      if (casa) out.push(Object.freeze({ familia, formula: regla.formula, fragmento: casa[0] }));
    }
  }
  return out;
}

/** Las ranuras que un texto usa, en el orden en que aparecen y sin repetir. */
export function ranurasDeTexto(texto) {
  const out = [];
  for (const [, ranura] of String(texto).matchAll(MARCA_DE_RANURA)) {
    if (!out.includes(ranura)) out.push(ranura);
  }
  return out;
}

/** Una ranura del catálogo cerrado, o un error que la nombra y enumera las válidas. */
export function exigeRanura(ranura, quien = 'la ranura de concordancia') {
  if (!RANURAS.includes(ranura)) {
    throw new Error(
      `${quien} ${JSON.stringify(ranura) ?? String(ranura)} no está en el catálogo cerrado de ranuras: las declaradas son ${RANURAS.join(', ')}`,
    );
  }
  return ranura;
}

/**
 * Resuelve las ranuras de un texto contra el género gramatical de quien juega.
 *
 * Sin género inyectado, **femenino**. Una ranura que el paquete de idioma no conoce
 * **falla nombrando la ranura y el idioma** en lugar de dejar el marcador dentro
 * del texto: un `{forastera}` en pantalla es peor que un error en la batería.
 */
export function resuelveConcordancia(texto, { locale = 'es', genero = GENERO_POR_DEFECTO } = {}) {
  if (typeof texto !== 'string') {
    throw new Error(`la concordancia necesita un texto y llegó ${JSON.stringify(texto) ?? String(texto)}`);
  }
  if (!IDS_DE_GENERO.includes(genero)) {
    throw new Error(
      `el género gramatical de quien juega llega como ${JSON.stringify(genero) ?? String(genero)}: los declarados son ${IDS_DE_GENERO.join(' y ')}. ` +
      `Sin inyectar se resuelve en ${GENERO_POR_DEFECTO}, que es la decisión del proyecto y no un descuido`,
    );
  }
  const formas = Object.prototype.hasOwnProperty.call(FORMAS, locale) ? FORMAS[locale] : null;
  if (!formas) {
    throw new Error(
      `el idioma ${JSON.stringify(locale) ?? String(locale)} no declara formas de concordancia: los declarados son ${Object.keys(FORMAS).join(', ')}`,
    );
  }
  return texto.replace(MARCA_DE_RANURA, (_, ranura) => {
    const forma_ = Object.prototype.hasOwnProperty.call(formas, ranura) ? formas[ranura] : null;
    if (!forma_) {
      throw new Error(
        `el paquete de idioma "${locale}" no conoce la ranura de concordancia "${ranura}": las declaradas son ${Object.keys(formas).join(', ')}. ` +
        'Dejar el marcador dentro del texto enseñaría la costura a quien juega',
      );
    }
    return forma_[genero];
  });
}

// El catálogo de formas se comprueba a sí mismo al cargarse, igual que el de
// puestos y el de efectos: un idioma al que le falte una ranura tiene que fallar
// aquí y no la primera vez que alguien juegue en él.
for (const locale of Object.keys(FORMAS)) {
  for (const ranura of RANURAS) {
    const forma_ = FORMAS[locale][ranura];
    if (!forma_) {
      throw new Error(`el paquete de idioma "${locale}" no declara la ranura de concordancia "${ranura}": el catálogo de ranuras es cerrado y se implementa entero`);
    }
    for (const genero of IDS_DE_GENERO) {
      if (typeof forma_[genero] !== 'string' || !forma_[genero]) {
        throw new Error(`la ranura "${ranura}" del idioma "${locale}" no declara su forma en ${genero}`);
      }
    }
  }
  for (const ranura of Object.keys(FORMAS[locale])) exigeRanura(ranura, `el paquete de idioma "${locale}" declara la ranura`);
}
