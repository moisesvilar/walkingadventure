// De metros andados a pasos del mundo: las dos fuentes de kilómetros, el resto que
// no completa un paso, la conversión contra el tramo personal y la reserva de la
// fuente de fondo con su tope.
//
// Un paso es **un tramo andado**, no dos kilómetros: por eso avanza igual quien
// anda 6 km con un tramo de 2 km que quien anda 1 800 m con uno de 600. Y el núcleo
// no mira el GPS ni decide qué es un vehículo: recibe la traza ya clasificada y
// consulta la regla de la duda donde vive, en `ritmo.js` (SPEC-004).

import { congelaHondo } from '../core/congelar.js';
import { cuentaParaElMotorDePasos } from './ritmo.js';
import { exigeTramoM } from './tramo.js';

/**
 * El tope de la reserva de la fuente de fondo. **Cinco, en un solo sitio.**
 *
 * Lo fija `quests.md` decisión 4 y sale de lo que cabe en un resumen legible, no de
 * lo que se puede simular. Vale solo para la reserva: los pasos de una salida
 * activa se gastan según se generan y no necesitan techo, porque quien juega está
 * delante viéndolos ocurrir.
 */
export const TOPE_DE_RESERVA = 5;

function exigeMetros(metros, quien) {
  if (!Number.isFinite(metros) || metros < 0) {
    throw new Error(`${quien}: llegaron ${JSON.stringify(metros) ?? String(metros)} metros, y hacen falta metros finitos y no negativos`);
  }
  return metros;
}

/**
 * Los metros de una traza que cuentan para el motor.
 *
 * Cuentan los andando **y los ambiguos**, y no cuentan los de vehículo ni las
 * paradas. La asimetría no se reimplementa aquí: se lee de `cuentaParaElMotorDePasos`,
 * que es el mismo módulo del que la medición del tramo saca la respuesta contraria.
 * Una traza entera en vehículo da cero, que es un total y no un error; un segmento
 * sin clasificar sí es un error, porque suponer que se andaba es exactamente lo que
 * haría que un viaje en tren moviera el mundo.
 */
export function metrosQueCuentan(traza) {
  const segmentos = Array.isArray(traza) ? traza : traza?.segmentos;
  if (!Array.isArray(segmentos)) {
    throw new Error(`traza mal formada: se esperaba una lista de segmentos { metros, clasificacion } o un objeto con "segmentos", y llegó ${JSON.stringify(traza) ?? String(traza)}`);
  }
  let total = 0;
  segmentos.forEach((seg, i) => {
    if (!seg || typeof seg !== 'object') {
      throw new Error(`el segmento ${i} de la traza no es un objeto { metros, clasificacion }: llegó ${JSON.stringify(seg) ?? String(seg)}`);
    }
    let cuenta;
    try {
      cuenta = cuentaParaElMotorDePasos(seg.clasificacion ?? seg.modo);
    } catch (e) {
      throw new Error(`el segmento ${i} de la traza no se puede contar para el motor de pasos: ${e.message}`);
    }
    const metros = exigeMetros(seg.metros, `el segmento ${i} de la traza`);
    if (cuenta) total += metros;
  });
  return total;
}

// Metros de una entrega, venga como número ya contado o como traza clasificada.
function metrosDeLaEntrega(entrada, quien) {
  if (Array.isArray(entrada) || (entrada && typeof entrada === 'object')) return metrosQueCuentan(entrada);
  return exigeMetros(entrada, quien);
}

/**
 * Abre la conversión de una salida, **congelando el tramo con el que se abrió**.
 *
 * El tramo no cambia a mitad de salida: SPEC-004 lo corrige al cerrar con la medida
 * de esa misma salida, así que usar el estimado vivo haría que la misma caminata se
 * convirtiera en un número de pasos distinto según cuándo se mirara. Y los pasos ya
 * ejecutados no se recalculan nunca: el resto sigue guardado **en metros** para que
 * corregir el tramo no reescale hacia atrás lo ya andado.
 */
export function abreSalidaDePasos({ motor, tramo }) {
  if (!motor || typeof motor.avanza !== 'function' || typeof motor.registro !== 'function') {
    throw new Error('abreSalidaDePasos necesita el motor de pasos del mapa activo: sin él no hay contador que avanzar');
  }
  const tramoM = exigeTramoM(tramo, 'la conversión de metros andados en pasos');
  const registro = motor.registro();

  return {
    tramoM,

    /** Los metros que aún no completan un paso, en metros y guardados con la partida. */
    restoM() {
      return registro.restoM;
    },

    /**
     * Anda: convierte una entrega de metros —un número ya contado o una traza
     * clasificada— en pasos, que se ejecutan **durante la caminata** y no al echar
     * el telón. Sin ellos, «el jugador se puede adelantar a su propia fama» sería
     * mentira.
     *
     * El troceado no cambia el resultado: veinte muestras de 100 m y una de 2 000 m
     * dan los mismos pasos y el mismo resto, porque lo que no completa un paso se
     * acumula en lugar de perderse en cada muestra.
     */
    anda(entrada) {
      const metros = metrosDeLaEntrega(entrada, 'los metros andados de la salida');
      const dados = [];
      registro.restoM += metros;
      // El resto se descuenta **después** de que el paso se haya ejecutado: si un
      // productor hace fallar el paso, los metros siguen ahí y no se pierden.
      while (registro.restoM >= tramoM) {
        const [paso] = motor.avanza(1);
        registro.restoM -= tramoM;
        dados.push(paso);
      }
      return congelaHondo({ pasos: dados, restoM: registro.restoM });
    },
  };
}

/**
 * Los kilómetros del día a día, la fuente de fondo.
 *
 * @param {object} opciones
 *   `motor` el del mapa activo; `metros` lo que haya leído al abrir la app quien lea
 *   la app de salud; `activos` si el modo está encendido, que llega **como dato de
 *   la partida** —el núcleo no sabe qué es un permiso de salud ni consulta ningún
 *   ajuste—; `tramo` el tramo personal.
 *
 * Con la reserva llena los kilómetros extra **se descartan enteros y sin dejar
 * resto**: el contador no salta, no se apunta nada para ejecutar después y no queda
 * deuda. Es la promesa entera de «volver tras tres meses equivale a volver tras
 * tres días», y guardar el resto sería acumular mundo pendiente por la puerta de
 * atrás. Que la reserva se desborde no le quita nada a nadie: un paso es tiempo del
 * mundo, no una recompensa.
 */
export function kilometrosDeFondo({ motor, metros, activos, tramo }) {
  if (!motor || typeof motor.avanza !== 'function' || typeof motor.registro !== 'function') {
    throw new Error('kilometrosDeFondo necesita el motor de pasos del mapa activo: la reserva es la de ese mapa');
  }
  if (activos !== true && activos !== false) {
    throw new Error(
      `kilometrosDeFondo necesita saber si los pasos de fondo están activos y llegó ${JSON.stringify(activos) ?? String(activos)}: ` +
      'es un dato de la partida —vienen apagados de origen— y el núcleo no lo consulta a ninguna capa de la plataforma',
    );
  }
  const registro = motor.registro();
  const m = exigeMetros(metros, 'los kilómetros de fondo');
  if (!activos) {
    return congelaHondo({ pasos: [], descartadosM: 0, enLaReserva: registro.reserva.length });
  }

  const tramoM = exigeTramoM(tramo, 'la conversión de kilómetros de fondo en pasos');
  const dados = [];
  registro.restoFondoM += m;
  while (registro.restoFondoM >= tramoM && registro.reserva.length < TOPE_DE_RESERVA) {
    const [paso] = motor.avanza(1);
    registro.restoFondoM -= tramoM;
    // Los pasos de la reserva son pasos normales, ya ejecutados: llevan su número
    // correlativo del mismo contador y su azar. Lo que la reserva guarda es lo que
    // queda **por narrar**, no lo que queda por ejecutar.
    registro.reserva.push(paso);
    dados.push(paso);
  }

  let descartadosM = 0;
  if (registro.reserva.length >= TOPE_DE_RESERVA) {
    descartadosM = registro.restoFondoM;
    registro.restoFondoM = 0;
  }
  return congelaHondo({ pasos: dados, descartadosM, enLaReserva: registro.reserva.length });
}

/** Cuántos pasos sin narrar hay en la reserva de este mapa. No la toca. */
export function tamanoDeLaReserva(motor) {
  return motor.registro().reserva.length;
}

/**
 * Vacía la reserva: entrega sus pasos en el orden en que se ejecutaron y la deja
 * vacía. Una reserva vacía devuelve una lista vacía, que no es un error.
 *
 * Vaciarla no quita nada del mundo —los pasos ya ocurrieron y su número sigue
 * dado—: lo que se lleva es lo que quedaba por contar. Redactar ese resumen es de
 * la fila 42, y aquí no se exporta ni un texto.
 */
export function vaciaReserva(motor) {
  const registro = motor.registro();
  const pasos = congelaHondo(registro.reserva.slice());
  registro.reserva = [];
  return pasos;
}
