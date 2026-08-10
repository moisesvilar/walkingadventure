// El cliente de las rutas de contenido del proxy ciego: imágenes, fotos y texto, **por lotes**.
//
// El proxy atiende una petición por llamada; el lote es de este lado, y es lo que hace que
// «una tanda de fotos al generar la celda» y «una tanda de ilustraciones al preparar la
// salida» sean de verdad una tanda: todas las peticiones de un lote van con el mismo
// identificador, que es lo que permite al proxy cortar un bucle del cliente antes de que
// llegue mil veces a aguas arriba.
//
// Como el cliente de generación, es **transporte y nada más**: no compone peticiones, no sabe
// qué es un prompt y no degrada. Un «no hay» vuelve tal cual dentro de su sobre, y quien
// decide qué significa es el conseguidor, que es quien tiene el vocabulario de motivos.
//
// El orden de la respuesta es el de la petición, posición a posición. No es un detalle: el
// conseguidor casa cada sobre con su entrada por índice, y descarta el lote entero si no
// cuadran, precisamente para que un desajuste no acabe guardando la ilustración de una taberna
// bajo el nombre de una ermita.

/** Las rutas de contenido que este cliente sabe pedir. Cerrada: las declara `server/proxy.mjs`. */
export const RUTAS_DE_CONTENIDO = Object.freeze(['imagen', 'places', 'texto']);

/**
 * Monta el cliente de una ruta.
 *
 * @param {object} deps
 *   `pide` la puerta de red inyectada; `base` la dirección del proxy; `ruta` cuál de las tres;
 *   `ficha` de dónde sale la ficha de la tanda, que sin ella se va por la vía sin atestación
 *   —una vía declarada del proxy, no una avería—; `lote` el identificador del lote en curso.
 */
export function creaClienteDeLotes({ pide, base, ruta, ficha = null, lote = null }) {
  if (typeof pide !== 'function') {
    throw new Error('el cliente de lotes necesita la puerta de red inyectada: pide(url, opciones) → respuesta');
  }
  if (typeof base !== 'string' || !base) {
    throw new Error('el cliente de lotes necesita la dirección del proxy, y no la adivina');
  }
  if (!RUTAS_DE_CONTENIDO.includes(ruta)) {
    throw new Error(`la ruta "${ruta}" no es una ruta de contenido del proxy: las que hay son ${RUTAS_DE_CONTENIDO.join(', ')}`);
  }
  const url = `${base.replace(/\/+$/, '')}/${ruta}`;

  /** Un sobre de «no hay», que es lo que el proxy responde cuando no puede servir. */
  const noHay = () => ({ tipo: ruta, hay: false });

  return {
    url,
    ruta,

    /**
     * Pide un lote entero y devuelve un sobre por petición, **en el mismo orden**.
     *
     * Nunca lanza: un fallo de transporte en una petición es un «no hay» en su posición. Que
     * el proveedor no esté es un estado del mundo y lo resuelve el fallback; lo que sí sería
     * una avería —que no haya transporte— ya falló al construir esto.
     */
    async pideLote(peticiones) {
      const lista = Array.isArray(peticiones) ? peticiones : [];
      const sobres = [];
      for (const peticion of lista) {
        // Una ficha **por petición**, no una por lote: el proxy gasta la ficha en cada
        // llamada de pago, así que reutilizarla dejaría todo el lote menos la primera
        // imagen rechazado con «hay que volver a atestar» — y como aquí un rechazo se
        // convierte en «no hay», el lote entero saldría con textos de plantilla sin que
        // nada lo dijera. Lo que sí es de todo el lote es el identificador, que es lo que
        // le permite al proxy cortar un bucle.
        const emitida = ficha ? await ficha() : null;
        const cuerpo = { peticion };
        if (emitida) cuerpo.ficha = emitida;
        if (lote) cuerpo.lote = lote;
        try {
          const respuesta = await pide(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo),
          });
          if (!respuesta || respuesta.status !== 200 || typeof respuesta.json !== 'function') {
            sobres.push(noHay());
            continue;
          }
          const sobre = await respuesta.json();
          sobres.push(sobre && sobre.tipo === ruta ? sobre : noHay());
        } catch {
          // Lo que dijo el transporte se descarta entero: puede traer la clave, la URL con la
          // clave dentro o el cuerpo que se mandó.
          sobres.push(noHay());
        }
      }
      return sobres;
    },
  };
}
