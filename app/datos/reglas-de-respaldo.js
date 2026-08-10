// Las reglas de respaldo: qué entra en la copia del sistema y qué no, escritas como
// dato para que una prueba pueda leerlas.
//
// RF-PERS-004 —«la partida entra en la copia»— tiene una mitad que solo se comprueba
// restaurando un móvil a mano, y otra que se rompe de verdad y todos los días: **una
// clave nueva que nadie añade a las reglas se queda fuera de la copia sin que nada
// proteste**. Esa es la mitad que se afirma aquí, y por eso las reglas son un fichero
// declarativo y no una casilla marcada en el manifiesto de cada plataforma
// (`pipeline/decisiones-orquestador.md` §6o: si un requisito no se puede poner rojo
// nunca, no está midiendo nada).
//
// El mecanismo real de cada sistema está en `app/plataforma/respaldo.ios.js` y
// `respaldo.android.js`: en iOS entra lo que cuelga del directorio de documentos salvo
// lo marcado como excluido, y en Android lo que declara el manifiesto. Las dos cosas
// dicen lo mismo que esto, y esto es lo que se puede comprobar sin dispositivo.

// Y la lista de prefijos de la partida **entra por la puerta**, no por un import del
// paquete (SPEC-020, repetida en SPEC-039): estas reglas tienen que poder leerse desde
// `node --test` sin instalación, que es justo el sitio donde se ponen rojas. Quien monta
// la app las arma en `app/nucleo/piezas.js` con la lista del núcleo, que sigue siendo una
// sola: derivar de ella es el punto, y copiarla sería el defecto.

import { PREFIJO as PREFIJO_DE_BINARIOS } from '../recursos/almacen-de-binarios.js';
import { SUFIJO_TEMPORAL } from './almacen-duradero.js';

/**
 * Lo que entra y lo que no, sobre la lista de prefijos que diga el núcleo.
 *
 * Los recursos binarios residentes están **dentro** y conviene decir por qué: son parte
 * del mundo congelado y no una caché. Sin ellos, un móvil restaurado abriría el mapa con
 * los huecos de las ilustraciones declarados y sin ilustración, que es medio mundo.
 *
 * La caché del proxy está **fuera**, y por lo contrario: no es partida, se vuelve a
 * pedir, y respaldarla sería subir a la cuenta de quien juega megas de datos de OSM que
 * no son suyos.
 */
export function creaReglasDeRespaldo({ PREFIJOS_DE_LA_PARTIDA } = {}) {
  if (!Array.isArray(PREFIJOS_DE_LA_PARTIDA) || PREFIJOS_DE_LA_PARTIDA.length === 0) {
    throw new Error('las reglas de respaldo necesitan PREFIJOS_DE_LA_PARTIDA inyectado: unas reglas sin prefijos dejarían la partida entera fuera de la copia sin protestar');
  }
  const reglas = Object.freeze({
    incluye: Object.freeze([
      ...PREFIJOS_DE_LA_PARTIDA,
      PREFIJO_DE_BINARIOS,
    ]),
    excluye: Object.freeze([
      'cache/',
      'tmp/',
    ]),
    /** Lo que nunca se respalda venga donde venga: un fichero a medio escribir. */
    excluyePorSufijo: Object.freeze([SUFIJO_TEMPORAL]),
  });
  return {
    reglas,
    cubre: (clave) => cubre(clave, reglas),
    exigeCobertura: (claves, donde) => exigeCobertura(claves, reglas, donde),
  };
}

/** Si una clave cae dentro de lo incluido. */
export function cubre(clave, reglas) {
  if (typeof clave !== 'string' || !clave) return false;
  if (reglas.excluyePorSufijo.some((s) => clave.endsWith(s))) return false;
  if (reglas.excluye.some((p) => clave.startsWith(p))) return false;
  return reglas.incluye.some((p) => clave.startsWith(p));
}

/**
 * Que toda clave que el almacén escribe caiga dentro de lo incluido, o un error que
 * **nombra la clave** que se quedaría fuera de la copia.
 *
 * Es el criterio que convierte RF-PERS-004 en algo que se puede poner rojo: basta con
 * que alguien estrene un prefijo de clave y no lo añada aquí.
 */
export function exigeCobertura(claves, reglas, donde = 'las reglas de respaldo') {
  const fuera = (claves ?? []).filter((c) => !cubre(c, reglas));
  if (fuera.length) {
    throw new Error(
      `${donde}: ${fuera.length} clave(s) que el almacén escribe se quedarían fuera de la copia del sistema (${fuera.join(', ')}). ` +
      'Toda clave de la partida entra en la copia, y añadir una sin declararla aquí la deja fuera sin que nada proteste',
    );
  }
  return true;
}

/**
 * Qué sale del móvil, dicho en voz alta.
 *
 * `seguridad-privacidad.md` §1 dice que del móvil no sale nada de quien juega;
 * `partida-guardada.md` §3 matiza que en la copia del sistema **sí sale**, cifrada,
 * hacia la cuenta del propio jugador y sin pasar por ningún servidor nuestro. Las dos
 * son verdad y la frontera es esta tabla.
 *
 * El anclaje redondeado está en la columna de la izquierda y no se disimula: es el
 * identificador de un mapa desde SPEC-003, es un redondeo y no un portal, y sin él no
 * hay partida que restaurar.
 */
export const QUE_SALE_DEL_MOVIL = Object.freeze({
  dondeVa: 'el respaldo cifrado de la cuenta del propio jugador (iCloud o Google Backup)',
  servidorPropio: false,
  sale: Object.freeze([
    'el mundo congelado de cada mapa, con su anclaje redondeado',
    'el estado de la partida y el registro de hechos',
    'el diario, la repisa, los rangos y los motes',
    'el personaje con su nombre, su género y su oficio',
    'los textos del narrador cacheados',
  ]),
  noSale: Object.freeze([
    'la posición exacta desde la que se levantó ningún mapa',
    'cualquier histórico de posiciones o camino recorrido',
    'cualquier lectura de sensor',
    'cualquier marca del reloj real de la vida de la jugadora',
    'cualquier identificador del dispositivo o de una cuenta nuestra',
  ]),
  /** La frase que resume la tabla, y que es la que se afirma en la batería. */
  resumen:
    'Lo que sale del móvil es una partida dentro del respaldo cifrado de la propia cuenta del jugador, '
    + 'sin pasar por ningún servidor nuestro. El rastro de ubicación no sale porque no existe.',
});
