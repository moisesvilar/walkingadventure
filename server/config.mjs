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
 * Lee la configuración del entorno inyectado y la congela.
 *
 * @param {Record<string, string|undefined>} [entorno]
 * @throws si falta un parámetro obligatorio, nombrándolo. Es lo que impide arrancar.
 */
export function cargaConfig(entorno = {}) {
  const config = {};
  const faltan = [];

  for (const p of PARAMETROS) {
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
    throw new Error(
      `el proxy no arranca: falta el tope de gasto declarado en su configuración → ${detalle}`,
    );
  }

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
