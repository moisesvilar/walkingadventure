// Los pasos del día a día: **el interruptor y la lectura al abrir**, cableados.
//
// Es opt-in explícito y viene apagado de origen (`quests.md` §8, y el valor lo declara
// `partida/ajustes.js`): el juego es completo sin activarlo y ninguna pantalla insiste. Lo
// que esta capa añade es el comportamiento de la fila de A6P6 que SPEC-038 dejó declarada,
// y el momento de leer, que es **al abrir la app y nunca de fondo**.
//
// Tres reglas que están aquí porque son las que se rompen solas:
//
// - **El interruptor no miente.** Su valor es el efectivo y nunca el pedido: encendido en
//   los ajustes pero con el permiso revocado desde el sistema se apaga y se dice. Un
//   interruptor encendido que en realidad no lee nada es la definición de la degradación
//   silenciosa que §6h prohíbe.
// - **Denegar no se insiste.** Se dice una vez, dentro de los ajustes y en voz de
//   aplicación —es el único sitio donde eso está permitido—, y no se vuelve a pedir solo.
// - **Apagar no borra ni ejecuta la reserva.** Los pasos ya ocurrieron y el contador ya
//   avanzó; borrar lo pendiente de narrar perdería lo ocurrido sin deshacerlo.
//
// El núcleo entra por la puerta (SPEC-020 y §6u): aquí no hay ni una regla de juego, así
// que el generador es una pieza inyectada y no un import, y quien lo cita por su nombre es
// `app/nucleo/piezas.js`.

/** Lo que esta orquestación le pide al núcleo, enumerado. */
export const DEL_NUCLEO = Object.freeze(['kilometrosDeFondo', 'tamanoDeLaReserva', 'AJUSTES_DE_ORIGEN', 'cambiaAjuste']);

/** El identificador del ajuste y el de su fila en A6P6. Los dos son de otras filas y aquí se consumen. */
export const AJUSTE = 'pasosDelDiaADia';
export const FILA_DE_AJUSTES = 'pasos-del-dia-a-dia';

/** Los localizadores que esta fila hace funcionar. Los declara SPEC-038 y no se inventan. */
export const TESTIDS = Object.freeze({
  fila: 'ajustes-pasos-de-fondo',
  aviso: 'ajustes-pasos-de-fondo-aviso',
});

/**
 * La línea que aparece **solo** si el permiso se deniega o se revoca. En voz de
 * aplicación, dicha una vez, y sin ofrecer ir a los ajustes del sistema ni insistir
 * después: el juego es completo sin el modo, y una segunda petición lo convertiría en
 * condición.
 */
export const AVISO_SIN_PERMISO = 'Sin acceso a los pasos que guarda el móvil no se pueden contar.';

/** Los motivos por los que el interruptor está apagado aunque se pidiera encendido. */
export const MOTIVOS_DE_APAGADO = Object.freeze({
  NO_PEDIDO: 'no-pedido',
  DENEGADO: 'permiso-denegado',
  REVOCADO: 'permiso-revocado',
  SIN_FUENTE: 'sin-fuente-de-salud',
});

function exigePieza(pieza, nombre, paraQue) {
  if (!pieza) {
    throw new Error(
      `los pasos del día a día se cablean sin ${nombre}, y no arrancan sin él: ${paraQue}. ` +
      'Salir adelante sin la pieza haría que «nadie lo cableó» y «el permiso no está» dieran el mismo resultado',
    );
  }
  return pieza;
}

/**
 * Los pasos del día a día, ya cableados.
 *
 * @param {object} opciones
 *   `nucleo` el generador, con lo que enumera `DEL_NUCLEO`; `lector` el de la app de salud;
 *   `ajustes` los de la partida, que es de donde sale si el modo está pedido.
 */
export function creaPasosDeFondo({ nucleo, lector, ajustes }) {
  exigePieza(nucleo, 'el núcleo', 'es quien convierte los metros en pasos y gobierna la reserva');
  for (const nombre of DEL_NUCLEO) {
    if (nucleo[nombre] == null) throw new Error(`al núcleo inyectado le falta "${nombre}", que es de lo que se componen los pasos del día a día`);
  }
  exigePieza(lector, 'el lector de la app de salud', 'es quien pide el permiso y lee los metros al abrir');
  exigePieza(ajustes, 'los ajustes de la partida', 'es de donde sale si el modo está pedido, y el núcleo no consulta ninguna capa de la plataforma');

  const { cambiaAjuste, kilometrosDeFondo, tamanoDeLaReserva } = nucleo;

  /** Si el modo está **pedido**: lo que dicen los ajustes de la partida, sin mirar nada más. */
  const pedido = () => ajustes[AJUSTE] === true;

  const apagaYExplica = (motivo) => {
    cambiaAjuste(ajustes, AJUSTE, false);
    return Object.freeze({ encendido: false, motivo, aviso: AVISO_SIN_PERMISO, testid: TESTIDS.aviso });
  };

  /**
   * El valor **efectivo** del interruptor: pedido y con el permiso de verdad concedido.
   * Un permiso revocado desde el sistema lo apaga aquí y lo dice, en lugar de dejarlo
   * encendido sin leer nada.
   */
  const efectivo = async () => {
    if (!pedido()) return Object.freeze({ encendido: false, motivo: MOTIVOS_DE_APAGADO.NO_PEDIDO, aviso: null, testid: TESTIDS.fila });
    const permiso = await lector.permiso();
    if (permiso === 'concedido') return Object.freeze({ encendido: true, motivo: null, aviso: null, testid: TESTIDS.fila });
    return apagaYExplica(permiso === 'no-disponible' ? MOTIVOS_DE_APAGADO.SIN_FUENTE : MOTIVOS_DE_APAGADO.REVOCADO);
  };

  return {
    ajuste: AJUSTE,
    fila: FILA_DE_AJUSTES,
    pedido,
    efectivo,

    /**
     * Enciende: **pide el permiso en contexto**, y solo entonces. Si se deniega, la fila
     * vuelve a «no» y bajo ella aparece la línea, una vez.
     */
    async enciende() {
      const permiso = await lector.pideElPermiso();
      if (permiso !== 'concedido') {
        return apagaYExplica(permiso === 'no-disponible' ? MOTIVOS_DE_APAGADO.SIN_FUENTE : MOTIVOS_DE_APAGADO.DENEGADO);
      }
      cambiaAjuste(ajustes, AJUSTE, true);
      return Object.freeze({ encendido: true, motivo: null, aviso: null, testid: TESTIDS.fila });
    },

    /**
     * Apaga: dejan de leerse pasos y **la reserva que hubiera queda como estaba**, sin
     * borrarse y sin ejecutarse. Volver a encender no recupera los kilómetros del tiempo
     * apagado, porque durante ese tiempo no se leyó nada y la marca de agua siguió su
     * camino.
     */
    apaga() {
      cambiaAjuste(ajustes, AJUSTE, false);
      return Object.freeze({ encendido: false, motivo: MOTIVOS_DE_APAGADO.NO_PEDIDO, aviso: null, testid: TESTIDS.fila });
    },

    /**
     * La lectura **al abrir la app**: los metros nuevos desde la última lectura, ya sin las
     * ventanas de salida activa, convertidos en pasos sobre el motor del **mapa activo**.
     *
     * Con el modo apagado no se lee y no se acredita nada. Que la app de salud no responda
     * tampoco es un fallo: el juego sigue igual y no se ejecuta ningún paso.
     *
     * @returns `{ leyo, motivo, metros, pasos, enLaReserva, descartadosM }`, congelado.
     */
    async alAbrirLaApp({ motor, tramo, salidas = [] }) {
      const estado = await efectivo();
      const lectura = await lector.lee({ activo: estado.encendido, salidas });
      if (!lectura.leyo || lectura.metros === 0) {
        return Object.freeze({
          leyo: lectura.leyo,
          motivo: lectura.motivo,
          metros: 0,
          pasos: [],
          enLaReserva: tamanoDeLaReserva(motor),
          descartadosM: 0,
        });
      }
      // `activos` viaja **como dato de la partida**: el núcleo no sabe qué es un permiso
      // de salud y no consulta ningún ajuste por su cuenta.
      const dados = kilometrosDeFondo({ motor, metros: lectura.metros, activos: true, tramo });
      return Object.freeze({
        leyo: true,
        motivo: null,
        metros: lectura.metros,
        pasos: dados.pasos,
        enLaReserva: dados.enLaReserva,
        descartadosM: dados.descartadosM,
      });
    },
  };
}
