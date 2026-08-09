// El seguidor de posición del momento en marcha: entrega posiciones **ya clasificadas**
// —andando · parada · vehículo · ambiguo—, como `partida/ritmo.js` exige desde SPEC-004.
//
// Dos cosas que este contrato promete y que son de privacidad, no de comodidad
// (RF-PRIV-002):
//
// - **No hay traza.** Lo que sale de aquí es la última posición y nada más: no se guarda
//   un histórico, no hay lista que crezca y no hay nada que serializar. Este es el
//   momento del juego por el que más posiciones pasan, y lo que sobrevive de todas ellas
//   es nada.
// - **Ninguna marca de tiempo.** Lo que devuelven los módulos de ubicación trae precisión,
//   rumbo, altitud y un sello temporal; aquí se copian la clasificación, el punto y el
//   sitio, y lo demás se tira en el sitio donde llega.
//
// Y una que es de frontera: **la clasificación llega hecha**. La detección de vehículo es
// de otra fila y el núcleo no la calcula; mover esa decisión aquí la partiría en dos.

/** Las clasificaciones que el núcleo admite. Las mismas de `partida/ritmo.js`. */
export const CLASIFICACIONES = ['andando', 'parada', 'vehiculo', 'ambiguo'];

/**
 * Envuelve el módulo nativo en el contrato que el momento en marcha espera.
 *
 * @param {object} piezas
 * @param {() => ({clasificacion: string, x: number, y: number, sitio?: string|null}|null)} piezas.lee
 *   la última posición clasificada, en metros del mundo. Devolver `null` es una respuesta
 *   prevista —el seguidor que no responde— y no un error: entonces el mapa se queda como
 *   estaba y ninguna pantalla lo cuenta como avería del mundo.
 */
export function creaSeguidorDePosicion({ lee }) {
  if (typeof lee !== 'function') {
    throw new Error(
      'el seguidor de posición se monta con lee() y no llegó ninguna: sin él el mapa enseñaría la marca quieta sin que nada protestara, ' +
      'que es la forma de fallo que este proyecto ya ha pagado cinco veces',
    );
  }
  return {
    montado: true,
    motivo: null,

    /** La última posición clasificada, o `null`. Nunca se guarda: se lee y se pinta. */
    posicion() {
      const leida = lee();
      if (leida == null) return null;
      if (!CLASIFICACIONES.includes(leida.clasificacion)) {
        throw new Error(
          `el seguidor ha clasificado la posición como ${JSON.stringify(leida.clasificacion) ?? String(leida.clasificacion)} ` +
          `y las clasificaciones son ${CLASIFICACIONES.join(', ')}: la traza llega clasificada, no cruda`,
        );
      }
      // Se copian los tres campos que hacen falta y se tira lo demás, aquí y no más
      // adelante: lo que no entra no se puede guardar por descuido.
      return { clasificacion: leida.clasificacion, x: leida.x, y: leida.y, sitio: leida.sitio ?? null };
    },
  };
}

/**
 * Un seguidor que **no está montado** y lo dice al usarlo.
 *
 * Existe porque esta entrega no trae módulo nativo de ubicación en marcha —ninguna spec ha
 * nombrado la dependencia que lo daría— y la alternativa era peor: un seguidor que
 * devolviera siempre la misma posición enseñaría un mapa con la marca quieta, que es
 * indistinguible de andar en círculos.
 */
export function seguidorSinMontar(motivo = 'no montado todavía: la app no trae módulo de ubicación en marcha, y ninguna spec ha nombrado la dependencia que lo daría') {
  return {
    montado: false,
    motivo,
    posicion() {
      throw new Error(`no se puede seguir la posición: ${motivo}`);
    },
  };
}
