// El medidor de texto de verdad: el que mide con las tipografías cargadas en Skia.
// Es la otra entrada que SPEC-021 inyecta, y sin ella no hay cajas, y sin cajas no
// hay colocación posible. Falla nombrando la familia si todavía no está cargada,
// en lugar de medir con una sustituta: una tipografía que cae a la de sistema
// estropea los cinco estilos a la vez sin romper ninguna afirmación.

/**
 * Crea un medidor a partir de un proveedor de tipografías.
 *
 * @param {(tipografia: object) => object} fuente devuelve el `SkFont` de una
 *   tipografía, o algo falso si todavía no está cargada.
 * @returns {(texto: string, tipografia: object) => { ancho, alto, ascenso, descenso }}
 */
export function creaMedidorSkia(fuente) {
  if (typeof fuente !== 'function') throw new Error('creaMedidorSkia necesita fuente(tipografia) → SkFont');
  return function mide(texto, tipografia) {
    const font = fuente(tipografia);
    if (!font) throw new Error(`la tipografía "${tipografia.familia}" todavía no está cargada`);
    const metricas = font.getMetrics();
    // Con interletraje el ancho no es el de la cadena: Skia no lo aplica al medir
    // ni al dibujar, así que se suma letra a letra igual que se dibuja.
    let ancho;
    if (tipografia.tracking) {
      const letras = [...texto];
      ancho = letras.reduce((suma, letra) => suma + font.getTextWidth(letra), 0) + tipografia.tracking * Math.max(0, letras.length - 1);
    } else {
      ancho = font.getTextWidth(texto);
    }
    const ascenso = Math.abs(metricas.ascent);
    const descenso = Math.abs(metricas.descent);
    // Una fuente sin tipografía detrás no lanza: mide cero y sigue. Sin esta guarda el
    // fallo aparece al final, en el colocador de rótulos, que es donde no está el
    // problema — y buscar ahí cuesta la tarde. Aquí se nombra la familia, que es lo que
    // hay que arreglar.
    if (texto && !(ancho > 0 && ascenso + descenso > 0)) {
      throw new Error(
        `la tipografía "${tipografia.familia}" mide cero: el gestor devolvió una fuente sin letra detrás, ` +
        'así que no hay caja que colocar',
      );
    }
    return { ancho, alto: ascenso + descenso, ascenso, descenso };
  };
}
