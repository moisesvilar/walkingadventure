// El sistema de ficheros del dispositivo, con el contrato de `datos/ficheros.js`.
//
// Es la única pieza de esta fila que necesita algo del sistema, y por eso está sola en
// un módulo de plataforma: todo lo que decide —qué es una clave, cómo se ordena una
// lista, que escribir sea escribir aparte y sustituir— vive en `datos/almacen-duradero.js`
// y se comprueba en Node contra el disco de verdad.
//
// **Dónde escribe**: el directorio de documentos de la app, que es exactamente el que
// entra en la copia del sistema —iCloud en iOS, Google Backup en Android— sin que nadie
// haga nada, y del que `datos/respaldo.js` declara las reglas. La caché no: la caché la
// borra el sistema cuando quiere, y una partida no es una caché.
//
// **La dependencia**: `expo-file-system`, y ahora sí está **declarada** en
// `app/package.json` con la versión que trae el SDK. Resolvía sola porque `expo@57` la
// arrastra como dependencia directa, y por ahí entraban también `expo-asset`,
// `expo-constants`, `expo-font` y `expo-keep-awake`: la lista cerrada mira lo que la app
// **declara** y nunca lo que **importa**, así que un paquete que llega dentro del SDK
// entraba en el móvil sin que nada lo dijera. Se declara lo que se importa; abrir la
// lista cerrada para que deje de estar roja es de quien mantenga la spec.

import { Directory, File, Paths } from 'expo-file-system';

/** El directorio de documentos de la app: lo que el sistema respalda por defecto. */
export function directorioDeDocumentos() {
  return Paths.document.uri;
}

/** El sistema de ficheros del dispositivo. Las seis operaciones y ninguna más. */
export function creaFicherosDelDispositivo() {
  return {
    async lee(ruta) {
      const fichero = new File(ruta);
      // Que no esté es un estado normal y no una avería: se contesta con nulo, igual
      // que en Node, para que el almacén no tenga que distinguir dos plataformas.
      if (!fichero.exists) return null;
      return fichero.text();
    },

    async escribe(ruta, texto) {
      const fichero = new File(ruta);
      if (!fichero.exists) fichero.create({ intermediates: true });
      fichero.write(texto);
    },

    async mueve(origen, destino) {
      // Con `overwrite`, que es lo que hace que sustituir sea un solo paso: sin él
      // habría que borrar el destino antes y ahí es donde cabe el apagón que deja la
      // clave sin ningún documento.
      await new File(origen).move(new File(destino), { overwrite: true });
    },

    async borra(ruta) {
      const fichero = new File(ruta);
      if (fichero.exists) fichero.delete();
    },

    async entradas(ruta) {
      const directorio = new Directory(ruta);
      if (!directorio.exists) return null;
      return directorio.list().map((e) => ({ nombre: e.name, esDirectorio: e instanceof Directory }));
    },

    async creaDirectorio(ruta) {
      const directorio = new Directory(ruta);
      if (!directorio.exists) directorio.create({ intermediates: true });
    },
  };
}
