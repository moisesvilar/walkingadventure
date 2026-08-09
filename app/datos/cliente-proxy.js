// El cliente de la ruta de generación del proxy ciego. Es el transporte y nada más:
// compone el sobre que `server/proxy.mjs` declara, lo manda y devuelve lo que vino
// dentro. No sabe qué es una celda, ni qué es un mundo, ni construye la consulta.
//
// Dos cosas que **no** hace, y las dos son de diseño y no de pereza:
//
// 1. **No reintenta.** Los eslabones y los plazos los encadena el proxy aguas
//    arriba (SPEC-024), que es quien sabe cuánto queda del presupuesto de datos. Un
//    reintento aquí sería un segundo presupuesto encima del primero, y el minuto de
//    RNF-PER-001 dejaría de ser un número.
// 2. **No degrada.** Cuando el LLM o las fotos no están, la aventura sigue con
//    textos de plantilla y nadie menciona la red; cuando no hay datos de OSM **no
//    hay mapa que levantar**. Aquí un «no hay» es un fallo honesto y reintentable, y
//    se distingue por su motivo de un fallo de transporte.

/** Los motivos por los que no se pudieron traer los datos. Cerrado: lo que no esté aquí no es un final. */
export const MOTIVOS_DE_FALLO = Object.freeze(['no-se-pudo-pedir', 'rechazado', 'sin-datos', 'respuesta-ilegible']);

/**
 * Un fallo al pedir los datos, con su motivo del catálogo cerrado.
 *
 * El motivo es para el diagnóstico y **nunca para la pantalla**: lo que la jugadora
 * lee es una línea en voz de mundo que no nombra la red, y quien la compone es la
 * pantalla, no esto.
 */
export class FalloDeDatos extends Error {
  constructor(motivo, detalle) {
    if (!MOTIVOS_DE_FALLO.includes(motivo)) {
      throw new Error(`motivo de fallo desconocido "${motivo}": los declarados son ${MOTIVOS_DE_FALLO.join(', ')}`);
    }
    super(`no se pudieron traer los datos del mundo (${motivo})${detalle ? `: ${detalle}` : ''}`);
    this.name = 'FalloDeDatos';
    this.motivo = motivo;
  }
}

/** La ruta de generación del proxy. Es la única que este cliente conoce. */
export const RUTA_DE_GENERACION = '/generacion';

/**
 * Monta el cliente.
 *
 * @param {object} deps
 * @param {(url: string, opciones: object) => Promise<object>} deps.pide  la puerta de
 *   red, inyectada. Sin ella esto no se construye: una capa de datos que se monta
 *   sin transporte y falla al primer mapa es la pieza que, al no estar, no protesta.
 * @param {string} deps.base  la dirección del proxy.
 * @param {() => Promise<object|null>} [deps.ficha]  de dónde sale la ficha de la
 *   tanda. Sin ficha se va por la vía sin atestación, que es una vía declarada del
 *   proxy y no una avería: sirve lo ya cacheado y no hace ninguna llamada de pago.
 * @param {object|null} [deps.lote]  el identificador de lote, si quien llama lo lleva.
 */
export function creaClienteDeProxy({ pide, base, ficha = null, lote = null }) {
  if (typeof pide !== 'function') {
    throw new Error('el cliente del proxy necesita la puerta de red inyectada: pide(url, opciones) → respuesta');
  }
  if (typeof base !== 'string' || !base) {
    throw new Error('el cliente del proxy necesita la dirección del proxy, y no la adivina');
  }
  if (ficha !== null && typeof ficha !== 'function') {
    throw new Error('la ficha del cliente del proxy se pide con una función: ficha() → { kid, nonce, firma } o nulo');
  }
  const url = `${base.replace(/\/+$/, '')}${RUTA_DE_GENERACION}`;

  return {
    url,

    /**
     * Pide una consulta de Overpass y devuelve lo que vino dentro del sobre.
     *
     * @param {{ql: string}} consulta
     * @returns {Promise<{elements: object[], deCache: boolean}>}
     * @throws {FalloDeDatos} con su motivo. Nunca devuelve una respuesta a medias.
     */
    async pideGeneracion(consulta) {
      if (!consulta || typeof consulta.ql !== 'string' || !consulta.ql) {
        throw new Error('pideGeneracion necesita la consulta de Overpass ya construida: { ql }');
      }
      const cuerpo = { peticion: { consulta: { ql: consulta.ql } } };
      if (ficha) {
        const emitida = await ficha();
        if (emitida) cuerpo.ficha = emitida;
      }
      if (lote) cuerpo.lote = lote;

      let respuesta;
      try {
        respuesta = await pide(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
        });
      } catch (e) {
        // Lo que dijo el transporte se descarta entero y no viaja a ninguna pantalla:
        // aquí solo importa que no se pudo pedir.
        throw new FalloDeDatos('no-se-pudo-pedir', e && e.message ? e.message : String(e));
      }

      if (!respuesta || typeof respuesta.status !== 'number' || typeof respuesta.json !== 'function') {
        throw new FalloDeDatos('respuesta-ilegible', 'la puerta de red no devolvió una respuesta con estado y cuerpo');
      }
      if (respuesta.status === 401) throw new FalloDeDatos('rechazado', 'hay que volver a atestar');
      if (respuesta.status !== 200) throw new FalloDeDatos('no-se-pudo-pedir', `el proxy respondió ${respuesta.status}`);

      let sobre;
      try {
        sobre = await respuesta.json();
      } catch (e) {
        throw new FalloDeDatos('respuesta-ilegible', e && e.message ? e.message : String(e));
      }
      if (!sobre || sobre.tipo !== 'generacion') {
        throw new FalloDeDatos('respuesta-ilegible', `el sobre no es de la ruta de generación (tipo "${sobre && sobre.tipo}")`);
      }
      // «No hay» es una respuesta normal del sobre —tope diario, cuota de la vía sin
      // atestación, aguas arriba caído— y aun así aquí es un fallo: sin datos de OSM
      // no hay mapa que levantar, y congelar una celda vacía sería exactamente la
      // degradación silenciosa que este proyecto ya ha pagado cinco veces.
      if (sobre.hay !== true) throw new FalloDeDatos('sin-datos', sobre.error ? String(sobre.error) : null);

      const contenido = sobre.contenido;
      if (!contenido || !Array.isArray(contenido.elements)) {
        throw new FalloDeDatos('respuesta-ilegible', 'el contenido no trae la lista de elementos de Overpass');
      }
      return { elements: contenido.elements, deCache: sobre.deCache === true };
    },
  };
}
