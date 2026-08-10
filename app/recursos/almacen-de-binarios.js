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

    /**
     * Guarda por **referencia entera** y no por clave: es lo que necesita importar una
     * partida, donde la referencia ya viene escrita dentro del documento del mundo y
     * volver a prefijarla la duplicaría (`local/recursos/local/recursos/...`).
     */
    restaura(referencia, contenido) {
      if (typeof referencia !== 'string' || !referencia.startsWith(PREFIJO)) {
        throw new Error(`una referencia de recurso empieza por "${PREFIJO}" y ha llegado ${JSON.stringify(referencia)}`);
      }
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

    /**
     * Olvida todos los binarios. **Solo la usa empezar de nuevo** (SPEC-040): los
     * binarios son parte del mundo congelado, y borrar la partida sin ellos dejaría en
     * memoria las ilustraciones de un mundo que ya no existe.
     *
     * Sigue sin borrar nada por su cuenta, que es lo que dice la cabecera: aquí se
     * borra porque alguien ha pedido explícitamente destruir la partida entera.
     */
    olvidaTodo() {
      const cuantos = datos.size;
      datos.clear();
      return cuantos;
    },
  };
}
