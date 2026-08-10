// La app de salud del sistema, doblada: los cuatro comportamientos que SPEC-042 tiene que
// distinguir, más el permiso que se revoca desde fuera.
//
// Es la frontera nueva de la fila 42 y se dobla como todo aquí: no se intercepta nada, se
// pasa otra fuente. Y son **cuatro y no dos** porque el lector separa cuatro situaciones
// que se arreglan en sitios distintos: leer, no tener permiso, que la fuente no conteste
// —que es una condición de funcionamiento y no un fallo— y que conteste una barbaridad,
// que sí es un defecto y se dice nombrando el valor.
//
// Los cinco llevan el recuento de lo que se les pidió: las ventanas leídas y las veces que
// se pidió el permiso. Sin ese recuento, «con el modo apagado no se lee nada» y «denegar no
// se reintenta» serían fe —no hay manera de afirmar una ausencia mirando el estado de
// después—, y son justo los dos criterios que esta fila existe para sostener.
//
// Nada de aquí toca la red, el reloj ni el azar.

/** Los metros que devuelve el que lee, por ventana. Arbitrario y constante. */
export const METROS_POR_VENTANA = 6000;

/**
 * Una fuente de salud, con todo lo que el lector le puede pedir.
 *
 * @param {object} opciones
 *   `permiso` lo que responde `estadoDelPermiso()`; `alPedir` lo que responde
 *   `pideElPermiso()`, que por defecto es lo mismo; `metros` lo que devuelve cada ventana
 *   —un número o una función `(ventana) => número`—; `pasos` lo mismo pero en zancadas,
 *   para la fuente que no da metros; `lanza` el mensaje con el que no responde.
 */
export function fuenteDeSalud({
  permiso = 'concedido',
  alPedir = null,
  metros = METROS_POR_VENTANA,
  pasos = null,
  lanza = null,
} = {}) {
  const ventanas = [];
  const peticiones = [];
  let estado = permiso;

  const responde = (fuente, ventana) => (typeof fuente === 'function' ? fuente(ventana) : fuente);

  const doble = {
    /** Las ventanas que se le han pedido, en orden. Es lo que afirma que no se lee dos veces. */
    ventanas: () => ventanas.map((v) => ({ desde: v.desde, hasta: v.hasta })),
    /** Cuántas veces se le ha pedido el permiso. Lo que permite afirmar que no se pidió. */
    peticiones: () => peticiones.length,
    /** Revoca el permiso desde fuera, como haría quien lo quita en los ajustes del sistema. */
    revoca(nuevo = 'denegado') {
      estado = nuevo;
      return doble;
    },
    async estadoDelPermiso() {
      return estado;
    },
    async pideElPermiso() {
      peticiones.push(true);
      estado = alPedir ?? estado;
      return estado;
    },
  };

  if (pasos !== null) {
    doble.pasosEnVentana = async (ventana) => {
      ventanas.push(ventana);
      if (lanza) throw new Error(lanza);
      return responde(pasos, ventana);
    };
    return doble;
  }

  doble.metrosEnVentana = async (ventana) => {
    ventanas.push(ventana);
    if (lanza) throw new Error(lanza);
    return responde(metros, ventana);
  };
  return doble;
}

/** Concede y devuelve una cantidad fija de metros por ventana. */
export function saludQueDaMetros(metros = METROS_POR_VENTANA) {
  return fuenteDeSalud({ metros });
}

/** Concede y solo sabe de pasos: la fuente que obliga a la zancada constante. */
export function saludQueDaPasos(pasos) {
  return fuenteDeSalud({ pasos });
}

/**
 * No responde. **No es un permiso denegado y no es un defecto**: es una condición de
 * funcionamiento, y el juego sigue igual sin que ninguna pantalla lo llame fallo.
 */
export function saludQueNoResponde(mensaje = 'la app de salud no contesta') {
  return fuenteDeSalud({ lanza: mensaje });
}

/**
 * Devuelve una barbaridad. Esto sí es un defecto de la fuente, y se dice nombrando el
 * valor recibido en lugar de tratarlo como cero: un contador quieto sin que nadie se
 * entere es peor que un error.
 */
export function saludQueDevuelveInvalido(valor = -1) {
  return fuenteDeSalud({ metros: valor });
}

/** Deniega. Ni lee ni deja leer, y responder eso no es una avería. */
export function saludQueDeniega() {
  return fuenteDeSalud({ permiso: 'sin-preguntar', alPedir: 'denegado' });
}

/** No hay app de salud en esta compilación: no poder preguntar no es haber denegado. */
export function saludQueNoEstaMontada() {
  return null;
}
