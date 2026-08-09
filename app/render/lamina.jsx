// La lámina: el elemento que enseñan las pantallas del juego. Ocupa entero el hueco
// que le den, a sangre y **sin ningún control encima** —el mapa no lleva botones ni
// leyenda ni selector de estilo: el estilo se cambia desde los ajustes y en ningún
// otro sitio—. Norte siempre arriba, y no hay manera de pedir que rote.
//
// Aquí no vive ni un color: compone la escena con el estilo pedido y se la da al
// ejecutor. Cambiar de estilo repinta y jamás resiembra, porque el documento que
// entra es el mismo objeto y no se levanta otra vez del almacén.

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { componeEscena } from '@walkingadventure/nucleo/render/escena.js';
import { colocadorSimple } from '@walkingadventure/nucleo/render/colocador-simple.js';
import { ESTILOS, ESTILO_POR_DEFECTO } from '@walkingadventure/nucleo/render/estilos.js';

import { exigeEnlace } from './enlace-skia.js';
import { creaMedidorSkia } from './medidor-skia.js';
import { pintaEscena } from './skia.js';

/**
 * @param {object} props
 *   `documento` el mundo congelado de la celda —el **mismo objeto** entre dos
 *   estilos—; `estilo` el identificador elegido; `vista` `{ cx, cy, r, foco,
 *   paraje, escala }`; `tamano` `{ ancho, alto }` en px; `factorTexto` el ajuste
 *   de tamaño de letra; `enlace` el enlace con Skia; `colocador` el de rótulos,
 *   que por defecto es el provisional de esta fila.
 */
export function Lamina({
  documento,
  estilo = ESTILO_POR_DEFECTO,
  catalogo = ESTILOS,
  vista = null,
  tamano,
  factorTexto = 1,
  enlace,
  colocador = colocadorSimple,
}) {
  const { Skia, enums, fuente, Canvas, Picture, creaCuadro } = exigeEnlace(enlace);

  // La escena se compone una vez por mundo, estilo, tamaño y vista: arrastrar y
  // hacer zoom mueven la cámara sobre la escena que ya existe, no la recomponen.
  const escena = useMemo(
    () => componeEscena({ documento, estilo, catalogo, vista, tamano, factorTexto, medidor: creaMedidorSkia(fuente), colocador }),
    [documento, estilo, catalogo, vista, tamano, factorTexto, fuente, colocador],
  );

  const cuadro = useMemo(
    () => creaCuadro((canvas) => pintaEscena({ canvas, Skia, enums, fuente }, escena)),
    [creaCuadro, Skia, enums, fuente, escena],
  );

  return (
    <View
      style={[estilos.lamina, { width: tamano.ancho, height: tamano.alto }]}
      testID="mapa"
      accessibilityLabel="El mapa"
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={cuadro} />
      </Canvas>
      <View testID="mapa-listo" style={estilos.marca} accessibilityElementsHidden />
      <View testID="mapa-estilo" accessibilityLabel={escena.estilo} style={estilos.marca} />
      <View testID="mapa-mundo" accessibilityLabel={String(escena.documentoId)} style={estilos.marca} />
      {escena.rotulos.map((rotulo) => (
        <View key={rotulo.id} testID="mapa-rotulo" accessibilityLabel={`${rotulo.rol}:${rotulo.texto}`} style={estilos.marca} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  lamina: { overflow: 'hidden' },
  // Marcas de estado para la batería: ocupan cero y no se ven. La lámina sigue sin
  // llevar nada encima.
  marca: { position: 'absolute', width: 0, height: 0 },
});
