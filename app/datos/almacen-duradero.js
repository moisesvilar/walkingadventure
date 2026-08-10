// El almacén duradero de la partida: las cuatro operaciones que SPEC-009 dejó
// inyectadas —leer por clave, escribir por clave, listar por prefijo y borrar—, ahora
// sobre un sistema de ficheros de verdad. Es la primera vez en el proyecto que cerrar
// la app no pierde nada.
//
// Tres decisiones que no son de estilo:
//
// - **Escribir es escribir aparte y sustituir.** Nunca se abre el fichero bueno para
//   sobrescribirlo: se escribe el temporal y se mueve encima. Un apagón a mitad deja o
//   el documento anterior entero o ninguno, jamás uno truncado. Es lo que SPEC-009
//   declaró propiedad del almacén y lo que hasta esta fila no tenía implementación.
// - **La clave se valida antes de tocar el disco.** Una clave con `..`, absoluta o con
//   un segmento vacío se rechaza nombrándola: todo cuelga del directorio de la partida
//   y nada se escribe fuera de él, y eso solo se sostiene si la clave no puede salir.
// - **El orden de `lista` es el del texto de la clave y no el del sistema de ficheros.**
//   Dos móviles con el mismo contenido tienen que dar la misma lista, y el orden de
//   lectura de un directorio no lo promete nadie.

import { exigeFicheros } from './ficheros.js';

/** El sufijo del fichero temporal. Fijo y declarado: se reconoce y se limpia. */
export const SUFIJO_TEMPORAL = '.escribiendo';

/** Cómo se llama el directorio de la partida dentro del área de documentos de la app. */
export const DIRECTORIO_DE_LA_PARTIDA = 'partida';

const SEGMENTO_VALIDO = /^[A-Za-z0-9._,()-]+$/;

/** El directorio de la partida dentro del área que el sistema respalda. */
export function directorioDeLaPartida(documentos) {
  if (typeof documentos !== 'string' || !documentos) {
    throw new Error('no se sabe dónde guarda este dispositivo: falta el directorio de documentos de la app');
  }
  return `${documentos.replace(/\/+$/, '')}/${DIRECTORIO_DE_LA_PARTIDA}`;
}

/**
 * El almacén **duradero** cableado, o un error que nombra lo que falta.
 *
 * No vale cualquier almacén: el de memoria cumple las cuatro operaciones y pierde la
 * partida al cerrar, que es justo el estado en el que SPEC-026 dejó las cosas. Aquí se
 * corta por construcción, que es la séptima aparición de la familia de
 * `pipeline/decisiones-orquestador.md` §6h y la única manera de que no haya una octava.
 */
export function exigeAlmacenDuradero(almacen, donde) {
  if (!almacen) {
    throw new Error(`${donde} necesita el almacén duradero de la partida cableado: sin él la partida no sobrevive a cerrar la app`);
  }
  if (almacen.esDuradero !== true) {
    throw new Error(
      `${donde} está cableado con un almacén que no es el duradero: el de memoria vale para las pruebas y pierde la partida al cerrar, ` +
      'y seguir con él sería perderla sin que nada proteste',
    );
  }
  return almacen;
}

/**
 * Una clave de almacén bien formada, o un error que la nombra.
 *
 * Las claves del juego son de la forma `mapa/<id>/celda/<i>,<j>.json`: segmentos de
 * letras, cifras, punto, coma, guion, guion bajo y paréntesis. Todo lo demás se
 * rechaza, empezando por lo que serviría para salir del directorio.
 */
export function exigeClave(clave, donde = 'el almacén') {
  if (typeof clave !== 'string' || clave.length === 0) {
    throw new Error(`${donde} escribe por clave, y llegó ${JSON.stringify(clave) ?? String(clave)}`);
  }
  if (clave.startsWith('/') || clave.includes('\\')) {
    throw new Error(`${donde}: la clave "${clave}" no es relativa al directorio de la partida, y nada se escribe fuera de él`);
  }
  const segmentos = clave.split('/');
  for (const segmento of segmentos) {
    if (segmento === '' || segmento === '.' || segmento === '..') {
      throw new Error(`${donde}: la clave "${clave}" tiene el segmento ${JSON.stringify(segmento)}, con el que se saldría del directorio de la partida`);
    }
    if (!SEGMENTO_VALIDO.test(segmento)) {
      throw new Error(`${donde}: la clave "${clave}" lleva el segmento "${segmento}", con símbolos que no valen para un nombre de fichero`);
    }
  }
  if (clave.endsWith(SUFIJO_TEMPORAL)) {
    throw new Error(`${donde}: la clave "${clave}" acaba en "${SUFIJO_TEMPORAL}", que es como se llaman los ficheros a medio escribir`);
  }
  return clave;
}

/**
 * Un almacén duradero sobre el sistema de ficheros inyectado.
 *
 * @param {object} opciones
 *   `ficheros` el sistema de ficheros (ver `ficheros.js`); `directorio` la raíz de la
 *   partida, ya resuelta por quien monta, porque dónde escribe cada plataforma no lo
 *   decide este módulo.
 */
export function creaAlmacenDuradero({ ficheros, directorio } = {}) {
  exigeFicheros(ficheros, 'el almacén duradero de la partida');
  if (typeof directorio !== 'string' || !directorio) {
    throw new Error('el almacén duradero necesita el directorio de la partida: dónde escribe cada plataforma no lo decide el almacén');
  }
  const raiz = directorio.endsWith('/') ? directorio.slice(0, -1) : directorio;
  const ruta = (clave) => `${raiz}/${clave}`;
  const cuenta = { lecturas: 0, escrituras: 0, borrados: 0 };
  // Toda clave que este almacén ha escrito alguna vez en esta sesión. No es diagnóstico:
  // es lo que se cruza con las reglas de respaldo para que una clave nueva que nadie
  // añadió a la copia del sistema se pueda poner roja (RF-PERS-004).
  const escritas = new Set();

  async function recorre(directorioActual, prefijoDeClave, salida) {
    const entradas = await ficheros.entradas(directorioActual);
    if (entradas === null) return salida;
    for (const entrada of entradas) {
      const clave = prefijoDeClave ? `${prefijoDeClave}/${entrada.nombre}` : entrada.nombre;
      if (entrada.esDirectorio) await recorre(`${directorioActual}/${entrada.nombre}`, clave, salida);
      else if (!entrada.nombre.endsWith(SUFIJO_TEMPORAL)) salida.push(clave);
    }
    return salida;
  }

  return {
    /** La marca que distingue este almacén del de memoria. La mira `exigeAlmacenDuradero`. */
    esDuradero: true,

    /** El contenido de una clave, o nulo. Que no esté es un estado normal, no una avería. */
    async lee(clave) {
      exigeClave(clave, 'el almacén duradero');
      cuenta.lecturas += 1;
      return ficheros.lee(ruta(clave));
    },

    /**
     * Escribe sustituyendo: temporal y encima. El texto se guarda tal cual, porque
     * canonizarlo es del formato.
     *
     * Si el disco está lleno, el error se propaga **nombrando la clave** y el documento
     * anterior sigue intacto: aquí no se borra nada antes de escribir.
     */
    async escribe(clave, texto) {
      exigeClave(clave, 'el almacén duradero');
      if (typeof texto !== 'string') {
        throw new Error(`el almacén duradero guarda documentos de texto y llegó ${typeof texto} para la clave ${clave}`);
      }
      const destino = ruta(clave);
      const temporal = `${destino}${SUFIJO_TEMPORAL}`;
      const carpeta = destino.slice(0, destino.lastIndexOf('/'));
      try {
        await ficheros.creaDirectorio(carpeta);
        await ficheros.escribe(temporal, texto);
        await ficheros.mueve(temporal, destino);
      } catch (e) {
        // Y el temporal se retira: dejarlo ahí haría que el siguiente intento arrancara
        // sobre restos de este, y `lista` ya lo ignora pero el espacio no se recupera.
        try { await ficheros.borra(temporal); } catch { /* el fallo de la limpieza no tapa el de la escritura */ }
        throw new Error(`el almacén duradero no ha podido escribir la clave ${clave}: ${e?.message ?? String(e)}`);
      }
      cuenta.escrituras += 1;
      escritas.add(clave);
      return clave;
    },

    /** Las claves que empiezan por un prefijo, en orden estable y declarado. */
    async lista(prefijo = '') {
      const todas = await recorre(raiz, '', []);
      return todas.filter((c) => c.startsWith(prefijo)).sort();
    },

    /** Borra una clave. Borrar lo que no está no es un error. */
    async borra(clave) {
      exigeClave(clave, 'el almacén duradero');
      cuenta.borrados += 1;
      return ficheros.borra(ruta(clave));
    },

    /** Lo que se ha hecho con él. Diagnóstico, nunca parte del juego. */
    recuento() {
      return { ...cuenta, escritas: escritas.size };
    },

    /** Toda clave que este almacén ha escrito. Es lo que se cruza con las reglas de respaldo. */
    clavesEscritas() {
      return [...escritas].sort();
    },

    /** Dónde escribe, para poder afirmar que todo cuelga del directorio de la partida. */
    donde() {
      return raiz;
    },
  };
}
