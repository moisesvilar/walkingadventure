// Salud en Android: **Health Connect**, la fuente que el lector de la fila 42 esperaba, y la
// sonda que dice la verdad de esta compilación.
//
// La lógica —el permiso, la ventana, la marca de agua y los metros— sigue viviendo en
// `lector-de-salud.js` y no se toca: lo que hay aquí es el enlace con la app de salud del
// sistema, envuelto en la interfaz que `creaLectorDeSalud` ya exigía —`estadoDelPermiso()`,
// `pideElPermiso()` y `metrosEnVentana(trozo)` **o** `pasosEnVentana(trozo)`—. La interfaz
// no se cambia para que encaje la librería; es la librería la que se envuelve.
//
// Su pareja es `salud.ios.js` y exporta exactamente los mismos nombres. Lo que difiere es la
// plataforma: hoy la fuente nativa es Health Connect y solo Android, y iOS entra como doble
// declarado porque ningún iPhone puede verificar más (`docs/iphone.md`, decisión 1).
//
// Tres decisiones que están aquí porque son las que se rompen solas:
//
// - **La sonda consulta y no pregunta.** Mirar el estado del permiso no lo pide: el permiso
//   se pide desde el interruptor de A6P6 y desde ningún otro sitio, en contexto y una vez.
// - **La fuente elige al construirse qué sabe leer**, según qué permiso esté concedido:
//   metros si hay distancia, pasos si solo hay pasos, y ninguna de las dos si no hay
//   ninguno. Health Connect concede por tipo de dato y quien juega puede dar uno y no el
//   otro; exigir los dos convertiría un permiso parcial en un modo que no se puede encender.
//   Consecuencia declarada: la fuente se arma **al abrir la app**, que es el único momento en
//   que se lee, así que un permiso concedido a mitad de sesión se aprovecha en la apertura
//   siguiente y no en ésta.
// - **Lo que se le pide es lo mínimo que mueve un contador**: los metros o los pasos de una
//   ventana. Nada con recorrido, ningún entrenamiento, ninguna sesión con ruta y ningún
//   registro del cuerpo. La lista cerrada vive en `permisos.js` y de ella sale esta llamada.

import {
  SdkAvailabilityStatus,
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  requestPermission,
} from 'react-native-health-connect';

import { PERMISOS_DE_SALUD } from './permisos.js';

/** El mecanismo real de esta plataforma, para que nadie tenga que redescubrirlo. */
export const MECANISMO = 'Health Connect, la app de salud del sistema en Android';

/** Lo que se le pide a Health Connect, tal como la librería lo espera. Dos y ninguno más. */
const LO_QUE_SE_PIDE = PERMISOS_DE_SALUD.map((p) => ({ accessType: 'read', recordType: p.registro }));

/** Qué registro alimenta cada función de lectura. Sale de la lista declarada, no de aquí. */
const REGISTRO_DE = Object.fromEntries(PERMISOS_DE_SALUD.map((p) => [p.alimenta, p.registro]));

/** Los motivos de la sonda, distintos entre sí porque se arreglan en sitios distintos. */
export const MOTIVOS_DE_LA_SONDA = Object.freeze({
  SIN_APP_DE_SALUD: `${MECANISMO}: la app de salud del sistema no está instalada o no está disponible en este aparato, así que no hay de dónde leer los pasos del día a día`,
  SIN_PERMISO: `${MECANISMO}: falta el permiso de lectura, y se pide al encender «contar los pasos del día a día» en los ajustes, nunca al abrir`,
  SIN_MODULO: `${MECANISMO}: el módulo nativo no responde en esta compilación, así que no hay de dónde leer los pasos del día a día`,
});

/** Un instante del reloj real en el formato que Health Connect entiende. */
function enISO(ms, quien) {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error(`${quien} llega como ${JSON.stringify(ms) ?? String(ms)}: se espera un instante en milisegundos, finito y no negativo`);
  }
  return new Date(ms).toISOString();
}

/** El filtro de una ventana `{ desde, hasta }`. Lo único que viaja a la app de salud. */
function ventanaDe(trozo) {
  return {
    operator: 'between',
    startTime: enISO(trozo?.desde, 'el principio de la ventana que se le pide a Health Connect'),
    endTime: enISO(trozo?.hasta, 'el final de la ventana que se le pide a Health Connect'),
  };
}

/**
 * Si Health Connect está y responde. **No pide ningún permiso.**
 *
 * Devuelve `{ hay, motivo }`: `hay` es que el SDK está disponible y se ha podido inicializar,
 * y el motivo distingue las dos maneras de que no lo esté —no hay app de salud, o el módulo
 * nativo no está enlazado en esta compilación—, que se arreglan en sitios distintos.
 */
async function hayAppDeSalud() {
  let estado;
  try {
    estado = await getSdkStatus();
  } catch {
    // El módulo nativo no está enlazado: es la compilación sin la dependencia resuelta, y no
    // es lo mismo que un aparato sin app de salud.
    return { hay: false, motivo: MOTIVOS_DE_LA_SONDA.SIN_MODULO };
  }
  if (estado !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    return { hay: false, motivo: MOTIVOS_DE_LA_SONDA.SIN_APP_DE_SALUD };
  }
  try {
    if (await initialize()) return { hay: true, motivo: null };
  } catch { /* cae al mismo sitio: no hay de dónde leer */ }
  return { hay: false, motivo: MOTIVOS_DE_LA_SONDA.SIN_APP_DE_SALUD };
}

/** Qué registros de los dos declarados están concedidos ahora mismo, en orden estable. */
async function concedidos() {
  const dados = await getGrantedPermissions();
  const suyos = new Set((dados ?? [])
    .filter((p) => p?.accessType === 'read' && typeof p?.recordType === 'string')
    .map((p) => p.recordType));
  return PERMISOS_DE_SALUD.map((p) => p.registro).filter((r) => suyos.has(r));
}

/**
 * La fuente de salud del sistema, o `null` si esta compilación no la tiene.
 *
 * Devolver `null` no es degradar en silencio: el lector lo traduce a `sin-fuente`, que es
 * distinto de que la app de salud no responda y distinto de no tener permiso, y la
 * orquestación de los pasos de fondo lo convierte en un interruptor **imposible de encender
 * por construcción** en lugar de uno que miente.
 *
 * @returns la fuente con la interfaz que `creaLectorDeSalud` exige, o `null`.
 */
export async function creaFuenteDeSalud() {
  const disponible = await hayAppDeSalud();
  if (!disponible.hay) return null;

  // Se pregunta **una vez, al construirse**, y de ahí sale qué sabe leer esta fuente. Volver
  // a preguntarlo dentro de cada lectura no cambiaría nada —la lectura ocurre al abrir la
  // app, en una sola tanda— y sí abriría la puerta a que dos trozos de la misma ventana se
  // leyeran con permisos distintos.
  let dados = [];
  try {
    dados = await concedidos();
  } catch { /* sin poder preguntar, la fuente queda sin lectura y lo dice en el permiso */ }

  // Si se ha preguntado en esta sesión. Health Connect no guarda «ya se preguntó», así que
  // esto es lo único que se puede afirmar sin inventarse un almacén: fuera de la sesión en
  // que se pidió, no constar no es haber denegado y se dice `sin-preguntar`. Las dos
  // respuestas llevan al mismo sitio —la fila apagada con su línea—, y separarlas es lo que
  // impide tratarlas como concedido.
  let sePregunto = false;

  const lee = async (alimenta, trozo) => {
    const registro = REGISTRO_DE[alimenta];
    const agregado = await aggregateRecord({ recordType: registro, timeRangeFilter: ventanaDe(trozo) });
    // Los metros salen ya en metros y los pasos en cuenta: la conversión de pasos a metros es
    // del lector, con su zancada constante, y no se duplica aquí.
    return registro === 'Distance' ? agregado?.DISTANCE?.inMeters : agregado?.COUNT_TOTAL;
  };

  const fuente = {
    mecanismo: MECANISMO,

    /** El estado del permiso, **leído y nunca pedido**. Lista cerrada de cuatro respuestas. */
    async estadoDelPermiso() {
      let ahora;
      try {
        ahora = await concedidos();
      } catch {
        // No poder preguntar no es haber denegado: se dice que no hay fuente, que es lo que
        // el lector distingue.
        return 'no-disponible';
      }
      if (ahora.length > 0) return 'concedido';
      return sePregunto ? 'denegado' : 'sin-preguntar';
    },

    /** Pide el permiso. **Solo lo llama el interruptor al encenderse**, en contexto. */
    async pideElPermiso() {
      sePregunto = true;
      let dio;
      try {
        dio = await requestPermission(LO_QUE_SE_PIDE);
      } catch {
        return 'no-disponible';
      }
      return (dio ?? []).length > 0 ? 'concedido' : 'denegado';
    },
  };

  // **La fuente expone una sola de las dos**, y por eso se decide aquí y no dentro: el lector
  // prefiere metros si la función existe y solo cae a pasos si no está, así que exponer las
  // dos con el permiso de distancia denegado haría fallar toda lectura.
  if (dados.includes(REGISTRO_DE.metrosEnVentana)) {
    fuente.metrosEnVentana = (trozo) => lee('metrosEnVentana', trozo);
  } else if (dados.includes(REGISTRO_DE.pasosEnVentana)) {
    fuente.pasosEnVentana = (trozo) => lee('pasosEnVentana', trozo);
  }

  return fuente;
}

/**
 * La capacidad. **La sonda no pide ningún permiso**: consultar no es preguntar.
 *
 * Tres respuestas y no dos, porque son tres arreglos distintos: sin app de salud en el
 * aparato, con app de salud y sin permiso, y todo en su sitio.
 */
export const salud = {
  nombre: 'salud',
  /** No es capa de aviso: salud no avisa de nada, solo aporta pasos. */
  capa: 'ninguna',
  async sonda() {
    const disponible = await hayAppDeSalud();
    if (!disponible.hay) return { montado: true, disponible: false, motivo: disponible.motivo };
    let dados = [];
    try {
      dados = await concedidos();
    } catch {
      return { montado: true, disponible: false, motivo: MOTIVOS_DE_LA_SONDA.SIN_MODULO };
    }
    if (!dados.length) return { montado: true, disponible: false, motivo: MOTIVOS_DE_LA_SONDA.SIN_PERMISO };
    return { montado: true, disponible: true, motivo: null };
  },
};
