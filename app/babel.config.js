// Babel de la app. Solo el preset de Expo: cualquier plugin de más aquí es una
// diferencia entre lo que corre en el móvil y lo que corre en Node, y la frontera
// del núcleo depende de que esa diferencia sea mínima.

module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
