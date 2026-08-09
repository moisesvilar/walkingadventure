// Doble del verificador de atestación: la única pieza que en producción habla con Apple
// y con Google, y la que hace falta doblar para ejercitar la vía legítima, la falsificada
// y la ausente sin un dispositivo real.
//
// Tiene una particularidad que no es un adorno y es la mitad de su motivo de existir:
// **devuelve un campo delator**. Un verificador de App Attest de verdad ve el
// identificador de la clave atestada, que es un identificador estable por instalación —
// exactamente el dato que RNF-PRIV-001 prohíbe conservar—. Si el doble no lo devolviera,
// las pruebas de privacidad estarían afirmando que no se guarda algo que nunca llegó a
// existir, que es una prueba que no puede ponerse roja. Devolviéndolo, «no se guarda» se
// convierte en «este valor concreto no aparece en la superficie de escritura», que sí.
//
// `server/atestacion.mjs` lee dos campos del veredicto y ninguno más, a propósito. El
// campo delator es la prueba de que ese «ninguno más» es cierto.

import { createHash, randomBytes } from 'node:crypto';

import { generaClaveRSA, preparaTanda, desciegaTanda } from '../../server/fichas.mjs';

export const MODOS = Object.freeze(['valida', 'falsificada', 'ausente', 'revienta']);

/** El nombre del campo delator, para que las pruebas lo busquen sin copiarlo a mano. */
export const CAMPO_DELATOR = 'idClaveAtestada';

/**
 * Fabrica una evidencia de plataforma para un reto dado.
 *
 * No imita el formato real de App Attest —eso es asunto del verificador de producción—:
 * imita lo que importa aquí, que es que la evidencia va atada a un reto y a una
 * instalación concreta, y que esa instalación tiene un identificador estable.
 *
 * @param {object} opciones
 * @param {string} opciones.reto  el que emitió el proxy.
 * @param {string} [opciones.instalacion='instalacion-A']  el identificador estable.
 * @param {boolean} [opciones.falsificada=false]  firma con otra cosa: no verifica.
 */
export function creaEvidencia({ reto, instalacion = 'instalacion-A', falsificada = false }) {
  const idClaveAtestada = `keyid-${createHash('sha256').update(String(instalacion)).digest('hex').slice(0, 32)}`;
  return {
    idClaveAtestada,
    reto,
    // La «firma»: un resumen del reto y de la clave atestada. La falsificada usa otro
    // secreto, así que no cuadra, que es lo único que el verificador comprueba.
    firma: createHash('sha256')
      .update(`${falsificada ? 'secreto-robado' : 'secreto-de-la-plataforma'}|${reto}|${idClaveAtestada}`)
      .digest('base64url'),
  };
}

/**
 * @param {object} [opciones]
 * @param {'valida'|'falsificada'|'ausente'|'revienta'} [opciones.modo='valida']  qué le
 *   pasa a **toda** evidencia que llegue. En modo «valida» la evidencia se comprueba de
 *   verdad, así que una evidencia falsificada se rechaza aunque el modo sea permisivo:
 *   un doble que aprueba todo no distingue la vía legítima de la que no lo es.
 */
export function creaVerificadorDoblado({ modo = 'valida' } = {}) {
  if (!MODOS.includes(modo)) throw new Error(`modo de verificador inválido: "${modo}"`);
  const registro = [];

  return {
    modo,
    /** Qué evidencias ha visto. El proxy no lo guarda; la prueba sí, para comparar. */
    vistas() { return registro.map((v) => ({ ...v })); },

    async verifica({ plataforma, reto, evidencia }) {
      registro.push({ plataforma, reto, evidencia });

      if (modo === 'revienta') throw new Error(`el verificador de ${plataforma} no responde`);
      if (modo === 'ausente' || !evidencia) {
        return { valida: false, motivo: 'no llegó ninguna evidencia de plataforma' };
      }
      if (modo === 'falsificada') {
        return { valida: false, motivo: 'la evidencia no está firmada por la plataforma', [CAMPO_DELATOR]: evidencia.idClaveAtestada };
      }

      const esperada = createHash('sha256')
        .update(`secreto-de-la-plataforma|${reto}|${evidencia.idClaveAtestada}`)
        .digest('base64url');
      const valida = evidencia.reto === reto && evidencia.firma === esperada;

      // El veredicto viaja con el identificador de la clave atestada dentro, igual que
      // el de verdad. Que el proxy lo tenga delante y no lo escriba es la afirmación.
      return {
        valida,
        motivo: valida ? null : 'la evidencia no verifica contra el reto',
        [CAMPO_DELATOR]: evidencia.idClaveAtestada,
        contadorDeAsercion: registro.length,
      };
    },
  };
}

/** Claves RSA de 1024 bits: la mitad de seguras y ocho veces más rápidas que las de 2048.
 *
 * Va en el andamiaje y no en `server/`: producción firma con 2048 y no se toca. Lo que
 * esto evita es que cada caso de prueba pague una generación de clave de 2048 bits, que
 * con un centenar de casos es la diferencia entre una suite de segundos y una de minutos.
 * El mecanismo que se prueba —cegar, firmar sin ver, desciegar— es el mismo con los dos
 * tamaños; lo que cambia es sólo el margen criptográfico, que no es lo que se verifica.
 */
export const generaClave1024 = () => generaClaveRSA(1024);

/**
 * La mitad cliente de una tanda, de principio a fin: pide reto, ciega, presenta la
 * evidencia y desciega las firmas.
 *
 * Vive aquí y no en cada prueba porque son cuatro pasos que hay que dar bien para tener
 * una sola ficha, y repetirlos a mano en veinte casos garantiza que uno acabe distinto.
 *
 * @returns {Promise<{ok: boolean, fichas?: object[], motivo?: string, clave?: object,
 *   reto?: string, evidencia?: object}>}
 */
export async function pideTanda(proxy, { cuantas = 4, instalacion = 'instalacion-A', falsificada = false, plataforma = 'app-attest', aleatorio = randomBytes } = {}) {
  const primera = await proxy.atiende({ ruta: '/atestacion', cuerpo: {} });
  const { reto, clave } = primera.sobre;
  const { cegadas, secretos } = preparaTanda(clave, cuantas, aleatorio);
  const evidencia = creaEvidencia({ reto, instalacion, falsificada });

  const segunda = await proxy.atiende({
    ruta: '/atestacion',
    cuerpo: { plataforma, reto, evidencia, cegadas },
  });
  if (!segunda.sobre.ok) return { ok: false, motivo: segunda.sobre.error, estado: segunda.estado, reto, evidencia, clave };

  return {
    ok: true,
    reto,
    evidencia,
    // Lo que el proxy llegó a ver de la tanda: valores cegados y nada más. Se devuelve
    // para poder afirmar la no enlazabilidad comparándolo con las fichas descegadas.
    cegadas,
    firmas: segunda.sobre.firmas,
    clave: segunda.sobre.clave,
    vigencia: segunda.sobre.vigencia,
    fichas: desciegaTanda(segunda.sobre.clave, secretos, segunda.sobre.firmas),
  };
}
