// El ofrecimiento de levantar un mapa: lo que se ve al abrir la app en un sitio al que
// no llega ninguno de tus mapas.
//
// **Sustituye a la portada, no se superpone a ella.** Una portada lleva un mapa dentro
// y aquí no hay ninguno; enseñar la de casa estando a trescientos kilómetros ofrecería
// salir a andar en un mundo donde no estás, que es exactamente lo que
// `alcance-del-mundo.md` §3 descarta —leerlos sí, jugarlos desde el sofá no—.
//
// Lo que esta pantalla **no** tiene, y es la mitad de lo que entrega: ninguna distancia
// a ningún mapa, ninguna lista de los mapas que tienes, ningún «volver a casa», ningún
// mapa dibujado de fondo y ningún selector. Y no hay pantalla de vuelta: al volver a un
// sitio conocido la portada aparece **sin transición, aviso ni bienvenida**, porque
// anunciarlo convertiría en evento algo que tiene que ser invisible.
//
// Como el resto de las pantallas, no decide nada: qué se dice y qué acciones hay sale
// entero de `componeOfrecimiento`, y las tres puertas siguen porque el diario es
// precisamente donde se leen los mapas donde ya no estás.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/**
 * @param {object} props
 *   `ofrecimiento` lo que devuelve `componeOfrecimiento`; `alLevantar` y `alDejarlo`
 *   qué ocurre en cada acción; `alAbrirPuerta` el diario, la repisa o los ajustes.
 */
export function PantallaOfrecimiento({ ofrecimiento, alLevantar = null, alDejarlo = null, alAbrirPuerta = null }) {
  const accionDe = (id) => ofrecimiento.acciones.find((a) => a.id === id);

  return (
    <View style={estilos.raiz} testID={ofrecimiento.testid}>
      {/* El momento del bucle y el mapa activo, que aquí es la ausencia de uno. */}
      <View testID="momento" accessibilityLabel={ofrecimiento.momento} style={estilos.marca} />
      <View testID="mapa-activo" accessibilityLabel={ofrecimiento.mapaActivo} style={estilos.marca} />

      <View style={estilos.contenido}>
        {/* El sitio dicho como lugar y no como coordenada. */}
        <Text testID="ofrecimiento-sitio" style={estilos.sitio}>{ofrecimiento.sitio.toUpperCase()}</Text>
        <Text testID="ofrecimiento-titular" style={estilos.titular}>{ofrecimiento.titular}</Text>
        <Text testID="ofrecimiento-cuerpo" style={estilos.cuerpo}>{ofrecimiento.cuerpo}</Text>
        {ofrecimiento.aviso ? <Text testID="ofrecimiento-aviso" style={estilos.cuerpo}>{ofrecimiento.aviso}</Text> : null}
      </View>

      <View style={estilos.acciones}>
        <Pressable testID={accionDe('levantar').testid} onPress={alLevantar} style={estilos.principal}>
          <Text style={estilos.principalTexto}>{accionDe('levantar').texto}</Text>
        </Pressable>
        <Pressable testID={accionDe('dejarlo').testid} onPress={alDejarlo} style={estilos.texto}>
          <Text style={estilos.textoTexto}>{accionDe('dejarlo').texto}</Text>
        </Pressable>
      </View>

      <View style={estilos.puertas}>
        {ofrecimiento.puertas.map((id) => (
          <Pressable
            key={id}
            testID={`puerta-${id}`}
            onPress={() => (alAbrirPuerta ? alAbrirPuerta(id) : null)}
            style={estilos.puerta}
          >
            <Text style={estilos.puertaTexto}>{id}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA, justifyContent: 'space-between' },
  marca: { width: 0, height: 0 },
  contenido: { padding: 24, gap: 12, marginTop: 48 },
  sitio: { fontSize: 13, color: LAPIZ, letterSpacing: 2 },
  titular: { fontSize: 26, color: TINTA, lineHeight: 32 },
  cuerpo: { fontSize: 15, color: TINTA, lineHeight: 22 },
  acciones: { padding: 24, gap: 12 },
  principal: { paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: TINTA, borderRadius: 4, alignItems: 'center' },
  principalTexto: { fontSize: 16, color: TINTA },
  texto: { paddingVertical: 10, alignItems: 'center' },
  textoTexto: { fontSize: 15, color: LAPIZ },
  puertas: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 24 },
  puerta: { paddingVertical: 8, paddingHorizontal: 12 },
  puertaTexto: { fontSize: 14, color: LAPIZ },
});
