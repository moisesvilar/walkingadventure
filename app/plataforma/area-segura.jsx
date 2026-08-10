// El área segura de verdad: la que también respeta la barra de estado en Android.
//
// El `SafeAreaView` de `react-native` **solo hace algo en iOS**; en Android es un `View`
// corriente (`Platform.select({ios: nativo, default: View})`). Con `edgeToEdgeEnabled` la
// ventana llega hasta el borde superior de la pantalla, así que la cabecera del arranque se
// pintaba encima del reloj del móvil y el sistema la daba por tapada: `arranque-contador`
// llegaba al árbol de accesibilidad como `visible: false` y ninguna automatización lo
// alcanzaba. El arreglo va por respetar los *insets* y no por desactivar el edge-to-edge:
// Android 16 lo hace obligatorio y `edgeToEdgeEnabled` ya sale marcado como obsoleto.
//
// **Sin añadir ninguna dependencia**, que es lo que obliga a resolverlo así:
//
// - En Android, el relleno superior sale de `StatusBar.currentHeight`, que es API pública de
//   React Native y devuelve el alto real de la barra en el dispositivo. El borde inferior ya
//   lo recorta la propia ventana (medido: la raíz llega a 2214 de 2400 en el emulador de
//   referencia), así que no hace falta compensarlo aquí.
// - En iOS el trabajo lo sigue haciendo el `SafeAreaView` de React Native, que ahí sí aplica
//   los insets de verdad. Se pide **en perezoso y solo en iOS** para que en Android no se
//   toque siquiera: leer esa propiedad imprime un aviso de obsolescencia, y un aviso en
//   desarrollo levanta el rótulo de LogBox, que tapa el pie de la pantalla y se come los
//   toques de la última acción.
//
// Lo que resolvería las dos plataformas de una vez es `react-native-safe-area-context`, que es
// lo que la propia React Native recomienda desde que marcó el suyo como obsoleto. **No la
// añado porque ninguna spec la nombra**: si se quiere el arreglo completo —recorte de cámara,
// barra de navegación, apaisado— esa es la dependencia que hay que declarar antes.

import React from 'react';
import { Platform, StatusBar, View } from 'react-native';

/** El alto de la barra de estado, en Android. En iOS lo resuelve el componente del sistema. */
const ALTO_DE_LA_BARRA = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

/** El componente del sistema, pedido una sola vez y solo donde hace algo. */
const SAFE_AREA_DE_IOS = Platform.OS === 'ios'
  // eslint-disable-next-line global-require
  ? require('react-native').SafeAreaView
  : null;

/**
 * Envuelve lo que sea que se pinte para que ningún borde quede bajo una barra del sistema.
 *
 * Se usa igual que el `SafeAreaView` al que sustituye: un `style` con `flex: 1` y el color de
 * fondo de la pantalla.
 */
export function AreaSegura({ style, children, ...resto }) {
  if (SAFE_AREA_DE_IOS) {
    return (
      <SAFE_AREA_DE_IOS style={style} {...resto}>
        {children}
      </SAFE_AREA_DE_IOS>
    );
  }
  return (
    <View style={[style, { paddingTop: ALTO_DE_LA_BARRA }]} {...resto}>
      {children}
    </View>
  );
}

/** El relleno que se está aplicando arriba. Para diagnóstico y para las pruebas de núcleo. */
export function altoDeLaBarraDeEstado() {
  return ALTO_DE_LA_BARRA;
}
