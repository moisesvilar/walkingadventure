// El sistema de ficheros de Node, para el almacén duradero.
//
// No es un doble ni un apaño de pruebas: es la implementación con la que la escritura
// atómica se comprueba **contra un sistema de ficheros de verdad**, que es lo que
// SPEC-039 pide y lo único que puede poner roja una atomicidad que no lo sea. El móvil
// monta la suya (`app/plataforma/ficheros.js`) sobre el mismo contrato.
//
// Vive en `app/` y no en `test/` porque es una implementación de una frontera de la
// app, y porque la app la usa de verdad: las herramientas de escritorio que abren una
// partida guardada —medir un fichero exportado, por ejemplo— van por aquí. Nada de
// `app/` la importa, así que el empaquetador del móvil no la ve.

import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';

/** El sistema de ficheros de Node con el contrato de `ficheros.js`. */
export function creaFicherosDeNode() {
  return {
    /** El texto de un fichero, o nulo si no está. Que no esté es un estado normal. */
    async lee(ruta) {
      try {
        return await readFile(ruta, 'utf8');
      } catch (e) {
        if (e?.code === 'ENOENT') return null;
        throw e;
      }
    },

    /** Escribe un fichero. El error —disco lleno, permisos— se propaga tal cual. */
    async escribe(ruta, texto) {
      await writeFile(ruta, texto, 'utf8');
    },

    /**
     * Mueve encima, que es lo que hace atómica la escritura.
     *
     * `rename` sobre el mismo sistema de ficheros sustituye en un solo paso: o está el
     * anterior entero o está el nuevo entero, y nunca medio fichero.
     */
    async mueve(origen, destino) {
      await rename(origen, destino);
    },

    /** Borra. Borrar lo que no está no es un error. */
    async borra(ruta) {
      await rm(ruta, { force: true, recursive: false });
    },

    /** Lo que hay en un directorio, o nulo si el directorio no existe. */
    async entradas(ruta) {
      try {
        const leidas = await readdir(ruta, { withFileTypes: true });
        return leidas.map((e) => ({ nombre: e.name, esDirectorio: e.isDirectory() }));
      } catch (e) {
        if (e?.code === 'ENOENT') return null;
        throw e;
      }
    },

    /** Crea el directorio y los que le falten por encima. Que ya exista no es un error. */
    async creaDirectorio(ruta) {
      await mkdir(ruta, { recursive: true });
    },
  };
}
