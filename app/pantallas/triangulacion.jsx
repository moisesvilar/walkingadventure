// A6P3 · La primera vez que triangulas. La escena de la primera coincidencia, que
// ocurre **una sola vez en toda la partida**.
//
// No cuelga de la portada: aparece dentro de la llegada a un núcleo, encima de lo que
// allí se cuenta, porque lo que la provoca es que allí te cuenten otra versión. Es
// modal y **no se puede saltar**: se cierra con su única acción, no con un gesto de
// descarte ni con el botón de atrás, y su valor entero está en que se lea.
//
// Aquí no se explica nada y no se decide nada. Las dos versiones, su orden —arriba la
// que se acaba de oír—, sus dos momentos y su única acción vienen hechos de
// `partida/triangulacion.js`. Las tres reglas de dibujo:
//
// - **Ni un texto que explique que las noticias se deforman.** La escena pone las dos
//   juntas y calla.
// - **Ninguna marca sobre ninguna de las dos**: mismo borde, misma tipografía, mismo
//   tamaño. Ni cuál es la buena, ni un orden que lo insinúe.
// - **Ninguna animación de revelado.** Celebrar un descubrimiento lo convertiría en un
//   logro, que es justo lo que ninguna pantalla del juego hace.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';
const FILETE = '#8a6d34';
const ROJO = '#8c2f18';

/** El texto de una versión: el de su entrada del diario, y nunca uno nuevo. */
function textoDeVersion(version, textos = {}) {
  return textos[version.texto]?.texto ?? version.plantilla ?? version.suceso;
}

/**
 * @param {object} props
 *   `escena` lo que devuelve `componeLaEscena`, o lo que trae `loQueAquiSeCuenta` en su
 *   campo `escena`; `textos` el área de textos de la partida; `alApuntarlo` qué ocurre
 *   al cerrarla —cerrar el marcador y volver a la llegada—, que es su única acción.
 */
export function PantallaTriangulacion({ escena, textos = {}, alApuntarlo = null }) {
  if (!escena) return null;
  return (
    <Modal visible transparent={false} animationType="none" onRequestClose={() => {}}>
      <View style={estilos.raiz} testID="triangulacion-escena">
        <View testID="momento" accessibilityLabel={escena.momento} style={estilos.marca} />

        <ScrollView contentContainerStyle={estilos.contenido}>
          <Text style={estilos.antetitulo}>{escena.antetitulo}</Text>
          <Text style={estilos.titular}>{escena.suceso}</Text>

          {escena.versiones.map((version, i) => (
            <React.Fragment key={version.id}>
              {i === 1 ? <Text style={estilos.entreLasDos}>{escena.entreLasDos}</Text> : null}
              <View testID="diario-version" style={estilos.version}>
                <Text style={estilos.cuando}>{version.cuando}</Text>
                <Text style={estilos.dicho}>«{textoDeVersion(version, textos)}»</Text>
              </View>
            </React.Fragment>
          ))}

          <Text style={estilos.remate}>{escena.remate}</Text>
        </ScrollView>

        {escena.acciones.map((accion) => (
          <Pressable key={accion.id} testID={`triangulacion-${accion.id}`} onPress={alApuntarlo} style={estilos.accion}>
            <Text style={estilos.accionTexto}>{accion.texto}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  marca: { width: 0, height: 0 },
  contenido: { padding: 28, gap: 14 },
  antetitulo: { fontFamily: 'System', fontSize: 13, color: LAPIZ, letterSpacing: 1 },
  titular: { fontFamily: 'serif', fontSize: 26, color: TINTA },
  // Las dos cajas son la misma caja: mismo borde, mismo relleno, misma tipografía.
  version: { borderWidth: 1, borderColor: FILETE, padding: 16 },
  cuando: { fontFamily: 'System', fontSize: 12, color: LAPIZ, letterSpacing: 1 },
  dicho: { fontFamily: 'serif', fontSize: 19, lineHeight: 29, color: TINTA, fontStyle: 'italic', marginTop: 6 },
  entreLasDos: { fontFamily: 'System', fontSize: 12, color: ROJO, letterSpacing: 2, textAlign: 'center' },
  remate: { fontFamily: 'serif', fontSize: 22, color: TINTA, marginTop: 18 },
  accion: { margin: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
});
