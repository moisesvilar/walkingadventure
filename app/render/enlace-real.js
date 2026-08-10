// El enlace con Skia de verdad: **el único módulo de la app que importa
// `@shopify/react-native-skia`**. Todo lo demás del render —el ejecutor, el medidor,
// la lámina— lo recibe inyectado, y esa es justamente la razón de que se puedan
// ejercitar en `node --test` contra un doble. Si esta importación se extendiera a
// otro fichero, esa propiedad se perdería sin que nada se pusiera rojo.
//
// Aquí no hay ni un color, ni un grosor, ni una tipografía: solo se traduce lo que
// la biblioteca publica al contrato que `enlace-skia.js` declara.

import {
  Skia,
  Canvas,
  Picture,
  PaintStyle,
  ClipOp,
  TileMode,
  ColorType,
  AlphaType,
  StrokeCap,
  StrokeJoin,
  FontSlant,
  FontWeight,
} from '@shopify/react-native-skia';

import { exigeEnlace } from './enlace-skia.js';

/** Los enumerados que la biblioteca publica aparte del objeto `Skia`. */
const ENUMS = Object.freeze({ PaintStyle, ClipOp, TileMode, ColorType, AlphaType, StrokeCap, StrokeJoin });

/**
 * Las familias genéricas de CSS. Los estilos declaran pilas al modo de la web
 * —`'"Cinzel", "IM Fell English", Georgia, serif'`— porque la paridad de datos con
 * el prototipo es criterio de SPEC-021 y las claves no se traducen. Un gestor de
 * tipografías no conoce estos nombres: son la instrucción de «usa la que el sistema
 * tenga para esto», y se resuelven pidiendo la tipografía por defecto.
 */
const GENERICAS = ['serif', 'sans-serif', 'sans serif', 'cursive', 'monospace', 'system-ui', 'fantasy'];

/** La pila de familias de una declaración de estilo, en orden y sin comillas. */
export function familiasDe(declaracion) {
  return String(declaracion ?? '')
    .split(',')
    .map((familia) => familia.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/**
 * Crea el proveedor de tipografías.
 *
 * Recorre la pila declarada por el estilo y se queda con la primera familia que el
 * sistema tenga. **No es una sustitución silenciosa**: la pila es dato del estilo, y
 * su cola genérica dice explícitamente con qué conformarse. Lo que todavía no hay es
 * la cabeza de esas pilas —«IM Fell English», «Cinzel», «Caveat», «MedievalSharp»—,
 * que son tipografías propias y entran con `expo-font` en la fila 27; hasta entonces
 * la lámina se pinta con la cola de la pila y por eso la revisión de paridad
 * compara todo menos la letra. Una pila sin ninguna familia resoluble sí devuelve
 * nulo, y entonces el ejecutor falla nombrándola en vez de pintar media lámina.
 */
export function creaFuente(gestor = Skia.FontMgr.System()) {
  const cache = new Map();
  return function fuente(tipografia) {
    const clave = `${tipografia.familia}|${tipografia.tamano}|${tipografia.peso}|${tipografia.italica}`;
    if (cache.has(clave)) return cache.get(clave);

    const forma = {
      weight: tipografia.peso === 'bold' ? FontWeight.Bold : FontWeight.Normal,
      slant: tipografia.italica ? FontSlant.Italic : FontSlant.Upright,
    };
    // «La primera familia que el sistema tenga» significa **una con la que se pueda
    // medir**, y hay que comprobarlo en vez de creerse la respuesta del gestor. Dos
    // cosas, medidas las dos en el emulador de Android:
    //
    // - `Skia.Font` sin tipografía —lo que salía de traducir el nombre genérico a «sin
    //   familia»— devuelve una fuente sin letra detrás. No lanza: se dibuja vacía y mide
    //   cero. Los genéricos se le piden al gestor como cualquier otro nombre, que en
    //   Android son familias de verdad.
    // - El gestor **también responde a familias que no tiene** con una tipografía que no
    //   rasteriza nada. `Georgia` y `Cinzel` entran por ahí, y son la cabeza de la pila
    //   de la cartela.
    //
    // Las dos acaban igual: medida cero, y el error saliendo al final del todo en el
    // colocador de rótulos, que es donde no está el problema. Una pasada de medida sobre
    // una letra lo corta aquí, que es donde se elige.
    let font = null;
    for (const familia of familiasDe(tipografia.familia)) {
      const letra = gestor.matchFamilyStyle(familia, forma)
        ?? (GENERICAS.includes(familia.toLowerCase()) ? gestor.matchFamilyStyle('', forma) : null);
      if (!letra) continue;
      const candidata = Skia.Font(letra, tipografia.tamano);
      if (!(candidata.getTextWidth('M') > 0)) continue;
      font = candidata;
      break;
    }
    cache.set(clave, font);
    return font;
  };
}

/**
 * Graba lo que pinte `pinta(canvas)` en un cuadro. Grabar y luego pintar el cuadro
 * es lo que permite que arrastrar el mapa mueva la cámara sobre una escena ya
 * grabada en vez de rehacer las primitivas en cada fotograma.
 */
export function creaCuadro(pinta) {
  const grabadora = Skia.PictureRecorder();
  const lienzo = grabadora.beginRecording();
  pinta(lienzo);
  return grabadora.finishRecordingAsPicture();
}

/**
 * El enlace montado, ya comprobado. Se construye una vez y se reparte: el gestor de
 * tipografías y su caché son caros de rehacer, y un enlace nuevo por repintado
 * tiraría la caché de fuentes en cada cambio de estilo.
 */
export function creaEnlaceReal() {
  return exigeEnlace({ Skia, enums: ENUMS, fuente: creaFuente(), Canvas, Picture, creaCuadro });
}
