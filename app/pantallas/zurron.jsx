// A2P2 · El zurrón: lo que el mundo hizo mientras no estabas, leído una vez y cerrado.
//
// La pantalla **no calcula nada**: recibe lo que compuso `partida/zurron.js` y lo pinta. Que
// exista o no lo decide el núcleo, y por eso aquí no hay ni un estado vacío: si no hay nada
// que contar, esta pantalla no se monta.
//
// Tres ausencias que son la pantalla entera y que se pintan **no poniéndolas**: ninguna
// cifra —ni de pasos, ni de días, ni de cuántas cosas han pasado—, ningún indicador de
// cuántas entradas quedan y ninguna manera de tocar una entrada para saber más. Lo que el
// zurrón cuenta sigue sedimentado en su núcleo, y atenderlo es ir andando.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { familiaDe } from './tipografia.js';
import { MARCA } from './marca.js';

const PAPEL = '#f6f2e6';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';
const FILETE = '#8a6d34';

/**
 * @param {object} props
 *   `zurron` lo que devuelve `componeElZurron`; `alSeguir` la única acción, la que lo cierra
 *   y sigue hacia lo que hay hoy.
 */
export function PantallaZurron({ zurron, alSeguir = null }) {
  if (!zurron) {
    throw new Error('la pantalla del zurrón se monta con lo que compuso el núcleo: sin zurrón no hay pantalla, y montarla vacía sería la pantalla que dice que no pasó nada');
  }
  // La voz del mundo, resuelta del registro que declara la composición y nunca elegida aquí.
  const serif = { fontFamily: familiaDe(zurron.registro) };

  return (
    <View style={estilos.raiz} testID={zurron.testid}>
      <View testID="momento" accessibilityLabel={zurron.momento} style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.rotulo}>{zurron.rotulo}</Text>

        {/* El envoltorio es el único texto nuevo de la pantalla, y cae al de plantilla sin
            que nada lo indique: sin cobertura el zurrón dice lo mismo. */}
        <Text testID={zurron.envoltorio.testid} style={[estilos.envoltorio, serif]}>{zurron.envoltorio.texto}</Text>

        {zurron.entradas.map((entrada) => (
          // Entre entradas, aire y nada más: ni iconos, ni líneas, ni numeración. Y ninguna
          // es pulsable, que es una decisión y no un olvido.
          <View key={entrada.paso} testID={entrada.testid} accessibilityLabel={String(entrada.paso)} style={estilos.entrada}>
            <Text style={estilos.sitio}>{entrada.rotulo}</Text>
            <Text style={[estilos.texto, serif]}>{entrada.texto}</Text>
          </View>
        ))}

        <Text style={[estilos.cierre, serif]}>{zurron.cierre}</Text>
      </ScrollView>

      <Pressable testID={zurron.accion.testid} accessibilityLabel={zurron.accion.id} onPress={alSeguir} style={estilos.accion}>
        <Text style={[estilos.textoDeAccion, serif]}>{zurron.accion.texto}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PAPEL },
  marca: MARCA,
  contenido: { padding: 24, paddingBottom: 12 },
  // Versalitas del color del filete, como el resto de rótulos del momento.
  rotulo: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: FILETE, marginBottom: 12 },
  envoltorio: { fontSize: 20, lineHeight: 28, color: TINTA, marginBottom: 24 },
  entrada: { marginBottom: 20 },
  sitio: { fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: FILETE, marginBottom: 4 },
  texto: { fontSize: 16, lineHeight: 24, color: TINTA },
  cierre: { fontSize: 14, lineHeight: 22, color: LAPIZ, marginTop: 8 },
  accion: { paddingVertical: 16, alignItems: 'center' },
  textoDeAccion: { fontSize: 17, color: TINTA },
});
