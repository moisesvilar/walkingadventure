// El zurrón al abrir la salida, A2P2: **una sola llamada agrupada y un vaciado que ocurre
// al confirmar**.
//
// Aquí no hay ni una regla: el núcleo decide si hay zurrón, compone sus entradas y vacía la
// reserva con su hecho; esta capa consigue —la llamada al narrador— y encadena el orden en
// que se escribe. Es la misma frontera que la preparación de A2P5, y el generador entra por
// la puerta por la misma razón (SPEC-020, §6u).
//
// El momento importa tanto como el contenido: la llamada ocurre **al abrir la salida y
// nunca durante la caminata**, que es la única excepción declarada de `quests.md`
// decisión 3 y sigue cumpliendo su espíritu.

/** Lo que esta orquestación le pide al núcleo, enumerado. */
export const DEL_NUCLEO = Object.freeze(['abreElZurron', 'vaciaElZurron', 'TESTIDS', 'ACCIONES', 'TOPE_DE_ENTRADAS', 'MOTIVOS_SIN_ZURRON']);

function exigePieza(pieza, nombre, paraQue) {
  if (!pieza) {
    throw new Error(
      `el zurrón se cablea sin ${nombre}, y no arranca sin él: ${paraQue}. ` +
      'Salir adelante sin la pieza haría que «nadie lo cableó» y «hoy no hay cobertura» dieran el mismo resultado',
    );
  }
  return pieza;
}

/**
 * El zurrón, ya cableado.
 *
 * @param {object} opciones
 *   `nucleo` el generador, con lo que enumera `DEL_NUCLEO`; `llamada` el cliente del
 *   narrador —se puede no tener, y entonces se declara con `sinNarrador`—; `presupuestoMs`
 *   lo que se espera como mucho, que es el de la preparación y no uno propio.
 */
export function creaZurron({ nucleo, llamada = null, sinNarrador = false, locale = 'es', presupuestoMs }) {
  exigePieza(nucleo, 'el núcleo', 'es quien decide si hay zurrón, lo compone y vacía la reserva con su hecho');
  for (const nombre of DEL_NUCLEO) {
    if (nucleo[nombre] == null) throw new Error(`al núcleo inyectado le falta "${nombre}", que es de lo que se compone el zurrón`);
  }
  if (!llamada && !sinNarrador) {
    exigePieza(null, 'la llamada al narrador', 'es quien escribe el envoltorio y los textos de las entradas; si de verdad no hay narrador, se declara con sinNarrador: true');
  }
  if (!Number.isFinite(presupuestoMs) || presupuestoMs <= 0) {
    throw new Error(
      `el zurrón necesita su presupuesto de espera declarado y llegó ${JSON.stringify(presupuestoMs) ?? String(presupuestoMs)}: ` +
      'sin él se esperaría sin límite justo antes de salir a andar',
    );
  }

  const { abreElZurron, vaciaElZurron } = nucleo;

  return {
    presupuestoMs,
    testids: nucleo.TESTIDS,

    /**
     * Abre: decide y, **solo si hay algo que contar**, hace la única llamada agrupada.
     *
     * Con el modo apagado, con la reserva vacía y con una reserva cuyos pasos no
     * produjeron nada no se llama a nadie. En el último caso hay que vaciar igual, y por
     * eso el resultado trae `vaciar` aparte de `hay`.
     */
    async abre({ mundo, modoDeFondo, reserva, momento = 'antes-de-salir', filtro = null, topicos = null, semillaDeMundo = null, ya = null }) {
      return abreElZurron({
        mundo,
        locale,
        modoDeFondo,
        reserva,
        momento,
        llamada,
        presupuestoMs,
        filtro,
        topicos,
        semillaDeMundo,
        ya,
      });
    },

    /**
     * Confirma «Seguir»: **el hecho primero y la reserva después**, en la misma escritura.
     *
     * Vale también para la reserva que no enseñó nada, con `narrados` a cero. Cerrar la app
     * antes de pasar por aquí devuelve el mismo zurrón la próxima vez, que es exactamente
     * lo que se decidió.
     */
    confirma({ motor, registro, mapa = null, dia, narrados = 0 }) {
      return vaciaElZurron({ motor, registro, mapa, dia, narrados });
    },
  };
}
