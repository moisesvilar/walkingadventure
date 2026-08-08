// Lo que hay hoy: las aventuras que el mundo de una celda puede ofrecer, cada una
// con su lazo ya trazado y con lo que ese lazo tenga que declarar.
//
// Aquí vive la otra mitad de «evita y declara»: **ninguna opción es peor juego**.
// El filtro no quita aventuras de la lista —dos personas con criterios distintos
// reciben las mismas, con los mismos beats—, solo cambia el trazado y lo que hay
// que decir. Y cuando el filtro deja el mundo sin ni un lazo que quepa, no se
// inventa nada: se entrega la falta de reparto con la oferta de alejarse un tramo
// más, que es un dato y no una acción. Quien decide es quien juega.

import { congelaHondo } from '../core/congelar.js';
import { dimensionaSalida } from './salida.js';
import { exigeTramoM } from './tramo.js';
import { MOTIVOS_DE_FALTA, normalizaCriterios, trazaLazo } from './filtro.js';

/**
 * Cuánto se sugiere alejarse cuando no hay reparto. Uno, literalmente: `bucle-
 * jugable.md` §7 dice «alejarse un tramo más», y calcular el mínimo suficiente
 * obligaría a repartir varias veces antes de preguntar.
 */
export const TRAMOS_DEL_ESTIRON = 1;

// Los motivos son los del filtro y no una copia: el trazado ya devuelve uno de
// ellos por su cuenta, y dos catálogos acabarían diciendo cosas distintas.
export { MOTIVOS_DE_FALTA };

/**
 * La falta de reparto con su oferta. **Es un dato**: nada se ha ampliado al
 * devolverlo, y si nadie responde el alcance de la salida sigue siendo el mismo.
 */
export function faltaDeReparto({ motivo, alcanceEnTramos }) {
  return congelaHondo({
    hayReparto: false,
    motivo,
    estiron: {
      tramosMas: TRAMOS_DEL_ESTIRON,
      alcanceEnTramos: alcanceEnTramos + TRAMOS_DEL_ESTIRON,
      aceptado: false,
    },
  });
}

/**
 * Las aventuras de un mundo, con los caminos que se evitan aplicados al trazado.
 *
 * @param {object} opciones
 *   `mundo` el mundo ya generado —del que se leen su casting y su grafo, y al que
 *   no se le toca ni un dato—; `criterios` los caminos que se evitan, inyectados;
 *   `tramo` el tramo personal; `tamano` cuál de los tres tamaños de salida se pide;
 *   `tramosDeMas` cuánto se ha estirado ya el alcance, que es lo que crece al
 *   aceptar la oferta.
 * @returns `{ hayReparto: true, aventuras }` con **todas** las plantillas que
 *   castean, cada una con su lazo y sus declaraciones; o la falta de reparto con su
 *   oferta. La lista es la misma con criterios y sin ellos: el número de aventuras
 *   ofrecidas no puede depender de por dónde puede andar quien juega.
 */
export function repartoDeAventuras({ mundo, criterios = [], tramo, tamano = 'aventura', tramosDeMas = 0 }) {
  const activos = normalizaCriterios(criterios);
  const tramoM = exigeTramoM(tramo, 'el reparto de aventuras');
  const salida = dimensionaSalida(tamano, tramoM);
  const alcanceEnTramos = salida.tramos + tramosDeMas;
  const alcanceM = alcanceEnTramos * tramoM;

  if (!mundo?.viario) {
    throw new Error(
      'el reparto de aventuras necesita el mundo con su grafo viario (world.viario), que es lo que genera buildWorld: ' +
      'sin él no hay por dónde trazar el lazo',
    );
  }

  const candidatas = (mundo.casting ?? []).filter((c) => c.ok);
  if (!candidatas.length) {
    // No es cosa del filtro y no se le atribuye: en este mundo no hay ni una
    // plantilla que montar, con criterios o sin ellos.
    return faltaDeReparto({ motivo: MOTIVOS_DE_FALTA.MUNDO, alcanceEnTramos });
  }

  const aventuras = candidatas.map((c) => {
    const puntos = c.beats.map((b) => ({ x: b.lugar.x, y: b.lugar.y }));
    const sinCriterios = trazaLazo({ grafo: mundo.viario, puntos, criterios: [], tramo: tramoM });
    const lazo = activos.length
      ? trazaLazo({ grafo: mundo.viario, puntos, criterios: activos, tramo: tramoM })
      : sinCriterios;
    return {
      plantilla: c.tpl.id,
      beats: c.beats,
      lazo,
      cabe: lazo.trazado && lazo.metros <= alcanceM,
      cabiaSinCriterios: sinCriterios.trazado && sinCriterios.metros <= alcanceM,
    };
  });

  if (aventuras.some((a) => a.cabe)) {
    return { hayReparto: true, alcanceM, alcanceEnTramos, criterios: activos, aventuras };
  }
  // Ninguna cabe. El motivo es el filtro solo si sin él alguna cabía: si tampoco
  // cabía ninguna, el mundo es pequeño y decir «es por tus ajustes» sería mentir.
  const porElFiltro = activos.length > 0 && aventuras.some((a) => a.cabiaSinCriterios);
  return faltaDeReparto({
    motivo: porElFiltro ? MOTIVOS_DE_FALTA.FILTRO : MOTIVOS_DE_FALTA.MUNDO,
    alcanceEnTramos,
  });
}

/**
 * Aceptar la oferta: se vuelve a repartir con el alcance ampliado y **el filtro
 * sigue igual de activo**. No se genera ni se resiembra nada del mundo; lo único
 * que cambia es hasta dónde te mandan, que es exactamente lo que el tramo puede
 * mover (`accesibilidad.md` §1).
 */
export function aceptaElEstiron(peticion) {
  return repartoDeAventuras({ ...peticion, tramosDeMas: (peticion.tramosDeMas ?? 0) + TRAMOS_DEL_ESTIRON });
}
