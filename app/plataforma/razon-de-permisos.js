// «¿Por qué me pides esto?»: **por dónde entra la pregunta del sistema, y nada más**.
//
// El sistema puede preguntar por la razón de los permisos de salud desde fuera de la app, y
// esa pregunta aterriza en A6P6 —donde la fila de contar los pasos y su línea de aviso ya
// dicen exactamente eso, escritas por quien pasó por las reglas de lenguaje—. Lo que este
// módulo hace es reconocer el enlace; **a dónde lleva lo decide `app/App.js`**, con su guarda
// de partida.
//
// El camino tiene dos mitades y conviene ver las dos juntas: el intento del sistema no trae
// datos y su acción no es `ACTION_VIEW`, así que `IntentModule` de React Native no lo deja
// llegar a JavaScript (`IntentModule.kt:59-68`, medido). El plugin
// `app/plugins/lo-que-exige-health-connect.js` lo **traduce** a este enlace en `MainActivity`,
// y de ahí en adelante es el camino de siempre: `Linking`, y esto que lo reconoce.
//
// **Esto no es el gancho de desarrollo y no vive con él**, aunque se le parezca. `gancho.js`
// es inerte en producción a propósito; esta entrada tiene que funcionar precisamente en
// producción, que es donde el sistema pregunta. Compartir fichero habría sido compartir esa
// regla, y la regla es lo único que hace del gancho una puerta que no es trasera.
//
// **Y es superficie pública, dicho y no disimulado**: cualquier app instalada puede abrir este
// enlace, no solo la de salud del sistema. Es inofensivo porque lo único que hace es enseñar
// una pantalla de ajustes que ya cuelga de la portada, y porque sin partida lista no enseña
// nada; pero se declara aquí y en la arista de `docs/flujo.md` en lugar de descubrirse luego.

/** El anfitrión del enlace. **Mismo literal que el plugin**, que es quien lo escribe. */
export const ANFITRION_DE_LA_RAZON = 'razon-de-permisos';

/** El enlace entero, para poder dispararlo a mano y para poder cruzarlo con el plugin. */
export const ENLACE_DE_LA_RAZON = `walkingadventure://${ANFITRION_DE_LA_RAZON}`;

/**
 * Si un enlace es el de la razón de permisos.
 *
 * Se lee sin ningún analizador de URL de plataforma, igual que el gancho y por lo mismo: el
 * formato es fijo y conocido, y un analizador de más es una dependencia que nadie ha pedido.
 */
export function esRazonDePermisos(url) {
  if (typeof url !== 'string' || !url) return false;
  const sinEsquema = url.replace(/^[a-zA-Z][\w+.-]*:\/\//, '');
  const [ruta] = sinEsquema.split('?');
  return ruta.replace(/\/+$/, '') === ANFITRION_DE_LA_RAZON;
}
