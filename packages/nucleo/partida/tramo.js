// El tramo personal: lo que cada jugadora anda en media hora, y la unidad de la
// que cuelga el tamaño de todo lo demás. Se declara una vez eligiendo un sitio al
// que se llega —nunca un número— y el juego lo corrige midiendo el ritmo, sin
// comentarlo jamás: aquí no se exporta ni un texto que el juego pueda enseñar.

import { congelaHondo } from '../core/congelar.js';
import { SUELO_MUNDO_JUGABLE_M, TRAMO_SUELO_M } from '../world/rejilla.js';

/**
 * El suelo del tramo **es** el suelo de mundo jugable, no un número aparte: la
 * celda se dimensiona en tramos, así que dos constantes distintas para lo mismo se
 * desincronizarían a la primera. Se reexporta desde donde ya vive
 * (`world/rejilla.js`) en lugar de escribir otra vez el 250.
 */
export const SUELO_TRAMO_M = TRAMO_SUELO_M;
export { SUELO_MUNDO_JUGABLE_M };

/**
 * Techo del tramo. 8 km/h sostenidos ya no es andar, y sin techo una traza mal
 * clasificada dispararía el mundo entero de un tirón.
 */
export const TECHO_TRAMO_M = 4000;

/** Media hora en segundos. El tramo es «por media hora» por definición y esto no se parametriza. */
export const SEGUNDOS_POR_TRAMO = 1800;

/**
 * El catálogo del arranque: cuatro respuestas, cada una un sitio al que se llega.
 *
 * Lo que viaja aquí es el **identificador** del sitio, no su redacción: la
 * pantalla `A1P2` es de otra fila y el núcleo no exporta texto de juego. Los
 * metros se calzan a los presets de `parametros-mundo.md` para no inventar una
 * escala paralela, y la tercera va preseleccionada como en la maqueta.
 */
export const RESPUESTAS_DE_TRAMO = congelaHondo([
  { id: 'vuelta-de-la-esquina', metrosPorMediaHora: 300, preseleccionada: false },
  { id: 'par-de-manzanas', metrosPorMediaHora: 700, preseleccionada: false },
  { id: 'otro-barrio', metrosPorMediaHora: 1200, preseleccionada: true },
  { id: 'pueblo-de-al-lado', metrosPorMediaHora: 2000, preseleccionada: false },
]);

/** Los identificadores válidos, en el orden del catálogo. */
export const IDS_DE_RESPUESTA = congelaHondo(RESPUESTAS_DE_TRAMO.map((r) => r.id));

/**
 * La declaración del suelo que consume la ficha de la tienda.
 *
 * Vive con la constante y no solo en `docs/` porque el día que el número cambie la
 * ficha seguiría diciendo el viejo. **Su destino es de fuera del juego**: se dice
 * antes de instalar y nunca dentro, y por eso lleva el destino escrito al lado.
 */
export const DECLARACION_DEL_SUELO = congelaHondo({
  destino: 'ficha-de-la-tienda',
  suelo: SUELO_TRAMO_M,
  texto:
    `Este juego se juega moviéndote. Cuenta cualquier desplazamiento propio —en silla, con andador, ` +
    `a paso muy corto, dando vueltas a un patio— y el mundo se dimensiona a lo tuyo. El límite está medido: ` +
    `por debajo de unos ${SUELO_TRAMO_M} m en media hora ya no hay juego que montar, y preferimos decírtelo ` +
    `antes de que lo instales. De las cuestas no te decimos nada, porque no las tenemos medidas.`,
});

/** El tramo en metros de una respuesta del catálogo. Acepta el identificador o la entrada entera. */
export function tramoDeRespuesta(respuesta) {
  const id = typeof respuesta === 'string' ? respuesta : respuesta?.id;
  const encontrada = RESPUESTAS_DE_TRAMO.find((r) => r.id === id);
  if (!encontrada) {
    const visto = typeof respuesta === 'string' ? `"${respuesta}"` : JSON.stringify(respuesta);
    throw new Error(`respuesta de tramo desconocida ${visto}: las cuatro declaradas son ${IDS_DE_RESPUESTA.join(', ')}`);
  }
  return encontrada.metrosPorMediaHora;
}

// Ni por debajo del suelo ni por encima del techo. Recortar en lugar de rechazar es
// lo que deja jugar a quien la decisión quería incluir (`accesibilidad.md` §4).
function entreSueloYTecho(metros) {
  return Math.min(TECHO_TRAMO_M, Math.max(SUELO_TRAMO_M, metros));
}

/** Declara el tramo de un personaje a partir de su respuesta del arranque. */
export function declaraTramo(respuesta) {
  const id = typeof respuesta === 'string' ? respuesta : respuesta?.id;
  const declaradoM = entreSueloYTecho(tramoDeRespuesta(respuesta));
  return congelaHondo({ respuesta: id, declaradoM, estimadoM: declaradoM, salidasMedidas: 0 });
}

/**
 * Un tramo a partir de un número de metros por media hora.
 *
 * **No es la vía de la pantalla** —la jugadora elige un sitio, no un número—:
 * existe porque el estimado ya es un número que no está en el catálogo y porque el
 * dimensionado tiene que poder trabajar con cualquier tramo.
 */
export function tramoEnMetros(metrosPorMediaHora) {
  if (!Number.isFinite(metrosPorMediaHora) || metrosPorMediaHora <= 0) {
    throw new Error(`tramoEnMetros necesita los metros por media hora como número positivo; llegó ${metrosPorMediaHora}`);
  }
  const declaradoM = entreSueloYTecho(metrosPorMediaHora);
  return congelaHondo({ respuesta: null, declaradoM, estimadoM: declaradoM, salidasMedidas: 0 });
}

/**
 * Recalibrar es volver a declarar: la estimación anterior medía otra respuesta y
 * arrastrarla haría que el cambio no se notara. No toca ningún mundo generado.
 */
export function cambiaTramo(tramo, respuesta) {
  exigeTramo(tramo);
  return declaraTramo(respuesta);
}

/**
 * El estado del tramo, venga suelto, dentro del personaje o dentro de la partida.
 *
 * El tramo **viaja con el personaje**: el `tramoM` que guarda la rejilla de un mapa
 * no es este dato, es la dimensión congelada con la que se generó lo que hay.
 */
export function exigeTramo(entrada, quien = 'el tramo') {
  const estado = entrada?.tramo ?? entrada?.personaje?.tramo ?? entrada;
  if (!estado || typeof estado !== 'object' || !Number.isFinite(estado.declaradoM)) {
    throw new Error(`falta el tramo declarado: ${quien} necesita la respuesta del arranque y la partida no la trae`);
  }
  return estado;
}

/** El tramo tal y como se declaró, en metros por media hora. */
export function tramoDeclaradoM(entrada) {
  return exigeTramo(entrada, 'el tramo declarado').declaradoM;
}

/**
 * El tramo corregido con lo andado. Sin ninguna salida medida es exactamente el
 * declarado, y **es el que dimensiona**: la corrección no se anuncia, se usa.
 */
export function tramoEstimadoM(entrada) {
  const estado = exigeTramo(entrada, 'el tramo estimado');
  return Number.isFinite(estado.estimadoM) ? estado.estimadoM : estado.declaradoM;
}

/**
 * Los metros de un tramo, acepte lo que acepte el llamante: un número ya resuelto o
 * el estado del tramo de un personaje. Es la única puerta por la que el
 * dimensionado obtiene metros, y por eso el mensaje de error nombra el dato.
 */
export function exigeTramoM(entrada, quien = 'el dimensionado') {
  if (Number.isFinite(entrada)) {
    if (entrada <= 0) throw new Error(`${quien} necesita "tramoM" positivo; llegó ${entrada}`);
    return entrada;
  }
  if (entrada && typeof entrada === 'object') return tramoEstimadoM(entrada);
  throw new Error(`${quien} necesita "tramoM", el tramo en metros por media hora, y no ha llegado ninguno (llegó ${JSON.stringify(entrada) ?? String(entrada)})`);
}
