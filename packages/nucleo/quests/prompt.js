// El sobre de la petición, la construcción del prompt y el cribado final contra los
// datos reales del mundo congelado.
//
// La garantía de privacidad **no se monta buscando lo prohibido dentro de un texto
// libre**, porque eso solo encuentra lo que se le ocurrió a quien escribió la búsqueda.
// Se monta al revés: el sobre es un objeto con una **lista blanca cerrada** de campos y
// lo que no está declarado no puede entrar. `game-design/seguridad-privacidad.md` §1
// pide exactamente eso, «la lista explícita de qué campos pueden viajar».
//
// Y encima de la lista blanca hay una segunda comprobación, que es la que hace la
// afirmación de privacidad ponible en rojo (§6o de `pipeline/decisiones-orquestador.md`):
// la lista blanca impide que un dato real entre **por su campo**, no que entre **dentro**
// de un campo permitido —un nombre de fantasía que por casualidad coincide con el real,
// una plantilla que interpola donde no debe—. Así que con el prompt ya construido y la
// lista de datos reales de ese mundo delante, **se criba, y una coincidencia hace fallar
// la construcción** nombrando el dato y el campo por el que entró.
//
// Es deliberadamente estricto y produce un falso positivo posible, que se resuelve
// fallando: fallar ahí manda al fallback una frase; dejar pasar manda el nombre del bar
// de alguien a un modelo.
//
// Nada de aquí abre una conexión: el prompt se construye y se afirma entero sin red.

import { congelaHondo } from '../core/congelar.js';
import { apareceDato, normaliza } from '../names/aptitud-de-texto.js';

/**
 * Los campos que pueden viajar. **Lista blanca cerrada**: lo que no esté aquí no puede
 * entrar, y meterlo hace fallar la petición nombrándolo.
 *
 * Por qué cada uno es seguro está en la spec y se resume así: o es una constante del
 * juego igual para todo el mundo, o lo produjo el código desde la semilla, o lo fijó el
 * casting y viaja **como restricción y no como pregunta**.
 */
export const CAMPOS_DEL_SOBRE = congelaHondo([
  'locale',
  'tono',
  'reglas',
  'punto',
  'tipos',
  'nombres',
  'escena',
  'disparador',
  'tamano',
  'signo',
  'nivel',
  'hechos',
  'mote',
  'huecos',
  'topicos',
]);

/**
 * Lo que **nunca** entra, ni en un campo ni dentro de otro. Va escrito porque es la
 * mitad que se lee, no la que se ejecuta: la que se ejecuta es la lista blanca.
 *
 * Sobre el mote conviene ser explícito, porque parece contradecir la regla y no la
 * contradice: **el mote sí viaja** porque lo produce el código desde la semilla, y **el
 * nombre del personaje no** porque lo teclea una persona y puede ser cualquier cosa. La
 * línea no es «lo que suena a fantasía», es **lo que produjo el código**.
 */
export const LO_QUE_NUNCA_VIAJA = congelaHondo([
  'el nombre real del anclaje',
  'su place_id y su identificador de OSM',
  'cualquier coordenada o dirección',
  'la semilla del mapa',
  'el nombre del personaje, que lo teclea la jugadora',
  'los kilómetros, la hora, la fecha y por dónde ha estado',
]);

/** El tono del juego. Constante, igual para todo el mundo, y por eso puede viajar. */
export const TONO = 'cómico-cálido, para leerse en voz alta; el chiste está en el desajuste y nunca a costa de nadie';

/** Las reglas de escritura que viajan. Son las de `game-design/lenguaje.md`, resumidas. */
export const REGLAS_DE_ESCRITURA = congelaHondo([
  'inclusivo con sesgo al femenino: antes de desdoblar, reformular',
  'nada de morfología inventada en -e, -x ni arroba',
  // Dicho sin nombrar ninguna de las magnitudes que el juego no enseña: el núcleo se
  // revisa contra ellas y un texto exportado que las nombre no pasa esa revisión, ni
  // siquiera cuando lo que hace es prohibirlas.
  'ninguna cifra de lo que se anda, de lo que se tarda ni de lo que se lleva hecho',
  'dentro del juego solo habla el mundo: ni la aplicación, ni la red, ni un permiso',
  'apto para menores',
]);

// --- Los datos reales de un mundo congelado ------------------------------------

const anota = (out, visto, dato, de) => {
  if (dato == null) return;
  const texto = String(dato).trim();
  if (!texto) return;
  const clave = normaliza(texto);
  if (visto.has(clave)) return;
  visto.add(clave);
  out.push({ dato: texto, de });
};

const anotaFicha = (out, visto, ficha, de) => {
  if (!ficha || typeof ficha !== 'object') return;
  anota(out, visto, ficha.name, `${de} · nombre real`);
  anota(out, visto, ficha.osmId, `${de} · identificador de OSM`);
  anota(out, visto, ficha.placeId, `${de} · place_id`);
};

/**
 * La lista de datos reales de un mundo congelado, ordenada y sin repetidos.
 *
 * De aquí sale lo que se criba, y por eso incluye **todo lo que el lado real aporta**:
 * los nombres y los identificadores de los anclajes de núcleos, servicios y parajes; los
 * nombres reales de las calles del callejero, que son de OSM tanto como un bar; los
 * identificadores de vía; la semilla del mapa y sus coordenadas de origen.
 *
 * El orden es el de recorrido declarado —núcleos, servicios, parajes, callejero, mapa—
 * para que dos ejecuciones nombren **el mismo dato** cuando haya más de una coincidencia.
 */
export function datosRealesDeMundo(mundo) {
  if (!mundo || typeof mundo !== 'object') {
    throw new Error(`el cribado necesita el mundo congelado del que salió el prompt y llegó ${JSON.stringify(mundo) ?? String(mundo)}`);
  }
  const out = [];
  const visto = new Set();

  for (const s of mundo.settlements ?? []) {
    anotaFicha(out, visto, s.anchor, `el anclaje del núcleo "${s.name}"`);
    anotaFicha(out, visto, s.real, `el anclaje del núcleo "${s.name}"`);
    for (const v of s.services ?? []) anotaFicha(out, visto, v.real, `el anclaje del servicio "${v.name}"`);
  }
  for (const p of mundo.parajes ?? []) anotaFicha(out, visto, p.real, `el anclaje del paraje "${p.name}"`);

  for (const familia of ['roads', 'callejero']) {
    for (const via of mundo.geo?.[familia] ?? []) {
      anota(out, visto, via.name, `el nombre real de una vía del ${familia}`);
      anota(out, visto, via.osmId, `el identificador de una vía del ${familia}`);
    }
  }
  for (const pico of mundo.geo?.peaks ?? []) anota(out, visto, pico.name, 'el nombre real de un pico');

  anota(out, visto, mundo.seed, 'la semilla del mapa');
  if (mundo.origin) {
    anota(out, visto, mundo.origin.lat, 'la latitud de origen');
    anota(out, visto, mundo.origin.lon, 'la longitud de origen');
  }
  return congelaHondo(out);
}

// --- El sobre ------------------------------------------------------------------

/** El texto plano de un valor del sobre, para poder cribarlo campo a campo. */
function comoTexto(valor) {
  if (valor == null) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (Array.isArray(valor)) return valor.map(comoTexto).join(' · ');
  return Object.keys(valor)
    .sort()
    .map((k) => `${k}: ${comoTexto(valor[k])}`)
    .join('; ');
}

/**
 * Compone el sobre de una petición, validándolo contra la lista blanca.
 *
 * Falla **nombrando el campo** en dos casos: cuando llega uno que la lista blanca no
 * declara, y cuando dentro de un campo permitido asoma un dato real del mundo. El
 * segundo ocurre **antes de construir ningún prompt**, que es lo que lo hace barato de
 * leer en un error.
 */
export function sobreDePeticion(campos, { datosReales = [] } = {}) {
  if (!campos || typeof campos !== 'object') {
    throw new Error(`el sobre de la petición se compone con sus campos y llegó ${JSON.stringify(campos) ?? String(campos)}`);
  }
  for (const campo of Object.keys(campos)) {
    if (!CAMPOS_DEL_SOBRE.includes(campo)) {
      throw new Error(
        `el sobre de la petición lleva el campo "${campo}", que no está en la lista blanca: los declarados son ${CAMPOS_DEL_SOBRE.join(', ')}. ` +
        'La lista es cerrada a propósito: lo que no está declarado no puede viajar',
      );
    }
  }
  if (typeof campos.locale !== 'string' || !campos.locale) {
    throw new Error(`el sobre de la petición no declara el locale: llegó ${JSON.stringify(campos.locale) ?? String(campos.locale)}`);
  }
  const sobre = {};
  for (const campo of CAMPOS_DEL_SOBRE) {
    if (Object.prototype.hasOwnProperty.call(campos, campo)) sobre[campo] = campos[campo];
  }
  for (const campo of Object.keys(sobre)) {
    const texto = comoTexto(sobre[campo]);
    for (const entrada of datosReales) {
      if (apareceDato(texto, entrada.dato)) {
        throw new Error(
          `el campo "${campo}" del sobre de la petición lleva dentro un dato real del mundo ("${entrada.dato}", ${entrada.de}): ` +
          'del móvil no sale nada real, y esto se corta antes de construir ningún prompt',
        );
      }
    }
  }
  return congelaHondo(sobre);
}

// --- El prompt ------------------------------------------------------------------

/** Cómo se dice cada campo dentro del prompt. El orden es el de la lista blanca. */
const ETIQUETA = congelaHondo({
  locale: 'Idioma',
  tono: 'Tono',
  reglas: 'Reglas de escritura',
  punto: 'Momento de la petición',
  tipos: 'Tipos de lugar (vocabulario del juego)',
  nombres: 'Nombres de fantasía, ya decididos',
  escena: 'Escena',
  disparador: 'Disparador, ya fijado',
  tamano: 'Tamaño de la salida',
  signo: 'Signo del rumor (restricción, no la decides)',
  nivel: 'Nivel de deformación (restricción, no lo decides)',
  hechos: 'Hechos, ya fijados',
  mote: 'Mote',
  huecos: 'Huecos a redactar',
  topicos: 'NO uses nada de esto: ya se ha leído',
});

/**
 * Los segmentos del prompt, uno por campo del sobre y en el orden de la lista blanca.
 *
 * Se construye por segmentos y no como una cadena de una pieza porque el cribado tiene
 * que poder decir **por qué campo entró** el dato que lo tumbó. Una cadena sola sabría
 * decir que hay un nombre real dentro y no de dónde salió, que es la mitad que sirve.
 */
export function segmentosDelPrompt(sobre) {
  const segmentos = [];
  for (const campo of CAMPOS_DEL_SOBRE) {
    if (!Object.prototype.hasOwnProperty.call(sobre, campo)) continue;
    if (campo === 'topicos') {
      // El registro viaja **como restricción negativa y nunca como ejemplo a imitar**,
      // y por eso su etiqueta lo dice en el propio prompt.
      const categorias = Object.keys(sobre.topicos ?? {}).sort();
      const cuerpo = categorias.map((c) => `${c}: ${(sobre.topicos[c] ?? []).join(' | ')}`).join('\n');
      segmentos.push({ campo, texto: `${ETIQUETA[campo]}\n${cuerpo}` });
      continue;
    }
    segmentos.push({ campo, texto: `${ETIQUETA[campo]}: ${comoTexto(sobre[campo])}` });
  }
  return segmentos;
}

/**
 * Criba unos segmentos ya construidos contra los datos reales del mundo.
 *
 * @returns el primer choque —`{ dato, de, campo }`— o `null`. El primero y no todos,
 *   porque una coincidencia ya hace fallar la construcción y enumerar el resto sería
 *   trabajo para un error que nadie va a leer entero.
 */
export function cribaSegmentos(segmentos, datosReales = []) {
  for (const segmento of segmentos) {
    for (const entrada of datosReales) {
      if (apareceDato(segmento.texto, entrada.dato)) {
        return congelaHondo({ dato: entrada.dato, de: entrada.de, campo: segmento.campo });
      }
    }
  }
  return null;
}

/**
 * Construye el prompt de una petición y lo criba contra el mundo del que salió.
 *
 * Una coincidencia **hace fallar la construcción** nombrando el dato y el campo. No hay
 * modo permisivo, y no lo hay a propósito: el criterio que se puede poner en rojo es lo
 * único que separa una afirmación de privacidad de una intención.
 *
 * @returns `{ texto, segmentos }`, congelado. Y no hace ninguna llamada de red: el
 *   resultado se puede afirmar entero sin conexión.
 */
export function construyePrompt({ sobre, datosReales = [] }) {
  if (!sobre || typeof sobre !== 'object') {
    throw new Error(`la construcción del prompt necesita el sobre ya validado y llegó ${JSON.stringify(sobre) ?? String(sobre)}`);
  }
  const segmentos = segmentosDelPrompt(sobre);
  const choque = cribaSegmentos(segmentos, datosReales);
  if (choque) {
    throw new Error(
      `el prompt lleva dentro un dato real del mundo congelado: "${choque.dato}" (${choque.de}), y entró por el campo "${choque.campo}". ` +
      'La construcción falla en vez de mandarlo: un nombre de fantasía que coincide con el real es un falso positivo asumido, ' +
      'y fallar aquí cuesta una frase de plantilla mientras dejar pasar cuesta el nombre del sitio de alguien',
    );
  }
  return congelaHondo({ texto: segmentos.map((s) => s.texto).join('\n\n'), segmentos });
}
