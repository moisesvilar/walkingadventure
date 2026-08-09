// A6P5 · La repisa: lo que se te ha quedado, de quién vino y de qué día, y debajo los
// motes por núcleo.
//
// La pantalla **no calcula nada**: la lista, su orden, la procedencia de cada objeto, los
// motes del mapa activo y la línea del oro salen enteros de `partida/repisa.js`. Por eso
// las ausencias que esta pantalla defiende —sin peso, sin huecos, sin nada que tirar— se
// afirman contra el vocabulario cerrado del núcleo y no mirando un simulador que aquí no
// existe.
//
// Tres cosas de esta capa que sí son decisiones de dibujo, y las tres salen del artefacto:
//
// - **Se lee y no se opera.** Ni pulsación larga, ni deslizar para borrar, ni arrastrar
//   para ordenar: los tres gestos que un inventario tendría **no están conectados a nada**,
//   y por eso aquí no hay ni un `Pressable`.
// - **Los motes van debajo de los objetos y en la misma columna.** Sin pestañas y sin
//   secciones plegables: separarlos los convertiría en un perfil.
// - **La tipografía sale del registro**, que la repisa declara como mundo. La serif no se
//   elige aquí.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TESTIDS } from '@walkingadventure/nucleo/partida/repisa.js';

import { familiaDe } from './tipografia.js';

const PAPEL = '#f6f2e6';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';
const PUNTEADO = '#d9d2be';

/** Una línea de objeto: el nombre a la izquierda, de quién y de qué día a la derecha. */
function LineaDeObjeto({ objeto, serif, sans }) {
  return (
    <View testID={TESTIDS.objeto} accessibilityLabel={objeto.id} style={estilos.linea}>
      <Text style={[estilos.nombre, serif]}>{objeto.nombre}</Text>
      <Text style={[estilos.margen, sans]}>{objeto.linea}</Text>
    </View>
  );
}

/** Una línea de mote: el mote en itálica a la izquierda y el núcleo a la derecha. */
function LineaDeMote({ mote, serif, sans }) {
  return (
    <View testID={TESTIDS.mote} accessibilityLabel={mote.nucleo} style={estilos.linea}>
      <Text style={[estilos.mote, serif]}>{mote.mote}</Text>
      <Text style={[estilos.margen, sans]}>{`en ${mote.nucleo}`}</Text>
    </View>
  );
}

/**
 * @param {object} props
 *   `repisa` lo que devuelve `componeRepisa`; `alVolver` qué ocurre al volver.
 */
export function PantallaRepisa({ repisa, alVolver = null }) {
  // La familia sale del registro que declara la composición, no de esta pantalla. El
  // margen derecho va en la otra, que es la sans de la voz de aplicación en el resto del
  // juego y aquí solo tamaño pequeño: es cómo lo dibuja el artefacto.
  const serif = { fontFamily: familiaDe(repisa.registro) };
  const sans = { fontFamily: 'sans-serif' };
  const texto = (id) => repisa.textos.find((t) => t.id === id).texto;

  return (
    <View style={estilos.raiz} testID="repisa">
      {/* El momento del bucle, para poder afirmar en cuál está la app. */}
      <View testID={TESTIDS.momento} accessibilityLabel={repisa.momento} style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text onPress={alVolver} style={[estilos.volver, serif]}>{texto('volver')}</Text>
        <Text style={[estilos.titulo, serif]}>{texto('titulo')}</Text>

        <View testID={TESTIDS.objetos} style={estilos.lista}>
          {repisa.objetos.vacio
            ? <Text style={[estilos.vacio, serif]}>{repisa.objetos.vacio}</Text>
            : repisa.objetos.lista.map((o) => <LineaDeObjeto key={o.id} objeto={o} serif={serif} sans={sans} />)}
        </View>

        <Text style={[estilos.rotuloDeMotes, serif]}>{texto('motes')}</Text>
        <View testID={TESTIDS.motes} style={estilos.lista}>
          {repisa.motes.vacio
            ? <Text style={[estilos.vacio, serif]}>{repisa.motes.vacio}</Text>
            : repisa.motes.lista.map((m) => <LineaDeMote key={m.nucleo} mote={m} serif={serif} sans={sans} />)}
        </View>

        {/* Al pie, en una sola línea y en cuerpo pequeño: es una moneda que se gasta y no un marcador. */}
        <Text testID={TESTIDS.oro} style={[estilos.oro, serif]}>{repisa.oro.linea}</Text>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PAPEL },
  marca: { width: 0, height: 0 },
  contenido: { padding: 20, gap: 4 },
  volver: { fontSize: 14, color: LAPIZ, marginBottom: 6 },
  titulo: { fontSize: 24, color: TINTA, marginBottom: 10 },
  lista: { gap: 0 },
  linea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PUNTEADO,
  },
  nombre: { flexShrink: 1, fontSize: 17, color: TINTA },
  mote: { flexShrink: 1, fontSize: 17, color: TINTA, fontStyle: 'italic' },
  margen: { fontSize: 12, color: LAPIZ },
  rotuloDeMotes: { fontSize: 17, color: TINTA, marginTop: 22, marginBottom: 4 },
  vacio: { fontSize: 15, color: LAPIZ, paddingVertical: 10 },
  oro: { fontSize: 12, color: LAPIZ, fontStyle: 'italic', marginTop: 24 },
});
