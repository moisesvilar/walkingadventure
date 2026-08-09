// Los parámetros del proxy, sus valores por defecto y —lo que importa— el que no
// tiene valor por defecto a propósito.
//
// `TOPE_DIARIO_GASTO` se declara sin defecto porque una clave de API sin tope es la
// forma conocida de descubrir el presupuesto cuando ya se ha gastado (riesgo 3 del
// PRD, `arquitectura.md` p3). Un valor por defecto generoso convertiría una decisión
// pendiente en una factura, así que el proxy prefiere no arrancar.
//
// Nada de aquí abre una conexión ni escribe: es la lectura de la configuración y su
// congelación. El entorno llega inyectado para que las pruebas no dependan de la
// máquina.

const DIA = 24 * 60 * 60 * 1000;
const MINUTO = 60 * 1000;

/** Cómo se lee cada parámetro del entorno. El tipo va aquí y no en el sitio de uso. */
const TIPOS = {
  cadena: (bruto) => bruto,
  entero: (bruto, nombre) => {
    if (!/^-?\d+$/.test(bruto.trim())) throw new Error(`${nombre} tiene que ser un número entero, y llegó "${bruto}"`);
    return Number.parseInt(bruto, 10);
  },
  numero: (bruto, nombre) => {
    const n = Number(bruto);
    if (!Number.isFinite(n)) throw new Error(`${nombre} tiene que ser un número, y llegó "${bruto}"`);
    return n;
  },
  interruptor: (bruto, nombre) => {
    const v = bruto.trim().toLowerCase();
    if (v !== 'on' && v !== 'off') throw new Error(`${nombre} solo admite "on" u "off", y llegó "${bruto}"`);
    return v;
  },
};

/**
 * La declaración de los parámetros: nombre, tipo, valor por defecto y de dónde sale.
 *
 * `defecto: undefined` **no** significa «se me olvidó»: significa que el proxy no
 * arranca sin él. Por eso el campo `obligatorio` es explícito y no se infiere de la
 * ausencia del defecto, que es exactamente la ambigüedad que §6h describe.
 */
export const PARAMETROS = Object.freeze([
  { nombre: 'POLITICA_SIN_ATESTACION', tipo: 'cadena', defecto: 'solo-cache', obligatorio: false,
    deDonde: 'arquitectura.md p2, riesgo 6: el rechazo duro deja fuera a gente legítima' },
  { nombre: 'CUOTA_VIA_DEGRADADA', tipo: 'numero', defecto: 0.05, obligatorio: false,
    deDonde: 'acota el coste de servir caché a quien no atesta: 5 % de las peticiones del día' },
  { nombre: 'FICHAS_POR_TANDA', tipo: 'entero', defecto: 200, obligatorio: false,
    deDonde: 'cubre un mapa nuevo y varias salidas sin volver a atestar' },
  { nombre: 'VIGENCIA_TANDA', tipo: 'entero', defecto: 7 * DIA, obligatorio: false,
    deDonde: 'corta el valor de una tanda robada sin obligar a atestar cada día' },
  { nombre: 'VIGENCIA_RETO', tipo: 'entero', defecto: 5 * MINUTO, obligatorio: false,
    deDonde: 'lo justo para completar una atestación' },
  { nombre: 'VIGENCIA_LOTE', tipo: 'entero', defecto: 15 * MINUTO, obligatorio: false,
    deDonde: 'lo que dura crear un mapa con margen' },
  { nombre: 'TOPE_PAGO_LOTE_MAPA', tipo: 'entero', defecto: 60, obligatorio: false,
    deDonde: 'orden de magnitud de un mapa con sus ilustraciones y sus fotos' },
  { nombre: 'TOPE_PAGO_LOTE_SALIDA', tipo: 'entero', defecto: 8, obligatorio: false,
    deDonde: 'los textos de una aventura y sus beats' },
  { nombre: 'TOPE_DIARIO_GASTO', tipo: 'numero', defecto: undefined, obligatorio: true,
    deDonde: 'arquitectura.md p3: el coste no tiene presupuesto todavía, y el proxy no arranca sin él' },
  { nombre: 'CACHE_GENERACION', tipo: 'interruptor', defecto: 'off', obligatorio: false,
    deDonde: 'seguridad-privacidad.md p2: encendida es un registro de zonas pedidas' },
  { nombre: 'VENTANA_METRICA', tipo: 'cadena', defecto: 'dia-natural', obligatorio: false,
    deDonde: 'granularidad por debajo de la cual un contador describe una sesión' },
  { nombre: 'MTIME_CONSTANTE', tipo: 'entero', defecto: Date.UTC(2001, 0, 1), obligatorio: false,
    deDonde: 'que el sistema de ficheros no responda «cuándo»' },
  { nombre: 'ESPERA_MAXIMA_AGUAS_ARRIBA', tipo: 'entero', defecto: 20 * 1000, obligatorio: false,
    deDonde: 'por debajo del minuto de RNF-PER-001, con margen para no reintentar nada' },
]);

/**
 * Los parámetros del **origen de la generación**: el Overpass del proyecto, su cobertura,
 * su cadena de respaldo y la sonda que decide si sirve de verdad (SPEC-024).
 *
 * Van en una declaración aparte de `PARAMETROS` a propósito. `cargaConfig` describe el
 * proxy ciego —lo que hace falta para atender texto, imagen y fotos— y lo monta la suite
 * entera en memoria sin ningún origen de datos; esto describe de dónde salen los datos de
 * OSM, que solo hace falta cuando hay un despliegue de verdad detrás. Juntarlos obligaría
 * a declarar un Overpass para probar la ruta de texto, que es pedir un dato que no pinta
 * nada. `server/arranca.mjs` carga las dos, así que **en producción el proxy sigue sin
 * arrancar** si falta cualquiera de las dos obligatorias de aquí.
 */
export const PARAMETROS_ORIGEN = Object.freeze([
  { nombre: 'OVERPASS_PROPIO', tipo: 'cadena', defecto: undefined, obligatorio: true,
    deDonde: 'SPEC-024: sin destino propio no se arranca, para que caer a los mirrors sea siempre visible' },
  { nombre: 'CONSULTA_VERSION', tipo: 'cadena', defecto: undefined, obligatorio: true,
    deDonde: 'la clave de caché es el texto de la consulta: cambiarlo sin cambiar la versión pierde la caché entera sin enterarse' },
  { nombre: 'EXTRACTO', tipo: 'cadena', defecto: 'spain-latest', obligatorio: false,
    deDonde: 'docker-compose.yml; sin actualización por diffs, y la frescura solo afecta a mapas nuevos' },
  { nombre: 'EXTRACTO_MIRROR', tipo: 'cadena', defecto: 'https://download.openstreetmap.fr/extracts/europe/spain-latest.osm.pbf', obligatorio: false,
    deDonde: 'la procedencia del extracto entra en la métrica de operación: un número sin ella no es comparable' },
  { nombre: 'EXTRACTO_FECHA', tipo: 'cadena', defecto: 'sin declarar', obligatorio: false,
    deDonde: 'la otra mitad de la procedencia; «sin declarar» es visible, que es lo que se busca' },
  { nombre: 'COBERTURA', tipo: 'cadena', defecto: 'espana', obligatorio: false,
    deDonde: 'fuera de ella el propio no tiene datos y responder vacío sería mentir' },
  { nombre: 'RESPALDO', tipo: 'cadena',
    defecto: 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter',
    obligatorio: false, deDonde: 'riesgo 9 del PRD: respaldo degradado, en el orden de server.mjs' },
  { nombre: 'PRESUPUESTO_DATOS', tipo: 'entero', defecto: 20 * 1000, obligatorio: false,
    deDonde: 'el tramo de datos del minuto de RNF-PER-001; encaja bajo ESPERA_MAXIMA_AGUAS_ARRIBA' },
  { nombre: 'PLAZO_ESLABON', tipo: 'entero', defecto: 8 * 1000, obligatorio: false,
    deDonde: 'tres eslabones caben en el presupuesto sin agotarlo' },
  { nombre: 'CONSULTAS_EN_VUELO', tipo: 'entero', defecto: 4, obligatorio: false,
    deDonde: 'dos generaciones simultáneas no se estorban: el número admitido se declara en vez de descubrirse' },
  { nombre: 'PERCENTIL_MEDIDA', tipo: 'entero', defecto: 95, obligatorio: false,
    deDonde: 'una media esconde exactamente la cola que estropea un onboarding' },
  { nombre: 'PASADAS_MEDIDA', tipo: 'entero', defecto: 20, obligatorio: false,
    deDonde: 'veinte pasadas por celda, con la caché fría, gobernadas por la urbana densa' },
  { nombre: 'SONDA_MINIMO', tipo: 'entero', defecto: 5, obligatorio: false,
    deDonde: 'los elementos que el canario da con el extracto entero: lo que distingue «sirve» de «contesta»' },
  { nombre: 'SONDA_PERIODO', tipo: 'entero', defecto: 60 * 1000, obligatorio: false,
    deDonde: 'detecta la caída dentro de una generación, no de una tarde' },
  { nombre: 'SONDA_PLAZO', tipo: 'entero', defecto: 8 * 1000, obligatorio: false,
    deDonde: 'el mismo plazo de un eslabón: una sonda que espera más que una consulta no mide lo que hace falta' },
  { nombre: 'SONDA_PARA_LISTO', tipo: 'entero', defecto: 2, obligatorio: false,
    deDonde: 'evita el vaivén durante el final de una importación' },
]);

/**
 * Los cubos del histograma de coste por lote, en la unidad de coste imputado.
 *
 * Van declarados y no calculados: un histograma con cubos que dependan de los datos
 * acaba teniendo un cubo por lote, que es una fila por petición con otro nombre.
 */
export const CUBOS_COSTE_LOTE = Object.freeze({
  mapa: Object.freeze([0, 1, 2, 5, 10, 20, 40, 60, 100]),
  salida: Object.freeze([0, 1, 2, 3, 4, 6, 8, 12]),
});

/**
 * Lo que se imputa a cada llamada de pago, por ruta.
 *
 * Es una unidad abstracta a propósito: el precio real de cada proveedor cambia y no
 * es una decisión de código. Lo que la métrica necesita es que dos lotes se puedan
 * comparar entre sí, y para eso basta con que la unidad sea la misma.
 */
export const COSTE_POR_RUTA = Object.freeze({ texto: 1, imagen: 4, places: 1, generacion: 1 });

/** Los dos tipos de lote de trabajo. La unidad de coste **no** es el jugador. */
export const TIPOS_DE_LOTE = Object.freeze(['mapa', 'salida']);

/**
 * Lee una declaración de parámetros del entorno inyectado. Común a las dos cargas.
 *
 * @throws nombrando **todos** los que faltan y de dónde sale cada uno: quien despliega
 *   arregla una configuración incompleta de una vez, no descubriendo uno por arranque.
 */
function lee(parametros, entorno, encabezado) {
  const config = {};
  const faltan = [];

  for (const p of parametros) {
    const bruto = entorno[p.nombre];
    if (bruto === undefined || bruto === null || String(bruto).trim() === '') {
      if (p.obligatorio) { faltan.push(p); continue; }
      config[p.nombre] = p.defecto;
      continue;
    }
    config[p.nombre] = TIPOS[p.tipo](String(bruto), p.nombre);
  }

  if (faltan.length) {
    const detalle = faltan.map((p) => `${p.nombre} (${p.deDonde})`).join('; ');
    throw new Error(`el proxy no arranca: ${encabezado} → ${detalle}`);
  }
  return config;
}

/**
 * Lee la configuración del entorno inyectado y la congela.
 *
 * @param {Record<string, string|undefined>} [entorno]
 * @throws si falta un parámetro obligatorio, nombrándolo. Es lo que impide arrancar.
 */
export function cargaConfig(entorno = {}) {
  const config = lee(PARAMETROS, entorno, 'falta el tope de gasto declarado en su configuración');

  if (config.CUOTA_VIA_DEGRADADA < 0 || config.CUOTA_VIA_DEGRADADA > 1) {
    throw new Error(`el proxy no arranca: CUOTA_VIA_DEGRADADA es una fracción entre 0 y 1, y llegó ${config.CUOTA_VIA_DEGRADADA}`);
  }
  if (config.VENTANA_METRICA !== 'dia-natural') {
    throw new Error(
      `el proxy no arranca: VENTANA_METRICA solo admite "dia-natural" (llegó "${config.VENTANA_METRICA}"). ` +
      'Con poco tráfico, una serie más fina que el día dibuja las sesiones de una persona.',
    );
  }

  config.CUBOS_COSTE_LOTE = CUBOS_COSTE_LOTE;
  config.COSTE_POR_RUTA = COSTE_POR_RUTA;
  return Object.freeze(config);
}

/**
 * Lee la configuración del origen de la generación y la congela.
 *
 * Las dos negativas a arrancar de SPEC-024 viven aquí:
 *
 * - **Sin `OVERPASS_PROPIO` no se arranca.** La alternativa —si no está, a los mirrors—
 *   es exactamente el fallo que costó siete horas: todo «funcionaba», solo que lentísimo,
 *   porque la caída al respaldo era silenciosa. Que se note es la mitad de esta pieza.
 * - **Sin `CONSULTA_VERSION` tampoco.** La clave de caché es el texto literal de la
 *   consulta, así que cambiar una letra invalida la caché entera; la versión es lo que
 *   convierte ese coste en un acto deliberado con su anotación, en vez de un lunes raro.
 *
 * @param {Record<string, string|undefined>} [entorno]
 */
export function cargaConfigDeOrigen(entorno = {}) {
  const config = lee(
    PARAMETROS_ORIGEN, entorno,
    'falta el origen de los datos de OSM declarado en su configuración',
  );

  config.RESPALDO = Object.freeze(
    String(config.RESPALDO).split(',').map((u) => u.trim()).filter(Boolean),
  );
  if (config.PLAZO_ESLABON > config.PRESUPUESTO_DATOS) {
    throw new Error(
      `el proxy no arranca: PLAZO_ESLABON (${config.PLAZO_ESLABON} ms) no cabe en ` +
      `PRESUPUESTO_DATOS (${config.PRESUPUESTO_DATOS} ms), así que un solo eslabón se comería el tramo de datos entero.`,
    );
  }
  if (config.SONDA_PARA_LISTO < 1) {
    throw new Error(`el proxy no arranca: SONDA_PARA_LISTO es el número de sondas en verde que hacen falta, y llegó ${config.SONDA_PARA_LISTO}`);
  }
  if (config.SONDA_MINIMO < 1) {
    throw new Error(
      `el proxy no arranca: SONDA_MINIMO en ${config.SONDA_MINIMO} deja la sonda en un grep de "elements", ` +
      'que pasa con la lista vacía y es justo lo que esta pieza vino a evitar.',
    );
  }
  return Object.freeze(config);
}
