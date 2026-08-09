// La cobertura del extracto: hasta dónde llegan los datos del Overpass del proyecto, y
// la decisión de encaminar una celda al propio o directamente al respaldo.
//
// Es el error que no se ve. Un extracto de España responde a una consulta en Lisboa con
// un **200 perfectamente válido y cero elementos**: sin esta comprobación el juego
// generaría un mundo sin nada anclado y lo presentaría como legítimo — que es la peor
// forma posible de fallar, porque no da error, da un juego roto (RF-MUNDO-005 lo haría
// además irreversible: lo generado no se resiembra jamás).
//
// Y por eso la cobertura **no es una caja**, aunque el parámetro se llame así en la spec:
// la caja de España contiene Lisboa. Son bandas por latitud, con el borde oeste de cada
// una, más las islas y las ciudades autónomas. Sigue siendo un recorte grueso —no son
// límites administrativos— y esa holgura la cubre la segunda red: una respuesta vacía del
// propio se confirma contra el respaldo antes de darla por buena (`overpass.mjs`).

/**
 * Las bandas del extracto `spain-latest`.
 *
 * Cada banda es `{sur, norte, oeste, este}` en grados. El borde oeste sigue a ojo la
 * frontera con Portugal, que es lo único que una caja única no puede hacer.
 */
export const COBERTURAS = Object.freeze({
  espana: Object.freeze({
    nombre: 'espana',
    descripcion: 'Extracto de España: península, Baleares, Canarias, Ceuta y Melilla.',
    bandas: Object.freeze([
      // Cornisa norte y Galicia. El oeste llega al cabo Touriñán.
      Object.freeze({ sur: 41.80, norte: 43.90, oeste: -9.35, este: 3.40 }),
      // Duero y Meseta norte: la frontera portuguesa sube hasta los -7,1º.
      Object.freeze({ sur: 39.90, norte: 41.80, oeste: -7.10, este: 3.40 }),
      // Extremadura y Meseta sur: la raya baja hasta los -7,55º.
      Object.freeze({ sur: 38.00, norte: 39.90, oeste: -7.55, este: 3.40 }),
      // Andalucía y Murcia.
      Object.freeze({ sur: 36.00, norte: 38.00, oeste: -7.55, este: 3.40 }),
      // Baleares, que se salen del este peninsular.
      Object.freeze({ sur: 38.60, norte: 40.15, oeste: 1.15, este: 4.40 }),
      // Canarias.
      Object.freeze({ sur: 27.55, norte: 29.50, oeste: -18.30, este: -13.30 }),
      // Ceuta y Melilla.
      Object.freeze({ sur: 35.83, norte: 35.95, oeste: -5.42, este: -5.25 }),
      Object.freeze({ sur: 35.24, norte: 35.35, oeste: -3.00, este: -2.88 }),
    ]),
  }),
  /** Todo. Para un despliegue cuyo origen propio tenga el planeta entero. */
  planeta: Object.freeze({
    nombre: 'planeta',
    descripcion: 'Sin recorte: el origen propio cubre el planeta.',
    bandas: Object.freeze([Object.freeze({ sur: -90, norte: 90, oeste: -180, este: 180 })]),
  }),
});

/** Un grado de latitud, en metros. Para convertir el radio de una celda a grados. */
const METROS_POR_GRADO = 111320;

/**
 * La cobertura de un extracto, con su procedencia.
 *
 * @param {object} opciones
 * @param {string} [opciones.cobertura='espana']  la clave de `COBERTURAS`.
 * @param {string} [opciones.extracto]  el nombre del fichero del que salió la base de datos.
 * @param {string} [opciones.mirror]  de qué mirror salió.
 * @param {string} [opciones.fecha]  de qué fecha es.
 */
export function creaCobertura({ cobertura = 'espana', extracto = 'spain-latest', mirror = 'sin declarar', fecha = 'sin declarar' } = {}) {
  const declarada = COBERTURAS[cobertura];
  if (!declarada) {
    throw new Error(
      `el proxy no arranca: COBERTURA "${cobertura}" no está declarada. Las declaradas son: ${Object.keys(COBERTURAS).join(', ')}.`,
    );
  }

  return {
    nombre: declarada.nombre,
    bandas: declarada.bandas,

    /**
     * Si el extracto cubre la celda **entera**, radio incluido. Media celda dentro es una
     * celda incompleta, y un mundo con la mitad de sus anclajes es indistinguible de un
     * mundo pobre.
     *
     * @param {{lat: number, lon: number, radio_m?: number}} celda
     */
    cubre(celda) {
      if (!celda || !Number.isFinite(celda.lat) || !Number.isFinite(celda.lon)) return false;
      const radio = Number.isFinite(celda.radio_m) ? celda.radio_m : 0;
      const dLat = radio / METROS_POR_GRADO;
      const dLon = radio / (METROS_POR_GRADO * Math.max(0.05, Math.cos((celda.lat * Math.PI) / 180)));
      const sur = celda.lat - dLat; const norte = celda.lat + dLat;
      const oeste = celda.lon - dLon; const este = celda.lon + dLon;
      return declarada.bandas.some((b) => sur >= b.sur && norte <= b.norte && oeste >= b.oeste && este <= b.este);
    },

    /**
     * La cobertura y la procedencia, como dato explícito y consultable. Entra en la
     * métrica de operación: un número sin extracto, mirror y fecha no es comparable con
     * el siguiente.
     */
    declara() {
      return {
        cobertura: declarada.nombre,
        descripcion: declarada.descripcion,
        bandas: declarada.bandas,
        extracto,
        mirror,
        fecha,
        actualizacionPorDiffs: false,
      };
    },
  };
}
