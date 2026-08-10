// Babel de la app. El preset de Expo y un solo plugin, que no es opcional: Skia
// exige `react-native-reanimated` al importarse (lo declara como par opcional, pero
// lo pide igual), y Reanimated 4 no funciona sin la transformación de worklets. Esa
// transformación ya no vive en Reanimated sino en `react-native-worklets`, y sin
// ella la app compila, instala y revienta al arrancar.
//
// El plugin va **el último** de la lista: reescribe funciones a worklets y necesita
// ver el código después de que los demás lo hayan transformado.

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
