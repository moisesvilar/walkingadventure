// El encadenado de una llegada en la app: monta el paso vigente y **no permite saltar**.
//
// No es un enrutador y no lo va a ser. La secuencia es un dato del núcleo —una lista
// ordenada de `{ tipo, modo }` que entrega `partida/secuencia.js`— y aquí solo se mira
// por cuál va y se monta esa pantalla. Tres cosas que eso compra, y son la razón:
//
// - **No hay ruta a la que ir**, así que no hay manera de llegar a A4P5 sin haber llegado
//   al núcleo. Un enrutador con cuatro rutas habría dejado esa puerta abierta.
// - **Ninguna de las pantallas encadenadas sabe si es la primera visita ni si hay beat**:
//   cada una recibe qué paso es. Sin esto, la regla del orden acabaría escrita cuatro
//   veces, que es exactamente cómo se desincronizan.
// - **La app cerrada a mitad de secuencia continúa donde iba**, porque el paso vigente es
//   estado y no una posición en una pila de navegación.
//
// El único control de cada paso es su propia acción de seguir, y la dibuja la fila dueña
// de esa pantalla. Aquí no hay barra, ni flecha de atrás entre pasos, ni manera de saltar
// al siguiente ni de volver al anterior.
//
// Las pantallas del visor (A4P1, A4P2), de la escena (A4P3, A4P4) y de la ficha (A4P7)
// son de las filas 33 y 34 y **no están en disco**: entran inyectadas por su tipo de
// paso, y mientras no existan se monta el hueco con el paso nombrado, en lugar de saltar
// el paso en silencio.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MODOS, TIPOS_DE_PASO } from '@walkingadventure/nucleo/partida/secuencia.js';

import { PantallaLoQueSeCuenta } from './lo-que-se-cuenta.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/** Lo que se dice de un paso cuya pantalla todavía no existe. Nunca se salta un paso. */
export const TEXTOS = Object.freeze({
  sinPantalla: 'Esto todavía no está dibujado.',
  seguir: 'Seguir',
  nada: 'Aquí no queda nada esperando.',
});

/** La lista de tipos y modos de la secuencia, para poder afirmar el orden de un vistazo. */
export function etiquetaDeSecuencia(secuencia) {
  return secuencia.map((paso) => `${paso.tipo}:${paso.modo}`).join(',');
}

/**
 * @param {object} props
 *   `llegada` la escena que espera, tal cual la entrega `creaLlegadas().espera()`;
 *   `loQueSeCuenta` la parte `pantalla` de `loQueAquiSeCuenta(...)`, que es lo que compone
 *   A4P5 cuando el paso vigente es el suyo;
 *   `pantallas` las de las filas 33 y 34, por tipo de paso; `alSeguir` avanzar al
 *   siguiente paso —lo único que mueve la secuencia—; `alVisor` abrir el visor que quedó
 *   a un toque, que **no se abre solo**.
 *
 * No hay ninguna propiedad para ir a un paso concreto, y su ausencia es la pieza.
 */
export function PantallaLlegada({ llegada, loQueSeCuenta = null, pantallas = {}, alSeguir = null, alVisor = null }) {
  if (!llegada) {
    return (
      <View style={estilos.raiz} testID="llegada">
        <Text style={estilos.mundo}>{TEXTOS.nada}</Text>
      </View>
    );
  }

  const vigente = llegada.vigente;
  const aUnToque = llegada.secuencia.find((paso) => paso.modo === MODOS.A_UN_TOQUE) ?? null;
  const Pantalla = vigente ? pantallas[vigente.tipo] ?? null : null;

  return (
    <View style={estilos.raiz} testID="llegada">
      <View testID="momento-estado" accessibilityLabel="al-parar" style={estilos.marca} />
      <View testID="llegada-secuencia" accessibilityLabel={etiquetaDeSecuencia(llegada.secuencia)} style={estilos.marca} />
      <View testID="llegada-paso" accessibilityLabel={vigente ? vigente.tipo : 'cerrada'} style={estilos.marca} />

      {aUnToque ? (
        <Pressable testID="visor-a-un-toque" onPress={alVisor} style={estilos.aUnToque}>
          <Text style={estilos.aUnToqueTexto}>{llegada.sitio}</Text>
        </Pressable>
      ) : null}

      {vigente && vigente.tipo === TIPOS_DE_PASO.LO_QUE_SE_CUENTA && loQueSeCuenta ? (
        <PantallaLoQueSeCuenta loQueSeCuenta={loQueSeCuenta} alSeguir={alSeguir} />
      ) : vigente && Pantalla ? (
        <Pantalla paso={vigente} sitio={llegada.sitio} alSeguir={alSeguir} />
      ) : vigente ? (
        <View style={estilos.hueco}>
          <Text style={estilos.mundo}>{TEXTOS.sinPantalla}</Text>
          <Pressable testID="llegada-seguir" onPress={alSeguir} style={estilos.accion}>
            <Text style={estilos.accionTexto}>{TEXTOS.seguir}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={estilos.mundo}>{TEXTOS.nada}</Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  marca: { width: 0, height: 0 },
  hueco: { flex: 1, padding: 28, justifyContent: 'center', gap: 24 },
  mundo: { fontFamily: 'serif', fontSize: 20, lineHeight: 30, color: TINTA },
  aUnToque: { paddingHorizontal: 28, paddingTop: 24 },
  aUnToqueTexto: { fontFamily: 'serif', fontSize: 15, color: LAPIZ },
  accion: { paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
});
