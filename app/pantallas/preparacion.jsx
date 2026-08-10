// A2P5 · La preparación. La pantalla es de SPEC-025 y aquí no se rediseña: lo que esta capa
// hace es montarla con lo que compone el núcleo y salir de ella a andar.
//
// **Dice exactamente lo mismo con red y sin ella**, y eso no es una promesa del dibujo: los
// textos salen de `componePreparacion`, que no mira lo conseguido. Ni un icono, ni un color,
// ni una frase cambian porque una ilustración no haya llegado.
//
// Y no ofrece cancelar: dura segundos y termina sola. Volver atrás desde aquí es «Otra cosa»
// en la ficha, un paso antes.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MARCA } from './marca.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/**
 * @param {object} props
 *   `preparacion` lo que devuelve `componePreparacion`; `lista` si la preparación ya terminó
 *   —el botón se habilita al cerrarse, no al conseguirlo todo—; `alSalirAAndar` qué ocurre al
 *   pulsarlo.
 */
export function PantallaPreparacion({ preparacion, lista = false, alSalirAAndar = null }) {
  return (
    <View style={estilos.raiz} testID="preparacion-salida">
      <View testID="momento-antes-de-salir" style={estilos.marca} />

      <Text style={estilos.titulo}>{preparacion.titulo}</Text>
      <Text style={estilos.coletilla}>{preparacion.coletilla}</Text>

      {/* Las tres líneas fijas, en voz de mundo y sin ningún indicador por recurso. */}
      <View testID="preparacion-lineas" accessibilityLabel={preparacion.lineas.join(' · ')} style={estilos.lineas}>
        {preparacion.lineas.map((linea) => (
          <Text key={linea} style={estilos.linea}>{linea}</Text>
        ))}
      </View>

      {/* La frase más importante de la pantalla: el contrato del juego dicho en una línea. */}
      <Text style={estilos.contrato}>{preparacion.contrato}</Text>

      <Pressable
        testID="preparacion-listo"
        onPress={alSalirAAndar}
        disabled={!lista}
        style={[estilos.accion, !lista && estilos.accionEnEspera]}
      >
        <Text style={estilos.accionTexto}>{preparacion.listo}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA, padding: 24, gap: 16, justifyContent: 'center' },
  marca: MARCA,
  titulo: { fontSize: 26, color: TINTA },
  coletilla: { fontSize: 15, color: LAPIZ },
  lineas: { gap: 8, paddingVertical: 16 },
  linea: { fontSize: 16, color: TINTA },
  contrato: { fontSize: 15, color: TINTA, lineHeight: 22 },
  accion: { paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: TINTA, borderRadius: 4, alignItems: 'center' },
  accionEnEspera: { borderColor: LAPIZ, opacity: 0.5 },
  accionTexto: { fontSize: 16, color: TINTA },
});
