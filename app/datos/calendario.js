// El calendario de la partida, del lado de la app: es aquí donde vive el reloj.
//
// El núcleo declara la frontera (`partida/calendario.js`) y no la implementa, porque
// `packages/nucleo/` no lee `Date` ni nada que se le parezca: mismo estado y mismo mundo
// tienen que dar el mismo resultado en cualquier máquina y a cualquier hora. Lo que cambia
// de un día a otro entra por esta puerta y por ninguna más.
//
// El día es **un contador de días enteros desde que empezó la partida**, no una fecha: sin
// zona horaria, sin calendario y sin nada que traduzca. El día cero es el primero.

/** Los milisegundos de un día. La única aritmética de tiempo de todo el juego. */
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * El calendario de una partida que empezó en un instante dado.
 *
 * @param {object} opciones
 *   `arrancadaEn` el instante en que se creó la partida, en milisegundos; `ahora` de dónde
 *   sale el instante actual, inyectado para poder recorrer varios días en `node --test` sin
 *   esperar ninguno.
 */
export function creaCalendario({ arrancadaEn, ahora = () => Date.now() }) {
  if (!Number.isFinite(arrancadaEn)) {
    throw new Error(
      `el calendario de la partida necesita saber cuándo empezó y llegó ${JSON.stringify(arrancadaEn) ?? String(arrancadaEn)}: ` +
      'sin ese instante el día de hoy no se puede contar, y contarlo desde cero cada vez que se abre la app haría que el día uno durase para siempre',
    );
  }
  if (typeof ahora !== 'function') {
    throw new Error('el calendario recibe de dónde sale el instante actual como función, para que se pueda doblar sin tocar el reloj del sistema');
  }
  return {
    arrancadaEn,
    /** El día de hoy, entero y no negativo. Un reloj que va hacia atrás no da días negativos. */
    dia() {
      const transcurrido = ahora() - arrancadaEn;
      if (!Number.isFinite(transcurrido)) {
        throw new Error('el instante actual no es un número: el calendario no inventa un día cuando no lo sabe');
      }
      return Math.max(0, Math.floor(transcurrido / MS_POR_DIA));
    },
  };
}

/**
 * El **reloj de pared** de SPEC-034: el minuto del día, y nada más.
 *
 * Vive aquí por lo mismo que el calendario: `packages/nucleo/` no lee `Date`, así que el
 * único sitio de la app donde se mira la hora es esta puerta. Lo consume la escena de un
 * beat de franja para decidir qué variante se lee, y **el minuto se usa y no se guarda**
 * (RF-PRIV-002): lo que queda anotado en la partida es la variante, nunca la hora.
 *
 * Devuelve una función y no un objeto porque eso es lo que el núcleo exige: `varianteDelBeat`
 * comprueba `typeof reloj !== 'function'` y falla nombrando el reloj si no está cableado, en
 * lugar de resolver todas las llegadas como si fueran dentro de la franja.
 */
export function relojDePared({ ahora = () => new Date() } = {}) {
  if (typeof ahora !== 'function') {
    throw new Error('el reloj de pared recibe de dónde sale el instante actual como función, para que se pueda doblar sin tocar el reloj del sistema');
  }
  return () => {
    const instante = ahora();
    const horas = instante?.getHours?.();
    const minutos = instante?.getMinutes?.();
    if (!Number.isInteger(horas) || !Number.isInteger(minutos)) {
      throw new Error('el reloj de pared no ha podido leer la hora del sistema: el minuto del día no se inventa cuando no se sabe');
    }
    return horas * 60 + minutos;
  };
}

/**
 * Un calendario parado en un día concreto.
 *
 * No es un doble de pruebas escondido en producción: es lo que consume la revisión del render
 * y cualquier pantalla que se quiera mirar en un día que todavía no ha llegado.
 */
export function calendarioEnElDia(dia) {
  if (!Number.isInteger(dia) || dia < 0) {
    throw new Error(`un calendario parado se para en un día entero no negativo y llegó ${JSON.stringify(dia) ?? String(dia)}`);
  }
  return { arrancadaEn: null, dia: () => dia };
}
