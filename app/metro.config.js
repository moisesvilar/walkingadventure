// Metro en un espacio de trabajo: la app vive en app/ y el paquete compartido en
// packages/nucleo/, o sea fuera del proyecto. Sin las dos líneas de abajo el
// empaquetador ni vigila el paquete ni sabe resolverlo, y el síntoma engaña —
// parece que el núcleo está congelado, o que le falta un fichero que sí está.

const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const PROYECTO = __dirname;
const RAIZ = path.resolve(PROYECTO, '..');

const config = getDefaultConfig(PROYECTO);

// Sin esto, un cambio en packages/nucleo/ no recarga: Metro no mira fuera del proyecto.
config.watchFolders = [RAIZ];

// El espacio de trabajo hoista a la raíz, así que hay que buscar en los dos sitios.
config.resolver.nodeModulesPaths = [
  path.resolve(PROYECTO, 'node_modules'),
  path.resolve(RAIZ, 'node_modules'),
];

// packages/nucleo/package.json publica subrutas (`./core/*`, `./world/*`…) por su
// mapa de exportaciones. Sin resolución por exportaciones esos imports fallan con
// un error que parece de fichero inexistente y no lo es.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
