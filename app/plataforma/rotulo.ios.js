// El rótulo del sistema, implementación de iOS: una **Actividad en Vivo** en la
// pantalla de bloqueo, más el modo de ubicación en segundo plano. Es lo que hace que la
// app cuente como «en uso» con la pantalla apagada, y por tanto lo que permite no pedir
// nunca el permiso de ubicación permanente (`seguridad-privacidad.md` §2, exclusión 12).
//
// Su pareja es `rotulo.android.js` y exporta exactamente los mismos nombres. Lo que
// difiere entre las dos es el **ciclo de vida**, nunca el texto: los literales de la
// línea y de la única acción los compone `packages/nucleo/partida/rotulo.js`.
//
// La diferencia de iOS que hay que tener delante (riesgo 4 del PRD): **la Actividad en
// Vivo tiene un tope de vida impuesto por el sistema** y se apaga sola pasado un rato
// largo. Dos consecuencias, y las dos están cerradas fuera de aquí: el plazo del juego
// es cómodamente menor que ese tope —`revisaElPlazo()` lo comprueba al importar— y la
// retirada por el sistema es un motivo propio, que no se confunde con el plazo.
//
// Aquí no se importa ningún módulo nativo, por lo mismo que en `ubicacion.js`: el
// contrato se ejercita en `node --test` contra un doble y el módulo nativo entra por la
// firma de `creaRotulo`.

/** El mecanismo real de esta plataforma, para que nadie tenga que redescubrirlo. */
export const MECANISMO = 'Actividad en Vivo de iOS en la pantalla de bloqueo, con la ubicación en segundo plano';

/**
 * Lo que esta plataforma necesita declarado, y que se comprueba contra `app.json`.
 *
 * `permisoPermanente: false` está escrito y no sobreentendido: es la mitad de esta fila
 * que se entrega **no declarando** nada — ni `NSLocationAlwaysAndWhenInUseUsageDescription`
 * ni `NSLocationAlwaysUsageDescription`—, y una ausencia solo se puede poner roja contra
 * una enumeración de lo que sí hay.
 */
export const DECLARACION = Object.freeze({
  servicio: 'Actividad en Vivo',
  actividadEnVivo: true,
  modosDeFondo: Object.freeze(['location']),
  descartable: false,
  permisos: Object.freeze(['NSLocationWhenInUseUsageDescription']),
  permisoPermanente: false,
});

/** La capacidad, con el contrato de SPEC-020 sin tocarlo. La sonda no pide ningún permiso. */
export const rotulo = {
  nombre: 'rotulo',
  // `ninguna` porque el rótulo no es una capa de aviso: es permanente y visible a
  // propósito, y meterlo en el par de capas de `accesibilidad.md` §3 lo pondría a
  // competir con los avisos, donde no pinta nada.
  capa: 'ninguna',
  async sonda() {
    return {
      montado: false,
      disponible: false,
      motivo: `${MECANISMO}: esta compilación no trae el módulo nativo que la arranca, y ninguna spec ha nombrado todavía la dependencia que lo daría`,
    };
  },
};

/**
 * Envuelve el módulo nativo en el contrato que la salida espera.
 *
 * Cuatro operaciones y ninguna opcional. `presente()` es la que permite comparar la
 * situación guardada con lo que hay de verdad en la pantalla de bloqueo, y en iOS es
 * además la que destapa la caducidad: la Actividad se apaga sola y nadie llama para
 * decirlo.
 *
 * @param {object} piezas
 * @param {(rotulo:{linea:string, accion:object}) => void} piezas.arranca  pide la Actividad en Vivo.
 * @param {(rotulo:{linea:string}) => void} piezas.actualiza  cambia la línea.
 * @param {(motivo:string) => void} piezas.para  termina la Actividad, con el motivo.
 * @param {() => boolean} piezas.corriendo  si la Actividad sigue viva **ahora**.
 */
export function creaRotulo({ arranca, actualiza, para, corriendo }) {
  for (const [nombre, pieza] of Object.entries({ arranca, actualiza, para, corriendo })) {
    if (typeof pieza !== 'function') {
      throw new Error(
        `el rótulo de iOS se monta con ${nombre}() y no llegó ninguna: sin las cuatro, una salida podría quedarse creyéndose sostenida ` +
        'por una Actividad en Vivo que ya caducó, que es la forma de fallo que este proyecto ya ha pagado cinco veces',
      );
    }
  }
  return {
    montado: true,
    disponible: true,
    motivo: null,
    mecanismo: MECANISMO,
    pone(compuesto) { arranca(compuesto); },
    actualiza(compuesto) { actualiza(compuesto); },
    retira(motivo) { para(motivo); },
    presente() { return corriendo() === true; },
  };
}

/**
 * Un rótulo que **no está montado** y lo dice al usarlo.
 *
 * Es el estado real de esta compilación, y devolverlo es la mitad de la fila: con él,
 * abrir una salida responde que no se abre y nombra la capacidad que falta, en lugar de
 * abrirla y perder la ubicación a los pocos minutos sin que nada proteste.
 */
export function rotuloSinMontar(motivo = `${MECANISMO}: no montado todavía, y ninguna spec ha nombrado la dependencia que lo daría`) {
  return {
    montado: false,
    disponible: false,
    motivo,
    mecanismo: MECANISMO,
    pone() { throw new Error(`no se puede poner el rótulo del sistema: ${motivo}`); },
    actualiza() { throw new Error(`no se puede actualizar el rótulo del sistema: ${motivo}`); },
    retira() { throw new Error(`no se puede retirar el rótulo del sistema: ${motivo}`); },
    presente() { return false; },
  };
}
