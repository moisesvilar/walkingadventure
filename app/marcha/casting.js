// El casting vigente de un mapa: **una sola fuente de la cadena**, para que la ficha, el
// motor, la preparación y la capa de llegadas hablen del mismo lazo.
//
// Existe por un defecto medido. Desde que la lista de hoy recibe los sitios marcados (la
// séptima costura), `repartoDeAventuras` **vuelve a castear** cuando hay descartes
// (`partida/aventuras.js`), así que la cadena que quien juega ve en la ficha ya no es la que
// trae `mundo.casting`. Y `mundo.casting` era justo lo que leían los tres sitios que aceptan
// la aventura en el motor, montan la capa de llegadas y la recuperan al reabrir la app.
// Medido sobre los cuatro mundos de referencia marcando **un solo sitio**: en `costero`, 24 de
// las 29 aventuras seguían ofreciéndose con una cadena distinta de la que se iba a recorrer.
// O sea, se te enseñaba un lazo y se te mandaba a otro — posiblemente al sitio que marcaste.
//
// La forma del arreglo es la que impide que vuelva: **nadie resuelve la cadena por su cuenta**.
// Este módulo entrega el mundo con su casting vigente dentro, y todo lo demás sigue leyendo
// `mundo.casting` como siempre. No hay un segundo camino que se le parezca, que es como §6h
// vuelve cada vez.
//
// Cuatro decisiones lo gobiernan:
//
//   · **Sin descartes, ni un cambio.** `hayDescartes` falso devuelve **el mismo objeto** que
//     llegó, no una copia: el camino normal no paga nada, no recompone ninguna lámina y lo que
//     se verificó en el aparato sigue valiendo tal cual.
//   · **Es determinista y no lee nada.** `castAll(mundo, mundo.seed, { descartes })` es función
//     pura del documento congelado y del conjunto de sitios marcados, y el área `anclajes` se
//     persiste con la partida. Por eso el mismo casting sale hoy en la ficha, dentro de un rato
//     al aceptar y mañana al reabrir la app — que es donde la fila 44 dejó su deuda.
//   · **La instantánea se toma una vez por resolución.** `vistaDeDescartes` es una instantánea
//     por contrato, así que castear el catálogo entero ve el mismo conjunto de la primera
//     plantilla a la última.
//   · **El núcleo entra por la puerta** (SPEC-020, §6u): se enumera en `DEL_NUCLEO` y llega
//     inyectado desde `app/nucleo/piezas.js`.

/** Lo que esto le pide al generador, enumerado. Ni una función más. */
export const DEL_NUCLEO = Object.freeze(['castAll', 'vistaDeDescartes', 'hayDescartes']);

/**
 * La huella de un conjunto de descartes: **los anclajes marcados y nada más**.
 *
 * Es la clave de la memoria, y va declarada porque decide cuándo se vuelve a castear. Lleva
 * solo el identificador de cada sitio: el casting pregunta `descartado(nombre)` y no mira ni el
 * rol ni el motivo, así que meterlos aquí haría recastear al cambiar algo que no cambia nada.
 * La lista llega ya ordenada por anclaje desde `descartesDeMapa`, así que dos partidas con los
 * mismos sitios marcados dan la misma huella sea cual sea el orden en que se marcaron.
 */
export function huellaDeDescartes(vista) {
  return vista.lista().map((d) => d.anclaje).join('');
}

/**
 * Monta el resolutor del casting vigente.
 *
 * @param {object} piezas  `nucleo` el generador con lo que enumera `DEL_NUCLEO`.
 */
export function creaElCasting({ nucleo }) {
  if (!nucleo) throw new Error('el casting vigente necesita el núcleo inyectado: es quien castea el catálogo contra el mundo congelado');
  const faltan = DEL_NUCLEO.filter((n) => nucleo[n] == null);
  if (faltan.length) {
    throw new Error(`al núcleo inyectado le faltan ${faltan.length} pieza(s) del casting vigente: ${faltan.join(', ')}`);
  }

  // **Una sola ranura**, y es de sobra: la huella cambia cuando alguien marca o desmarca un
  // sitio —un gesto raro, y siempre desde otra pantalla— y el mapa activo es uno. Un caché con
  // varias entradas necesitaría una política de desalojo para un problema que no existe, y sin
  // memoria ninguna se recastearía el catálogo entero en cada repintado de la portada.
  let ranura = null;

  /**
   * El mundo con su casting vigente dentro.
   *
   * Devuelve **el mismo objeto** cuando no hay ningún sitio marcado. Cuando lo hay, devuelve un
   * mundo derivado con el casting recasteado, y **la misma referencia** mientras la huella no
   * cambie: quien lo memoiza por identidad —la lámina, la petición de la lista— no recompone
   * nada por mirarlo dos veces.
   *
   * Un mundo sin levantar devuelve `null`, que es un estado normal de una partida y no una
   * avería: se puede tener personaje antes de que ninguna celda esté escrita.
   */
  const mundoVigente = ({ mundo, anclajes, mapaId }) => {
    if (!mundo) return null;
    if (!anclajes || typeof anclajes !== 'object') {
      throw new Error(
        'el casting vigente se resuelve contra el área de anclajes de la partida y no llegó ninguna: sin ella, un sitio marcado ' +
        '«este sitio no pega» seguiría casteando aventuras y la cadena que se recorre dejaría de ser la que enseña la ficha',
      );
    }
    if (typeof mapaId !== 'string' || !mapaId) {
      throw new Error(`el casting vigente se resuelve sobre un mapa y llegó ${JSON.stringify(mapaId) ?? String(mapaId)}: lo marcado en un mapa no dice nada de otro`);
    }

    const descartes = nucleo.vistaDeDescartes(anclajes, mapaId);
    // Sin ningún sitio marcado, el casting del documento **ya es el vigente**. No se recastea,
    // no se copia el mundo y no se toca la ranura: el camino normal cuesta exactamente lo que
    // costaba antes de esta costura.
    if (!nucleo.hayDescartes(descartes)) return mundo;

    const clave = `${mapaId}${huellaDeDescartes(descartes)}`;
    if (ranura && ranura.clave === clave && ranura.documento === mundo) return ranura.mundo;

    const casting = nucleo.castAll(mundo, mundo.seed, { descartes });
    ranura = { clave, documento: mundo, mundo: { ...mundo, casting } };
    return ranura.mundo;
  };

  return {
    mundoVigente,

    /** El casting vigente de un mapa, suelto. Es lo mismo que `mundoVigente(...).casting`. */
    vigente(peticion) {
      return mundoVigente(peticion)?.casting ?? [];
    },

    /** Si la última resolución tuvo que recastear. Se publica para poder medir el coste. */
    recasteado: () => ranura !== null,
  };
}
