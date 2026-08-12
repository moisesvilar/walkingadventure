// Lo que **Health Connect exige del proyecto nativo** y que ni `app.json` ni la propia
// librería pueden poner: el mínimo de Android y la traducción del intento de la razón de
// permisos. Dos cosas, las dos con el mismo dueño —`react-native-health-connect`, la única
// dependencia que la fila 46 autoriza— y ninguna dependencia nueva: `withGradleProperties` y
// `withMainActivity` vienen dentro de `expo`, que ya está. **`expo-build-properties` queda
// descartada por nombre**: habría sido una segunda librería para escribir una línea.
//
// El patrón es el de `retira-permisos-prohibidos.js`, que es el hermano de este fichero:
// plugin propio en `app/plugins/`, el porqué escrito dentro y el coste medido al lado.
//
// ## 1 · El mínimo de Android sube a 26, y cuesta algo
//
// `androidx.health.connect:connect-client` declara `minSdkVersion 26`
// (`node_modules/react-native-health-connect/android/gradle.properties:2`) y el proyecto
// venía en 24, así que la fusión de manifiestos **falla la compilación entera** con «uses-sdk:
// minSdkVersion 24 cannot be smaller than version 26». No es una advertencia: sin esto no hay
// APK.
//
// **El coste, dicho y no escondido: la app deja de instalarse en Android 7.0 y 7.1** (API 24 y
// 25). Se sube el mínimo en vez de forzar la librería con `tools:overrideLibrary` porque
// forzarla dejaría la app instalable en aparatos donde la primera lectura de salud revienta,
// que es peor que no instalarse: un fallo en el sitio equivocado y sin nadie mirando.
// `docs/prd.md` no fija ningún mínimo de Android —RNF-COM-001 solo habla de una base React
// Native con Expo—, así que esto no contradice ninguna decisión escrita.
//
// ## 2 · El intento de la razón de permisos se traduce a enlace profundo
//
// El sistema puede preguntar «¿por qué me pides esto?» desde fuera de la app, y esta fila
// decidió que esa pregunta aterriza en A6P6, que es donde la fila de contar los pasos y su
// línea de aviso ya dicen exactamente eso. El problema es de mecanismo y está medido:
// `IntentModule.kt:59-68` de React Native **solo** devuelve una URL inicial si la acción es
// `ACTION_VIEW` (o la de NFC) **y** el intento trae datos, y el intento de la razón no cumple
// ninguna de las dos. Sin traducir, la acción no llega nunca a JavaScript.
//
// Así que se traduce en el único sitio donde se puede: unas líneas en `MainActivity`. Y **la
// traducción no decide nada**: cambia esas acciones por `ACTION_VIEW` sobre
// `walkingadventure://razon-de-permisos` y se aparta. A dónde lleva ese enlace —A6P6 con
// partida lista, el arranque de siempre sin ella— se decide en `app/App.js`, que es donde las
// guardas de este repo lo pueden ver y poner rojo. Nada de lógica de producto en Kotlin.
//
// **Son dos acciones y no una, y las dos las declara el plugin de la propia librería**
// (`node_modules/react-native-health-connect/app.plugin.js`): `ACTION_SHOW_PERMISSIONS_RATIONALE`
// sobre `MainActivity` es el camino de Android 13 y anteriores, y
// `VIEW_PERMISSION_USAGE` con la categoría `HEALTH_PERMISSIONS` sobre el
// `activity-alias ViewPermissionUsageActivity` —que apunta a la misma actividad— es el de
// Android 14 en adelante. Ninguna de las dos trae datos, así que ninguna llega sola a
// JavaScript, y son **la misma razón de permisos vista desde dos versiones de Android**:
// traducir solo la primera daría verde en un banco que fuerza la acción vieja y rojo en
// cualquier móvil moderno, que es justo la puerta que usa el aparato donde esto se mide
// (`wa-pixel`, Android 15 / API 35).
//
// Se traducen también las dos entradas y no una: con `launchMode="singleTask"`, el intento
// llega por `onCreate` si la app estaba muerta y por `onNewIntent` si estaba viva, y atender
// solo la primera haría que la razón de permisos funcionara o no según algo que quien juega no
// puede ver ni explicar.
//
// El enlace se escribe aquí literal y también en `app/plataforma/razon-de-permisos.js`, por la
// misma mecánica que las listas de `retira-permisos-prohibidos.js`: los plugins los carga Expo
// con `require` desde CommonJS y los módulos de la app son ESM. Que estén en dos sitios es
// comprobable con un cruce de cadenas.

const { withGradleProperties, withMainActivity } = require('expo/config-plugins');

/** El mínimo que Health Connect exige. Sube de 24; el coste está en la cabecera. */
const MINIMO_DE_ANDROID = '26';

/** La propiedad que el proyecto de Expo lee para fijarlo. */
const PROPIEDAD_DEL_MINIMO = 'android.minSdkVersion';

/**
 * Las **dos** acciones con las que el sistema pregunta por la razón de los permisos de salud:
 * la de Android 13 y anteriores, y la de Android 14 en adelante por el `activity-alias`.
 * Las dos aterrizan en la actividad principal y ninguna trae datos.
 */
const ACCIONES_DE_LA_RAZON = [
  'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
  'android.intent.action.VIEW_PERMISSION_USAGE',
];

/** A qué enlace se traduce. **Mismo literal que `app/plataforma/razon-de-permisos.js`.** */
const ENLACE_DE_LA_RAZON = 'walkingadventure://razon-de-permisos';

/** La marca que hace idempotente el parche: si está, ya se aplicó. */
const MARCA = 'SPEC-046';

/** El Kotlin que se inserta, con su porqué dentro para quien abra el fichero generado. */
const TRADUCCION = `
  // ${MARCA} · Las dos acciones con las que el sistema pregunta por qué se piden los permisos
  // de salud: la de Android 13 y anteriores, y la de Android 14 en adelante por el
  // \`activity-alias\`. Son la misma pregunta vista desde dos versiones de Android, y las dos
  // aterrizan aquí sin traer datos.
  private val accionesDeLaRazonDePermisos = setOf(
${ACCIONES_DE_LA_RAZON.map((a) => `    "${a}"`).join(',\n')}
  )

  // Traduce ese intento a un enlace profundo, porque \`IntentModule\` de React Native solo deja
  // pasar \`ACTION_VIEW\` con datos y estas acciones no llegan nunca a JavaScript.
  //
  // **Esto traduce, no decide**: a dónde lleva el enlace lo resuelve \`app/App.js\` —A6P6 con
  // partida lista, el arranque de siempre sin ella—, que es donde se puede poner rojo.
  private fun traduceLaRazonDePermisos(entrante: android.content.Intent?): android.content.Intent? {
    if (entrante == null || !accionesDeLaRazonDePermisos.contains(entrante.action)) return entrante
    entrante.action = android.content.Intent.ACTION_VIEW
    entrante.data = android.net.Uri.parse("${ENLACE_DE_LA_RAZON}")
    return entrante
  }

  // Las dos entradas, porque con \`launchMode="singleTask"\` el intento llega por \`onCreate\`
  // con la app muerta y por \`onNewIntent\` con la app viva.
  override fun onNewIntent(entrante: android.content.Intent?) {
    val traducido = traduceLaRazonDePermisos(entrante)
    if (traducido != null) setIntent(traducido)
    super.onNewIntent(traducido)
  }
`;

/** Sube el mínimo de Android sustituyendo la propiedad, o añadiéndola si no estaba. */
function conElMinimoDeAndroid(config) {
  return withGradleProperties(config, (configurado) => {
    const propiedades = configurado.modResults.filter(
      (p) => !(p.type === 'property' && p.key === PROPIEDAD_DEL_MINIMO),
    );
    propiedades.push({ type: 'property', key: PROPIEDAD_DEL_MINIMO, value: MINIMO_DE_ANDROID });
    configurado.modResults = propiedades;
    return configurado;
  });
}

/** Inserta la traducción en `MainActivity`. Idempotente por la marca. */
function conLaTraduccionDelIntento(config) {
  return withMainActivity(config, (configurado) => {
    const fuente = configurado.modResults.contents;
    if (configurado.modResults.language !== 'kt') {
      throw new Error(
        `la traducción del intento de la razón de permisos está escrita en Kotlin y MainActivity llegó en "${configurado.modResults.language}": ` +
        'aplicarla a ciegas dejaría un fichero que no compila, y el fallo se vería una hora después en Gradle',
      );
    }
    if (fuente.includes(MARCA)) return configurado;

    // La llamada va **después** de `super.onCreate`: lo que se toca es el intento de la
    // actividad, que sigue siendo el mismo objeto cuando JavaScript lo lee más tarde.
    const anclaDeOnCreate = 'super.onCreate(null)';
    if (!fuente.includes(anclaDeOnCreate)) {
      throw new Error(
        `MainActivity no contiene "${anclaDeOnCreate}", que es donde se engancha la traducción del intento de la razón de permisos: ` +
        'la plantilla de Expo ha cambiado y este parche hay que volver a medirlo en vez de aplicarlo a ciegas',
      );
    }
    const cierre = fuente.lastIndexOf('}');
    if (cierre === -1) {
      throw new Error('MainActivity no tiene ninguna llave de cierre: el parche de la razón de permisos no sabe dónde ponerse');
    }

    const conLlamada = fuente.replace(
      anclaDeOnCreate,
      `${anclaDeOnCreate}\n    traduceLaRazonDePermisos(intent)`,
    );
    const finalDeClase = conLlamada.lastIndexOf('}');
    configurado.modResults.contents = `${conLlamada.slice(0, finalDeClase)}${TRADUCCION}${conLlamada.slice(finalDeClase)}`;
    return configurado;
  });
}

module.exports = function loQueExigeHealthConnect(config) {
  return conLaTraduccionDelIntento(conElMinimoDeAndroid(config));
};
