// La secuencia de una llegada: qué se enseña al llegar a un sitio, en qué orden y en
// qué modo. Es **un dato del núcleo y no una navegación de la app** — una lista
// ordenada de `{ tipo, modo }` que sale del sitio, de si es la primera visita, de si
// hay beat y de si el sitio es un núcleo.
//
// Que sea un dato es la decisión entera, y tiene tres consecuencias que son su razón:
// el orden de RF-BUCLE-006 se puede poner rojo sobre los ocho mundos de referencia sin
// un simulador; las filas 33, 34 y 35 reciben qué paso montar en lugar de deducir cada
// una por su cuenta si es la primera visita o si hay beat; y **la ausencia de
// navegación es estructural y no una omisión de UI**: no hay ruta a la que ir, así que
// no hay manera de llegar a la pantalla de un núcleo sin haber llegado al núcleo.
//
// Y el orden, que es lo que `bucle-jugable.md` §2 fija y aquí se escribe una sola vez:
// visor, beat o ficha, y **lo que aquí se cuenta siempre al final**. El beat es el
// motivo del viaje y el estado del pueblo es el marco; ponerlo delante convertiría en
// peaje algo que tiene que ser un regalo.

import { congelaHondo } from '../core/congelar.js';

/** Los cuatro tipos de paso que puede tener una llegada. Catálogo cerrado. */
export const TIPOS_DE_PASO = Object.freeze({
  VISOR: 'visor',
  BEAT: 'beat',
  FICHA: 'ficha',
  LO_QUE_SE_CUENTA: 'lo-que-se-cuenta',
});

/**
 * Los cuatro tipos **en el orden en que aparecen en una secuencia**, que es la misma
 * lista y no dos: un catálogo y un orden separados es cómo se desincronizan.
 */
export const IDS_DE_TIPO = congelaHondo([
  TIPOS_DE_PASO.VISOR,
  TIPOS_DE_PASO.BEAT,
  TIPOS_DE_PASO.FICHA,
  TIPOS_DE_PASO.LO_QUE_SE_CUENTA,
]);

/**
 * Los dos modos de un paso. **Encadenado** lo trae llegar; **a un toque** está
 * disponible y no se abre solo.
 *
 * El visor de la segunda visita es un modo del mismo paso y no una secuencia distinta
 * (`bucle-jugable.md` §2): volver tiene que sentirse distinto de descubrir, y
 * modelarlo así es lo que evita que las filas 33 y 34 tengan que saber cuál es la
 * visita.
 */
export const MODOS = Object.freeze({ ENCADENADO: 'encadenado', A_UN_TOQUE: 'a-un-toque' });

/** Los dos modos, en orden declarado. */
export const IDS_DE_MODO = congelaHondo([MODOS.ENCADENADO, MODOS.A_UN_TOQUE]);

/** Los tipos de sitio a los que se llega. Solo el núcleo tiene estado que contar. */
export const TIPOS_DE_SITIO = congelaHondo(['nucleo', 'paraje', 'servicio']);

/**
 * Las formas que puede tomar una secuencia.
 *
 * Las **cuatro primeras** son las que la spec nombra y las que los ocho mundos de
 * referencia tienen que producir. La quinta existe porque existe en el mundo —un beat
 * del lazo puede caer en un paraje o en un servicio, y entonces no hay ni ficha ni
 * estado del pueblo— y se declara en lugar de meterla a la fuerza en una de las otras:
 * una forma sin nombre es una forma que nadie cuenta.
 */
export const FORMAS = Object.freeze({
  SOLO_FICHA: 'solo-ficha',
  FICHA_CON_VISOR: 'ficha-con-visor',
  BEAT_CON_LO_QUE_SE_CUENTA: 'beat-con-lo-que-se-cuenta',
  LO_QUE_SE_CUENTA_ENTERO: 'lo-que-se-cuenta-entero',
  BEAT_SIN_NUCLEO: 'beat-sin-nucleo',
});

/** Las cuatro formas declaradas por la spec, en el orden en que las nombra. */
export const FORMAS_DECLARADAS = congelaHondo([
  FORMAS.SOLO_FICHA,
  FORMAS.FICHA_CON_VISOR,
  FORMAS.BEAT_CON_LO_QUE_SE_CUENTA,
  FORMAS.LO_QUE_SE_CUENTA_ENTERO,
]);

/** Todas las formas, en orden estable. */
export const IDS_DE_FORMA = congelaHondo(Object.values(FORMAS).slice().sort());

/**
 * Lo que esta capa entrega **no escribiéndolo**, nombrado para que su ausencia se pueda
 * poner roja igual que la de un botón.
 *
 * `bucle-jugable.md` §2 y el artefacto 4: «ninguna de estas pantallas se navega». Que
 * no haya manera de saltar es lo que impide que el visor se convierta en un trámite y
 * que el estado del pueblo se convierta en un peaje.
 */
export const OPERACIONES_QUE_NO_EXISTEN = congelaHondo([
  'saltar-a-un-paso',
  'volver-al-paso-anterior',
  'navegar-a-un-paso',
  'reordenar-la-secuencia',
]);

function exigeBooleano(valor, quien) {
  if (typeof valor !== 'boolean') {
    throw new Error(`${quien} es un dato de dos valores y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  return valor;
}

/** El tipo de sitio, validado. Falla nombrando los declarados. */
export function exigeTipoDeSitio(tipo, quien = 'el sitio al que se llega') {
  if (!TIPOS_DE_SITIO.includes(tipo)) {
    throw new Error(`${quien} declara el tipo ${JSON.stringify(tipo) ?? String(tipo)}, que no es ninguno de los declarados: ${TIPOS_DE_SITIO.join(', ')}`);
  }
  return tipo;
}

/**
 * La secuencia de una llegada.
 *
 * @param {object} opciones
 *   `tipoDeSitio` uno de `TIPOS_DE_SITIO`; `primeraVisita` si es la primera vez aquí;
 *   `hayIlustracion` si el sitio tiene ilustración —sin ella no hay visor en ningún
 *   modo—; `hayBeat` si este sitio es del lazo vigente o si le ha caído un
 *   micro-encuentro, que producen exactamente el mismo paso.
 * @returns la lista ordenada de `{ tipo, modo }`, congelada. **Nunca vacía y nunca con
 *   un tipo repetido**: no existe una llegada que no enseñe nada.
 */
export function secuenciaDeLlegada({ tipoDeSitio, primeraVisita, hayIlustracion, hayBeat }) {
  const tipo = exigeTipoDeSitio(tipoDeSitio);
  exigeBooleano(primeraVisita, 'si es la primera visita al sitio');
  exigeBooleano(hayIlustracion, 'si el sitio tiene ilustración');
  exigeBooleano(hayBeat, 'si el sitio tiene beat hoy');

  const esNucleo = tipo === 'nucleo';
  const pasos = [];

  // El visor abre, y solo la primera vez encadenado. Sin ilustración no aparece en
  // ningún modo: un visor vacío sería una pantalla que no enseña nada.
  if (hayIlustracion) {
    pasos.push({ tipo: TIPOS_DE_PASO.VISOR, modo: primeraVisita ? MODOS.ENCADENADO : MODOS.A_UN_TOQUE });
  }
  if (hayBeat) pasos.push({ tipo: TIPOS_DE_PASO.BEAT, modo: MODOS.ENCADENADO });
  // La ficha es lo que hay cuando no se ha venido a nada, y por eso no convive con el
  // beat. En un núcleo tampoco: allí la llegada entera es lo que se cuenta.
  if (!hayBeat && !esNucleo) pasos.push({ tipo: TIPOS_DE_PASO.FICHA, modo: MODOS.ENCADENADO });
  // Siempre al final, sin excepción configurable.
  if (esNucleo) pasos.push({ tipo: TIPOS_DE_PASO.LO_QUE_SE_CUENTA, modo: MODOS.ENCADENADO });

  return congelaHondo(pasos);
}

/** Una secuencia bien formada: lista, con tipos y modos declarados y sin repetidos. */
export function exigeSecuencia(secuencia, quien = 'la secuencia de la llegada') {
  if (!Array.isArray(secuencia) || !secuencia.length) {
    throw new Error(`${quien} llega como ${JSON.stringify(secuencia) ?? String(secuencia)}: es una lista ordenada de pasos y nunca está vacía`);
  }
  const vistos = new Set();
  secuencia.forEach((paso, i) => {
    if (!paso || !IDS_DE_TIPO.includes(paso.tipo)) {
      throw new Error(`el paso ${i} de ${quien} declara el tipo ${JSON.stringify(paso?.tipo) ?? String(paso?.tipo)}: los declarados son ${IDS_DE_TIPO.join(', ')}`);
    }
    if (!IDS_DE_MODO.includes(paso.modo)) {
      throw new Error(`el paso ${i} de ${quien} declara el modo ${JSON.stringify(paso.modo) ?? String(paso.modo)}: los declarados son ${IDS_DE_MODO.join(', ')}`);
    }
    if (vistos.has(paso.tipo)) throw new Error(`${quien} repite el paso "${paso.tipo}": una llegada no enseña dos veces lo mismo`);
    vistos.add(paso.tipo);
  });
  return secuencia;
}

/** Los pasos que trae llegar, que son los encadenados. Nunca son cero. */
export function pasosEncadenados(secuencia) {
  return congelaHondo(exigeSecuencia(secuencia).filter((p) => p.modo === MODOS.ENCADENADO));
}

/**
 * La forma de una secuencia, para poder contarlas sobre los ocho mundos.
 *
 * El visor cuenta para «ficha con visor» solo cuando viene **encadenado**: en la
 * segunda visita está a un toque y lo que la llegada enseña es la ficha, que es
 * exactamente la diferencia entre descubrir y volver.
 */
export function formaDeSecuencia(secuencia) {
  const lista = exigeSecuencia(secuencia);
  const tipos = new Set(lista.map((p) => p.tipo));
  if (tipos.has(TIPOS_DE_PASO.LO_QUE_SE_CUENTA)) {
    return tipos.has(TIPOS_DE_PASO.BEAT) ? FORMAS.BEAT_CON_LO_QUE_SE_CUENTA : FORMAS.LO_QUE_SE_CUENTA_ENTERO;
  }
  if (tipos.has(TIPOS_DE_PASO.BEAT)) return FORMAS.BEAT_SIN_NUCLEO;
  const visorEncadenado = lista.some((p) => p.tipo === TIPOS_DE_PASO.VISOR && p.modo === MODOS.ENCADENADO);
  return visorEncadenado ? FORMAS.FICHA_CON_VISOR : FORMAS.SOLO_FICHA;
}

/**
 * El primer paso encadenado desde `desde`, o el final de la lista si no queda ninguno.
 *
 * Es la pieza que hace que «a un toque» signifique **disponible a un toque** y no
 * **primero**: un paso a un toque no lo trae llegar, así que no puede ser nunca el paso
 * vigente. Sin esto, la segunda visita a un sitio con ilustración ofrecía el visor como
 * paso vigente y la pantalla que monta el paso vigente lo abría sola, que es justo lo que
 * `bucle-jugable.md` §2 prohíbe: volver tiene que abrir por lo que ha cambiado.
 */
function encadenadoDesde(lista, desde) {
  let i = desde;
  while (i < lista.length && lista[i].modo !== MODOS.ENCADENADO) i += 1;
  return i;
}

function exigeIndice(paso, lista, quien) {
  if (!Number.isInteger(paso) || paso < 0 || paso > lista.length) {
    throw new Error(`${quien}: el paso vigente llega como ${JSON.stringify(paso) ?? String(paso)} y la secuencia tiene ${lista.length} pasos`);
  }
  return paso;
}

/**
 * El paso vigente de una secuencia, o `null` cuando ya se recorrió entera.
 *
 * Es una **lectura del estado**, no un salto: quien la llama pregunta por dónde iba,
 * no elige por dónde va. La diferencia está en que no hay ninguna operación que
 * escriba ese índice a voluntad.
 *
 * Lo que devuelve es siempre un paso **encadenado**: los de a un toque quedan
 * disponibles y esperan un dedo, y por eso no son nunca lo que la llegada ofrece.
 */
export function pasoVigente(secuencia, paso) {
  const lista = exigeSecuencia(secuencia);
  const i = encadenadoDesde(lista, exigeIndice(paso, lista, 'el paso vigente de la secuencia'));
  return i >= lista.length ? null : congelaHondo({ ...lista[i], indice: i });
}

/**
 * Avanza al siguiente paso. **La única manera de moverse por la secuencia**, y solo
 * hacia adelante: recorrida hasta el final, la llegada queda cerrada.
 *
 * Avanza de encadenado a encadenado, que son los que trae llegar. Saltarse los de a un
 * toque no es saltar un paso: es no encadenar el que nadie ha tocado.
 */
export function avanzaLaSecuencia(secuencia, paso) {
  const lista = exigeSecuencia(secuencia);
  const i = exigeIndice(paso, lista, 'avanzar la secuencia');
  // Se avanza desde el paso vigente, no desde el índice: si por delante solo quedaban
  // pasos a un toque, la secuencia ya estaba en el final.
  const vigente = encadenadoDesde(lista, i);
  const siguiente = encadenadoDesde(lista, Math.min(vigente + 1, lista.length));
  const cerrada = siguiente >= lista.length;
  return congelaHondo({
    paso: siguiente,
    vigente: cerrada ? null : { ...lista[siguiente], indice: siguiente },
    cerrada,
  });
}
