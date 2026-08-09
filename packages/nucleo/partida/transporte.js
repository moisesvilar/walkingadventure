// El detector: convierte una secuencia de posiciones en una traza segmentada y
// clasificada —andando, parada, vehiculo o ambiguo—, que es la forma que `ritmo.js` y
// `kilometros.js` llevan consumiendo desde que se escribieron. Hasta aquí esa traza la
// escribía a mano quien probaba; a partir de aquí la deduce alguien.
//
// Vive en el paquete compartido y no en `app/` porque clasificar decide si el mundo
// avanza, y eso es regla de juego y no detalle de sensor (`arquitectura.md` §2). La
// plataforma entrega posiciones con su marca y su precisión, y no decide nada. Además,
// una regla que solo corriera en un dispositivo no se podría poner roja en `node --test`.
//
// Tres ausencias deliberadas, y las tres son el contenido de este módulo tanto como sus
// umbrales:
//
// - **Aquí no hay ninguna regla por efecto.** Qué se hace con cada clasificación lo dice
//   `ritmo.js` en un solo sitio, y esto solo la produce: la asimetría se consulta, no se
//   copia. Por eso de `ritmo.js` se importa el vocabulario y nada más.
// - **Aquí no hay reloj ni azar.** El tiempo entra dentro de cada posición y no se lee
//   ninguna fuente del sistema, que es lo que permite afirmar dos minutos de autobús sin
//   esperar dos minutos.
// - **Aquí no se consume el reconocimiento de actividad de iOS ni de Android.** Divergen
//   entre plataformas, no se pueden poner rojos en Node y no hace falta apretar la
//   detección: quien quiera recorrerse el juego en coche puede, y no hay ningún marcador
//   que proteger.
//
// Y nada de esto aflora: no se exporta ni un texto para mostrar, no hay ajuste que lo
// calibre y la clasificación vive lo que dura la salida en curso. Una traza guardada
// sería un registro de por dónde se fue y en qué, que es justo lo que este proyecto no
// tiene.

import { congelaHondo } from '../core/congelar.js';
import { CLASIFICACIONES, UMBRAL_PARADA_MS } from './ritmo.js';

/**
 * Por debajo de esta velocidad se sigue pudiendo afirmar que se anda. Seis, que es lo
 * mismo que ya usa el GPS simulado: andar deprisa son 6 km/h y por encima ya no se puede
 * afirmar que sea andar.
 */
export const UMBRAL_ANDAR_KMH = 6;

/**
 * A partir de esta velocidad hay motor. **Veinticinco y no quince**: el supuesto de
 * trabajo es «solo las velocidades inequívocas de motor», y una bicicleta sostiene 20
 * con soltura. A 15 caerían en vehículo la bici y la silla eléctrica, que son justo los
 * dos casos que `accesibilidad.md` deja abiertos, y apartarlos les borraría el esfuerzo.
 */
export const UMBRAL_VEHICULO_KMH = 25;

/**
 * Cuánto hay que sostener la velocidad de vehículo para que cuente como tal. Un pico de
 * GPS dura una muestra; un autobús dura minutos.
 */
export const CONFIRMACION_VEHICULO_S = 60;

/**
 * Cuánto hay que estar por debajo del umbral de andar para salir del vehículo. **El
 * doble que para entrar, y a propósito**: estar dentro del vehículo quita y salir
 * devuelve, así que se entra despacio y se sale igual de despacio para no oscilar. Un
 * autobús parado en un semáforo no es bajarse del autobús.
 */
export const SALIDA_DE_VEHICULO_S = 120;

/**
 * El mayor error del fijo —lo que la plataforma entrega como `precisionM`— con el que
 * todavía se puede fundar un vehículo. Por encima de treinta metros el salto entre dos
 * fijos puede ser del error y no del movimiento, y un salto de error a velocidad de coche
 * es un falso vehículo. Las posiciones malas no se descartan —eso quitaría metros que sí
 * se anduvieron—: solo dejan de poder afirmar un motor.
 *
 * Se llama error y no precisión a propósito: la única constante de precisión del paquete
 * es la rejilla con la que se guardan los metros, y vive en `core/geo.js`. Esto no la toca.
 */
export const ERROR_MAXIMO_FIABLE_M = 30;

/**
 * El mayor hueco entre dos posiciones que todavía produce segmento. Por encima, la
 * velocidad media entre los dos fijos no describe nada de lo que pasó en medio, así que
 * **el hueco no se clasifica: corta**. Es la decisión menos obvia del módulo y la de más
 * consecuencias: dejar ambiguo un salto de 30 km haría contar el viaje en tren de quien
 * cerró la app, y llamarlo vehículo sería adivinar. Esos metros no le pertenecen a nadie.
 */
export const HUECO_MAXIMO_S = 180;

// Los bordes se declaran cerrados por abajo y aquí, no en cada comparación: 6 km/h
// exactos es andando, 25 exactos es vehículo, 30 m exactos de error son fiables y un
// hueco de 180 s exactos todavía produce segmento. Un criterio que depende de si la
// comparación lleva el igual no es un criterio.
//
// Y para que «exactamente 25 es vehículo» sea verdad **sobre coordenadas reales**, la
// comparación lleva una millonésima de tolerancia: una secuencia a 25,000 km/h clavados
// da 24,999999999999996 al proyectar y dividir, y sin la tolerancia el borde declarado
// caería del lado contrario por el error de coma flotante. La tolerancia es menor que
// cualquier diferencia que el juego distinga.
const TOLERANCIA_KMH = 1e-6;

const esVelocidadDeVehiculo = (kmh) => kmh >= UMBRAL_VEHICULO_KMH - TOLERANCIA_KMH;
const esVelocidadDeAndar = (kmh) => kmh <= UMBRAL_ANDAR_KMH + TOLERANCIA_KMH;

const R_TIERRA_M = 6371000;
const MS_POR_S = 1000;
const KMH_POR_MS = 3.6;

// Proyección equirectangular local, sin pasar por `core/geo.js`: allí los metros se
// cuantizan a la rejilla de un metro, y a cadencia de un segundo eso deforma la velocidad
// —a 5 km/h dos fijos consecutivos distan 1,4 m—. Aquí la distancia se usa para dividir,
// no para guardarse, así que se mide en crudo.
function metrosEntre(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat = ((a.lat + b.lat) / 2) * rad;
  const x = dLon * Math.cos(lat);
  return Math.sqrt(dLat * dLat + x * x) * R_TIERRA_M;
}

function comoTexto(v) {
  return JSON.stringify(v) ?? String(v);
}

// Una posición mal formada se dice nombrándola, nunca se corrige ni se reordena: una
// secuencia desordenada mide cualquier cosa y hay que verla fallar.
function exigePosicion(cruda, indice, previa) {
  if (!cruda || typeof cruda !== 'object') {
    throw new Error(`la posición ${indice} no es un objeto { lat, lon, tMs, precisionM }: llegó ${comoTexto(cruda)}`);
  }
  if (!Number.isFinite(cruda.lat) || !Number.isFinite(cruda.lon)) {
    throw new Error(`la posición ${indice} no trae coordenada: llegaron lat=${comoTexto(cruda.lat)} y lon=${comoTexto(cruda.lon)}, y hacen falta dos números finitos`);
  }
  if (!Number.isFinite(cruda.tMs)) {
    throw new Error(
      `la posición ${indice} llega sin marca de tiempo (tMs=${comoTexto(cruda.tMs)}): el detector no lee ningún reloj, ` +
      'así que el tiempo del sensor viaja dentro de cada posición',
    );
  }
  if (previa && cruda.tMs < previa.tMs) {
    throw new Error(
      `la posición ${indice} lleva la marca ${cruda.tMs} ms y la anterior llevaba ${previa.tMs} ms: ` +
      'una secuencia que va hacia atrás se dice, no se reordena',
    );
  }
  let precisionM = null;
  if (cruda.precisionM !== null && cruda.precisionM !== undefined) {
    if (!Number.isFinite(cruda.precisionM) || cruda.precisionM < 0) {
      throw new Error(`la posición ${indice} trae una precisión que no son metros: llegó ${comoTexto(cruda.precisionM)}`);
    }
    precisionM = cruda.precisionM;
  }
  return { lat: cruda.lat, lon: cruda.lon, tMs: cruda.tMs, precisionM };
}

// La precisión de un enlace es la peor de sus dos extremos, y desconocida contagia: una
// posición sin dato de precisión no puede fundar un vehículo, igual que una mala.
function precisionFiableEntre(a, b) {
  if (a.precisionM === null || b.precisionM === null) return false;
  return Math.max(a.precisionM, b.precisionM) <= ERROR_MAXIMO_FIABLE_M;
}

/**
 * La clasificación que el enlace pide **por sí solo**, antes de la histéresis.
 *
 * Un enlace a velocidad de vehículo con precisión no fiable cae a ambiguo en lugar de a
 * vehículo: la precisión mala nunca funda un motor, y en la duda se cuenta.
 */
function clasificacionCruda(enlace) {
  if (esVelocidadDeVehiculo(enlace.velocidadKmH)) return enlace.precisionFiable ? 'vehiculo' : 'ambiguo';
  if (!esVelocidadDeAndar(enlace.velocidadKmH)) return 'ambiguo';
  // Por debajo del umbral de andar la distinción es entre moverse y estar quieta, y el
  // número lo pone `ritmo.js`: el detector distingue motor, no descanso.
  return enlace.metros / enlace.duracionS < UMBRAL_PARADA_MS ? 'parada' : 'andando';
}

// Escribe el enlace en una lista de segmentos, fundiéndolo con el anterior si comparten
// clasificación y fragmento. De aquí sale la garantía de que dos segmentos consecutivos
// del mismo fragmento nunca comparten clasificación: un cambio de segmento significa
// siempre un cambio de clasificación, o un corte.
function escribe(lista, enlace, clasificacion) {
  if (!CLASIFICACIONES.includes(clasificacion)) {
    throw new Error(`el detector ha intentado escribir la clasificación desconocida "${clasificacion}": las declaradas son ${CLASIFICACIONES.join(', ')}`);
  }
  if (!Number.isFinite(enlace.metros) || enlace.metros < 0) {
    throw new Error(`el detector ha producido un segmento de ${comoTexto(enlace.metros)} m: unos metros negativos son un error, no un aviso`);
  }
  if (!Number.isFinite(enlace.duracionS) || enlace.duracionS <= 0) {
    throw new Error(`el detector ha producido un segmento de ${comoTexto(enlace.duracionS)} s: una duración que no es positiva no se puede medir`);
  }
  const ultimo = lista[lista.length - 1];
  if (ultimo && ultimo.clasificacion === clasificacion && ultimo.fragmento === enlace.fragmento) {
    ultimo.metros += enlace.metros;
    ultimo.duracionS += enlace.duracionS;
    ultimo.hastaMs = enlace.hastaMs;
    return;
  }
  lista.push({
    metros: enlace.metros,
    duracionS: enlace.duracionS,
    clasificacion,
    desdeMs: enlace.desdeMs,
    hastaMs: enlace.hastaMs,
    fragmento: enlace.fragmento,
  });
}

/**
 * Levanta un detector, que acumula posiciones y entrega la traza de lo recibido.
 *
 * Es incremental de verdad —no guarda la secuencia, solo el último fijo y la racha que
 * todavía no está resuelta—, y de ahí sale que dar la secuencia entera o trocearla en
 * lotes produzca exactamente la misma traza.
 *
 * @returns `{ montado, motivo, agrega(posiciones), traza() }`. `traza()` no consume nada
 *   y se puede pedir tantas veces como haga falta: la racha sin resolver se cierra en la
 *   salida con la clasificación que le toca hoy, y sigue viva por dentro.
 */
export function creaDetectorDeTransporte() {
  const cerrados = [];
  const cortes = [];
  let pendientes = [];
  let enVehiculo = false;
  let acumuladoS = 0;
  let anterior = null;
  let recibidas = 0;
  let fragmento = 0;
  // Los metros de dos fijos con la misma marca no se pierden: viajan con el enlace
  // siguiente, porque sin tiempo entre medias no hay velocidad que clasificar.
  let arrastreM = 0;

  // Cómo se resuelve una racha que todavía no ha cumplido su tiempo. Sin confirmar, una
  // racha a velocidad de vehículo queda ambigua —que es la clasificación que cuenta en la
  // duda—; dentro del vehículo, la racha lenta sigue siendo el viaje hasta que se cumpla
  // el tiempo de salida.
  const resueltos = (lista) => lista.map((enlace) => ({ enlace, clasificacion: enVehiculo ? 'vehiculo' : 'ambiguo' }));

  const vuelca = (lista) => {
    for (const { enlace, clasificacion } of resueltos(pendientes)) escribe(lista, enlace, clasificacion);
  };

  const procesa = (enlace) => {
    const cruda = clasificacionCruda(enlace);

    if (!enVehiculo) {
      if (cruda === 'vehiculo') {
        pendientes.push(enlace);
        acumuladoS += enlace.duracionS;
        if (acumuladoS >= CONFIRMACION_VEHICULO_S) {
          // Confirmado: la racha entera era el viaje, también sus primeros segundos.
          enVehiculo = true;
          for (const e of pendientes) escribe(cerrados, e, 'vehiculo');
          pendientes = [];
          acumuladoS = 0;
        }
        return;
      }
      vuelca(cerrados);
      pendientes = [];
      acumuladoS = 0;
      escribe(cerrados, enlace, cruda);
      return;
    }

    if (esVelocidadDeAndar(enlace.velocidadKmH)) {
      pendientes.push(enlace);
      acumuladoS += enlace.duracionS;
      if (acumuladoS >= SALIDA_DE_VEHICULO_S) {
        // Se ha bajado: la racha lenta entera vuelve a ser suya, desde el principio.
        enVehiculo = false;
        for (const e of pendientes) escribe(cerrados, e, clasificacionCruda(e));
        pendientes = [];
        acumuladoS = 0;
      }
      return;
    }

    // Volver a moverse por encima del umbral de andar antes del tiempo de salida es el
    // semáforo: la racha lenta era parte del viaje.
    for (const e of pendientes) escribe(cerrados, e, 'vehiculo');
    pendientes = [];
    acumuladoS = 0;
    escribe(cerrados, enlace, 'vehiculo');
  };

  const corta = (desde, hasta, metros) => {
    vuelca(cerrados);
    pendientes = [];
    acumuladoS = 0;
    // Tras un hueco no se sabe nada: se vuelve a entrar en vehículo desde cero, con su
    // tiempo de confirmación entero, en lugar de arrastrar un estado de hace media hora.
    enVehiculo = false;
    cortes.push({
      desdeMs: desde.tMs,
      hastaMs: hasta.tMs,
      duracionS: (hasta.tMs - desde.tMs) / MS_POR_S,
      metros: metros + arrastreM,
      fragmento,
    });
    arrastreM = 0;
    fragmento += 1;
  };

  return {
    montado: true,
    motivo: null,

    /**
     * Acumula un lote de posiciones. Un lote vacío es un no-op declarado; una posición
     * mal formada falla nombrándola.
     */
    agrega(posiciones) {
      if (!Array.isArray(posiciones)) {
        throw new Error(`el detector recibe una lista de posiciones { lat, lon, tMs, precisionM } y llegó ${comoTexto(posiciones)}`);
      }
      for (const cruda of posiciones) {
        const p = exigePosicion(cruda, recibidas, anterior);
        recibidas += 1;
        if (anterior === null) {
          anterior = p;
          continue;
        }
        const duracionS = (p.tMs - anterior.tMs) / MS_POR_S;
        const metros = metrosEntre(anterior, p);
        if (duracionS > HUECO_MAXIMO_S) {
          corta(anterior, p, metros);
          anterior = p;
          continue;
        }
        if (duracionS === 0) {
          arrastreM += metros;
          anterior = p;
          continue;
        }
        const conArrastre = metros + arrastreM;
        arrastreM = 0;
        procesa({
          metros: conArrastre,
          duracionS,
          velocidadKmH: (conArrastre / duracionS) * KMH_POR_MS,
          precisionFiable: precisionFiableEntre(anterior, p),
          desdeMs: anterior.tMs,
          hastaMs: p.tMs,
          fragmento,
        });
        anterior = p;
      }
    },

    /**
     * La traza de lo recibido: sus segmentos, y los cortes que un hueco dejó.
     *
     * Los metros y la duración de un corte **no pertenecen a ningún segmento**, y por eso
     * viajan aparte: no existen para nadie que consuma la traza.
     */
    traza() {
      const segmentos = cerrados.map((s) => ({ ...s }));
      for (const { enlace, clasificacion } of resueltos(pendientes)) escribe(segmentos, enlace, clasificacion);
      return congelaHondo({ segmentos, cortes: cortes.map((c) => ({ ...c })) });
    },
  };
}

/**
 * La traza de una secuencia entera, de una vez. Es el detector con las tres llamadas
 * juntas, y da exactamente lo mismo que trocear la secuencia en lotes.
 */
export function clasificaPosiciones(posiciones) {
  const detector = creaDetectorDeTransporte();
  detector.agrega(posiciones);
  return detector.traza();
}

/**
 * Un detector que **no está cableado** y lo dice al usarlo.
 *
 * Existe por la forma de fallo que este proyecto ya ha pagado seis veces: una pieza que
 * al no estar no protesta. Sin él, quien olvidara cablear el detector recibiría una traza
 * vacía —o peor, una con todo clasificado como andando— y el viaje en tren movería el
 * mundo sin que nada se pusiera rojo.
 */
export function detectorSinMontar(motivo = 'no cableado: nadie ha montado el detector de esta salida') {
  return {
    montado: false,
    motivo,
    agrega() {
      throw new Error(`no se pueden clasificar posiciones: el detector está ${motivo}`);
    },
    traza() {
      throw new Error(`no hay traza que dar: el detector está ${motivo}`);
    },
  };
}
