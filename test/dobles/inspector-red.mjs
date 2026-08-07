// Inspector de tráfico saliente: envuelve la frontera de red y registra qué sale
// de verdad. Es la única manera de afirmar «esto no sale del móvil» en lugar de
// suponerlo, y por eso tiene modo estricto: un observador que solo ve lo que le
// dan no puede afirmar una ausencia.
//
// La frontera que cubre es `fetch`, que es por donde la app habla con el proxy.
// Si algún día se añade otra salida (un cliente de sockets, por ejemplo), aquí
// hay que envolverla también: lo que no se envuelve, en modo estricto, se corta.

function aTexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

/**
 * @param {object} [opciones]
 * @param {boolean} [opciones.estricto=false]  corta cualquier salida a red que no
 *   pase por una dependencia envuelta, nombrando el destino. Se activa al crear
 *   el inspector y se deshace con `suelta()`.
 */
export function creaInspectorDeRed({ estricto = false } = {}) {
  const registro = [];
  let soltado = false;

  // Se guarda el descriptor, no el valor: así `suelta()` deja la frontera
  // exactamente como estaba, incluido el caso de que `fetch` no existiera.
  const descriptorPrevio = estricto ? Object.getOwnPropertyDescriptor(globalThis, 'fetch') : null;

  if (estricto) {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      enumerable: descriptorPrevio ? descriptorPrevio.enumerable : false,
      value: (destino) => {
        throw new Error(
          `salida a red no envuelta hacia ${aTexto(destino && destino.url ? destino.url : destino)}: ` +
          'el inspector está en modo estricto y solo deja pasar lo que envuelve',
        );
      },
    });
  }

  const anota = (destino, opciones) => {
    const o = opciones || {};
    registro.push({
      indice: registro.length,
      destino: typeof destino === 'string' ? destino : aTexto(destino && destino.url ? destino.url : destino),
      metodo: o.method ?? 'GET',
      cabeceras: o.headers ?? {},
      // El cuerpo se guarda tal cual llegó. Recortarlo o normalizarlo escondería
      // justo lo que se quiere poder afirmar que no sale.
      cuerpo: o.body,
    });
  };

  return {
    /**
     * Devuelve la dependencia envuelta. La firma es la de `fetch` porque es la
     * frontera real; cualquier otra dependencia que la respete vale igual.
     */
    envuelve(dependencia) {
      return (destino, opciones) => {
        anota(destino, opciones);
        return dependencia(destino, opciones);
      };
    },

    /** Lo que ha visto salir, en orden. Sin peticiones, lista vacía; nunca un error. */
    peticiones() {
      return registro.map((p) => ({ ...p }));
    },

    /**
     * Si algo de lo que ha salido contiene ese texto: mira todos los destinos,
     * todas las cabeceras y todos los cuerpos. Es la aserción de privacidad —
     * «estas coordenadas no aparecen en ninguna llamada»— y por eso no basta con
     * mirar el cuerpo.
     */
    contiene(texto) {
      return registro.some(
        (p) =>
          p.destino.includes(texto) ||
          aTexto(p.metodo).includes(texto) ||
          aTexto(p.cabeceras).includes(texto) ||
          aTexto(p.cuerpo).includes(texto),
      );
    },

    /** Deja la frontera exactamente como estaba antes de envolverla. Idempotente. */
    suelta() {
      if (!estricto || soltado) return;
      soltado = true;
      if (descriptorPrevio) Object.defineProperty(globalThis, 'fetch', descriptorPrevio);
      else delete globalThis.fetch;
    },
  };
}
