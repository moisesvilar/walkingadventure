// Los dobles del rótulo del sistema y de la fuente de posiciones de una salida
// (SPEC-030). Son las dos entradas nuevas que la vida de una salida recibe
// inyectadas, y aquí están sus versiones de mentira: sin ellas, «sin rótulo la
// salida no se abre» y «el rótulo lo retiró el sistema» no se podrían poner rojos
// en Node, que es donde tienen que poder ponerse.
//
// Cuatro rótulos y no uno, porque los cuatro casos que la spec separa **se ven
// distintos desde fuera** y confundirlos es exactamente el fallo que se persigue:
// uno que funciona, uno que no está montado en esta compilación, uno montado que
// no se puede usar, y uno que **se retira solo** — el que reproduce lo que hace
// iOS cuando la Actividad en Vivo caduca y lo que hace Android cuando el sistema
// mata el servicio para recuperar memoria.
//
// Todos llevan cuenta de lo que se les pidió: sin ese registro, «el cierre retira
// el rótulo en la misma transición» y «la retirada por el sistema no vuelve a
// pedirle nada a un rótulo que ya no está» solo se podrían suponer.
//
// Aquí no se importa nada: ni del paquete, ni de la app, ni de Node más allá de lo
// que trae el lenguaje. Un doble que importara lo que dobla no doblaría nada.

/** El registro común de los cuatro: qué se les pidió, en orden y con qué. */
function bitacora() {
  const puestas = [];
  const actualizaciones = [];
  const retiradas = [];
  return {
    puestas,
    actualizaciones,
    retiradas,
    /** Cuántas veces se puso, se actualizó y se retiró. Es lo que se afirma. */
    cuentas: () => ({ puestas: puestas.length, actualizaciones: actualizaciones.length, retiradas: retiradas.length }),
    /** La última línea que llegó a la pantalla de bloqueo, o `null`. */
    linea: () => {
      const ultimo = actualizaciones.length ? actualizaciones[actualizaciones.length - 1] : puestas[puestas.length - 1];
      return ultimo ? ultimo.linea : null;
    },
  };
}

/**
 * Un rótulo que funciona.
 *
 * `presente()` responde por lo que este doble hizo de verdad —puesto y no retirado—,
 * y no por lo que el estado de la partida crea. Es la mitad del contrato que permite
 * comparar las dos cosas.
 */
export function rotuloQueFunciona() {
  const log = bitacora();
  let puesto = false;
  return {
    montado: true,
    disponible: true,
    motivo: null,
    pone(compuesto) {
      log.puestas.push(compuesto);
      puesto = true;
    },
    actualiza(compuesto) {
      log.actualizaciones.push(compuesto);
    },
    retira(motivo) {
      log.retiradas.push(motivo);
      puesto = false;
    },
    presente: () => puesto,
    ...log,
  };
}

/**
 * Un rótulo que **no está montado en esta compilación**. Usarlo lanza: el motivo por
 * el que este doble existe es que la salida no llegue a pedírselo, y si lo pide hay
 * que verlo.
 */
export function rotuloSinMontar(motivo = 'no montado en esta compilación: falta el módulo nativo que lo arranca') {
  return {
    montado: false,
    disponible: false,
    motivo,
    pone() { throw new Error(`el doble sin montar ha recibido pone(): ${motivo}`); },
    actualiza() { throw new Error(`el doble sin montar ha recibido actualiza(): ${motivo}`); },
    retira() { throw new Error(`el doble sin montar ha recibido retira(): ${motivo}`); },
    presente: () => false,
    cuentas: () => ({ puestas: 0, actualizaciones: 0, retiradas: 0 }),
    linea: () => null,
  };
}

/**
 * Un rótulo **montado y no disponible**: el módulo está, y el sistema no deja usarlo
 * —el permiso de notificaciones denegado en Android, las Actividades en Vivo apagadas
 * en ajustes en iOS—. Es un problema distinto del anterior y se arregla en otro sitio,
 * y por eso son dos dobles y no uno con un flag.
 */
export function rotuloNoDisponible(motivo = 'montado y no disponible: el sistema no deja arrancarlo') {
  return {
    montado: true,
    disponible: false,
    motivo,
    pone() { throw new Error(`el doble no disponible ha recibido pone(): ${motivo}`); },
    actualiza() { throw new Error(`el doble no disponible ha recibido actualiza(): ${motivo}`); },
    retira() { throw new Error(`el doble no disponible ha recibido retira(): ${motivo}`); },
    presente: () => false,
    cuentas: () => ({ puestas: 0, actualizaciones: 0, retiradas: 0 }),
    linea: () => null,
  };
}

/**
 * Un rótulo que **se retira solo**, sin que ninguna transición del juego lo pida.
 *
 * Es el riesgo 4 del PRD reproducido: se llama a `caduca()` y a partir de ahí
 * `presente()` dice que no, exactamente como la Actividad en Vivo que se apaga sola o
 * el servicio que el sistema mató. Nadie llama para avisar, que es lo que hace que la
 * única manera de enterarse sea preguntar.
 */
export function rotuloQueSeRetiraSolo() {
  const doble = rotuloQueFunciona();
  let caducado = false;
  const presenteAntes = doble.presente;
  return {
    ...doble,
    presente: () => !caducado && presenteAntes(),
    /** El sistema se lo lleva. No avisa a nadie: solo deja de estar. */
    caduca() { caducado = true; },
  };
}

/**
 * La fuente de posiciones de la salida, doblada.
 *
 * El núcleo la exige cableada para abrir —una salida que nunca recibirá una posición
 * nunca podría cerrarse por regreso— pero las posiciones entran una a una por la
 * transición, así que esto es sobre todo la prueba de que está. Con una secuencia
 * declarada las va entregando en orden, y agotada devuelve `null`, que es la respuesta
 * prevista del sensor que todavía no ha dicho nada.
 */
export function fuenteDePosiciones(secuencia = []) {
  let i = 0;
  return {
    montado: true,
    motivo: null,
    posicion: () => (i < secuencia.length ? secuencia[i++] : null),
    pendientes: () => secuencia.length - i,
  };
}

/** Una fuente que no está cableada: no expone `posicion()` y por eso abrir tiene que fallar. */
export function fuenteSinCablear() {
  return { montado: false, motivo: 'no cableada: esta compilación no trae módulo de ubicación en marcha' };
}
