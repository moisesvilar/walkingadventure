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
//   elige aquí, y **no hay ninguna excepción para la línea de procedencia**. El wireframe
//   la dibuja en sans pequeña y aquí estaba escrita a mano; se resuelve por el mecanismo y
//   no por la excepción, porque la familia no es una decisión de esta pantalla: en este
//   juego una sans es voz de aplicación, «de Ferreiro · día 12» habla como mundo igual que
//   el nombre que tiene al lado, y un texto con voz de aplicación colocado en la repisa lo
//   rechaza `coloca` nombrándolo. Lo que el artefacto pedía y sí sobrevive es la
//   **jerarquía**: cuerpo pequeño y color de lápiz, que es lo que separa el margen del
//   nombre. Si algún día esa línea tuviera que ir de verdad en sans, la vía es que su
//   registro lo diga —y eso sería abrir la voz de aplicación dentro del bucle, que es un
//   rediseño de `lenguaje.md` y no un `fontFamily` en un componente.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TESTIDS } from '@walkingadventure/nucleo/partida/repisa.js';

import { familiaDe } from './tipografia.js';
import { MARCA } from './marca.js';

const PAPEL = '#f6f2e6';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';
const PUNTEADO = '#d9d2be';

/** Una línea de objeto: el nombre a la izquierda, de quién y de qué día a la derecha. */
function LineaDeObjeto({ objeto, serif }) {
  return (
    <View testID={TESTIDS.objeto} accessibilityLabel={objeto.id} style={estilos.linea}>
      <Text style={[estilos.nombre, serif]}>{objeto.nombre}</Text>
      <Text style={[estilos.margen, serif]}>{objeto.linea}</Text>
    </View>
  );
}

/** Una línea de mote: el mote en itálica a la izquierda y el núcleo a la derecha. */
function LineaDeMote({ mote, serif }) {
  return (
    <View testID={TESTIDS.mote} accessibilityLabel={mote.nucleo} style={estilos.linea}>
      <Text style={[estilos.mote, serif]}>{mote.mote}</Text>
      <Text style={[estilos.margen, serif]}>{`en ${mote.nucleo}`}</Text>
    </View>
  );
}

/**
 * @param {object} props
 *   `repisa` lo que devuelve `componeRepisa`; `alVolver` qué ocurre al volver.
 */
export function PantallaRepisa({ repisa, alVolver = null }) {
  // **Una sola familia en toda la pantalla, y sale del registro.** No hay una segunda
  // constante de fuente aquí y no es un olvido: ver la nota de la cabecera.
  const serif = { fontFamily: familiaDe(repisa.registro) };
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
            : repisa.objetos.lista.map((o) => <LineaDeObjeto key={o.id} objeto={o} serif={serif} />)}
        </View>

        <Text style={[estilos.rotuloDeMotes, serif]}>{texto('motes')}</Text>
        <View testID={TESTIDS.motes} style={estilos.lista}>
          {repisa.motes.vacio
            ? <Text style={[estilos.vacio, serif]}>{repisa.motes.vacio}</Text>
            : repisa.motes.lista.map((m) => <LineaDeMote key={m.nucleo} mote={m} serif={serif} />)}
        </View>

        {/* Al pie, en una sola línea y en cuerpo pequeño: es una moneda que se gasta y no un marcador. */}
        <Text testID={TESTIDS.oro} style={[estilos.oro, serif]}>{repisa.oro.linea}</Text>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PAPEL },
  marca: MARCA,
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
