// El contrato del enlace con Skia, declarado como dato y comprobado al montarlo.
// Skia **no se importa aquí**: entra por la firma, igual que `fetchData` en
// `buildWorld`. Eso es lo que deja el ejecutor y la lámina ejercitables en Node
// contra un doble, y lo que impide que la única pieza dependiente de la plataforma
// se extienda por el resto del render.
//
// Quien monta el enlace de verdad es `enlace-real.js`, el único módulo que importa
// `@shopify/react-native-skia` —declarada en `app/package.json` desde esta fila—.
// Este fichero solo declara y comprueba el contrato, y por eso sigue corriendo en
// Node sin la biblioteca instalada.

/** Lo que un enlace tiene que traer para que la lámina se pueda pintar. */
export const PIEZAS_DEL_ENLACE = Object.freeze(['Skia', 'enums', 'fuente', 'Canvas', 'Picture', 'creaCuadro']);

/** Los enumerados que la biblioteca publica aparte del objeto `Skia`. */
export const ENUMERADOS = Object.freeze(['PaintStyle', 'ClipOp', 'TileMode', 'ColorType', 'AlphaType', 'StrokeCap', 'StrokeJoin']);

/**
 * Comprueba un enlace y lo devuelve. Falla nombrando lo que falta, en lugar de
 * pintar media lámina.
 */
export function exigeEnlace(enlace) {
  if (!enlace || typeof enlace !== 'object') throw new Error('la lámina necesita el enlace con Skia inyectado');
  const faltan = PIEZAS_DEL_ENLACE.filter((pieza) => enlace[pieza] == null);
  if (faltan.length) throw new Error(`el enlace con Skia no trae ${faltan.join(', ')}`);
  const sinEnumerar = ENUMERADOS.filter((nombre) => enlace.enums[nombre] == null);
  if (sinEnumerar.length) throw new Error(`el enlace con Skia no trae los enumerados ${sinEnumerar.join(', ')}`);
  return enlace;
}

/** Si el enlace está montado en esta compilación. La ausencia se declara, no se disimula. */
export function hayEnlace(enlace) {
  try {
    exigeEnlace(enlace);
    return true;
  } catch {
    return false;
  }
}
