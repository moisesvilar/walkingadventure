// «Sitios que marcaste», dentro de A6P6. **La pantalla de ajustes es de la fila 38**;
// de aquí sale solo lo que esa fila cuelga dentro: la fila con su número, la lista al
// abrirla y el deshacer de cada sitio.
//
// Deshacer vive en ajustes y no en el sitio, y es deliberado: deshacerlo desde el sitio
// obligaría a volver a andar hasta allí, que es el único coste que este juego no puede
// cobrar por un cambio de opinión (`seguridad-privacidad.md` §3).
//
// Cada fila lleva el nombre de fantasía y, debajo, qué es en realidad. **Sin motivo, sin
// fecha, sin agrupación y sin buscador**: el motivo no se usa para nada mecánico y
// enseñarlo aquí convertiría la lista en una rendición de cuentas. Y no se pide motivo
// para deshacer, igual que no se pedía para marcar.
//
// Registro de aplicación, como todo lo de ajustes: aquí no habla el mundo.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const PAPEL = '#f6f2e6';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/**
 * @param {object} props
 *   `sitios` lo que devuelve `creaCapaDeDescartes(...).sitiosMarcados()`;
 *   `alAbrir` abre la lista desde la fila de ajustes; `alDeshacer` recibe el
 *   identificador del sitio que vuelve a contar.
 */
export function FilaSitiosMarcados({ sitios, alAbrir = null }) {
  return (
    <Pressable testID="sitios-marcados" accessibilityLabel={String(sitios.cuantos)} onPress={alAbrir} style={estilos.fila}>
      <Text style={estilos.etiqueta}>{sitios.etiqueta}</Text>
      <Text style={estilos.numero}>{sitios.cuantos}</Text>
    </Pressable>
  );
}

/** La lista al abrirla. Con cero marcados dice que no hay ninguno, y no finge una lista. */
export function ListaSitiosMarcados({ sitios, alDeshacer = null }) {
  return (
    <View style={estilos.raiz} testID="sitios-marcados" accessibilityLabel={String(sitios.cuantos)}>
      <Text style={estilos.titulo}>{sitios.etiqueta}</Text>
      {sitios.ninguno ? (
        <Text style={estilos.vacio}>{sitios.ninguno}</Text>
      ) : (
        <ScrollView contentContainerStyle={estilos.lista}>
          {sitios.filas.map((f) => (
            <View key={f.anclaje} style={estilos.entrada}>
              <View style={estilos.textos}>
                <Text style={estilos.nombre}>{f.nombre}</Text>
                {f.enRealidad ? <Text style={estilos.real}>{f.enRealidad}</Text> : null}
              </View>
              <Pressable
                testID="sitio-marcado-deshacer"
                accessibilityLabel={f.anclaje}
                onPress={() => alDeshacer && alDeshacer(f.anclaje)}
                style={estilos.deshacer}
              >
                <Text style={estilos.deshacerTexto}>{f.deshacer}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PAPEL, padding: 20 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  etiqueta: { fontSize: 16, color: TINTA },
  numero: { fontSize: 16, color: LAPIZ },
  titulo: { fontSize: 20, color: TINTA, marginBottom: 12 },
  vacio: { fontSize: 15, color: LAPIZ },
  lista: { gap: 14 },
  entrada: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  textos: { flexShrink: 1, gap: 2 },
  nombre: { fontFamily: 'serif', fontSize: 18, color: TINTA },
  real: { fontSize: 13, color: LAPIZ },
  deshacer: { paddingVertical: 8, paddingHorizontal: 10 },
  deshacerTexto: { fontSize: 14, color: TINTA },
});
