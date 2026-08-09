// A4P8 · El sitio que no pega. **Capa por encima de la ficha, no pantalla nueva**: se
// llega desde la acción discreta «Este sitio no pega» de A4P7 y cerrarla devuelve a la
// ficha con todo como estaba.
//
// Dos toques y ninguno más, y el segundo es el que escribe. No hay diálogo de
// confirmación detrás de «Marcarlo»: eso serían tres toques, y convertiría en trámite
// algo que tiene que costar menos que ignorarlo (`seguridad-privacidad.md` §3). Tampoco
// hay línea de gracias al marcar: la capa se cierra, y que la acción ya no esté
// disponible es toda la confirmación que hace falta.
//
// Los motivos van **antes** de la acción y son opcionales; se elige uno como mucho, y
// volver a tocarlo lo desmarca. **Ninguno lleva campo de texto, ni siquiera «Otra
// cosa»**: un campo libre invita a escribir datos de personas reales del barrio dentro
// de la partida, y ese texto acabaría en la copia exportable. Aquí no hay dónde
// escribirlo, y por eso no hace falta prometerlo.
//
// Cerrar la capa sin pulsar «Marcarlo» habiendo elegido un motivo **descarta la
// elección y no marca nada**: el que escribe es el segundo toque.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/**
 * @param {object} props
 *   `capa` lo que devuelve `creaCapaDeDescartes(...).capaDe(sitio)` del paquete;
 *   `alMarcar` recibe el motivo elegido o `null`, y es el segundo y último toque;
 *   `alCerrar` vuelve a la ficha sin marcar nada.
 */
export function CapaDescarte({ capa, alMarcar = null, alCerrar = null }) {
  const [motivo, setMotivo] = useState(null);

  return (
    <View style={estilos.raiz} testID="descarte-anclaje">
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.nombre}>{capa.nombre}</Text>
        <Text style={estilos.pregunta}>{capa.pregunta}</Text>
        {/* Va antes de los motivos y no después: es lo que convierte la lista en una
            ayuda en lugar de en un formulario. */}
        <Text style={estilos.suelta}>{capa.sinObligacion}</Text>

        <View style={estilos.motivos}>
          {capa.motivos.map((m) => (
            <Pressable
              key={m.id}
              testID="descarte-motivo"
              accessibilityLabel={m.id}
              accessibilityState={{ selected: motivo === m.id }}
              onPress={() => setMotivo(motivo === m.id ? null : m.id)}
              style={[estilos.motivo, motivo === m.id && estilos.motivoMarcado]}
            >
              <Text style={estilos.motivoTexto}>{m.texto}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={estilos.reversible}>{capa.reversibilidad}</Text>
      </ScrollView>

      <Pressable
        testID="descarte-confirmar"
        onPress={() => {
          if (alMarcar) alMarcar(motivo);
          if (alCerrar) alCerrar();
        }}
        style={estilos.marcar}
      >
        <Text style={estilos.marcarTexto}>{capa.confirmar}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  contenido: { padding: 28, gap: 16 },
  nombre: { fontFamily: 'serif', fontSize: 22, color: LAPIZ },
  pregunta: { fontFamily: 'serif', fontSize: 28, color: TINTA },
  suelta: { fontFamily: 'serif', fontSize: 16, lineHeight: 24, color: TINTA },
  motivos: { gap: 10, marginTop: 8 },
  motivo: { paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: LAPIZ },
  motivoMarcado: { borderColor: TINTA, borderWidth: 2 },
  motivoTexto: { fontFamily: 'serif', fontSize: 17, color: TINTA },
  reversible: { fontFamily: 'serif', fontSize: 15, color: LAPIZ, marginTop: 12 },
  marcar: { margin: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  marcarTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
});
