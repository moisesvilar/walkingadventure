// Por qué una plantilla no se ofrece, como **dato** y no como frase.
//
// El motivo del fallo es la otra mitad del casting: alimenta el informe de salud
// del generador, que es una de las pocas cosas que este proyecto sí mide. Una
// cadena redactada se agrega parseando texto y se rompe al reescribirla; una clave
// de catálogo cerrado se cuenta. Por eso aquí no hay ni una frase de las que se
// enseñan: hay clave, roles implicados y el requisito que pedían.
//
// El catálogo es **cerrado y comprobado**: una causa que no esté aquí hace fallar
// la entrega nombrándola, en vez de salir como clave genérica que enmascare el
// caso. Es el mismo criterio con el que `world/grafo.js` trata la marca de
// suposición: lo que no está declarado es un error de construcción, no un dato que
// falte.

/**
 * Las claves del catálogo cerrado. Ninguna se refiere a la falta de gente, y es
 * deliberado: un rol humano lo produce el sitio donde trabaja (`npcs.md`), así que
 * lo único que estrecha el casting son los lugares.
 */
export const MOTIVOS_DE_CASTING = Object.freeze({
  /** Ni un lugar del mundo cumple lo que pide un rol. */
  SIN_CANDIDATOS: 'sin-candidatos',
  /** Hay candidatos, pero el grafo no ofrece camino entre dos de ellos. */
  SIN_RUTA_EN_EL_GRAFO: 'sin-ruta-en-el-grafo',
  /** Un trecho entre dos beats pasa del tope: más de media hora al ritmo de quien juega. */
  TRECHO_FUERA_DEL_TOPE: 'trecho-fuera-del-tope',
  /** Dos beats caerían pegados y el lazo sería una vuelta a la manzana. */
  TRECHO_POR_DEBAJO_DEL_MINIMO: 'trecho-por-debajo-del-minimo',
  /** El recorrido entero no cabe en el alcance del tamaño declarado. */
  RECORRIDO_FUERA_DEL_TAMANO: 'recorrido-fuera-del-tamano',
  /** La plantilla declara más o menos beats de los que su tamaño admite. */
  BEATS_FUERA_DEL_TAMANO: 'beats-fuera-del-tamano',
  /** El primer o el último beat no caen cerca del punto de partida. */
  LAZO_QUE_NO_CIERRA: 'lazo-que-no-cierra',
  /** Con el horario diurno activo, la franja de un beat cae fuera de él. */
  FRANJA_INCOMPATIBLE: 'franja-incompatible',
});

/** Las claves válidas, en el orden en que se declaran. Es lo que enumera el histograma. */
export const CLAVES_DE_MOTIVO = Object.freeze(Object.values(MOTIVOS_DE_CASTING));

// El único motivo que no habla de ningún rol: el número de beats es una propiedad
// de la plantilla entera y atribuírselo a uno cualquiera sería inventarse el dato.
const SIN_ROLES = [MOTIVOS_DE_CASTING.BEATS_FUERA_DEL_TAMANO];

/**
 * Compone un motivo del catálogo, validándolo.
 *
 * @param {object} motivo
 *   `clave` una de `MOTIVOS_DE_CASTING`; `roles` los roles implicados —uno el que
 *   no se pudo resolver, dos cuando lo que no casó es el trecho entre ellos—;
 *   `requisito` qué pedían, como dato estructurado y nunca como texto.
 * @returns el motivo congelado.
 */
export function motivoDeCasting({ clave, roles = [], requisito = null }) {
  if (!CLAVES_DE_MOTIVO.includes(clave)) {
    throw new Error(
      `motivo de casting desconocido ${JSON.stringify(clave)}: el catálogo cerrado es ${CLAVES_DE_MOTIVO.join(', ')}. ` +
      'Una causa nueva se añade al catálogo, no se entrega con una clave genérica',
    );
  }
  if (!Array.isArray(roles) || roles.some((r) => typeof r !== 'string' || r.length === 0)) {
    throw new Error(`el motivo "${clave}" declara sus roles como ${JSON.stringify(roles)} y tienen que ser una lista de identificadores de rol`);
  }
  if (roles.length === 0 && !SIN_ROLES.includes(clave)) {
    throw new Error(`el motivo "${clave}" tiene que nombrar el rol o los roles implicados: sin ellos no se distingue si falla la plantilla o el mundo`);
  }
  if (requisito != null && typeof requisito !== 'object') {
    throw new Error(`el motivo "${clave}" declara un requisito que no es un dato estructurado: ${JSON.stringify(requisito)}`);
  }
  return Object.freeze({
    clave,
    roles: Object.freeze([...roles]),
    requisito: requisito == null ? null : Object.freeze({ ...requisito }),
  });
}

/**
 * La clave de agregación de un motivo, para el histograma del informe de salud.
 *
 * Existe para que nadie vuelva a contar fallos leyendo una cadena: es la clave
 * pelada, sin roles ni requisito, que es lo que se cuenta.
 */
export function claveDeMotivo(motivo) {
  if (!motivo || !CLAVES_DE_MOTIVO.includes(motivo.clave)) {
    throw new Error(`esto no es un motivo del catálogo: ${JSON.stringify(motivo)}`);
  }
  return motivo.clave;
}
