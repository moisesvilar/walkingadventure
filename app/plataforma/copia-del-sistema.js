// La hoja de compartir y el selector de ficheros, que son **del sistema y no se
// envuelven**: nosotros no elegimos carpeta, no proponemos servicios y no enseñamos
// rutas. Aquí solo se les da lo que necesitan y se recoge lo que devuelven.
//
// Las dos salen de lo que la app ya declara: la hoja es `Share` de React Native, y el
// selector es `File.pickFileAsync` del sistema de ficheros de Expo. Ninguna dependencia
// nueva, que es lo que corresponde a una spec que no nombra ninguna.
//
// Compartir necesita un fichero en disco al que apuntar, y ese fichero se escribe en la
// **caché** y no en el directorio de la partida: es una copia de trabajo que el sistema
// puede borrar cuando quiera, y meterla donde vive la partida la metería además en la
// copia del sistema, que es justo lo que las reglas de respaldo excluyen.

import { Share } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

/** Dónde se deja el fichero mientras la hoja de compartir decide adónde va. */
const CARPETA_DE_SALIDA = 'copias';

/** La hoja de compartir del sistema. Recibe el nombre y el contenido, y nada más. */
export async function comparteConElSistema({ nombre, contenido }) {
  const carpeta = new Directory(Paths.cache, CARPETA_DE_SALIDA);
  if (!carpeta.exists) carpeta.create({ intermediates: true });
  const fichero = new File(carpeta, nombre);
  // Se escribe entero antes de enseñar nada: así no hay manera de que alguien se
  // encuentre un fichero a medias si la escritura falla.
  if (fichero.exists) fichero.delete();
  fichero.create();
  fichero.write(contenido);
  const resultado = await Share.share({ url: fichero.uri, title: nombre });
  return { compartida: resultado?.action !== Share.dismissedAction, uri: fichero.uri };
}

/** El selector de ficheros del sistema. Devuelve el contenido, o que se canceló. */
export async function eligeConElSistema() {
  const elegido = await File.pickFileAsync();
  const fichero = Array.isArray(elegido) ? elegido[0] : (elegido?.result ?? elegido);
  if (!fichero || elegido?.canceled) return { cancelada: true };
  return { cancelada: false, nombre: fichero.name, contenido: await fichero.text() };
}
