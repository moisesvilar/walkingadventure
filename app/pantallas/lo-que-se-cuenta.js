// A4P5 · Lo que aquí se cuenta. La única pantalla que compone esta fila.
//
// Pantalla completa, voz del mundo en serif, **sin cabecera de navegación y sin ningún
// camino de vuelta**: no se llega aquí tocando nada, se llega llegando. Su único control
// es «Seguir», que cierra la llegada y cierra el momento — el móvil vuelve al bolsillo.
//
// No decide nada. El titular, la versión que llegó a este núcleo, si hay sección de lo
// que se cuenta de la jugadora y la línea del diario vienen hechos de
// `partida/llegadas.js`. Aquí solo se pintan, y las tres reglas de dibujo son del diseño:
//
// - **«Y de ti» no aparece cuando no ha llegado nada.** Una sección que dijera «todavía
//   nadie habla de ti» sería un marcador de reputación con otras palabras.
// - **La línea del diario es una constatación y no un botón**: informa de que queda
//   anotado, y el diario se lee desde la portada.
// - **Ningún nivel y ninguna etiqueta de fiabilidad**, que además aquí es barato: el dato
//   no llega hasta esta pantalla.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MARCA } from './marca.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/** El texto de una versión que llegó: el redactado si lo hay, y si no, su asunto. */
function textoDeVersion(version) {
  return version.texto ?? version.hechos?.asunto ?? version.rumor;
}

/**
 * @param {object} props
 *   `loQueSeCuenta` la parte `pantalla` de lo que devuelve
 *   `creaLlegadas().loQueAquiSeCuenta(...)` — lo que aflora, sin el nivel ni nada que
 *   se le parezca; lo que queda anotado viaja por otro lado y no entra aquí;
 *   `alSeguir` qué ocurre al cerrar la llegada, que es la única acción de la pantalla.
 */
export function PantallaLoQueSeCuenta({ loQueSeCuenta, alSeguir = null }) {
  const cuenta = loQueSeCuenta;
  return (
    <View style={estilos.raiz} testID="lo-que-se-cuenta">
      <View testID="momento-estado" accessibilityLabel="al-parar" style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.antetitulo}>{cuenta.antetitulo}</Text>

        {cuenta.sinNada ? (
          <Text style={estilos.mundo}>{cuenta.sinNada}</Text>
        ) : (
          <>
            <Text style={estilos.seccion}>{cuenta.loQueCuentanAqui.titulo}</Text>
            {cuenta.loQueCuentanAqui.versiones.map((version) => (
              <Text key={version.rumor} style={estilos.mundo}>
                {textoDeVersion(version)}
              </Text>
            ))}
          </>
        )}

        {cuenta.deTi ? (
          <View testID="lo-que-se-cuenta-de-ti">
            <Text style={estilos.seccion}>{cuenta.deTi.titulo}</Text>
            {cuenta.deTi.versiones.map((version) => (
              <Text key={version.rumor} style={estilos.mundo}>
                {textoDeVersion(version)}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={estilos.diario}>{cuenta.diario}</Text>
      </ScrollView>

      <Pressable testID="llegada-seguir" onPress={alSeguir} style={estilos.accion}>
        <Text style={estilos.accionTexto}>{cuenta.seguir}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  marca: MARCA,
  contenido: { padding: 28, gap: 18 },
  antetitulo: { fontFamily: 'serif', fontSize: 15, color: LAPIZ },
  seccion: { fontFamily: 'serif', fontSize: 15, color: LAPIZ, marginTop: 12 },
  mundo: { fontFamily: 'serif', fontSize: 20, lineHeight: 30, color: TINTA },
  diario: { fontFamily: 'serif', fontSize: 14, color: LAPIZ, marginTop: 24 },
  accion: { margin: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
});
