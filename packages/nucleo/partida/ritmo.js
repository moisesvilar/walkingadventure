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
 * Vive aquí porque aquí vive el umbral, y lo consume el ritmo de la salida: por debajo de
 * medio metro por segundo se está quieta, lo etiquetara quien lo etiquetara, con el mismo
 * criterio por el que `mideRitmoDeSalida` no se cree veinte minutos de café marcados como
 * andando.
 *
 * **Lo que ya no decide es la validación de un geofence** (SPEC-044, §9a). Medido: el ruido
 * del GPS con fijos a T segundos aparenta ~1,4·σ/T m/s, así que un parado de verdad con
 * σ = 10 m no parece parado hasta que pasan veintiocho segundos entre fijos, y con la
 * cadencia real no validaba **ninguna** llegada. Quien decide eso ahora es
 * `creaVentanaDeParada`, unas líneas más abajo y en este mismo módulo, que es lo que impide
 * que la regla se parta en dos. Lo que sigue valiendo de aquí es el umbral para el ritmo y
 * para el motor de pasos.
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

// --- la parada, medida por deriva de ventana --------------------------------------
//
// Anclar y comparar cada fijo contra un ancla **no vale**, y está medido (§9c): «parada
// dentro» y «de paso a 4 km/h» suben juntas con el radio de quietud —radio 15 m: 98 % de
// paradas validadas y **36 %** de paseos—, porque con dos o tres fijos en la ventana el
// ruido y la deriva son indistinguibles.
//
// Lo que sí los separa es que **el ruido del GPS es de media cero y la deriva de quien anda
// no**. Se compara el centroide de la primera mitad de una ventana con el de la segunda:
// promediar hunde el ruido como 1/√n y deja la deriva intacta.

/**
 * Los dos pares ventana/deriva, medidos con muestreo cada cinco segundos y 800 semillas por
 * celda (`pipeline/decisiones-orquestador.md` §9c). **No se reinventan aquí.**
 *
 * La regla es adaptativa **porque la medida lo pide y no por elegancia**: con el fijo bueno
 * la ventana corta ya separa —0 % de paseos a 4 y a 5 km/h hasta 3 m de error—, así que los
 * veinte segundos de SPEC-032 se conservan donde el fijo los sostiene y solo se estiran a
 * cuarenta cuando el error declarado los deja de sostener. Alargarla para todo el mundo
 * habría contradicho sin necesidad la razón por la que SPEC-032 la puso corta: *validar es
 * barato, y un beat que se atiende de paso valida igual*.
 */
export const VENTANAS_DE_PARADA = congelaHondo({
  corta: { duracionS: 20, derivaM: 5 },
  larga: { duracionS: 40, derivaM: 8 },
});

/**
 * Hasta qué error declarado del fijo sostiene la ventana corta.
 *
 * Cinco metros, de la misma tabla: a cinco la corta deja pasar un 4,3 % de paseos a 4 km/h y
 * a diez un 27,6 %, que es lo que la hace dejar de servir.
 */
export const ERROR_QUE_SOSTIENE_LA_CORTA_M = 5;

/**
 * El límite de esta regla, **con número y no con esperanza**: por encima de σ ≈ 15 m la
 * validación se degrada —91 % de paradas con la ventana larga— y por encima de σ ≈ 20 m deja
 * de sostenerse. Cubre la calle normal y no cubre el cañón urbano profundo.
 */
export const LIMITE_DE_ERROR_DECLARADO = congelaHondo({ seDegradaM: 15, dejaDeSostenerseM: 20 });

/** Los motivos por los que una ventana responde que no es parada. Vocabulario cerrado. */
export const MOTIVOS_DE_NO_PARADA = congelaHondo(['vehiculo', 'ventana-sin-cubrir', 'deriva']);

/**
 * Qué ventana toca para una precisión declarada. **Sin precisión, la larga**: la asimetría
 * de este proyecto es fallar hacia el lado que no rompe el diseño, y aquí el lado caro es
 * validar a quien pasa andando, que tumbaría «El visor no aparece nunca andando».
 */
export function ventanaParaPrecision(precisionM) {
  const sostiene = Number.isFinite(precisionM) && precisionM <= ERROR_QUE_SOSTIENE_LA_CORTA_M;
  return sostiene ? VENTANAS_DE_PARADA.corta : VENTANAS_DE_PARADA.larga;
}

/** El centroide de una lista de puntos. Promediar es lo que hunde el ruido. */
function centroide(puntos) {
  let x = 0;
  let y = 0;
  for (const p of puntos) {
    x += p.x;
    y += p.y;
  }
  return { x: x / puntos.length, y: y / puntos.length };
}

/**
 * La deriva de una ventana: metros entre el centroide de su primera mitad y el de la
 * segunda. Se parte **por tiempo y no por número de muestras**, porque la cadencia real no
 * es regular y partir por índice mediría medias de duraciones distintas.
 */
export function derivaDeVentana(posiciones) {
  if (!Array.isArray(posiciones) || posiciones.length < 2) {
    throw new Error(`la deriva de una ventana se mide sobre dos posiciones o más y llegaron ${Array.isArray(posiciones) ? posiciones.length : JSON.stringify(posiciones) ?? String(posiciones)}`);
  }
  const primera = posiciones[0];
  const ultima = posiciones[posiciones.length - 1];
  const mitad = (primera.tMs + ultima.tMs) / 2;
  const antes = posiciones.filter((p) => p.tMs < mitad);
  const despues = posiciones.filter((p) => p.tMs >= mitad);
  if (!antes.length || !despues.length) return 0;
  const a = centroide(antes);
  const b = centroide(despues);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * La ventana de parada de una salida: **una sola y no una por sitio**.
 *
 * Estar parada es una propiedad de la trayectoria y no del sitio; una por geofence mediría
 * lo mismo n veces y multiplicaría el estado sin cambiar ninguna respuesta.
 *
 * No guarda ninguna traza: dentro vive como mucho la ventana larga de posiciones —ocho a la
 * cadencia de cinco segundos—, en memoria, y no hay nada que serializar. Es el mismo estado
 * de sensor en vuelo que la racha del detector de transporte.
 *
 * @returns `{ agrega(posicion), ultima() }`. `agrega` devuelve
 *   `{ parada, desdeMs, derivaM, ventana, motivo }`: `desdeMs` es **el principio de la
 *   ventana** y no esta posición, que es lo que hace que la permanencia de veinte segundos
 *   se conserve donde el fijo la sostiene en vez de sumarse a la ventana.
 */
export function creaVentanaDeParada() {
  const lista = [];
  let ultimo = null;

  /** El índice desde el que la ventana cubre `duracionS`, o `-1` si todavía no la cubre. */
  const desdeQueCubre = (duracionS) => {
    const corte = lista[lista.length - 1].tMs - duracionS * 1000;
    let i = -1;
    for (let k = 0; k < lista.length; k += 1) {
      if (lista[k].tMs <= corte) i = k;
      else break;
    }
    return i;
  };

  const resultado = (parada, motivo, derivaM, ventana, desdeMs) => congelaHondo({ parada, motivo, derivaM, ventana, desdeMs });

  return {
    /**
     * Mete una posición y responde si la trayectoria está parada.
     *
     * Una marca que va hacia atrás **vuelve a anclar la ventana** en lugar de medir una
     * duración negativa: una traza que retrocede en el tiempo es otra traza. Es lo mismo que
     * hace la app al volver del segundo plano, y por eso la permanencia se paga otra vez.
     */
    agrega({ x, y, tMs, precisionM = null, clasificacion }) {
      const c = normalizaClasificacion(clasificacion, null);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`la posición que entra en la ventana de parada llega sin punto: ${JSON.stringify({ x, y })}`);
      }
      if (!Number.isInteger(tMs)) {
        throw new Error(
          `la posición que entra en la ventana de parada llega con la marca ${JSON.stringify(tMs) ?? String(tMs)}: ` +
          'el tiempo del sensor viaja dentro de cada posición y esta capa no lee ningún reloj',
        );
      }
      if (lista.length && tMs < lista[lista.length - 1].tMs) lista.length = 0;
      lista.push({ x, y, tMs, precisionM: Number.isFinite(precisionM) ? precisionM : null });

      // El vehículo nunca es una parada aunque el coche esté quieto: un atasco dentro de un
      // geofence no es haber llegado. Se responde antes de medir nada, y esa guarda es la
      // mitad del criterio que un arreglo de ruido pierde sola.
      if (c === 'vehiculo') {
        ultimo = resultado(false, 'vehiculo', null, null, null);
        return ultimo;
      }

      // Qué ventana toca lo decide **la peor precisión de la ventana corta**, y desconocida
      // contagia: un solo fijo malo dentro obliga a la larga, igual que en el detector de
      // transporte una precisión desconocida no puede fundar un motor.
      const iCorta = desdeQueCubre(VENTANAS_DE_PARADA.corta.duracionS);
      const enCorta = lista.slice(Math.max(0, iCorta));
      const sostiene = enCorta.every((p) => Number.isFinite(p.precisionM) && p.precisionM <= ERROR_QUE_SOSTIENE_LA_CORTA_M);
      const ventana = sostiene ? VENTANAS_DE_PARADA.corta : VENTANAS_DE_PARADA.larga;

      const i = sostiene ? iCorta : desdeQueCubre(ventana.duracionS);
      // Se poda a la ventana larga y no a la elegida: si el fijo mejora, la corta tiene que
      // poder salir de lo que ya hay dentro.
      const iLarga = desdeQueCubre(VENTANAS_DE_PARADA.larga.duracionS);
      if (iLarga > 0) lista.splice(0, iLarga);
      const base = iLarga > 0 ? i - iLarga : i;

      // Una ventana que todavía no cubre su duración responde que no, y no se extrapola:
      // con dos fijos el ruido y la deriva son indistinguibles, que es lo que §9c mide.
      if (i < 0) {
        ultimo = resultado(false, 'ventana-sin-cubrir', null, ventana, null);
        return ultimo;
      }

      const dentro = lista.slice(Math.max(0, base));
      const derivaM = derivaDeVentana(dentro);
      ultimo = resultado(derivaM <= ventana.derivaM, derivaM <= ventana.derivaM ? null : 'deriva', derivaM, ventana, dentro[0].tMs);
      return ultimo;
    },

    /** Lo que respondió la última posición, o `null` si todavía no ha entrado ninguna. */
    ultima: () => ultimo,
  };
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
