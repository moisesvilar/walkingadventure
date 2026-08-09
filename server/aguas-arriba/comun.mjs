// Lo que comparten los cuatro clientes de aguas arriba: el plazo máximo, la forma del
// fallo y la garantía de que ni la clave del proveedor ni el cuerpo de la petición
// entran en un mensaje de error.
//
// El diagnóstico que queda escrito lleva la ruta y el tipo de fallo, y nada más. No es
// una precaución: un error con el cuerpo dentro es la vía por la que un prompt de
// ficción —y con él la semilla, y con ella la coordenada— acaba en un registro.

/** Los tipos de fallo. Catálogo cerrado: lo que no encaje aquí es «desconocido». */
export const TIPOS_DE_FALLO = Object.freeze(['plazo-agotado', 'caido', 'respuesta-invalida', 'desconocido']);

export class FalloDeAguasArriba extends Error {
  constructor(ruta, tipo) {
    super(`aguas arriba (${ruta}): ${tipo}`);
    this.name = 'FalloDeAguasArriba';
    this.ruta = ruta;
    this.tipo = TIPOS_DE_FALLO.includes(tipo) ? tipo : 'desconocido';
  }
}

/**
 * Una llamada de pago, con su plazo y sin fugas.
 *
 * @param {object} args
 * @param {string} args.ruta  la ruta de contenido, para el diagnóstico agregado.
 * @param {Function} args.fetch  inyectado: en `node --test` es un doble y no hay red.
 * @param {object} args.config
 * @param {() => Promise<any>} args.llama  la llamada concreta del proveedor.
 * @param {(datos: any) => any|null} args.valida  devuelve el contenido en la forma del
 *   sobre, o `null` si la respuesta no encaja en el esquema de su ruta.
 */
export async function pideAguasArriba({ ruta, config, llama, valida }) {
  let bruto;
  try {
    bruto = await Promise.race([
      llama(),
      new Promise((_, rechaza) =>
        setTimeout(() => rechaza(new FalloDeAguasArriba(ruta, 'plazo-agotado')), config.ESPERA_MAXIMA_AGUAS_ARRIBA).unref?.(),
      ),
    ]);
  } catch (e) {
    // El mensaje del proveedor se descarta entero. Puede traer la clave, la URL con la
    // clave dentro, o el cuerpo que se le mandó.
    throw e instanceof FalloDeAguasArriba ? e : new FalloDeAguasArriba(ruta, 'caido');
  }

  const contenido = valida(bruto);
  if (contenido === null || contenido === undefined) throw new FalloDeAguasArriba(ruta, 'respuesta-invalida');
  return contenido;
}

/** Cuerpo JSON leído con el plazo ya puesto por quien llama. */
export async function json(fetch, url, opciones) {
  const res = await fetch(url, opciones);
  if (!res || res.ok !== true) throw new Error('respuesta no ok');
  return res.json();
}
