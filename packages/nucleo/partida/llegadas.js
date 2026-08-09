// Las llegadas: el geofence de un sitio, la permanencia que distingue pararse de pasar
// de largo, el registro de lo validado y lo que aflora al llegar a un núcleo.
//
// **Validar no es un gesto.** No hay ninguna operación que reciba un toque, una
// confirmación ni ninguna acción de quien juega: llegar valida, y no hay otra manera.
// Y una llegada validada **no emite nada** —ni notificación, ni háptico, ni petición de
// primer plano—: la escena queda disponible y espera. Si mira, está ahí; si no, sigue
// andando y no ha pasado nada, que es lo que hace que pararse en un semáforo dentro de
// un geofence no tenga consecuencias.
//
// Tres cosas que esta capa **no hace**, y las tres a propósito:
//
// - **No clasifica velocidades.** Consulta `validaLlegadaPorGeofence` de `ritmo.js`,
//   que es donde vive la asimetría de `bucle-jugable.md` §9: en la duda se valida,
//   porque una llegada de más no le quita nada a nadie, y solo el vehículo la invalida.
//   Y consulta ahí mismo `esUnaParada`, que es lo que separa haberse parado de haber
//   estado dentro. La regla se lee del mismo módulo del que la lee el motor de pasos.
// - **No lee el reloj ni sortea nada.** Las marcas de tiempo viajan dentro de cada
//   posición, como en el regreso de SPEC-030.
// - **No decide si hay beat, ni si hay micro-encuentro, ni qué se cuenta.** Todo eso
//   llega cableado, y sin cablear **falla nombrando lo que falta** en lugar de
//   devolver una llegada sin beat o un núcleo que calla.
//
// Y por qué estos números no son los del regreso, aunque se parezcan: allí la asimetría
// es la contraria —en la duda no se cierra— y por eso la permanencia es un minuto. Aquí
// son veinte segundos, porque validar es barato y un beat que se atiende de paso tiene
// que validar igual.
//
// Los veinte segundos se cuentan **parada**, y esa palabra es toda la pieza: un geofence
// de cuarenta metros se cruza en línea recta a cinco kilómetros por hora en casi un
// minuto, así que contar tiempo *dentro* validaba cualquier paso a pie por delante de un
// sitio y «el visor no aparece nunca andando» se caía sin que nada se pusiera rojo.

import { congelaHondo } from '../core/congelar.js';
import { infraccionesDeTexto } from '../names/lenguaje.js';
import { PROTAGONISTAS } from './deformacion.js';
import { apuntaLoQueSeCuenta, sucesosConVariasVersiones } from './diario.js';
import { paraLaCapaQuePinta } from './nucleos.js';
import { exigeMapaId } from './pasos.js';
import { esUnaParada, validaLlegadaPorGeofence } from './ritmo.js';
import {
  MODOS,
  TIPOS_DE_PASO,
  avanzaLaSecuencia,
  exigeSecuencia,
  formaDeSecuencia,
  pasoVigente as pasoVigenteDe,
  secuenciaDeLlegada,
} from './secuencia.js';

/**
 * El radio del geofence, **el mismo para todos los sitios**.
 *
 * `quests.md` §3 declara el rango de treinta a cincuenta metros y pide que sea
 * «activable desde espacio público, tolerante a lugares reales cerrados o
 * inaccesibles». Cuarenta cubre la acera de enfrente —treinta metros— con margen para
 * el error del fijo, y no es tan grande como para que dos anclajes de la misma calle se
 * confundan en el mundo urbano denso. Un radio por tipo de sitio sería una perilla más
 * que calibrar sin ninguna decisión de diseño detrás.
 */
export const RADIO_DE_GEOFENCE_M = 40;

/**
 * Cuánto hay que estar **parada dentro** para que la llegada valide.
 *
 * Es tiempo de parada, no tiempo dentro: el diseño dice «parada dentro» y la diferencia
 * no es un matiz, porque atravesar andando este radio ya dura más que esto. Quien lo
 * mide es `esUnaParada` de `ritmo.js`, que es donde vive el umbral.
 *
 * Corto, y es deliberado: **validar es barato**. Lo que la permanencia distingue es
 * pararse de pasar de largo — sin ella, atravesar el geofence validaría y «el visor no
 * aparece nunca andando» dejaría de sostenerse. Con un minuto, en cambio, un beat que
 * se atiende de paso dejaría de validar, y `bucle-jugable.md` §9 dice que pasar cerca
 * por casualidad «valida igual» y «es un regalo, no una anomalía».
 */
export const PERMANENCIA_S = 20;

/** La permanencia en milisegundos, que es la unidad en la que llegan las marcas. */
export const PERMANENCIA_MS = PERMANENCIA_S * 1000;

/**
 * Lo que validar **no** exige, declarado para poder afirmar que no existe.
 *
 * Un anclaje puede ser una casa, un local cerrado o una finca, y nunca hay que entrar.
 * Escribir la lista es lo que permite poner rojo el día que alguien añada una condición
 * de interior «solo para los servicios».
 */
export const LO_QUE_VALIDAR_NO_EXIGE = congelaHondo([
  'entrar-en-el-recinto',
  'que-el-sitio-este-abierto',
  'tocar-un-boton',
  'confirmar-la-llegada',
  'haber-ido-por-el-trazado',
]);

/** Lo que una llegada validada emite hacia la plataforma: **nada**, y eso es la pieza. */
export const LO_QUE_UNA_LLEGADA_EMITE = congelaHondo([]);

/**
 * Lo que una llegada validada no emite. Que entrar en el geofence de un micro-encuentro
 * sí notifique es la **oferta**, que es otra cosa y de la fila 29: la llegada validada,
 * por sí sola, no emite ninguna de estas.
 */
export const LO_QUE_UNA_LLEGADA_NO_EMITE = congelaHondo([
  'notificacion',
  'haptico',
  'sonido',
  'encender-la-pantalla',
  'poner-la-app-en-primer-plano',
]);

/**
 * Los textos fijos de A4P5. La versión que llegó se redacta en otra fila; aquí solo
 * están las líneas del marco, y **ninguna lleva una cifra**: ni de distancia, ni de
 * tiempo, ni de ritmo, ni de progreso, ni de reputación.
 */
export const TEXTOS = congelaHondo({
  loQueCuentanAqui: 'Lo que cuentan aquí',
  deTi: 'Y de ti',
  diario: 'Queda anotado en tu diario, con el sitio y el momento.',
  seguir: 'Seguir',
  nadaQueContar: 'Hoy no se cuenta nada por aquí.',
});

// Y se criban al cargar el módulo, no cuando a alguien se le ocurra llamar: una criba
// que hay que acordarse de invocar es otra pieza que, al no estar, no protesta.
revisaLosTextos({ locale: 'es' });
revisaLosTextos({ locale: 'gl' });

/** El antetítulo de A4P5: nombra el sitio, nunca el rumor ni su nivel. */
export function antetituloDe(nucleo) {
  return `En ${nucleo} se habla de`;
}

/**
 * Criba de cifras sobre los textos de este paso. Se hace sobre datos y no mirando una
 * captura, que es lo único que sigue siendo cierto cuando alguien cambie una línea.
 */
export function revisaLosTextos({ locale = 'es', extra = [] } = {}) {
  for (const [clave, texto] of [...Object.entries(TEXTOS), ...extra.map((t, i) => [`extra ${i}`, t])]) {
    const cifras = infraccionesDeTexto(texto, { locale }).filter((i) => i.familia === 'cifras');
    if (cifras.length) {
      throw new Error(`el texto "${clave}" de lo que aquí se cuenta lleva una cifra ("${cifras[0].fragmento}"): en este paso no aparece ninguna — "${texto}"`);
    }
  }
  return true;
}

// --- el geofence ---------------------------------------------------------------

function exigeNombre(valor, quien) {
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${quien} se nombra con el identificador de un sitio del mundo y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  return valor;
}

/**
 * El geofence de un sitio: su radio y el punto del mundo en el que está.
 *
 * **Falla nombrando el sitio** cuando no trae posición: un sitio sin posición nunca
 * podría validar una llegada, y eso se descubriría plantada delante de él.
 */
export function geofenceDe(sitio) {
  const nombre = exigeNombre(sitio?.nombre, 'el sitio del que se pide el geofence');
  if (!Number.isFinite(sitio.x) || !Number.isFinite(sitio.y)) {
    throw new Error(
      `el sitio "${nombre}" llega sin posición (x=${JSON.stringify(sitio.x) ?? String(sitio.x)}, y=${JSON.stringify(sitio.y) ?? String(sitio.y)}) ` +
      'y sin ella no tiene geofence: una llegada a un sitio sin punto no se puede validar nunca',
    );
  }
  return congelaHondo({ nombre, tipo: sitio.tipo, x: sitio.x, y: sitio.y, radioM: RADIO_DE_GEOFENCE_M });
}

/** Metros entre un geofence y una posición, en el plano métrico del mundo. */
export function distanciaAlGeofence(geofence, { x, y }) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`la posición recibida llega sin punto: ${JSON.stringify({ x, y })}`);
  }
  return Math.hypot(x - geofence.x, y - geofence.y);
}

/**
 * Los sitios de un mundo congelado con su posición y su tipo, indexados por nombre.
 *
 * Núcleos, servicios y parajes entran los tres: a los tres se llega. El nombre es el
 * identificador, como en el resto de la partida — a un sitio se le nombra, nunca se le
 * da una coordenada.
 */
export function sitiosConPosicion(mundo) {
  const indice = new Map();
  const anota = (sitio) => {
    if (indice.has(sitio.nombre)) return;
    indice.set(sitio.nombre, geofenceDe(sitio));
  };
  for (const s of mundo?.settlements ?? []) {
    anota({ nombre: s.name, tipo: 'nucleo', x: s.x, y: s.y });
    for (const v of s.services ?? []) anota({ nombre: v.name, tipo: 'servicio', x: v.x, y: v.y });
  }
  for (const p of mundo?.parajes ?? []) anota({ nombre: p.name, tipo: 'paraje', x: p.x, y: p.y });
  return indice;
}

// --- la traza ------------------------------------------------------------------

/**
 * Una traza clasificada segmento a segmento. **Falla nombrando el segmento** que llega
 * sin clasificar, en lugar de suponer que se andaba.
 */
export function exigeTrazaClasificada(traza, quien = 'la traza sobre la que se comprueba una llegada') {
  const segmentos = Array.isArray(traza) ? traza : traza?.segmentos;
  if (!Array.isArray(segmentos)) {
    throw new Error(`${quien} llega como ${JSON.stringify(traza) ?? String(traza)}: se espera una lista de segmentos clasificados o un objeto con "segmentos"`);
  }
  segmentos.forEach((seg, i) => {
    const clasificacion = seg?.clasificacion ?? seg?.modo;
    if (typeof clasificacion !== 'string' || !clasificacion) {
      throw new Error(
        `el segmento ${i} de ${quien} llega sin clasificar (${JSON.stringify(clasificacion) ?? String(clasificacion)}): ` +
        'la traza llega clasificada desde SPEC-004 y esta capa no clasifica velocidades por su cuenta',
      );
    }
  });
  return segmentos;
}

// --- el área del estado ----------------------------------------------------------

/**
 * El área de una partida recién empezada: ninguna salida y ninguna llegada.
 *
 * Va al estado guardado y no a la memoria de la salida, y es requisito: la escena
 * «espera», y una escena que se pierde al cerrar la app rompe a la vez «pararse en un
 * semáforo… sigue disponible para cuando vuelva» y «la aventura sigue abierta hasta
 * volver o cerrar a mano». Lo que **no** guarda es el reloj de permanencia: es una
 * medida de sensor de veinte segundos, no un hecho de la partida.
 */
export function estadoDeLlegadas() {
  return { salida: null, llegadas: [] };
}

function exigeRegistro(estado) {
  if (!estado || typeof estado !== 'object' || !Array.isArray(estado.llegadas)) {
    throw new Error('el registro de llegadas llega mal formado: se espera lo que devuelve estadoDeLlegadas()');
  }
  return estado;
}

function vistaDeLlegada(llegada) {
  return congelaHondo({
    mapa: llegada.mapa,
    sitio: llegada.sitio,
    secuencia: llegada.secuencia.map((p) => ({ ...p })),
    forma: formaDeSecuencia(llegada.secuencia),
    paso: llegada.paso,
    cerrada: llegada.cerrada,
    vigente: pasoVigenteDe(llegada.secuencia, llegada.paso),
  });
}

/** Las llegadas validadas de la salida en curso, en el orden en que se ofrecen. */
export function llegadasValidadas(estado) {
  return congelaHondo(exigeRegistro(estado).llegadas.map(vistaDeLlegada));
}

/**
 * La escena que espera: la primera llegada sin cerrar. `null` es una respuesta —no hay
 * nada esperando— y no un error.
 */
export function escenaQueEspera(estado) {
  const esperando = exigeRegistro(estado).llegadas.find((l) => !l.cerrada);
  return esperando ? vistaDeLlegada(esperando) : null;
}

/** El registro en documento. Sin coordenadas y sin marcas de tiempo (RF-PRIV-002). */
export function congelaLlegadas(estado) {
  const registro = exigeRegistro(estado);
  return {
    salida: registro.salida ?? null,
    llegadas: registro.llegadas.map((l) => ({
      mapa: l.mapa,
      sitio: l.sitio,
      secuencia: l.secuencia.map((p) => ({ tipo: p.tipo, modo: p.modo })),
      paso: l.paso,
      cerrada: l.cerrada === true,
    })),
  };
}

/** El registro de vuelta de su documento, con la secuencia validada al levantarla. */
export function levantaLlegadas(doc) {
  const estado = estadoDeLlegadas();
  estado.salida = doc?.salida ?? null;
  for (const l of doc?.llegadas ?? []) {
    const secuencia = exigeSecuencia(
      (l?.secuencia ?? []).map((p) => ({ tipo: p.tipo, modo: p.modo })),
      `la secuencia guardada de la llegada a "${l?.sitio}"`,
    );
    if (!Number.isInteger(l.paso) || l.paso < 0 || l.paso > secuencia.length) {
      throw new Error(`la llegada guardada a "${l.sitio}" vuelve con el paso ${JSON.stringify(l.paso) ?? String(l.paso)} y su secuencia tiene ${secuencia.length} pasos`);
    }
    estado.llegadas.push({
      mapa: exigeNombre(l.mapa, 'el mapa de una llegada guardada'),
      sitio: exigeNombre(l.sitio, 'el sitio de una llegada guardada'),
      secuencia,
      paso: l.paso,
      cerrada: l.cerrada === true,
    });
  }
  return estado;
}

// --- la frontera de inyección -----------------------------------------------------

function exigePieza(pieza, metodos, nombre, porque) {
  const falta = !pieza || metodos.some((m) => typeof pieza[m] !== 'function');
  if (falta) {
    throw new Error(
      `${nombre} no está cableado y la llegada no se resuelve sin él: ${porque}. Se monta con { ${metodos.map((m) => `${m}()`).join(', ')} }`,
    );
  }
  return pieza;
}

function exigeReparto(reparto) {
  if (!reparto || !Array.isArray(reparto.beats)) {
    throw new Error(
      'el reparto de la aventura no está cableado y la llegada no se resuelve sin él: sin saber qué beats hay hoy, una secuencia sin beat ' +
      'sería indistinguible de una llegada a la que no se ha venido a nada. Una salida sin aventura aceptada se declara con { beats: [] }',
    );
  }
  return reparto;
}

// --- la capa -----------------------------------------------------------------------

/**
 * Monta la capa de llegadas de una salida.
 *
 * @param {object} piezas
 *   `mundo` el mundo congelado del mapa activo; `mapaId` el mapa; `salida` la salida
 *   abierta —sin ella no hay llegadas—; `estado` el área de la partida; `detector` el
 *   de transporte de SPEC-031; `reparto` la aventura aceptada con sus beats, o
 *   `{ beats: [] }`; `cola` los micro-encuentros mandados de SPEC-019; `loQueSeCuenta`
 *   la consulta por núcleo de SPEC-012; `ilustraciones` si un sitio tiene ilustración;
 *   `visitados` si ya se pisó y dónde anotarlo; `diario` el de SPEC-016.
 */
export function creaLlegadas({
  mundo,
  mapaId,
  salida,
  estado = estadoDeLlegadas(),
  detector,
  reparto,
  cola,
  loQueSeCuenta,
  ilustraciones,
  visitados,
  diario,
}) {
  const id = exigeMapaId(mapaId, 'las llegadas');
  const registro = exigeRegistro(estado);
  if (typeof salida !== 'string' || !salida) {
    throw new Error(
      `no hay ninguna salida abierta en la que validar llegadas y llegó ${JSON.stringify(salida) ?? String(salida)}: ` +
      'una llegada pertenece a una salida, y sin ella no habría dónde registrarla ni cuándo dejar de ofrecerla',
    );
  }
  const sitios = sitiosConPosicion(mundo);

  exigePieza(cola, ['microEncuentroEn'], 'la cola de entregas', 'decidir por nuestra cuenta que no hay micro-encuentro sería inventarse la cola');
  exigePieza(loQueSeCuenta, ['versionesDe'], 'la capa de lo que se cuenta', 'un núcleo que calla y un núcleo sin cablear tienen que ser distinguibles');
  exigePieza(ilustraciones, ['hay'], 'la capa de ilustraciones', 'sin ella no habría visor nunca y nadie lo notaría');
  exigePieza(visitados, ['yaVisitado', 'anota'], 'el registro de sitios pisados', 'sin él toda llegada sería la primera y el visor se abriría cada vez');
  exigeReparto(reparto);

  // Los beats se resuelven **contra los sitios del mundo congelado**: un beat cuyo
  // lugar no existe es un cableado a medias, y tratarlo como un sitio sin beat es
  // exactamente la degradación silenciosa que este proyecto ya ha pagado siete veces.
  const beatsPorSitio = new Map();
  for (const beat of reparto.beats) {
    const donde = exigeNombre(beat?.lugar?.nombre ?? beat?.lugar, `el lugar del beat ${beat?.n ?? '?'} de la aventura`);
    if (!sitios.has(donde)) {
      throw new Error(
        `el beat ${beat?.n ?? '?'} de la aventura ocurre en "${donde}", que no es ningún sitio del mapa ${id}: ` +
        'un lugar que el mundo congelado no tiene no se puede tratar como un sitio sin beat',
      );
    }
    if (!beatsPorSitio.has(donde)) beatsPorSitio.set(donde, beat);
  }

  // Una salida nueva empieza sin llegadas: las de la anterior se fueron con su telón, y
  // arrastrarlas reabriría una escena de otro día.
  if (registro.salida !== salida) {
    registro.salida = salida;
    registro.llegadas = [];
  }

  const geofenceDeSitio = (nombre) => {
    const quien = exigeNombre(nombre, 'el sitio del que se pide el geofence');
    const geofence = sitios.get(quien);
    if (!geofence) {
      throw new Error(`el sitio "${quien}" no pertenece al mapa ${id}, así que no tiene geofence en él: un geofence es de un sitio de su mapa y de ningún otro`);
    }
    return geofence;
  };

  const yaValidada = (nombre) => registro.llegadas.some((l) => l.sitio === nombre);

  // El reloj de la parada, por sitio: desde cuándo lleva parada dentro de este geofence.
  // Vive mientras dura la vigilancia y no se guarda: son veinte segundos de sensor, no un
  // hecho de la partida. Lo que cuenta es parada seguida — echar a andar dentro del
  // geofence lo borra, igual que salirse —, porque dos paradas cortas con un paseo en
  // medio no son haberse parado aquí.
  const paradaDesde = new Map();

  // La última posición vista, que es con la que se forma el enlace cuando las posiciones
  // llegan de una en una y no en tandas. Una sola posición no distingue estar parada de
  // ir de paso: hacen falta dos.
  let anterior = null;

  const exigeDetector = () => {
    if (!detector || detector.montado !== true) {
      throw new Error(
        `el detector de transporte está ${detector?.motivo ?? 'ausente'} y sin él no se comprueba ninguna llegada: ` +
        'validar suponiendo que se andaba haría que pasar en coche por delante de un beat lo validara',
      );
    }
  };

  const clasificacionDe = (posiciones, segmentos, i) => {
    if (segmentos) {
      // El segmento i clasifica el movimiento que termina en la posición i+1; la
      // primera posición se resuelve con el primero, que es el único que la toca.
      const seg = segmentos[Math.max(0, i - 1)];
      if (!seg) {
        throw new Error(`la traza trae ${segmentos.length} segmentos y no cubre la posición ${i}: una traza más corta que las posiciones dejaría tramos sin clasificar`);
      }
      return seg.clasificacion ?? seg.modo;
    }
    const clasificacion = posiciones[i]?.clasificacion;
    if (typeof clasificacion !== 'string' || !clasificacion) {
      throw new Error(
        `la posición ${i} llega sin clasificar (${JSON.stringify(clasificacion) ?? String(clasificacion)}): ` +
        'la traza llega clasificada desde SPEC-004 y esta capa no clasifica velocidades por su cuenta',
      );
    }
    return clasificacion;
  };

  /** Registra una llegada validada con su secuencia ya calculada. */
  const registra = (nombre) => {
    const geofence = geofenceDeSitio(nombre);
    const primeraVisita = visitados.yaVisitado(nombre) !== true;
    const delLazo = beatsPorSitio.get(nombre) ?? null;
    // Un micro-encuentro mandado por la cola produce beat igual que uno del lazo.
    const mandado = delLazo ? null : cola.microEncuentroEn(nombre);
    const secuencia = secuenciaDeLlegada({
      tipoDeSitio: geofence.tipo,
      primeraVisita,
      hayIlustracion: ilustraciones.hay(nombre) === true,
      hayBeat: !!(delLazo || mandado),
    });
    visitados.anota(nombre);
    const llegada = { mapa: id, sitio: nombre, secuencia, paso: 0, cerrada: false, beat: delLazo ?? mandado ?? null };
    registro.llegadas.push(llegada);
    return llegada;
  };

  const laLlegadaDe = (nombre, quien) => {
    const llegada = registro.llegadas.find((l) => l.sitio === nombre);
    if (!llegada) {
      throw new Error(
        `${quien}: no hay ninguna llegada validada a "${nombre}" en la salida "${salida}". ` +
        'No existe manera de consultar el estado de un núcleo sin haber llegado a él: enterarse cuesta piernas',
      );
    }
    return llegada;
  };

  return {
    mapaId: id,
    salida,
    radioM: RADIO_DE_GEOFENCE_M,
    permanenciaMs: PERMANENCIA_MS,

    /** El geofence de un sitio del mapa activo. */
    geofence: geofenceDeSitio,

    /**
     * Comprueba una secuencia de posiciones y valida las llegadas que toque.
     *
     * **No recibe ningún gesto**: lo que entra son posiciones con su marca y su
     * clasificación, o una traza clasificada al lado. Lo que sale es qué se validó, y
     * nada se emite hacia la plataforma.
     *
     * @param {object} opciones
     *   `posiciones` la lista de `{ x, y, tMs, clasificacion? }` en metros del mundo;
     *   `traza` la traza clasificada, si la clasificación viaja aparte.
     * @returns `{ validadas, esperando, emite }`. Las validadas de esta llamada van
     *   **de la más cercana a la más lejana**: dos geofences solapados validan los dos
     *   y se ofrece primero la del sitio más cercano, con la otra esperando detrás.
     */
    comprueba({ posiciones, traza = null }) {
      exigeDetector();
      if (!Array.isArray(posiciones)) {
        throw new Error(`la comprobación de llegadas recibe una lista de posiciones { x, y, tMs } y llegó ${JSON.stringify(posiciones) ?? String(posiciones)}`);
      }
      const segmentos = traza === null ? null : exigeTrazaClasificada(traza);
      const nuevas = [];

      posiciones.forEach((posicion, i) => {
        if (!Number.isInteger(posicion?.tMs)) {
          throw new Error(
            `la posición ${i} llega sin marca de tiempo (${JSON.stringify(posicion?.tMs) ?? String(posicion?.tMs)}): ` +
            'el tiempo del sensor viaja dentro de cada posición y esta capa no lee el reloj del sistema',
          );
        }
        const clasificacion = clasificacionDe(posiciones, segmentos, i);
        // La regla de la duda se lee de `ritmo.js` y no se reimplementa: en la duda se
        // valida, y solo el vehículo aparta la llegada.
        const puedeValidar = validaLlegadaPorGeofence(clasificacion);

        // El enlace que termina en esta posición, que es lo único que sabe si se estaba
        // parada. Una marca que no avanza no forma enlace: una traza que retrocede en el
        // tiempo es otra traza, y se vuelve a anclar en lugar de medir una duración
        // negativa.
        const previa = anterior;
        anterior = posicion;
        const enlace = previa && posicion.tMs > previa.tMs
          ? { metros: Math.hypot(posicion.x - previa.x, posicion.y - previa.y), duracionS: (posicion.tMs - previa.tMs) / 1000 }
          : null;
        const parada = enlace !== null && esUnaParada({ ...enlace, clasificacion });

        const validadasAqui = [];
        for (const [nombre, geofence] of sitios) {
          const distanciaM = distanciaAlGeofence(geofence, posicion);
          const cuenta = distanciaM <= geofence.radioM && puedeValidar && parada;
          if (!cuenta) {
            // Salir del geofence, echar a andar dentro de él o subirse a un vehículo
            // borran el reloj: cruzarlo dos veces no suma veinte segundos entre las dos,
            // y pararse diez a la ida y diez a la vuelta tampoco.
            paradaDesde.delete(nombre);
            continue;
          }
          // El reloj arranca donde arrancó la parada, que es el principio del enlace y no
          // esta posición: si no, la primera muestra de cada parada no contaría.
          const desde = paradaDesde.get(nombre) ?? previa.tMs;
          paradaDesde.set(nombre, desde);
          if (posicion.tMs - desde < PERMANENCIA_MS) continue;
          if (yaValidada(nombre)) continue;
          validadasAqui.push({ nombre, distanciaM });
        }

        // Dentro de la misma posición, la más cercana primero. Entre posiciones manda
        // el orden en que ocurrieron, que es el orden en que se llegó.
        validadasAqui.sort((a, b) => a.distanciaM - b.distanciaM || (a.nombre < b.nombre ? -1 : 1));
        for (const { nombre, distanciaM } of validadasAqui) {
          const llegada = registra(nombre);
          nuevas.push(congelaHondo({ ...vistaDeLlegada(llegada), distanciaM }));
        }
      });

      return congelaHondo({
        validadas: nuevas,
        esperando: registro.llegadas.filter((l) => !l.cerrada).map((l) => l.sitio),
        // Lo que esta capa manda a la plataforma al validar: nada.
        emite: LO_QUE_UNA_LLEGADA_EMITE,
      });
    },

    /** Las llegadas validadas de esta salida, en el orden en que se ofrecen. */
    validadas() {
      return llegadasValidadas(registro);
    },

    /** La escena que espera, o `null`. Sigue esperando aunque nadie mire el móvil. */
    espera() {
      return escenaQueEspera(registro);
    },

    /** El beat de una llegada, si lo hay. Lo compone la fila 34; aquí solo se entrega. */
    beatDe(nombre) {
      const llegada = laLlegadaDe(nombre, 'pedir el beat de una llegada');
      // Al levantar la partida el beat se vuelve a resolver contra el reparto: el área
      // guarda la secuencia, que es lo que no se puede recalcular, y no una copia del
      // beat, que sí.
      return llegada.beat ?? beatsPorSitio.get(nombre) ?? null;
    },

    /**
     * Avanza al siguiente paso de la llegada que espera. **La única manera de moverse
     * por la secuencia**: no hay ninguna operación que salte a un paso concreto.
     */
    avanza() {
      const llegada = registro.llegadas.find((l) => !l.cerrada);
      if (!llegada) {
        throw new Error(`no hay ninguna escena esperando en la salida "${salida}": una llegada cerrada no vuelve a ofrecerse en la misma salida`);
      }
      const paso = avanzaLaSecuencia(llegada.secuencia, llegada.paso);
      llegada.paso = paso.paso;
      llegada.cerrada = paso.cerrada;
      return congelaHondo({ sitio: llegada.sitio, ...paso, siguiente: escenaQueEspera(registro) });
    },

    /**
     * Lo que aquí se cuenta: A4P5, el último paso encadenado de una llegada a un núcleo.
     *
     * **Falla si no se ha llegado**, que es la garantía entera de «enterarse cuesta
     * piernas»: no existe ninguna otra puerta a esta consulta.
     */
    loQueAquiSeCuenta({ sitio, dia, paso }) {
      const nombre = exigeNombre(sitio, 'el núcleo del que aflora lo que allí se cuenta');
      const llegada = laLlegadaDe(nombre, 'aflorar lo que se cuenta en un núcleo');
      const geofence = geofenceDeSitio(nombre);
      if (geofence.tipo !== 'nucleo') {
        throw new Error(`"${nombre}" es un ${geofence.tipo} y no un núcleo: lo que aquí se cuenta es el estado de un pueblo y un paraje no lo tiene`);
      }
      if (!llegada.secuencia.some((p) => p.tipo === TIPOS_DE_PASO.LO_QUE_SE_CUENTA && p.modo === MODOS.ENCADENADO)) {
        throw new Error(`la llegada a "${nombre}" no tiene el paso de lo que aquí se cuenta en su secuencia, así que no hay nada que aflorar`);
      }

      const versiones = loQueSeCuenta.versionesDe(nombre);
      if (!Array.isArray(versiones)) {
        throw new Error(`la capa de lo que se cuenta devuelve ${JSON.stringify(versiones) ?? String(versiones)} para "${nombre}": un núcleo que no ha oído nada devuelve una lista vacía, que es una respuesta`);
      }
      const deLaJugadora = (v) => v?.hechos?.protagonista?.tipo === PROTAGONISTAS.JUGADORA;
      // El mismo canal para las dos: la reputación es lo que llegó, no un apartado
      // aparte. Lo que cambia es dónde se pinta, no de dónde sale.
      const delMundo = paraLaCapaQuePinta(versiones.filter((v) => !deLaJugadora(v)));
      const deTi = versiones.filter(deLaJugadora);

      const anotado = apuntaLoQueSeCuenta({ diario, versiones, mapaId: id, nucleo: nombre, dia, paso });
      // El marcador de la primera triangulación lo reservó SPEC-016 sin decidir cuándo
      // se enciende, y quien lo decide es la llegada: una segunda versión de algo ya
      // apuntado solo puede aflorar donde te la cuentan. Aquí solo se declara en el
      // estado; **componer la pantalla es de la fila 37**.
      const primeraTriangulacion = diario.triangulado !== true && sucesosConVariasVersiones(diario, { mapaId: id }).length > 0;
      if (primeraTriangulacion) diario.triangulado = true;

      return congelaHondo({
        sitio: nombre,
        // **Lo que aflora**, que es exactamente lo que va a pantalla. Va aparte de lo
        // que queda anotado a propósito: el apunte del diario sí lleva el nivel —lo
        // necesita para convivir con otra versión del mismo suceso— y lo que se enseña
        // no lo lleva nunca. Separarlos es lo que permite afirmar la ausencia sobre el
        // dato en vez de sobre una captura.
        pantalla: {
          sitio: nombre,
          antetitulo: antetituloDe(nombre),
          hayAlgoQueContar: versiones.length > 0,
          loQueCuentanAqui: { titulo: TEXTOS.loQueCuentanAqui, versiones: delMundo },
          // La sección no existe cuando no ha llegado nada: enseñarla vacía sería un
          // marcador de reputación con otras palabras, y además reprocharía la ausencia.
          deTi: deTi.length ? { titulo: TEXTOS.deTi, versiones: paraLaCapaQuePinta(deTi) } : null,
          // Un núcleo que calla enseña la pantalla igual, y ningún texto lo llama error.
          sinNada: versiones.length ? null : TEXTOS.nadaQueContar,
          diario: TEXTOS.diario,
          seguir: TEXTOS.seguir,
        },
        anotado,
        // Que la pantalla de la triangulación pueda existir: componerla es de la fila 37.
        triangulacion: primeraTriangulacion,
      });
    },
  };
}
