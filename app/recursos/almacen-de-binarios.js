// El almacén de los binarios de recursos: las ilustraciones y las fotos que consigue el
// conseguidor. Guarda el contenido y devuelve **la referencia con la que el documento lo cita**,
// que es lo único que llega al mundo congelado (SPEC-025: el binario no entra en el JSON).
//
// Dos cosas que no hace, y las dos son de otras filas: no sobrevive a cerrar la app —los
// binarios entre sesiones son de quien posea la repisa— y no borra nada por sí solo. Lo que sí
// hace es distinguir «no lo tengo» de «no lo he pedido nunca», porque `exigeResidentes` decide
// con eso si una salida se puede jugar entera sin red.

/** El prefijo de las referencias. Local y declarado: ninguna referencia apunta a una URL. */
export const PREFIJO = 'local/recursos/';

/** Un almacén de binarios en memoria. */
export function creaAlmacenDeBinarios() {
  const datos = new Map();

  return {
    /** Guarda un contenido y devuelve su referencia. Guardar dos veces la misma clave sustituye. */
    guarda(clave, contenido) {
      if (typeof clave !== 'string' || !clave) {
        throw new Error('el almacén de binarios guarda por clave, y llegó una clave vacía');
      }
      const referencia = `${PREFIJO}${clave}`;
      datos.set(referencia, contenido);
      return referencia;
    },

    /** Si el binario de una referencia está de verdad. Síncrono: lo consume `exigeResidentes`. */
    tiene(referencia) {
      return datos.has(referencia);
    },

    /** El contenido de una referencia, o nulo. Que no esté es un estado normal. */
    lee(referencia) {
      return datos.has(referencia) ? datos.get(referencia) : null;
    },

    /** Las referencias guardadas, en orden estable. */
    guardados() {
      return [...datos.keys()].sort();
    },
  };
}
