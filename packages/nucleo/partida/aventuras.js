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
import { castAll } from '../quests/casting.js';
import { SIN_DESCARTES, exigeDescartes, hayDescartes } from './descartes.js';
import { TRAMOS_DEL_ESTIRON, dimensionaSalida } from './salida.js';
import { exigeTramoM } from './tramo.js';
import { MOTIVOS_DE_FALTA, normalizaCriterios, trazaLazo } from './filtro.js';

// El estirón vive en `salida.js` desde SPEC-035 —es un tramo más de alcance de salida, y
// desde allí lo pide también la alarma de los descartes— y se reexporta desde aquí para
// que nadie tenga que cambiar de sitio para pedirlo.
export { TRAMOS_DEL_ESTIRON };

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
 *   aceptar la oferta; `descartes` la vista de los sitios que quien juega marcó, que
 *   **saca candidatos del casting sin resembrar nada**.
 * @returns `{ hayReparto: true, aventuras }` con **todas** las plantillas que
 *   castean, cada una con su lazo y sus declaraciones; o la falta de reparto con su
 *   oferta. La lista es la misma con criterios y sin ellos: el número de aventuras
 *   ofrecidas no puede depender de por dónde puede andar quien juega.
 */
export function repartoDeAventuras({ mundo, criterios = [], tramo, tamano = 'aventura', tramosDeMas = 0, descartes = SIN_DESCARTES }) {
  const activos = normalizaCriterios(criterios);
  const tramoM = exigeTramoM(tramo, 'el reparto de aventuras');
  const marcados = exigeDescartes(descartes, 'el reparto de aventuras');
  const salida = dimensionaSalida(tamano, tramoM);
  const alcanceEnTramos = salida.tramos + tramosDeMas;
  const alcanceM = alcanceEnTramos * tramoM;

  if (!mundo?.viario) {
    throw new Error(
      'el reparto de aventuras necesita el mundo con su grafo viario (world.viario), que es lo que genera buildWorld: ' +
      'sin él no hay por dónde trazar el lazo',
    );
  }

  // El casting que llega con el mundo es el de un mundo sin marcar. Con descartes se
  // vuelve a castear —barato, y sin tocar ni un byte de la celda: SPEC-009 lo dejó fuera
  // del documento congelado— y el reparto puede cambiar, incluso en plantillas donde el
  // sitio marcado era candidato y no elegido.
  const casting = hayDescartes(marcados) ? castAll(mundo, mundo.seed, { descartes: marcados }) : mundo.casting ?? [];
  const candidatas = casting.filter((c) => c.ok);
  if (!candidatas.length) {
    // No es cosa del filtro y no se le atribuye. Sí puede ser cosa de los descartes, y
    // eso se decide con la misma regla de siempre: solo si sin ellos había algo.
    return faltaDeReparto({ motivo: motivoDeLaFalta({ mundo, aventuras: [], activos, marcados, alcanceM, tramoM }), alcanceEnTramos });
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
  return faltaDeReparto({
    motivo: motivoDeLaFalta({ mundo, aventuras, activos, marcados, alcanceM, tramoM }),
    alcanceEnTramos,
  });
}

/**
 * A qué se le echa la culpa de que no haya reparto, con **una sola regla de atribución**
 * aplicada a los dos culpables posibles: se le atribuye a algo que quien juega puso solo
 * si **sin ello** había reparto.
 *
 * El orden importa y es el de la spec: primero los descartes, después el filtro, y el
 * mundo pequeño de último. Un barrio de tres calles que nunca dio para un lazo sigue
 * declarando el mundo aunque haya sitios marcados: no se le echa la culpa a quien juega
 * de algo que ya pasaba.
 */
function motivoDeLaFalta({ mundo, aventuras, activos, marcados, alcanceM, tramoM }) {
  if (hayDescartes(marcados) && algunaCabiaSin({ mundo, criterios: activos, alcanceM, tramoM })) {
    return MOTIVOS_DE_FALTA.DESCARTES;
  }
  if (activos.length > 0 && aventuras.some((a) => a.cabiaSinCriterios)) return MOTIVOS_DE_FALTA.FILTRO;
  return MOTIVOS_DE_FALTA.MUNDO;
}

// El mismo mundo **ignorando los descartes**, que es lo que distingue el motivo de los
// descartes del motivo del mundo, exactamente como el filtro se distingue hoy del mundo
// pequeño. Se calcula solo cuando hay descartes que atribuir.
function algunaCabiaSin({ mundo, criterios, alcanceM, tramoM }) {
  return (mundo.casting ?? []).some((c) => {
    if (!c.ok) return false;
    const puntos = c.beats.map((b) => ({ x: b.lugar.x, y: b.lugar.y }));
    const lazo = trazaLazo({ grafo: mundo.viario, puntos, criterios, tramo: tramoM });
    return lazo.trazado && lazo.metros <= alcanceM;
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
