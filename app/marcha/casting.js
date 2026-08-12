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
export const DEL_NUCLEO = Object.freeze(['castAll', 'vistaDeDescartes', 'vistaDeAnclajes', 'hayDescartes']);

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

  // La memoria, por `(mapaId, huella de los descartes)`. **Dos huellas vivas como mucho**: la
  // de ahora, que es contra la que se compone la lista, y la que la aventura en curso congelo
  // al aceptarse, que solo se separa de la otra si alguien marca un sitio a mitad de camino.
  // Con el tope en cuatro sobra para las dos y para un cambio de mapa, y desalojar la mas
  // vieja es una politica de una linea; sin memoria ninguna se recastearia el catalogo entero
  // en cada repintado de la portada, que son 158,7 ms medidos en `urbano-denso`.
  const TOPE = 4;
  const memoria = new Map();

  const recuerda = (clave, documento, hazlo) => {
    const suya = memoria.get(clave);
    if (suya && suya.documento === documento) return suya.mundo;
    const mundo = hazlo();
    memoria.set(clave, { documento, mundo });
    while (memoria.size > TOPE) memoria.delete(memoria.keys().next().value);
    return mundo;
  };

  /** El mundo con el casting que sale de una vista de descartes. El mismo si no hay ninguno. */
  const conLosDescartes = (mundo, descartes, clave) => {
    if (!nucleo.hayDescartes(descartes)) return mundo;
    return recuerda(clave, mundo, () => Object.freeze({ ...mundo, casting: nucleo.castAll(mundo, mundo.seed, { descartes }) }));
  };

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

    // Sin ningun sitio marcado, el casting del documento **ya es el vigente**. No se recastea,
    // no se copia el mundo y no se toca la memoria: el camino normal cuesta exactamente lo que
    // costaba antes de esta costura.
    const descartes = nucleo.vistaDeDescartes(anclajes, mapaId);
    return conLosDescartes(mundo, descartes, `${mapaId}#${huellaDeDescartes(descartes)}`);
  };

  /**
   * El mundo con el casting **de una aventura ya aceptada**: el que sale de los sitios que
   * estaban marcados cuando se acepto, y no de los de ahora.
   *
   * Es la novena costura. Marcar un sitio sigue estando disponible siempre y sigue siendo
   * reversible; lo que no puede es cambiarle la cadena a lo que ya estas andando
   * (`docs/flujo.md`, A4P8: «Marcarlo - reversible, y anota sin resembrar»). Medido antes de
   * coserlo: marcando **un solo sitio** a mitad de camino, de las 19 aventuras de `suelo-250m`
   * 9 dejaban de castear y la salida quedaba encallada, y en `costero` 14 de 29 volvian con
   * otra cadena.
   */
  const mundoDeLaAventura = ({ mundo, marcados }) => {
    if (!mundo) return null;
    if (!Array.isArray(marcados)) {
      throw new Error(
        'la cadena de una aventura aceptada se recupera contra los sitios que estaban marcados cuando se acepto, y no ha llegado '
        + `ninguna lista (${JSON.stringify(marcados) ?? String(marcados)}): recuperarla contra los de ahora le cambiaria el lazo a lo que ya se esta andando`,
      );
    }
    const descartes = nucleo.vistaDeAnclajes(marcados);
    return conLosDescartes(mundo, descartes, `aventura#${huellaDeDescartes(descartes)}`);
  };

  return {
    mundoVigente,
    mundoDeLaAventura,

    /** El casting vigente de un mapa, suelto. Es lo mismo que `mundoVigente(...).casting`. */
    vigente(peticion) {
      return mundoVigente(peticion)?.casting ?? [];
    },

    /** Cuantas huellas hay memorizadas. Se publica para poder medir el coste. */
    memorizadas: () => memoria.size,
  };
}
