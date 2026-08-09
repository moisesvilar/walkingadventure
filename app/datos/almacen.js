// El almacén de la partida dentro del móvil: las cuatro operaciones que el núcleo
// pide inyectadas —leer por clave, escribir por clave, listar por prefijo y borrar—
// y **la atomicidad de la escritura**, que es suya y no del núcleo.
//
// Lo que hay aquí es la implementación en memoria. La duradera es de la fila 39, que
// es la que decide dónde escribe cada plataforma y trae con ella la dependencia de
// sistema de ficheros; hasta entonces la frontera existe entera y se puede
// ejercitar, que es lo que hace falta para afirmar que abrir un mapa ya levantado no
// pide nada a OSM.
//
// La escritura sustituye y nunca modifica en sitio: un apagón a mitad no puede dejar
// un documento truncado donde había uno bueno. En memoria eso es gratis —una clave
// pasa a apuntar a otra cadena— y por eso está escrito así desde el principio: la
// implementación duradera hereda el contrato, no lo inventa.

/**
 * Un almacén en memoria.
 *
 * @param {Iterable<[string, string]>} [contenidoInicial] con qué arranca. Sirve para
 *   levantar una partida ya guardada sin haberla escrito en esta ejecución, que es
 *   como se afirma «se vuelve a abrir la app y se pinta desde el documento».
 */
export function creaAlmacenEnMemoria(contenidoInicial = []) {
  const documentos = new Map(contenidoInicial);
  // Los recuentos son del diagnóstico y de la batería, no del juego: con ellos se
  // puede afirmar cuántas veces se escribió y cuántas se leyó sin instrumentar nada.
  const cuenta = { lecturas: 0, escrituras: 0, borrados: 0 };

  return {
    /** El contenido de una clave, o nulo. Que no esté es un estado normal, no una avería. */
    async lee(clave) {
      cuenta.lecturas += 1;
      return documentos.has(clave) ? documentos.get(clave) : null;
    },

    /** Escribe sustituyendo. El texto se guarda tal cual: canonizarlo es del formato. */
    async escribe(clave, texto) {
      if (typeof clave !== 'string' || !clave) throw new Error('el almacén escribe por clave, y llegó una clave vacía');
      if (typeof texto !== 'string') throw new Error(`el almacén guarda documentos de texto y llegó ${typeof texto} para la clave ${clave}`);
      cuenta.escrituras += 1;
      documentos.set(clave, texto);
      return clave;
    },

    /** Las claves que empiezan por un prefijo, en orden estable. */
    async lista(prefijo) {
      return [...documentos.keys()].filter((c) => c.startsWith(prefijo)).sort();
    },

    /** Borra una clave. Borrar lo que no está no es un error. */
    async borra(clave) {
      cuenta.borrados += 1;
      return documentos.delete(clave);
    },

    /** Lo que se ha hecho con él. Diagnóstico, nunca parte del juego. */
    recuento() {
      return { ...cuenta, documentos: documentos.size };
    },

    /** Una copia del contenido, para poder montar otro almacén con lo mismo dentro. */
    volcado() {
      return [...documentos.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    },
  };
}
