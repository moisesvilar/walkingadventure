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
//
// Y **es una capa de verdad, no un hermano en el flujo**. Hasta SPEC-050 su raíz era
// `flex: 1` sin posicionar y `llegada.js` la montaba como último hijo de una columna
// donde la ficha ya pedía `flex: 1`: los dos se repartían el alto, los cinco motivos
// empujaban, y a 1080×2400 los dos últimos salían con cotas degeneradas (`y2 < y1`)
// **encima de «Marcarlo»** — el marcado solo entraba por una franja de 30 px. La otra
// capa del mismo fichero, el visor, siempre usó `absoluteFillObject`; esta no, y esa
// es toda la diferencia. Con la capa acotada por la pantalla, el desplazable se queda
// con los motivos y la acción, que va fuera de él, se queda abajo y entera.

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
      {/* El desplazable se lleva el hueco que sobre y no más: `flex: 1` aquí es lo que
          impide que los motivos empujen a «Marcarlo» fuera de la pantalla. */}
      <ScrollView style={estilos.desplazable} contentContainerStyle={estilos.contenido}>
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
  // Capa: cubre la pantalla y **no compite por el alto con la ficha**, que sigue montada
  // debajo para que cerrar la devuelva con todo como estaba.
  //
  // Las cuatro anclas van **escritas una a una y no con `...StyleSheet.absoluteFillObject`**,
  // que es lo que hace el visor. Medido en `wa-pixel` el 12-ago-2026: con el spread la capa
  // salía en `[0,2122][1080,2400]` —o sea, apilada debajo de la ficha y no encima— y los
  // cinco motivos no se pintaban; escritas así sale a pantalla completa. Se deja explícito
  // en vez de perseguir por qué el spread no cuaja: lo que esta pantalla necesita es un
  // posicionamiento que se pueda leer y afirmar, no una constante que dependa de cómo la
  // exporte la versión de React Native que toque.
  raiz: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: PLACA },
  desplazable: { flex: 1 },
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
