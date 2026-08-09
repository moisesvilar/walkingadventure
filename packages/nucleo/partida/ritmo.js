// Medir el ritmo de una salida y corregir con él el tramo, en silencio. El núcleo
// no mira sensores ni tiene reloj: recibe la traza **ya clasificada** segmento a
// segmento y devuelve un número. Aquí vive además, en un solo sitio, la asimetría
// de `bucle-jugable.md` §9: qué se hace con la duda para cada uno de los tres
// efectos, porque dispersarla es como se rompe.

import { congelaHondo } from '../core/congelar.js';
import { SEGUNDOS_POR_TRAMO, SUELO_TRAMO_M, TECHO_TRAMO_M, exigeTramo } from './tramo.js';

/** Las cuatro clasificaciones que puede traer un segmento de traza. */
export const CLASIFICACIONES = congelaHondo(['andando', 'parada', 'vehiculo', 'ambiguo']);

// El GPS simulado marca las paradas como 'parado'. Se acepta el sinónimo en lugar
// de obligar a traducir la traza entre el doble y el núcleo, que es donde se cuelan
// los desajustes que nadie ve hasta que la prueba miente.
const SINONIMOS = { parado: 'parada', vehículo: 'vehiculo', ambigua: 'ambiguo' };

/**
 * Por debajo de esta velocidad se trata como parada aunque llegue clasificado como
 * andando: el detector de vehículo distingue vehículo, no descanso, y la parada del
 * café es justo la que no puede destrozar el número.
 */
export const UMBRAL_PARADA_MS = 0.5;

/** Por debajo de estos metros andando la salida mide ruido y no aporta medida. */
export const MINIMO_UTIL_M = 400;

/** Peso de la medida nueva en la media móvil exponencial. Converge sin que una salida rara mande. */
export const ALFA = 0.4;

/**
 * Qué se hace con la velocidad ambigua, por efecto. **Medir el tramo la excluye;
 * contar kilómetros y validar llegadas cuentan y validan en la duda**, porque un
 * paso de más no le quita nada a nadie y no contar los de quien baja una cuesta
 * larga en silla le borra su esfuerzo. Los dos consumidores leen esto, no lo
 * reimplementan.
 */
export const REGLA_DE_LA_DUDA = congelaHondo({
  medirElTramo: false,
  motorDePasos: true,
  validarLlegada: true,
});

function normalizaClasificacion(valor, indice = null) {
  const quien = indice === null ? 'la clasificación' : `el segmento ${indice} de la traza`;
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${quien} llega sin clasificar: se esperaba una de ${CLASIFICACIONES.join(', ')} y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  const clasificacion = SINONIMOS[valor] ?? valor;
  if (!CLASIFICACIONES.includes(clasificacion)) {
    throw new Error(`${quien} llega con la clasificación desconocida "${valor}": las declaradas son ${CLASIFICACIONES.join(', ')}`);
  }
  return clasificacion;
}

/** Solo lo andando entra en la media del tramo. */
export function entraEnLaMedidaDelTramo(clasificacion) {
  return normalizaClasificacion(clasificacion) === 'andando';
}

/** El motor de pasos cuenta en la duda; el vehículo se aparta. */
export function cuentaParaElMotorDePasos(clasificacion) {
  const c = normalizaClasificacion(clasificacion);
  return c === 'andando' || (c === 'ambiguo' && REGLA_DE_LA_DUDA.motorDePasos);
}

/** Una llegada se valida en la duda; solo el vehículo la invalida —parado en el sitio sí se ha llegado—. */
export function validaLlegadaPorGeofence(clasificacion) {
  const c = normalizaClasificacion(clasificacion);
  return c !== 'vehiculo';
}

/**
 * Si un enlace de la traza —dos posiciones seguidas— es una **parada**.
 *
 * Vive aquí porque aquí vive el umbral, y porque quien pregunta es el geofence: lo que
 * separa haber llegado de pasar por delante es haberse parado, no haber estado dentro.
 * Un geofence generoso se cruza andando en casi un minuto, así que medir tiempo dentro
 * valida cualquier paseo por delante de un sitio.
 *
 * Lo dice la clasificación que llega —el detector ya distingue `parada`— y **además** el
 * umbral, con el mismo criterio por el que `mideRitmoDeSalida` no se cree veinte minutos
 * de café marcados como andando: por debajo de medio metro por segundo se está quieta,
 * lo etiquetara quien lo etiquetara. Y en la duda **sí** es parada, que es la asimetría
 * de `REGLA_DE_LA_DUDA` para las llegadas: quien se para a mirar algo raro valida.
 *
 * El vehículo nunca es una parada aunque el coche esté quieto: un atasco dentro de un
 * geofence no es haber llegado, y esa es la única clasificación que aparta la llegada.
 */
export function esUnaParada({ metros, duracionS, clasificacion }) {
  const c = normalizaClasificacion(clasificacion);
  if (c === 'vehiculo') return false;
  if (c === 'parada') return true;
  if (!Number.isFinite(metros) || metros < 0) {
    throw new Error(`el enlace del que se pregunta si es una parada mide ${metros} m: hacen falta metros finitos y no negativos`);
  }
  if (!Number.isFinite(duracionS) || duracionS <= 0) {
    throw new Error(`el enlace del que se pregunta si es una parada dura ${duracionS} s: una duración que no es positiva no se puede medir`);
  }
  return metros / duracionS < UMBRAL_PARADA_MS;
}

// Un segmento puede declarar su duración o sus dos marcas de tiempo. Con marcas se
// comprueba además que la traza va hacia adelante: una traza desordenada mide
// cualquier cosa y hay que verla fallar, no promediarla.
function duracionDeSegmento(seg, indice, anteriorHastaMs) {
  if (Number.isFinite(seg.desdeMs) && Number.isFinite(seg.hastaMs)) {
    if (anteriorHastaMs !== null && seg.desdeMs < anteriorHastaMs) {
      throw new Error(`la traza tiene las marcas de tiempo desordenadas: el segmento ${indice} empieza en ${seg.desdeMs} ms y el anterior terminaba en ${anteriorHastaMs} ms`);
    }
    const duracionS = (seg.hastaMs - seg.desdeMs) / 1000;
    if (!(duracionS > 0)) {
      throw new Error(`el segmento ${indice} de la traza dura ${duracionS} s: una duración que no es positiva no se puede medir`);
    }
    return { duracionS, hastaMs: seg.hastaMs };
  }
  const duracionS = seg.duracionS;
  if (!Number.isFinite(duracionS) || duracionS <= 0) {
    throw new Error(`el segmento ${indice} de la traza dura ${duracionS} s: hace falta una duración positiva, o las dos marcas "desdeMs" y "hastaMs"`);
  }
  return { duracionS, hastaMs: anteriorHastaMs };
}

function segmentosDe(traza) {
  const lista = Array.isArray(traza) ? traza : traza?.segmentos;
  if (!Array.isArray(lista)) {
    throw new Error(`traza mal formada: se esperaba una lista de segmentos { metros, duracionS, clasificacion } o un objeto con "segmentos", y llegó ${JSON.stringify(traza) ?? String(traza)}`);
  }
  return lista;
}

/**
 * Mide el ritmo de una salida a partir de su traza clasificada.
 *
 * @returns `{ hayMedida, metrosPorMediaHora, metrosAndando, segundosAndando, motivo }`.
 *   Sin medida devuelve `hayMedida: false` y el motivo, **nunca un cero**: un cero
 *   es una medida y arrastraría el tramo hacia abajo por no haber salido a andar.
 */
export function mideRitmoDeSalida(traza) {
  const segmentos = segmentosDe(traza);

  let metrosAndando = 0;
  let segundosAndando = 0;
  let anteriorHastaMs = null;

  segmentos.forEach((seg, indice) => {
    if (!seg || typeof seg !== 'object') {
      throw new Error(`el segmento ${indice} de la traza no es un objeto { metros, duracionS, clasificacion }: llegó ${JSON.stringify(seg) ?? String(seg)}`);
    }
    const clasificacion = normalizaClasificacion(seg.clasificacion ?? seg.modo, indice);
    const metros = seg.metros;
    if (!Number.isFinite(metros) || metros < 0) {
      throw new Error(`el segmento ${indice} de la traza mide ${metros} m: hacen falta metros finitos y no negativos`);
    }
    const { duracionS, hastaMs } = duracionDeSegmento(seg, indice, anteriorHastaMs);
    anteriorHastaMs = hastaMs;

    if (clasificacion !== 'andando') return;
    // El umbral se aplica **además** de lo que llegue clasificado: veinte minutos
    // de café marcados como andando siguen siendo una parada.
    if (metros / duracionS < UMBRAL_PARADA_MS) return;

    metrosAndando += metros;
    segundosAndando += duracionS;
  });

  if (!segmentos.length) return congelaHondo({ hayMedida: false, metrosPorMediaHora: null, metrosAndando: 0, segundosAndando: 0, motivo: 'traza-sin-segmentos' });
  if (segundosAndando === 0) return congelaHondo({ hayMedida: false, metrosPorMediaHora: null, metrosAndando: 0, segundosAndando: 0, motivo: 'ningun-segmento-andando' });
  if (metrosAndando < MINIMO_UTIL_M) {
    return congelaHondo({ hayMedida: false, metrosPorMediaHora: null, metrosAndando, segundosAndando, motivo: 'por-debajo-del-minimo-util' });
  }

  return congelaHondo({
    hayMedida: true,
    metrosPorMediaHora: (metrosAndando / segundosAndando) * SEGUNDOS_POR_TRAMO,
    metrosAndando,
    segundosAndando,
    motivo: null,
  });
}

/**
 * Incorpora una medida al tramo estimado, con media móvil exponencial y recortada
 * entre el suelo y el techo.
 *
 * Una salida que no aporta medida devuelve el mismo estado y **no cuenta como salida
 * medida**. Nada de esto produce texto: la corrección no se comenta jamás.
 */
export function incorporaMedida(tramo, medida) {
  const estado = exigeTramo(tramo, 'la corrección del tramo');
  if (!medida || medida.hayMedida !== true) return estado;
  if (!Number.isFinite(medida.metrosPorMediaHora)) {
    throw new Error(`la medida dice tener valor pero sus metros por media hora son ${medida.metrosPorMediaHora}`);
  }

  const previo = Number.isFinite(estado.estimadoM) ? estado.estimadoM : estado.declaradoM;
  const movido = previo + ALFA * (medida.metrosPorMediaHora - previo);
  return congelaHondo({
    ...estado,
    estimadoM: Math.min(TECHO_TRAMO_M, Math.max(SUELO_TRAMO_M, movido)),
    salidasMedidas: (estado.salidasMedidas ?? 0) + 1,
  });
}
