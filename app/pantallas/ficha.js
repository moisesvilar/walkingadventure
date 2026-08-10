// A4P7 · La ficha de texto. **Pantalla, no capa**, y no es un estado vacío del visor:
// es una pantalla del juego con las mismas tipografías, la misma jerarquía y las mismas
// acciones que cualquier otra del momento.
//
// Es lo que hay cuando un sitio te pilla de paso —las ilustraciones solo existen para el
// reparto de la aventura aceptada— y también lo que hay en el modo sin cobertura, con el
// mundo entero en ese estado. Por eso **su composición no cambia** según lo que haya: el
// mismo tipo, el mismo nombre de fantasía, la misma línea de qué es en realidad y la
// misma escena tenga el sitio foto o no la tenga.
//
// Y no dice en ningún sitio que falte nada: ni una disculpa, ni una acción de reintentar,
// ni una de descargar, ni una de conectarse. Anunciarlo solo serviría para señalar algo
// que quien juega no puede arreglar. La comprobación de eso no es esta pantalla: es el
// vocabulario prohibido de `partida/visor.js`, que se criba sobre el texto ya compuesto.
//
// Dos acciones abajo, y la de la izquierda es de otra fila: «Este sitio no pega» lleva a
// A4P8 y es de la fila 35; de ella aquí solo sale el sitio donde se toca.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MARCA } from './marca.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/**
 * @param {object} props
 *   `ficha` lo que devuelve `componeFicha(...)` del paquete; `alSeguir` cerrar el momento;
 *   `alDescartar` el sitio donde se toca «Este sitio no pega», cuya pantalla es de la fila 35.
 */
export function PantallaFicha({ ficha, alSeguir = null, alDescartar = null }) {
  return (
    <View style={estilos.raiz} testID="ficha-texto">
      <View testID="momento-estado" accessibilityLabel="al-parar" style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.tipo}>{ficha.tipo}</Text>
        <Text style={estilos.nombre}>{ficha.nombre}</Text>
        <Text style={estilos.real}>{ficha.enRealidad}</Text>
        {/* La escena solo la tienen los sitios que la declaran. Sin ella no se dibuja una
            línea vacía ni se dice que no la haya: lo que no está, no se nombra. */}
        {ficha.escena ? <Text style={estilos.mundo}>{ficha.escena}</Text> : null}
        <Text style={estilos.visita}>{ficha.visita}</Text>
      </ScrollView>

      <View style={estilos.acciones}>
        <Pressable testID="ficha-descartar" onPress={alDescartar} style={estilos.discreta}>
          <Text style={estilos.discretaTexto}>{ficha.descartar}</Text>
        </Pressable>
        <Pressable testID="llegada-seguir" onPress={alSeguir} style={estilos.accion}>
          <Text style={estilos.accionTexto}>{ficha.seguir}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  marca: MARCA,
  contenido: { padding: 28, gap: 16 },
  tipo: { fontFamily: 'serif', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: LAPIZ },
  nombre: { fontFamily: 'serif', fontSize: 30, color: TINTA },
  real: { fontFamily: 'serif', fontSize: 18, color: TINTA },
  mundo: { fontFamily: 'serif', fontSize: 20, lineHeight: 30, color: TINTA },
  visita: { fontFamily: 'serif', fontSize: 15, color: LAPIZ, marginTop: 12 },
  acciones: { margin: 24, gap: 16 },
  discreta: { paddingVertical: 10, alignItems: 'center' },
  discretaTexto: { fontFamily: 'serif', fontSize: 15, color: LAPIZ },
  accion: { paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
});
