// La cámara de la lámina: con qué encuadre se está pintando el mundo congelado.
//
// Tres números y ni uno más —centro en metros y radio en metros—, y **ningún
// ángulo**. El norte no está arriba porque nadie haya pedido girar todavía: está
// arriba porque la cámara no tiene por dónde girar, igual que la vista que recibe
// `componeEscena`. Un gesto de rotación no encuentra aquí nada que mover, y por eso
// no ocurre nada; ignorar en silencio, y no rebotar con una animación, porque una
// animación de rechazo es la app hablando.
//
// La cámara es estado **de pantalla y no del mundo**: moverla no toca el documento
// congelado, y por eso se puede guardar entre aperturas sin rozar ningún invariante.
// No sabe de estilos: el estilo es solo pintado, y una cámara que dependiera del
// margen del marco cambiaría de sitio al cambiar de estilo.

/** Los ejes de la cámara. Cerrado y comprobable: si aparece un cuarto, hay rotación. */
export const EJES_DE_LA_CAMARA = Object.freeze(['cx', 'cy', 'r']);

/** Lo más que se puede acercar, en metros de radio. Por debajo no queda mundo que leer. */
export const RADIO_MINIMO_M = 40;

/**
 * Lo más que se puede alejar, como múltiplo del radio de la celda. Con 1.15 la celda
 * entera cabe con aire; más allá solo hay papel, y alejarse hasta perder el mapa es
 * la manera de que alguien crea que lo ha roto.
 */
export const ALEJAMIENTO_MAXIMO = 1.15;

/**
 * El encuadre de partida: la celda entera con margen.
 *
 * Se abre así y no acercada porque el primer mensaje de A1P6 es que esto es tu
 * barrio con otra ropa, y eso solo se ve entero; abrir acercada obligaría a alejar
 * para entender la lámina.
 */
export const MARGEN_DE_ENCUADRE = 1.05;

function exigeDocumento(documento) {
  const radio = documento && documento.radius;
  if (!Number.isFinite(radio) || radio <= 0) {
    throw new Error('la cámara necesita el documento del mundo congelado, con su radio en metros');
  }
  return radio;
}

/** El encuadre inicial de un mundo: centrado y con la celda entera dentro. */
export function encuadraCelda(documento) {
  const radio = exigeDocumento(documento);
  return Object.freeze({ cx: 0, cy: 0, r: Math.min(radio * MARGEN_DE_ENCUADRE, radio * ALEJAMIENTO_MAXIMO) });
}

/**
 * Devuelve la cámara dentro de sus topes: el radio entre el mínimo y el alejamiento
 * máximo, y el centro sin salirse del mundo.
 */
export function normaliza(camara, documento) {
  const radio = exigeDocumento(documento);
  if (!Number.isFinite(camara.cx) || !Number.isFinite(camara.cy) || !Number.isFinite(camara.r)) {
    throw new Error(`la cámara son tres números en metros y llegó cx=${camara.cx}, cy=${camara.cy}, r=${camara.r}`);
  }
  const r = Math.min(Math.max(camara.r, RADIO_MINIMO_M), radio * ALEJAMIENTO_MAXIMO);
  // El centro se puede llevar hasta el borde del mundo y no más allá: pasado ese
  // punto la lámina sería papel, y quien la arrastró creería haberla perdido.
  const recorta = (v) => Math.max(-radio, Math.min(radio, v));
  return Object.freeze({ cx: recorta(camara.cx), cy: recorta(camara.cy), r });
}

/** Metros por píxel con los que se está pintando. De aquí sale cuánto mundo mueve un dedo. */
export function metrosPorPixel(camara, tamano) {
  if (!tamano || !Number.isFinite(tamano.ancho) || tamano.ancho <= 0) {
    throw new Error('la cámara necesita el tamaño de la lámina en píxeles para convertir un arrastre en metros');
  }
  return (camara.r * 2) / tamano.ancho;
}

/**
 * Arrastrar: **se mueve la cámara y no el mundo**. El dedo va con el papel, así que
 * arrastrar hacia la derecha lleva la cámara hacia la izquierda; y el eje vertical se
 * invierte porque en la lámina la y crece hacia el norte y en la pantalla hacia abajo.
 */
export function arrastra(camara, { dxPx, dyPx, tamano, documento }) {
  if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx)) throw new Error(`el arrastre llega en píxeles y llegó dx=${dxPx}, dy=${dyPx}`);
  const m = metrosPorPixel(camara, tamano);
  return normaliza({ cx: camara.cx - dxPx * m, cy: camara.cy + dyPx * m, r: camara.r }, documento);
}

/**
 * Acercar y alejar. El factor es la razón entre la separación de dos dedos ahora y
 * al empezar: mayor que uno acerca, y acercar es reducir el radio.
 *
 * **El ángulo entre los dos dedos no entra**: la cámara no tiene rotación, así que
 * un gesto que además gire acerca exactamente igual y no gira nada.
 */
export function acerca(camara, factor, documento) {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error(`el factor de acercamiento tiene que ser positivo y llegó ${factor}`);
  return normaliza({ cx: camara.cx, cy: camara.cy, r: camara.r / factor }, documento);
}

/**
 * La vista con la que se pinta. La barra de escala va **apagada**: una escala
 * cartográfica dice «250 varas (250 m)», que es una cifra de distancia, y el sistema
 * de diseño las prohíbe en las pantallas del juego.
 */
export function vistaDe(camara) {
  return { cx: camara.cx, cy: camara.cy, r: camara.r, foco: null, paraje: null, escala: false };
}

/** La cámara en texto, para guardarla. Tres números y el mundo al que pertenecen. */
export function textoDeCamara(camara, { mapaId, clave }) {
  return JSON.stringify({ version: 1, mapaId, clave, cx: camara.cx, cy: camara.cy, r: camara.r });
}

/**
 * La cámara guardada, o el encuadre inicial.
 *
 * Una cámara ilegible **no es un error del juego**: es estado de pantalla, y volver
 * al encuadre inicial es una respuesta honesta. Lo que nunca se hace es tocar el
 * documento por eso.
 */
export function leeCamara(texto, documento) {
  if (typeof texto !== 'string' || !texto) return encuadraCelda(documento);
  let guardada;
  try {
    guardada = JSON.parse(texto);
  } catch {
    return encuadraCelda(documento);
  }
  if (!guardada || !EJES_DE_LA_CAMARA.every((eje) => Number.isFinite(guardada[eje]))) return encuadraCelda(documento);
  return normaliza({ cx: guardada.cx, cy: guardada.cy, r: guardada.r }, documento);
}

/** La clave con la que vive la cámara en el almacén, fuera de los documentos del mapa. */
export const CLAVE_DE_CAMARA = (mapaId, clave) => `camara/${mapaId}/${clave}.json`;
