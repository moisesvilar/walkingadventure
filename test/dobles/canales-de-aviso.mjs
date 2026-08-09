// Los dos canales de aviso doblados: el **vibrador**, que es la capa de bolsillo de todo
// aviso, y el **notificador**, que es la de pantalla de las oportunidades y el único canal
// del juego que enciende la pantalla (`game-design/accesibilidad.md` §3, `quests.md`
// decisión 3).
//
// La distinción que gobierna este fichero, y que es la razón de que haya cinco dobles y no
// dos: **denegado no es ausente, y ninguno de los dos es «no salió»**.
//
// - **ausente** — la pieza no está cableada. Es avería: el emisor falla al construirse.
// - **denegado** — la pieza está y quien juega dijo que no. Es estado: el aviso sale por
//   las capas que quedan y la falta se anota con su motivo.
// - **sin respuesta** — la pieza está, el permiso está y el canal falló al emitir. También
//   se anota, con otro motivo, porque se arregla en otro sitio.
//
// Los tres primeros llevan registro de lo emitido. Es lo que permite afirmar «vibró» y
// «no saltó ninguna notificación» sobre datos en vez de sobre fe, que es la única manera
// de poner roja la mitad negativa del par de capas.
//
// Nada de aquí toca la red, el reloj ni el azar, y ninguno importa del paquete.

/** Un vibrador que **registra cada toque** y no hace nada más. El caso normal. */
export function vibradorQueRegistra() {
  const toques = [];
  return {
    montado: true,
    motivo: null,
    capa: 'bolsillo',
    /** Los toques dados, en orden. Es lo que se compara entre dos recorridos iguales. */
    toques: () => toques.slice(),
    vibra(aviso) {
      toques.push({ texto: aviso?.texto ?? null });
    },
  };
}

/**
 * Un vibrador **que no está cableado**: no trae `vibra()`.
 *
 * No se traga la llamada en silencio, que es la pieza que al no estar no protesta: se
 * queda sin el método y hace fallar la construcción, nombrándose.
 */
export function vibradorAusente() {
  return { montado: false, motivo: 'no cableado en esta prueba', capa: 'bolsillo' };
}

/**
 * Un vibrador cableado **que falla al vibrar**. No es lo mismo que no estar: aquí el
 * aviso sale por lo que quede y la capa caída se anota con «canal sin respuesta».
 */
export function vibradorQueFalla(motivo = 'el motor háptico no responde') {
  return {
    montado: true,
    motivo,
    capa: 'bolsillo',
    toques: () => [],
    vibra() {
      throw new Error(`no se puede dar el toque desde el bolsillo: ${motivo}`);
    },
  };
}

/** Un notificador con permiso concedido que **registra lo notificado**. El caso normal. */
export function notificadorQueRegistra() {
  const notificadas = [];
  return {
    montado: true,
    motivo: null,
    capa: 'pantalla',
    /** Lo que se sacó por la notificación, en orden. */
    notificadas: () => notificadas.slice(),
    permisoConcedido: () => true,
    notifica(aviso) {
      notificadas.push({ texto: aviso?.texto ?? null });
    },
  };
}

/**
 * Un notificador **montado y sin permiso**. Es un estado y no una avería: la oportunidad
 * se emite igual por las capas que quedan y la falta queda declarada con su motivo.
 *
 * `notifica` lanza a propósito: si algo llamase a notificar con el permiso denegado, la
 * prueba tiene que verlo, no tragárselo.
 */
export function notificadorDenegado(motivo = 'el permiso de notificaciones está denegado') {
  return {
    montado: true,
    motivo,
    capa: 'pantalla',
    notificadas: () => [],
    permisoConcedido: () => false,
    notifica() {
      throw new Error(`no se puede notificar: ${motivo}`);
    },
  };
}

/**
 * Un notificador **que no está cableado**: le falta el par de métodos con el que se monta.
 * Es la avería, y no responde «denegado», que sería hacer pasar por decisión de quien
 * juega una pieza que nadie enchufó.
 */
export function notificadorAusente() {
  return { montado: false, motivo: 'no cableado en esta prueba', capa: 'pantalla' };
}

/** Un notificador con permiso concedido **que falla al notificar**: canal sin respuesta. */
export function notificadorQueFalla(motivo = 'el servicio de notificaciones no responde') {
  return {
    montado: true,
    motivo,
    capa: 'pantalla',
    notificadas: () => [],
    permisoConcedido: () => true,
    notifica() {
      throw new Error(`no se puede notificar: ${motivo}`);
    },
  };
}
