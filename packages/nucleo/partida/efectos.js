// El catálogo cerrado de lo que un paso del mundo puede producir. Existe para que
// «un paso solo añade» (`quests.md` decisión 4) sea estructural y no una
// convención: los tipos son tres, los tres añaden, y un efecto que no encaje hace
// fallar el paso entero en lugar de aplicarse a medias.
//
// El motor no sabe qué es un rumor: sabe qué forma tiene un efecto y qué no puede
// hacer. Quién los produce —la propagación de la fila 12, la cola de oportunidades
// de la fila 19— cuelga por inyección y no se nombra aquí.

import { congelaHondo } from '../core/congelar.js';

/**
 * Los tres tipos, literalmente los de `quests.md` decisión 4: «puede crear un
 * rumor, una oportunidad o una razón para volver».
 *
 * Cada uno declara **qué campos admite**, y esa lista es lo que convierte la regla
 * en estructura: un efecto que traiga `retira`, `caduca` o cualquier otra cosa que
 * el catálogo no declare no se aplica a medias, no se aplica en absoluto.
 *
 * `signo` está declarado y **no se valida contra ningún valor «bueno»**: la
 * consecuencia de un acto de la jugadora puede ser mala y viaja igual. La regla
 * protege contra penalizar la ausencia, no contra propagar lo que se hizo.
 */
export const TIPOS_DE_EFECTO = congelaHondo({
  rumor: {
    anade: true,
    campos: ['nucleo', 'asunto', 'nivel', 'signo', 'origen'],
    obligatorios: ['nucleo', 'asunto'],
  },
  oportunidad: {
    anade: true,
    campos: ['asunto', 'clase', 'lugar', 'origen'],
    obligatorios: ['asunto'],
  },
  'razon-para-volver': {
    anade: true,
    campos: ['lugar', 'asunto', 'origen'],
    obligatorios: ['lugar'],
  },
});

/** Los identificadores del catálogo, en orden estable. */
export const IDS_DE_EFECTO = congelaHondo(Object.keys(TIPOS_DE_EFECTO).sort());

// El catálogo se comprueba a sí mismo al cargarse. Es barato y cierra la puerta
// por la que la regla se rompería de verdad: no con un efecto raro, sino con un
// tipo nuevo añadido aquí dentro el día que alguien quiera «solo caducar una cosa».
for (const tipo of IDS_DE_EFECTO) {
  if (TIPOS_DE_EFECTO[tipo].anade !== true) {
    throw new Error(`el catálogo de efectos declara "${tipo}" sin añadir: un paso solo añade, así que un tipo que quite no puede existir`);
  }
}

/**
 * Los verbos con los que se quita. Es la **segunda red**: un campo así ya fallaría
 * por no estar declarado, pero entonces el error diría «campo desconocido» y no lo
 * que de verdad ocurre, que es que alguien intentó restar en un paso del mundo.
 */
const VERBOS_QUE_QUITAN = /(quita|retira|caduca|resta|elimina|borra|baja|penaliza|revoca|expira|descuenta)/i;

/** Un tipo del catálogo, y todos añaden por construcción. */
export function esTipoDeEfecto(tipo) {
  return typeof tipo === 'string' && Object.prototype.hasOwnProperty.call(TIPOS_DE_EFECTO, tipo);
}

/**
 * Valida un efecto contra el catálogo y lo devuelve congelado.
 *
 * @param efecto  lo que devolvió un productor.
 * @param quien   quién lo produjo, para que el error nombre al culpable y el paso
 *   concreto: un fallo que no dice de qué productor viene es inútil en un motor con
 *   varios colgados.
 */
export function validaEfecto(efecto, quien = 'un productor de paso') {
  if (!efecto || typeof efecto !== 'object' || Array.isArray(efecto)) {
    throw new Error(`${quien} devolvió ${JSON.stringify(efecto) ?? String(efecto)}, que no es un efecto: se espera un objeto con "tipo" y los campos que ese tipo declara`);
  }
  const { tipo } = efecto;
  if (VERBOS_QUE_QUITAN.test(String(tipo))) {
    throw new Error(`${quien} devolvió el efecto "${tipo}", que quita: un paso solo añade, así que se rechaza entero (los tipos declarados son ${IDS_DE_EFECTO.join(', ')})`);
  }
  if (!esTipoDeEfecto(tipo)) {
    throw new Error(`${quien} devolvió un efecto del tipo ${JSON.stringify(tipo) ?? String(tipo)}, que no está en el catálogo: los declarados son ${IDS_DE_EFECTO.join(', ')}`);
  }

  const declarado = TIPOS_DE_EFECTO[tipo];
  for (const campo of Object.keys(efecto)) {
    if (campo === 'tipo') continue;
    if (VERBOS_QUE_QUITAN.test(campo)) {
      throw new Error(`${quien} devolvió un efecto "${tipo}" con el campo "${campo}", que quita: un paso solo añade y el efecto se rechaza entero`);
    }
    if (!declarado.campos.includes(campo)) {
      throw new Error(`${quien} devolvió un efecto "${tipo}" con el campo "${campo}", que el catálogo no declara: los de este tipo son ${declarado.campos.join(', ')}`);
    }
    const valor = efecto[campo];
    // Una cantidad negativa es la manera mecánica de restar, y es la única que se
    // puede reconocer sin saber qué significa el campo.
    if (typeof valor === 'number' && !(Number.isFinite(valor) && valor >= 0)) {
      throw new Error(`${quien} devolvió un efecto "${tipo}" con "${campo}" = ${valor}: un paso solo añade, así que no se admite una cantidad negativa ni no finita`);
    }
  }
  for (const campo of declarado.obligatorios) {
    if (efecto[campo] === undefined || efecto[campo] === null) {
      throw new Error(`${quien} devolvió un efecto "${tipo}" sin "${campo}", que es obligatorio: los de este tipo son ${declarado.obligatorios.join(', ')}`);
    }
  }

  return congelaHondo({ ...efecto });
}

/** La lista entera, validada de una vez. Si uno falla, no se aplica ninguno. */
export function validaEfectos(efectos, quien = 'un productor de paso') {
  if (efectos === undefined || efectos === null) return [];
  if (!Array.isArray(efectos)) {
    throw new Error(`${quien} devolvió ${JSON.stringify(efectos) ?? String(efectos)}: se espera una lista de efectos del catálogo, o nada`);
  }
  return efectos.map((e) => validaEfecto(e, quien));
}
