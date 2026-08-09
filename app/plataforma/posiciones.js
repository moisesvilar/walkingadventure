// La fuente de posiciones de la salida: lo que entrega `{ lat, lon, tMs, precisionM }`
// mientras el rótulo del sistema sostiene el permiso «mientras se usa».
//
// **La marca de tiempo viaja dentro de cada posición**, y eso no es un detalle de
// formato: es lo que hace que el núcleo no tenga reloj. El plazo de noventa minutos y
// el minuto de permanencia del regreso se miden comparando marcas recibidas, así que se
// pueden afirmar en `node --test` sin esperar noventa minutos.
//
// Y una ausencia que es de privacidad y no de comodidad (RF-PRIV-002): **no hay traza**.
// Lo que sale de aquí es la última posición y nada más; no se guarda un histórico, no
// hay lista que crezca y lo único que la partida llega a escribir es el punto de partida
// de la salida en curso, que es un punto y no un rastro.
//
// Sin rótulo no hay fuente: retirado el rótulo se acabó el permiso, y por eso reanudar es
// una acción explícita y nunca una detección.

/**
 * Envuelve el módulo nativo en el contrato que la salida espera.
 *
 * @param {object} piezas
 * @param {() => ({lat:number, lon:number, tMs:number, precisionM?:number, clasificacion?:string}|null)} piezas.lee
 *   la última posición con su marca del sensor. Devolver `null` es una respuesta
 *   prevista —el sensor que todavía no ha entregado nada— y no un error.
 */
export function creaFuenteDePosiciones({ lee }) {
  if (typeof lee !== 'function') {
    throw new Error(
      'la fuente de posiciones se monta con lee() y no llegó ninguna: sin ella la salida se abriría para no recibir jamás una posición, ' +
      'y por tanto para no poder cerrarse nunca por regreso',
    );
  }
  return {
    montado: true,
    motivo: null,

    /** La última posición, o `null`. Nunca se guarda: se lee y se entrega. */
    posicion() {
      const leida = lee();
      if (leida == null) return null;
      if (!Number.isFinite(leida.lat) || !Number.isFinite(leida.lon)) {
        throw new Error(`la fuente ha entregado una posición sin coordenada: llegó ${JSON.stringify(leida) ?? String(leida)}`);
      }
      if (!Number.isInteger(leida.tMs)) {
        throw new Error(
          `la fuente ha entregado una posición sin marca de tiempo (tMs=${JSON.stringify(leida.tMs) ?? String(leida.tMs)}): ` +
          'el tiempo del sensor viaja dentro de cada posición porque el núcleo no lee ningún reloj',
        );
      }
      // Se copian los campos que hacen falta y se tira lo demás aquí, no más adelante:
      // lo que no entra no se puede guardar por descuido. Rumbo, altitud y velocidad se
      // quedan fuera.
      return {
        lat: leida.lat,
        lon: leida.lon,
        tMs: leida.tMs,
        precisionM: Number.isFinite(leida.precisionM) ? leida.precisionM : null,
        clasificacion: leida.clasificacion ?? null,
      };
    },
  };
}

/**
 * Una fuente que **no está montada** y lo dice al usarla.
 *
 * Existe porque esta entrega no trae módulo nativo de ubicación en marcha —SPEC-030 no
 * nombra ninguna dependencia que lo diera— y la alternativa era peor: una fuente que
 * devolviera siempre la misma posición dejaría la salida sin cerrarse jamás por regreso
 * sin que nada protestara.
 */
export function fuenteSinMontar(motivo = 'no montada todavía: la app no trae módulo de ubicación en marcha, y ninguna spec ha nombrado la dependencia que lo daría') {
  return {
    montado: false,
    motivo,
    posicion() {
      throw new Error(`no se pueden leer posiciones de la salida: ${motivo}`);
    },
  };
}
