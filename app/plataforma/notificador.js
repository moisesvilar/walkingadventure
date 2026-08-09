// El notificador: la capa de pantalla de las oportunidades, y **el único canal del juego
// que enciende la pantalla** (`game-design/quests.md` decisión 3). Está racionado a
// propósito: un aviso más que la encienda devalúa todos los demás, así que la noticia no
// lo usa ni siquiera silenciosa.
//
// La distinción que gobierna este fichero: **denegado no es ausente**. Un notificador
// montado cuyo permiso se denegó responde que no lo tiene y la oportunidad se emite igual
// por las capas que quedan, con la falta declarada en el dato; no tener notificador es
// una avería y hace fallar al construir el emisor. Confundirlos convertiría una pieza sin
// cablear en una decisión de quien juega, y entonces «el aviso llegó» dejaría de ser
// comprobable, que es el error caro de `accesibilidad.md` §3.

/**
 * Envuelve el módulo nativo en el contrato que el emisor de avisos espera.
 *
 * @param {object} piezas
 * @param {() => boolean} piezas.permisoConcedido  si el permiso está concedido **ahora**.
 *   Se pregunta en cada emisión y no se cachea: se puede revocar desde los ajustes del
 *   sistema sin que la app se entere de otra manera.
 * @param {(aviso: {texto: string}) => void} piezas.notifica  saca la notificación. El
 *   texto llega ya validado por el núcleo —una línea, nombra el sitio, sin llamada a
 *   tocar—, así que aquí no se recorta ni se completa nada.
 */
export function creaNotificador({ permisoConcedido, notifica }) {
  if (typeof permisoConcedido !== 'function' || typeof notifica !== 'function') {
    throw new Error(
      'el notificador se monta con permisoConcedido() y notifica({ texto }) y falta alguna: sin ellas no se puede distinguir ' +
      '«han denegado el permiso», que es un estado y sigue adelante, de «no hay notificador», que es una avería',
    );
  }
  return {
    montado: true,
    motivo: null,
    capa: 'pantalla',
    permisoConcedido() {
      return permisoConcedido() === true;
    },
    notifica(aviso) {
      notifica(aviso ?? {});
    },
  };
}

/** Un notificador **montado y sin permiso**: la oportunidad sale igual por lo que queda. */
export function notificadorDenegado(motivo = 'el permiso de notificaciones está denegado') {
  return {
    montado: true,
    motivo,
    capa: 'pantalla',
    permisoConcedido() {
      return false;
    },
    notifica() {
      throw new Error(`no se puede notificar: ${motivo}`);
    },
  };
}

/**
 * Un notificador que **no está montado** y lo dice al usarlo. No responde «denegado»: eso
 * sería hacer pasar por decisión de quien juega lo que es una pieza sin cablear.
 */
export function notificadorSinMontar(motivo = 'no montado: esta compilación no trae notificaciones') {
  return {
    montado: false,
    motivo,
    capa: 'pantalla',
    permisoConcedido() {
      throw new Error(`no se puede consultar el permiso de notificaciones: ${motivo}`);
    },
    notifica() {
      throw new Error(`no se puede notificar: ${motivo}`);
    },
  };
}

/**
 * El notificador sobre `expo-notifications`, que ya es dependencia de la app.
 *
 * El permiso se lee de lo que dejó la sonda de `notificaciones.js` y **no se pide aquí**:
 * pedirlo en marcha sería un diálogo del sistema mientras alguien cruza una calle, que es
 * exactamente lo que este momento existe para no hacer. Se pide donde el onboarding lo
 * tiene dibujado.
 */
export function creaNotificadorDeExpo(Notifications, { concedido = false } = {}) {
  if (typeof Notifications?.scheduleNotificationAsync !== 'function') {
    return notificadorSinMontar('no montado: expo-notifications no está en esta compilación');
  }
  if (!concedido) return notificadorDenegado('montado, sin permiso concedido; no se pide en marcha');
  return creaNotificador({
    permisoConcedido: () => true,
    notifica({ texto }) {
      // Sin cuerpo y sin «toca para saber más»: el título lleva el aviso entero, porque
      // se lee de un vistazo o no se lee. Sale ya, sin disparador: el aviso es ahora.
      Notifications.scheduleNotificationAsync({ content: { title: texto }, trigger: null });
    },
  });
}
