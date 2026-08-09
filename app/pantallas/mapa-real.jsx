// El mapa real de A1P4: la única pantalla del juego donde se ven las calles tal cual.
//
// Se inyecta como componente y no se importa, por lo mismo que Skia: dibujar teselas
// necesita un módulo nativo, y **ninguna spec ha nombrado todavía la dependencia que
// lo daría**. Lo que esta entrega monta es la superficie sobre la que se arrastra la
// marca, que sí es suya, y que dice en voz alta que las calles no están: una
// superficie lisa que se hiciera pasar por un mapa sería exactamente la pieza que, al
// no estar, no protesta (§6h).
//
// La marca y el círculo se dibujan **encima** y son de `arranque.jsx`: eso es lo que
// hace que arrastrar y el radio del círculo se puedan ejercitar sin ninguna librería.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Lo que se dice cuando el mapa real no está montado. Es diagnóstico, no copy de juego. */
export const SIN_MAPA_REAL = 'sin-mapa-real: falta la capa de teselas, que ninguna spec ha nombrado todavía';

/**
 * La superficie del mapa real.
 *
 * @param {object} props  `centro` la coordenada que queda en el medio; `tamano` el
 *   hueco que ocupa.
 */
export function MapaRealSinMontar({ centro, tamano }) {
  return (
    <View
      testID="punto-mapa-real"
      accessibilityLabel={SIN_MAPA_REAL}
      style={[estilos.superficie, tamano ? { width: tamano.ancho, height: tamano.alto } : null]}
    >
      {/* La coordenada del centro va como marca y no como texto: en pantalla sería una
          cifra, y aquí no se enseña ninguna. */}
      <View testID="punto-mapa-centro" accessibilityLabel={centro ? `${centro.lat},${centro.lon}` : ''} style={estilos.marca} />
      <Text style={estilos.aviso}>{' '}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  superficie: { flex: 1, backgroundColor: '#d9d2c0' },
  aviso: { fontSize: 1, opacity: 0 },
  marca: { position: 'absolute', width: 0, height: 0 },
});
