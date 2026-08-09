// La medición del coste: contadores agregados por día, histogramas de coste por lote,
// y la negativa a guardar nada más fino.
//
// La unidad **no es el jugador**: es el lote de trabajo —un mapa, una salida—, porque
// contar por instalación es exactamente el identificador persistente que RNF-PRIV-001
// descarta. De ahí salen dos medidas honestas —coste medio y dispersión por lote de
// mapa, y lo mismo por lote de salida— y una tercera que no se mide sino que se modela:
// cuántas salidas juega alguien con un mapa. El coste por jugador es el producto, y se
// declara como modelo.
//
// La ventana es el día natural y no baja de ahí. Con poco tráfico, una serie por hora
// dibuja las sesiones de una persona; el día es la ventana más fina que no lo hace y
// sigue sirviendo para presupuestar.

import { TIPOS_DE_LOTE } from './config.mjs';

/**
 * Lo que este módulo escribe, entrada por entrada **y campo por campo**. Se compara con
 * la superficie declarada al arrancar: son los campos exactos de `diaVacio`, y añadir uno
 * ahí sin declararlo aquí y en la superficie impide arrancar.
 */
export const ESCRITURAS = Object.freeze([
  Object.freeze({
    entrada: 'metrica-del-dia',
    campos: Object.freeze(['dia', 'contadores', 'peticiones', 'degradadas', 'coste', 'lotes', 'eslabones']),
  }),
]);

/**
 * Los eslabones del origen de datos, para el recuento del día (SPEC-024).
 *
 * Es el contrapeso de dejar los mirrors públicos como respaldo: sin este recuento, que el
 * Overpass del proyecto se caiga se nota solo en que todo va más lento, que es exactamente
 * el fallo de siete horas. Con él, el día en que `propio` baja y `respaldo-1` sube es un
 * número que dispara la revisión de la pieza.
 *
 * `ninguno` es la cadena agotada: ese mapa no se levantó. No hay ninguna geografía aquí,
 * solo cuántas generaciones sirvió cada eslabón.
 */
export const ESLABONES_MEDIDOS = Object.freeze(['propio', 'respaldo-1', 'respaldo-2', 'respaldo-3', 'ninguno']);

/** Las cuatro rutas de contenido. La de atestación no cuenta contenido de nadie. */
export const RUTAS_MEDIDAS = Object.freeze(['texto', 'imagen', 'places', 'generacion']);

/** Los resultados posibles de una petición. Catálogo cerrado: no hay un «otros». */
export const RESULTADOS = Object.freeze(['acierto-cache', 'llamada-de-pago', 'fallo-aguas-arriba', 'rechazo']);

/** Escrito para que se pueda buscar y no encontrarse: la unidad no es la persona. */
export const UNIDAD_DE_COSTE = 'lote-de-trabajo';

/** El día natural en UTC. Es la única resolución temporal que se escribe. */
export function diaDe(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function diaVacio(dia, cubos) {
  const contadores = {};
  for (const ruta of RUTAS_MEDIDAS) {
    contadores[ruta] = { coste: 0 };
    for (const r of RESULTADOS) contadores[ruta][r] = 0;
  }
  const lotes = {};
  for (const tipo of TIPOS_DE_LOTE) {
    lotes[tipo] = { n: 0, suma: 0, sumaCuadrados: 0, histograma: cubos[tipo].map(() => 0) };
  }
  const eslabones = {};
  for (const e of ESLABONES_MEDIDOS) eslabones[e] = 0;
  return { dia, contadores, peticiones: 0, degradadas: 0, coste: 0, lotes, eslabones };
}

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {{ahora: () => number}} deps.reloj  decide a qué día natural suma un contador,
 *   y no se usa para nada más. Nunca entra en una respuesta ni en una clave.
 * @param {object} deps.almacen  almacén de la entrada `metrica-del-dia`.
 */
export function creaMetrica({ config, reloj, almacen }) {
  const cubos = config.CUBOS_COSTE_LOTE;

  const carga = async (dia) => (await almacen.lee(dia)) ?? diaVacio(dia, cubos);
  const hoy = () => diaDe(reloj.ahora());

  const conElDia = async (fn) => {
    const dia = hoy();
    const registro = await carga(dia);
    fn(registro);
    await almacen.escribe(dia, registro);
    return registro;
  };

  return {
    ESCRITURAS,

    /** Suma una petición atendida: su ruta y su resultado. Nada más. */
    async cuenta({ ruta, resultado, coste = 0, degradada = false }) {
      if (!RUTAS_MEDIDAS.includes(ruta)) throw new Error(`ruta no medida: "${ruta}"`);
      if (!RESULTADOS.includes(resultado)) throw new Error(`resultado no declarado: "${resultado}"`);
      return conElDia((r) => {
        r.contadores[ruta][resultado] += 1;
        r.contadores[ruta].coste += coste;
        r.peticiones += 1;
        r.coste += coste;
        if (degradada) r.degradadas += 1;
      });
    },

    /**
     * Cierra un lote y suma su coste al histograma de su tipo.
     *
     * El identificador del lote **no entra**: lo que suma es el coste, en un cubo
     * agregado. Del histograma no se reconstruye la secuencia de lotes de nadie
     * porque los cubos no guardan orden.
     */
    async cierraLote({ tipo, coste }) {
      if (!TIPOS_DE_LOTE.includes(tipo)) throw new Error(`tipo de lote no declarado: "${tipo}"`);
      return conElDia((r) => {
        const l = r.lotes[tipo];
        l.n += 1;
        l.suma += coste;
        l.sumaCuadrados += coste * coste;
        const cortes = cubos[tipo];
        let i = cortes.length - 1;
        while (i > 0 && coste < cortes[i]) i--;
        l.histograma[i] += 1;
      });
    },

    /**
     * Suma una generación al eslabón que la sirvió. Es un recuento y nada más: ni la
     * celda, ni la consulta, ni cuándo dentro del día.
     */
    async cuentaEslabon(eslabon) {
      if (!ESLABONES_MEDIDOS.includes(eslabon)) throw new Error(`eslabón no declarado: "${eslabon}"`);
      return conElDia((r) => {
        // Un día escrito antes de que existiera el recuento no tiene el campo: se completa
        // al vuelo en vez de perder la suma o de fallar.
        if (!r.eslabones) { r.eslabones = {}; for (const e of ESLABONES_MEDIDOS) r.eslabones[e] = 0; }
        r.eslabones[eslabon] += 1;
      });
    },

    /** La métrica de un día. Sin tráfico, todos los contadores a cero y ninguno falta. */
    async delDia(dia = hoy()) {
      return carga(dia);
    },

    /** El gasto imputado del día en curso, que es contra lo que se mide el tope diario. */
    async gastoDelDia() {
      return (await carga(hoy())).coste;
    },

    /** Peticiones del día y cuántas de ellas fueron por la vía sin atestación. */
    async volumenDelDia() {
      const r = await carga(hoy());
      return { peticiones: r.peticiones, degradadas: r.degradadas };
    },

    /**
     * Coste medio y dispersión por lote, **medidos**. Se guardan la suma y la suma de
     * cuadrados en lugar de los valores: dan media y desviación exactas sin conservar
     * ni un lote individual.
     */
    async porLote(tipo, dias = [hoy()]) {
      if (!TIPOS_DE_LOTE.includes(tipo)) throw new Error(`tipo de lote no declarado: "${tipo}"`);
      let n = 0; let suma = 0; let sumaCuadrados = 0;
      const histograma = cubos[tipo].map(() => 0);
      for (const dia of dias) {
        const l = (await carga(dia)).lotes[tipo];
        n += l.n; suma += l.suma; sumaCuadrados += l.sumaCuadrados;
        l.histograma.forEach((v, i) => { histograma[i] += v; });
      }
      const media = n ? suma / n : 0;
      const varianza = n ? Math.max(0, sumaCuadrados / n - media * media) : 0;
      return { unidad: UNIDAD_DE_COSTE, n, media, desviacion: Math.sqrt(varianza), cubos: cubos[tipo], histograma };
    },

    /**
     * El coste por jugador. Se devuelve **declarado como modelo**, con sus dos factores
     * medidos y su factor de uso supuesto, porque medirlo de verdad exigiría contar
     * salidas por móvil, que es el identificador que no hay.
     */
    async costePorJugador({ salidasPorMapa, dias = [hoy()] }) {
      const mapa = await this.porLote('mapa', dias);
      const salida = await this.porLote('salida', dias);
      return {
        esModelo: true,
        factoresMedidos: { costeMedioPorLoteDeMapa: mapa.media, costeMedioPorLoteDeSalida: salida.media },
        factorSupuesto: { salidasPorMapa },
        estimacion: mapa.media + salida.media * salidasPorMapa,
        advertencia:
          'es un modelo, no una medición: el número de salidas por mapa se supone, ' +
          'porque medirlo exigiría contar salidas por instalación y ese identificador no existe.',
      };
    },
  };
}
