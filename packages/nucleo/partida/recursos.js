// Los tres huecos de B3 y B4: las ilustraciones por su prompt de ficción, las fotos
// del lado real por su `place_id`, y los textos ya validados en línea con su origen.
// Aquí está **la forma del hueco y no su contenido**: generar las imágenes es de la
// fila 25 y los textos, de la fila 18. Lo que esta capa responde, y es lo que sostiene
// RF-PERS-002, es qué le falta a una aventura para jugarse sin red.

import { congelaHondo } from '../core/congelar.js';

/** Los dos estados de un recurso binario. No hay un tercero: o está en el móvil o no. */
export const ESTADOS = Object.freeze({ AUSENTE: 'ausente', RESIDENTE: 'residente' });

/** De dónde salió un texto del juego. Se declara siempre, porque decide qué se puede reescribir. */
export const ORIGENES_DE_TEXTO = Object.freeze(['llm', 'plantilla']);

/** Las tres familias de recurso, en el orden en que viven en el documento. */
export const FAMILIAS = Object.freeze(['ilustraciones', 'fotos', 'textos']);

/**
 * Los tres huecos vacíos, que es el estado normal hoy.
 *
 * Un mundo sin ninguna ilustración, ninguna foto y ningún texto del LLM está
 * completo y es jugable: cada hueco **declara** que está vacío en vez de no existir,
 * que es lo que permite preguntar qué falta sin que la respuesta sea un `undefined`.
 */
export function recursosVacios() {
  return { ilustraciones: [], fotos: [], textos: [] };
}

/**
 * La clave de un elemento del mundo dentro de la capa de recursos.
 *
 * Sale del tipo y del nombre de fantasía y de nada más: los nombres son únicos
 * dentro de un mundo —lo garantiza el índice de nombres— y ninguno de los dos dice
 * nada del sitio real, que es la condición de `seguridad-privacidad.md` §1.
 */
export function claveDeElemento(tipo, nombre) {
  if (!tipo || !nombre) throw new Error(`clave de elemento mal formada: llegó tipo="${tipo}" y nombre="${nombre}"`);
  return `${tipo}:${nombre}`;
}

/**
 * La clave con la que se pide y se cachea la ilustración de un prompt de ficción.
 *
 * Es **derivada del prompt** y no inventada, que es lo que fija RF-INFRA-002: el
 * proxy cachea lo inerte por esa misma clave, así que guardar la clave en lugar del
 * binario permite volver a pedir un recurso perdido sin tocar la capa de ficción. El
 * prompt es por construcción un texto sin ningún dato real, así que derivar de él no
 * reintroduce por la puerta de atrás lo que el prompt tenía prohibido llevar.
 *
 * FNV-1a de 32 bits en hexadecimal: no es criptografía, es un identificador estable
 * y el paquete no tiene dependencias con las que hacer otra cosa.
 */
export function claveDeIlustracion(prompt) {
  if (typeof prompt !== 'string' || !prompt) {
    throw new Error('claveDeIlustracion necesita el prompt de ficción: sin él no hay clave con la que pedir ni cachear la imagen');
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < prompt.length; i++) {
    h ^= prompt.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `il_${h.toString(16).padStart(8, '0')}`;
}

/**
 * Declara la ilustración de un elemento.
 *
 * El documento guarda el prompt, su clave y la referencia al recurso local, o la
 * declaración de que no lo hay. **El binario no entra**, ni en línea ni codificado:
 * un JSON con imágenes dentro deja de poder compararse y de poder leerse por partes.
 */
export function declaraIlustracion({ elemento, prompt, recurso = null }) {
  if (!elemento) throw new Error('declaraIlustracion necesita el elemento del mundo al que ilustra');
  return {
    elemento,
    prompt,
    clave: claveDeIlustracion(prompt),
    recurso: recurso ?? null,
    estado: recurso ? ESTADOS.RESIDENTE : ESTADOS.AUSENTE,
  };
}

/**
 * Declara la foto del lado real de un anclaje.
 *
 * Se guardan el `place_id`, la referencia local y la fecha de captura, y **ninguna
 * URL de Places**, que caduca. La fecha es la única marca de reloj de todo el
 * documento y llega de un reloj **inyectado**: dentro del núcleo leer el reloj del
 * sistema está prohibido, y con el reloj fuera una prueba puede fijarla y el
 * documento sigue siendo comparable byte a byte.
 */
export function declaraFoto({ anclaje, placeId, recurso = null, capturadaEn = null, reloj = null }) {
  if (!placeId) throw new Error('declaraFoto necesita el place_id: es lo único de Places que se puede guardar');
  let fecha = capturadaEn;
  if (fecha == null && recurso != null) {
    if (typeof reloj !== 'function') {
      throw new Error(
        `la foto de ${placeId} está residente y no declara fecha de captura: pásale "capturadaEn", o inyecta un reloj — ` +
        'el núcleo no lee el reloj del sistema y sin fecha no se puede saber cuándo hay que refrescarla',
      );
    }
    fecha = reloj();
  }
  if (fecha != null && typeof fecha !== 'string') {
    throw new Error(`la fecha de captura de ${placeId} tiene que ser texto y llegó ${typeof fecha}`);
  }
  return {
    anclaje: anclaje ?? `places:${placeId}`,
    placeId,
    recurso: recurso ?? null,
    capturadaEn: fecha ?? null,
    estado: recurso ? ESTADOS.RESIDENTE : ESTADOS.AUSENTE,
  };
}

/**
 * Declara un texto ya validado.
 *
 * Los textos **sí** van en línea: `quests.md` decisión 1 manda guardarlos con la
 * partida, son texto y no mueven la aguja del tamaño, y sacarlos fuera añadiría una
 * indirección por cada frase del juego. El origen se declara siempre.
 */
export function declaraTexto({ clave, texto, origen }) {
  if (!clave) throw new Error('declaraTexto necesita la clave con la que se recupera el texto');
  if (typeof texto !== 'string') throw new Error(`el texto de "${clave}" tiene que ser texto y llegó ${typeof texto}`);
  if (!ORIGENES_DE_TEXTO.includes(origen)) {
    throw new Error(`origen de texto desconocido "${origen}" en "${clave}": los declarados son ${ORIGENES_DE_TEXTO.join(' y ')}`);
  }
  return { clave, texto, origen };
}

/**
 * La capa de recursos en su forma canónica: las tres listas, cada una ordenada por
 * su clave estable y sin repetidos.
 *
 * El orden es declarado y no el de inserción, que es lo que permite afirmar que dos
 * congelaciones del mismo mundo dan el mismo texto aunque los recursos se hayan ido
 * declarando en otro orden.
 */
export function ordenaRecursos(recursos) {
  const r = recursos ?? recursosVacios();
  const por = (clave) => (a, b) => (clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : 0);
  return {
    ilustraciones: (r.ilustraciones ?? []).slice().sort(por((x) => x.elemento)),
    fotos: (r.fotos ?? []).slice().sort(por((x) => x.anclaje)),
    textos: (r.textos ?? []).slice().sort(por((x) => x.clave)),
  };
}

/** Los recursos residentes, indexados. Se responde con esto y no recorriendo listas. */
export function inventario(recursos) {
  const r = ordenaRecursos(recursos);
  return congelaHondo({
    ilustraciones: r.ilustraciones.filter((i) => i.estado === ESTADOS.RESIDENTE).map((i) => i.elemento),
    fotos: r.fotos.filter((f) => f.estado === ESTADOS.RESIDENTE).map((f) => f.anclaje),
    textos: r.textos.map((t) => t.clave),
  });
}

/** La clave con la que se guarda el texto de un beat de una aventura. */
export function claveDeTextoDeBeat(plantilla, n) {
  return `${plantilla}:beat:${n}`;
}

/**
 * Qué le falta a una aventura para poder jugarse **sin una sola petición de red**.
 *
 * Se responde sin salir a ningún sitio, y esa es toda la frontera: conseguir lo que
 * falte es de la preparación de la salida (fila 28) y generarlo, de las filas 18 y
 * 25. `packages/nucleo/` no habla con la red (RF-INFRA-001), así que esta capa
 * enumera y no consigue.
 *
 * Lo que falta **no impide jugar**: un paraje sin ilustración cae al material de
 * plantilla y un anclaje sin foto abre su visor con la cartela sobre fondo liso. Por
 * eso la respuesta enumera, y no rechaza.
 */
export function queFaltaParaJugarSinRed({ aventura, recursos }) {
  if (!aventura || !Array.isArray(aventura.beats)) {
    throw new Error('queFaltaParaJugarSinRed necesita una aventura con sus beats: sin ellos no hay nada que enumerar');
  }
  const inv = inventario(recursos);
  const faltan = [];
  const visto = new Set();
  const anota = (familia, clave, de) => {
    const id = `${familia}|${clave}`;
    if (visto.has(id)) return;
    visto.add(id);
    faltan.push({ familia, clave, de });
  };

  for (const beat of aventura.beats) {
    const lugar = beat.lugar ?? null;
    if (lugar) {
      const elemento = claveDeElemento(lugar.tipo, lugar.nombre);
      if (!inv.ilustraciones.includes(elemento)) anota('ilustracion', elemento, `beat ${beat.n}`);
      const placeId = lugar.real?.placeId ?? null;
      if (placeId && !inv.fotos.includes(`places:${placeId}`)) anota('foto', `places:${placeId}`, `beat ${beat.n}`);
    }
    const claveTexto = claveDeTextoDeBeat(aventura.plantilla, beat.n);
    if (!inv.textos.includes(claveTexto)) anota('texto', claveTexto, `beat ${beat.n}`);
  }

  return congelaHondo({ completo: faltan.length === 0, faltan });
}
