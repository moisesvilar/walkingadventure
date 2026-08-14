// El adaptador de caché y hoja nativa del cuaderno; solo lo carga la rama `__DEV__`.
// Todo vive bajo `cache/cuaderno-de-a-bordo/`, fuera de documentos, partida y respaldos.

import { Share } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

import { creaCuadernoDeABordo } from './cuaderno-de-a-bordo.js';

const CARPETA = 'cuaderno-de-a-bordo';
const NOMBRE = 'cuaderno-de-a-bordo.jsonl';

const carpeta = new Directory(Paths.cache, CARPETA);
const fichero = (nombre) => new File(carpeta, nombre);
const ficheros = {
  async leeEstado() {
    const marca = fichero('encendido');
    const cuaderno = fichero(NOMBRE);
    const contenido = cuaderno.exists ? await cuaderno.text() : '';
    const ultima = contenido.trimEnd().split('\n').at(-1);
    let secuencia = 0;
    try { secuencia = ultima ? JSON.parse(ultima).secuencia ?? 0 : 0; } catch { secuencia = 0; }
    return { encendido: marca.exists, contenido, secuencia };
  },
  async marcaEncendido() {
    const destino = fichero('encendido');
    if (!destino.exists) destino.create({ intermediates: true });
    destino.write('1');
  },
  async escribeCuaderno(contenido) {
    const destino = fichero(NOMBRE);
    if (!destino.exists) destino.create({ intermediates: true });
    destino.write(contenido);
  },
  async borraTodo() {
    if (carpeta.exists) carpeta.delete();
  },
  uri() { return fichero(NOMBRE).uri; },
};

async function comparte({ contenido }) {
  await ficheros.escribeCuaderno(contenido);
  return Share.share({ url: ficheros.uri(), title: NOMBRE });
}

export function creaCuadernoDelDispositivo() {
  return creaCuadernoDeABordo({ ficheros, comparte });
}
