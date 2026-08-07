// El reloj del mundo, que no es el reloj del sistema: el mundo avanza cuando el
// jugador camina, así que aquí se avanza pidiéndolo. Existe para poder escribir
// «el mundo avanza siete pasos» sin andar siete tramos.
//
// Sin temporizadores y sin leer la hora: si el mundo dependiera del calendario,
// estar un mes sin salir acumularía mundo pendiente, que es justamente lo que
// game-design/quests.md §37 descarta (el contenido de un paso lo decide su número).

/**
 * @param {object} [dependencias]
 * @param {Function|{paso: Function}} [dependencias.motorDePasos]
 *   Recibe el número de cada paso, uno a uno y en orden. El motor de verdad
 *   llega con SPEC-011; hasta entonces se inyecta un espía. Se acepta tanto una
 *   función como un objeto con `paso(n)` porque el motor real será lo segundo y
 *   una prueba casi siempre quiere lo primero.
 */
export function creaRelojDeMundo({ motorDePasos } = {}) {
  let pasos = 0;

  const invoca = (n) => {
    if (typeof motorDePasos === 'function') return motorDePasos(n);
    return motorDePasos.paso(n);
  };

  return {
    /** Pasos acumulados. Solo cambia si alguien pide avanzar. */
    pasos() {
      return pasos;
    },

    /**
     * Avanza `n` pasos, numerados consecutivamente desde el actual. El motor
     * recibe un aviso por paso, no uno por tanda: el contenido de un paso lo
     * decide su número, así que saltárselos rompería el mundo.
     */
    avanza(n) {
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`número de pasos inválido: ${n}; tiene que ser un entero positivo`);
      }
      if (motorDePasos === undefined || motorDePasos === null) {
        throw new Error('falta la dependencia "motorDePasos": el reloj no inventa pasos, los delega');
      }
      if (typeof motorDePasos !== 'function' && typeof motorDePasos.paso !== 'function') {
        throw new Error('dependencia "motorDePasos" inválida: se espera una función o un objeto con "paso(n)"');
      }
      for (let k = 0; k < n; k++) invoca(++pasos);
      return pasos;
    },
  };
}
