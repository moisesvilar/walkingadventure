// A4P1 y A4P2 · El visor del anclaje. **Una capa a pantalla completa, no un paso**: se
// cierra con la flecha o tocando fuera, y debajo sigue estando el resto de la llegada.
//
// No decide nada. Qué lado abre, qué dice cada cartela, si hay foto y si se abre sola
// vienen hechos de `partida/visor.js`; aquí viven el gesto, el pintado y el ciclo de vida
// de la capa, que son las tres cosas que no se pueden afirmar sin dispositivo.
//
// Tres reglas de dibujo que son del diseño y no de la implementación:
//
// - **La ausencia de foto no se representa: se sustituye.** Sin foto el lado real es el
//   papel liso del estilo, y no hay hueco de imagen, ni icono de imagen rota, ni leyenda.
//   Un marcador de posición es exactamente el anuncio de falta que la decisión prohíbe.
// - **La invitación se escribe, no se anima.** El tirador en el borde ya enseña que hay
//   algo debajo y la línea de la cartela lo dice en voz de mundo. Ni parpadeos ni tutorial.
// - **Dos posiciones estables y ninguna intermedia.** Es una revelación y no una galería:
//   soltar antes del cruce devuelve a la ficción, soltar en el cruce o después lo lleva al
//   lado real. Quién decide eso es el paquete, con `alSoltar`.
//
// Y el tirador vuelve **al borde de la ficción** cada vez que la capa se monta, también
// cuando se reabre a un toque: quien vuelve a mirar quiere volver a ver el cruce, y abrir
// por el lado real le regalaría la revelación que ya tenía.

import React from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { LADOS, TIRADOR, alSoltar, cartelaEnPosicion, ladoEnPosicion } from '@walkingadventure/nucleo/partida/visor.js';

const PLACA = '#efe3c0';
const PAPEL = '#e8dcc0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';
const FONDO = '#12180f';

/** La flecha de cierre. Un solo glifo: no hay botón de cerrar en texto ni de aceptar. */
export const CERRAR = '▾';

/** El tirador, que es el único control del arrastre. */
export const ASA = '◂ ▸';

/**
 * @param {object} props
 *   `visor` lo que devuelve `componeVisor(...)` del paquete: los dos lados, las dos
 *   cartelas y el recorrido del tirador; `alCerrar` la única salida, la misma para la
 *   flecha y para tocar fuera.
 *
 * No hay ninguna propiedad para confirmar, para pasar de lámina ni para abrir por el lado
 * real, y su ausencia es la pieza.
 */
export function PantallaVisor({ visor, alCerrar = null }) {
  const [t, ponT] = React.useState(TIRADOR.inicio);
  const [ancho, ponAncho] = React.useState(0);
  const posicion = React.useRef(TIRADOR.inicio);
  const desde = React.useRef(TIRADOR.inicio);
  const anchoDeLaLamina = React.useRef(0);

  posicion.current = t;
  anchoDeLaLamina.current = ancho;

  // El responder se crea una sola vez: recrearlo en cada pintado corta el gesto a mitad,
  // que es justo el arrastre interrumpido que no debe ocurrir por culpa nuestra.
  const gesto = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { desde.current = posicion.current; },
      onPanResponderMove: (_, estado) => {
        const recorrido = anchoDeLaLamina.current || 1;
        const bruto = desde.current + estado.dx / recorrido;
        ponT(Math.min(TIRADOR.max, Math.max(TIRADOR.min, bruto)));
      },
      // Soltar no lo decide la pantalla: el paquete dice a qué lado cae, cruce incluido.
      onPanResponderRelease: () => ponT(alSoltar(posicion.current).posicion),
      onPanResponderTerminate: () => ponT(alSoltar(posicion.current).posicion),
    }),
  ).current;

  const lado = ladoEnPosicion(t);
  const cartela = cartelaEnPosicion(visor, t);

  return (
    <View style={estilos.capa} testID="visor-anclaje">
      <Pressable testID="visor-fuera" accessibilityLabel="cerrar-el-visor" style={estilos.fuera} onPress={alCerrar} />

      <Pressable testID="visor-cerrar" accessibilityLabel="cerrar-el-visor" onPress={alCerrar} style={estilos.cerrar}>
        <Text style={estilos.flecha}>{CERRAR}</Text>
      </Pressable>

      <View style={estilos.lamina} onLayout={(e) => ponAncho(e.nativeEvent.layout.width)}>
        <Image source={visor.ficcion.imagen} style={estilos.imagen} resizeMode="cover" />

        {/* El lado real se descubre por la izquierda a medida que el tirador avanza. Sin
            foto lo que se descubre es el papel del estilo, y no un hueco. */}
        <View testID="visor-lado-real" accessibilityLabel={lado} style={[estilos.real, { width: `${t * 100}%` }]}>
          {visor.real.foto ? <Image source={visor.real.foto} style={estilos.imagen} resizeMode="cover" /> : null}
        </View>

        <View testID="visor-tirador" style={[estilos.tirador, { left: `${t * 100}%` }]} {...gesto.panHandlers}>
          <Text style={estilos.asa}>{ASA}</Text>
        </View>
      </View>

      <View testID="visor-cartela" accessibilityLabel={cartela.lado} style={estilos.cartela}>
        <Text style={estilos.tipo}>{cartela.lado === LADOS.REAL ? cartela.encabezado : cartela.tipo}</Text>
        <Text style={estilos.nombre}>{cartela.nombre}</Text>
        <Text style={estilos.pie}>{cartela.lado === LADOS.REAL ? cartela.remate : cartela.invitacion}</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  capa: { ...StyleSheet.absoluteFillObject, backgroundColor: FONDO, justifyContent: 'center' },
  fuera: { ...StyleSheet.absoluteFillObject },
  cerrar: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 32 },
  flecha: { fontFamily: 'serif', fontSize: 26, color: PLACA },
  lamina: { flex: 1, marginHorizontal: 16, overflow: 'hidden', backgroundColor: PAPEL },
  imagen: { ...StyleSheet.absoluteFillObject },
  real: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: PAPEL, overflow: 'hidden' },
  tirador: { position: 'absolute', top: 0, bottom: 0, marginLeft: -22, width: 44, alignItems: 'center', justifyContent: 'center' },
  asa: { fontFamily: 'serif', fontSize: 20, color: TINTA },
  cartela: { margin: 16, padding: 20, backgroundColor: PLACA, gap: 6 },
  tipo: { fontFamily: 'serif', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: LAPIZ },
  nombre: { fontFamily: 'serif', fontSize: 26, color: TINTA },
  pie: { fontFamily: 'serif', fontSize: 15, color: LAPIZ },
});
