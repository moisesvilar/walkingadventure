// La rejilla de celdas fijas sobre la que se genera un mapa: su anclaje a una
// coordenada redondeada, su dimensionado en tramos del jugador, y la aritmética
// de índices, límites y vecindad. Crecer no es regenerar: es abrir otra celda.

import { makeProjector } from '../core/geo.js';

/**
 * Paso de redondeo del anclaje, en grados. Es **geográfico y el mismo para todo el
 * mundo**, no un múltiplo del lado de celda: si dependiera del tramo, el anclaje
 * guardado dejaría deducir el tramo del jugador, y el tramo es dato del cuerpo
 * (`seguridad-privacidad.md`). Son ~1,1 km en latitud y 0,7-0,9 km en longitud en
 * la península: suficiente para que el mapa se pueda enseñar sin enseñar el portal.
 */
export const PASO_ANCLAJE_GRADOS = 0.01;

/**
 * Lado de la celda, medido en tramos del jugador. **Parámetro con valor por
 * defecto justificado, no número de diseño cerrado**: `alcance-del-mundo.md`
 * pendiente 1 dice que hay criterio —una celda tiene que contener el suelo de
 * parajes de `parajes.md`— y que el número sale midiendo.
 *
 * Por qué 2 mientras no se mida:
 *  - el radio inscrito de la celda es exactamente un tramo, o sea que desde el
 *    centro se llega al borde en media hora;
 *  - con un caminante estándar (~2 km por tramo) la celda mide 4 × 4 km y su
 *    círculo inscrito cubre el preset más grande de `parametros-mundo.md`;
 *  - con el tramo del suelo el radio inscrito cae en los 250 m que
 *    `accesibilidad.md` §4 midió como suelo de mundo jugable, así que los dos
 *    suelos coinciden en lugar de contradecirse.
 *
 * Aparece aquí una sola vez y ninguna fase lo recalcula por su cuenta.
 */
export const LADO_CELDA_EN_TRAMOS = 2;

/** Suelo de mundo jugable medido en `accesibilidad.md` §4: por debajo no hay lazo que montar. */
export const SUELO_MUNDO_JUGABLE_M = 250;

/**
 * Suelo del tramo declarado, derivado y no clavado: es el tramo más corto con el
 * que el radio inscrito de la celda todavía alcanza el suelo de mundo jugable. Si
 * `LADO_CELDA_EN_TRAMOS` cambia al medirlo, este suelo se mueve solo.
 */
export const TRAMO_SUELO_M = (2 * SUELO_MUNDO_JUGABLE_M) / LADO_CELDA_EN_TRAMOS;

function redondeaAlPaso(grados) {
  // Se redondea sobre el número de pasos enteros y se vuelve a dos decimales: ir
  // por el múltiplo directo deja ruido de coma flotante en el anclaje, y el
  // anclaje es el identificador del mapa.
  return Number((Math.round(grados / PASO_ANCLAJE_GRADOS) * PASO_ANCLAJE_GRADOS).toFixed(2));
}

/**
 * El anclaje de la rejilla: la coordenada de arranque redondeada al paso
 * declarado. Es lo único que queda registrado del sitio donde se levantó el mapa
 * — la coordenada exacta no se guarda en ninguna parte, que es lo que sostiene
 * «el rastro de ubicación no se guarda nunca».
 */
export function anclaje(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`el anclaje necesita una coordenada válida; llegó lat=${lat}, lon=${lon}`);
  }
  return { lat: redondeaAlPaso(lat), lon: redondeaAlPaso(lon) };
}

/** El identificador de un mapa dentro de la partida es su anclaje, y nada más. */
export function idDeMapa(anc) {
  return `${anc.lat.toFixed(2)},${anc.lon.toFixed(2)}`;
}

/** Clave estable de una celda, para índices y registros que no dependan de un orden de inserción. */
export function claveDeCelda(celda) {
  return `${celda.i},${celda.j}`;
}

function exigeCelda(celda) {
  if (!celda || !Number.isInteger(celda.i) || !Number.isInteger(celda.j)) {
    const visto = celda ? `{ i: ${celda.i}, j: ${celda.j} }` : String(celda);
    throw new Error(`índice de celda mal formado: se esperaba un par de enteros { i, j } y llegó ${visto}`);
  }
  return celda;
}

/**
 * Levanta la rejilla de un mapa.
 *
 * @param {{ lat?: number, lon?: number, anclaje?: {lat:number,lon:number}, tramoM: number }} opciones
 *   `lat`/`lon` es la coordenada de arranque, que se redondea y **no se conserva**.
 *   `tramoM` es el tramo declarado del jugador en metros por media hora.
 * @returns la rejilla, congelada: el anclaje no cambia nunca, ni porque el jugador
 *   se mueva ni porque cambie ningún ajuste.
 */
export function creaRejilla({ lat, lon, anclaje: ancDado, tramoM } = {}) {
  const anc = ancDado ? anclaje(ancDado.lat, ancDado.lon) : anclaje(lat, lon);

  if (!Number.isFinite(tramoM) || tramoM <= 0) {
    throw new Error(`creaRejilla necesita "tramoM", el tramo declarado en metros por media hora, y tiene que ser un número positivo; llegó ${tramoM}`);
  }

  // Un tramo por debajo del suelo no rechaza el mapa: se recorta y se declara al
  // llamante, para que la pantalla lo diga con sus palabras (`accesibilidad.md`
  // §4). Rechazarlo dejaría sin juego justo a quien la decisión quería incluir.
  const recortado = tramoM < TRAMO_SUELO_M;
  const tramo = recortado ? TRAMO_SUELO_M : tramoM;
  const ladoM = tramo * LADO_CELDA_EN_TRAMOS;

  return Object.freeze({
    anclaje: Object.freeze(anc),
    id: idDeMapa(anc),
    tramoM: tramo,
    tramoPedidoM: tramoM,
    tramoRecortadoAlSuelo: recortado,
    tramoSueloM: TRAMO_SUELO_M,
    ladoM,
    // El radio inscrito es lo que A1P4 dibuja como círculo de alcance y lo que las
    // fases portadas del prototipo siguen recibiendo como radio mientras las filas
    // 4 y 6 las reexpresan en tramos.
    radioInscritoM: ladoM / 2,
    ladoEnTramos: LADO_CELDA_EN_TRAMOS,
  });
}

/** Proyección local a metros desde el anclaje. La rejilla es métrica; solo el anclaje es geográfico. */
export function proyectorDeRejilla(rejilla) {
  return makeProjector(rejilla.anclaje.lat, rejilla.anclaje.lon);
}

/**
 * En qué celda cae una posición.
 *
 * La celda «0,0» está centrada en el anclaje, así que el jugador está dentro de su
 * celda pero no en su centro salvo por coincidencia. **Regla de bordes**: el borde
 * pertenece a la celda que empieza en él (intervalos semiabiertos), de modo que dos
 * celdas contiguas comparten el borde exactamente, sin solape ni hueco.
 */
export function celdaEnPosicion(rejilla, lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`celdaEnPosicion necesita una coordenada válida; llegó lat=${lat}, lon=${lon}`);
  }
  const p = proyectorDeRejilla(rejilla).toXY(lat, lon);
  return { i: Math.floor(p.x / rejilla.ladoM + 0.5), j: Math.floor(p.y / rejilla.ladoM + 0.5) };
}

/** El centro geográfico de una celda. Sale del anclaje y del índice, nunca de dónde esté el jugador. */
export function centroDeCelda(rejilla, celda) {
  exigeCelda(celda);
  return proyectorDeRejilla(rejilla).toLatLon({ x: celda.i * rejilla.ladoM, y: celda.j * rejilla.ladoM });
}

/**
 * Los límites de una celda: su rectángulo en metros desde el anclaje y sus cuatro
 * esquinas en coordenadas geográficas. No dependen de dónde esté el jugador.
 */
export function limitesDeCelda(rejilla, celda) {
  exigeCelda(celda);
  const mitad = rejilla.ladoM / 2;
  const minX = celda.i * rejilla.ladoM - mitad;
  const minY = celda.j * rejilla.ladoM - mitad;
  const maxX = minX + rejilla.ladoM;
  const maxY = minY + rejilla.ladoM;
  const proy = proyectorDeRejilla(rejilla);
  const so = proy.toLatLon({ x: minX, y: minY });
  const se = proy.toLatLon({ x: maxX, y: minY });
  const ne = proy.toLatLon({ x: maxX, y: maxY });
  const no = proy.toLatLon({ x: minX, y: maxY });
  return {
    celda: { i: celda.i, j: celda.j },
    ladoM: rejilla.ladoM,
    metros: { minX, minY, maxX, maxY },
    // Orden canónico de las esquinas: suroeste, sureste, noreste, noroeste.
    esquinas: [so, se, ne, no],
    min: so,
    max: ne,
    centro: proy.toLatLon({ x: celda.i * rejilla.ladoM, y: celda.j * rejilla.ladoM }),
  };
}

/**
 * Las cuatro vecinas de una celda, en orden canónico (este, oeste, norte, sur).
 *
 * Cuatro y no ocho: para llegar andando a una diagonal hay que cruzar antes una de
 * las dos ortogonales, que se abre por pisarla y convierte a la diagonal en
 * contigua. Incluir las diagonales solo añadiría aperturas por saltos de GPS.
 */
export function celdasContiguas(celda) {
  exigeCelda(celda);
  return [
    { i: celda.i + 1, j: celda.j },
    { i: celda.i - 1, j: celda.j },
    { i: celda.i, j: celda.j + 1 },
    { i: celda.i, j: celda.j - 1 },
  ];
}

/** Si dos celdas comparten un borde. */
export function sonContiguas(a, b) {
  exigeCelda(a);
  exigeCelda(b);
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j) === 1;
}

/** Orden canónico de dos índices de celda, para que una costura no dependa de por dónde se mire. */
export function ordenCanonico(a, b) {
  exigeCelda(a);
  exigeCelda(b);
  return a.i < b.i || (a.i === b.i && a.j < b.j) ? [a, b] : [b, a];
}

export { exigeCelda };
