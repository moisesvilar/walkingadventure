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
/**
 * La clasificación de una posición que todavía no ha formado ningún segmento.
 *
 * **Ambiguo y no parada**: con un solo fijo no hay velocidad que medir, y `ritmo.js` cuenta
 * lo ambiguo a favor de quien anda. Un falso ambiguo regala unos metros al principio de una
 * salida; un falso parada se los quita, y la asimetría de `accesibilidad.md` dice hacia qué
 * lado se falla.
 */
export const SIN_SEGMENTO_TODAVIA = 'ambiguo';

/**
 * El seguidor de una salida abierta: la última posición de la única suscripción, ya
 * clasificada por el detector del núcleo y proyectada a metros del mundo.
 *
 * **Aquí no se clasifica nada.** La clasificación se lee del último segmento de la traza
 * que produce `partida/transporte.js`; calcularla aquí partiría en dos una decisión que el
 * núcleo ya toma, y es justo lo que la cabecera de este módulo prohíbe.
 *
 * **Y aquí no se proyecta nada tampoco.** La conversión de grados a metros del mundo es
 * `makeProjector` de `core/geo.js`, inyectado desde `app/nucleo/piezas.js`: cuantiza al
 * proyectar, y una trigonometría paralela escrita en la app daría puntos que no cuadran con
 * los del mundo congelado.
 *
 * **Y el sitio se resuelve, no se inventa.** Hasta SPEC-044 el cuarto campo del contrato iba
 * siempre a `null` por construcción, y su comentario lo declaraba: está bien declarado y no
 * protestaba nadie el día que la fila que tenía que rellenarlo se olvidara (§8b). Ahora se
 * resuelve contra el índice de geofences del mapa activo, y **montarse sin él falla nombrando
 * lo que falta**: la ausencia no es un estado legítimo del mundo —siempre hay mundo levantado
 * cuando hay salida abierta—, así que se cierra por contrato, que es más fuerte que declararla.
 *
 * @param {object} piezas
 *   `fuente` la de `plataforma/posiciones.js`, que entrega la última posición cruda;
 *   `traza` la de la salida, de la que sale la clasificación; `origen` el `{lat, lon}` del
 *   mundo congelado, que es el cero de sus metros; `nucleo` con `makeProjector`; `sitios` el
 *   índice de geofences del mapa activo, el que devuelve `sitiosConPosicion(mundo)`.
 */
export function creaSeguidorDeLaSalida({ fuente, traza, origen, nucleo, sitios }) {
  if (!fuente || typeof fuente.posicion !== 'function') {
    throw new Error(`el seguidor de la salida se monta con la fuente de posiciones y llegó ${JSON.stringify(fuente) ?? String(fuente)}`);
  }
  if (!traza || typeof traza.muestrea !== 'function' || typeof traza.traza !== 'function') {
    throw new Error(
      `el seguidor de la salida se monta con la traza clasificada y llegó ${JSON.stringify(traza) ?? String(traza)}: ` +
      'sin ella la posición llegaría sin clasificar y el mundo avanzaría con los kilómetros de un tren',
    );
  }
  if (typeof nucleo?.makeProjector !== 'function') {
    throw new Error('el seguidor de la salida necesita "makeProjector" del núcleo inyectado: los metros del mundo no se calculan dos veces');
  }
  if (!origen || !Number.isFinite(origen.lat) || !Number.isFinite(origen.lon)) {
    throw new Error(`el seguidor de la salida se monta sobre el origen del mundo congelado y llegó ${JSON.stringify(origen) ?? String(origen)}`);
  }
  if (!(sitios instanceof Map)) {
    throw new Error(
      `el seguidor de la salida se monta con el índice de geofences del mapa activo (sitiosConPosicion(mundo)) y llegó ${JSON.stringify(sitios) ?? String(sitios)}: ` +
      'sin él el sitio bajo la marca sería nulo por construcción, que es indistinguible de estar en medio del monte',
    );
  }
  const proyector = nucleo.makeProjector(origen.lat, origen.lon);

  /**
   * El sitio en cuyo geofence se está, o `null`. **El más cercano cuando hay solapados**, que
   * es el mismo criterio con el que SPEC-032 ordena dos llegadas validadas a la vez: dos
   * criterios distintos para lo mismo es cómo se desincronizan.
   */
  const sitioEn = (punto) => {
    let cerca = null;
    for (const [nombre, geofence] of sitios) {
      const distanciaM = Math.hypot(punto.x - geofence.x, punto.y - geofence.y);
      if (distanciaM > geofence.radioM) continue;
      if (cerca === null || distanciaM < cerca.distanciaM || (distanciaM === cerca.distanciaM && nombre < cerca.nombre)) {
        cerca = { nombre, distanciaM };
      }
    }
    return cerca === null ? null : cerca.nombre;
  };

  return creaSeguidorDePosicion({
    lee() {
      const cruda = fuente.posicion();
      if (cruda == null) return null;
      const segmentos = traza.traza().segmentos;
      const ultimo = segmentos.length ? segmentos[segmentos.length - 1] : null;
      const punto = proyector.toXY(cruda.lat, cruda.lon);
      return {
        clasificacion: ultimo ? ultimo.clasificacion : SIN_SEGMENTO_TODAVIA,
        x: punto.x,
        y: punto.y,
        // Fuera de todos los geofences sigue siendo `null`, que ahí sí es la respuesta
        // honesta: no es que no se haya consultado, es que no hay ninguno debajo.
        sitio: sitioEn(punto),
      };
    },
  });
}

export function seguidorSinMontar(motivo = 'no montado todavía: la app no trae módulo de ubicación en marcha, y ninguna spec ha nombrado la dependencia que lo daría') {
  return {
    montado: false,
    motivo,
    posicion() {
      throw new Error(`no se puede seguir la posición: ${motivo}`);
    },
  };
}
