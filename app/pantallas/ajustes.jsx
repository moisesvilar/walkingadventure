// A6P6 · Los ajustes: el único sitio del juego que habla como aplicación.
//
// La pantalla **no sabe qué es un tramo, ni un estilo, ni un anclaje descartado**: pide el
// catálogo a `partida/ajustes.js`, lo pinta agrupado y devuelve la elección a su dueña. Eso
// es lo que hace que «no existe una fila del oficio» y «no hay ningún control de mapa
// activo» sean criterios que se pueden poner rojos sin abrir un simulador, y lo que impide
// que una fila sin cablear se pinte apagada: si falta su dueña, la composición falla antes
// de llegar aquí y lo dice nombrándola.
//
// Cuatro decisiones de dibujo, y las cuatro salen del artefacto y del design system:
//
// - **En sans desde el titular.** No se elige aquí: sale del registro que declara la
//   composición, que en esta pantalla —y solo en esta, dentro del juego— es aplicación.
// - **Lista de filas con el valor a la derecha, sin tarjetas y sin descripción bajo cada
//   fila.** Una descripción invitaría a explicar «caminos que evitar», que es justo lo que
//   `accesibilidad.md` no quiere que se explique.
// - **Tres tipos de fila y ninguno más**: valor, interruptor y puerta.
// - **«Empezar de nuevo» va última y sin color destructivo aquí.** Lo destructivo se
//   declara en su propia pantalla, que es donde hay sitio para explicar.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { PALABRAS_DE_INTERRUPTOR, TESTIDS } from '@walkingadventure/nucleo/partida/ajustes.js';

import { familiaDe } from './tipografia.js';

const PAPEL = '#f6f2e6';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';
const FILETE = '#8a6d34';
const PUNTEADO = '#d9d2be';

/** Una fila. Los tres tipos se pintan aquí y no hay un cuarto camino. */
function Fila({ fila, sans, alTocar, alCambiar }) {
  const encendida = fila.valor === PALABRAS_DE_INTERRUPTOR.si;
  const cuerpo = (
    <View style={estilos.fila}>
      <Text style={[estilos.etiqueta, sans]}>{fila.etiqueta}</Text>
      {fila.tipo === 'interruptor' ? (
        <Switch
          value={encendida}
          // El interruptor no se enciende solo por tocarlo: lo que hace es pedirlo, y el
          // valor que se pinta es siempre el real. El comportamiento del permiso es de su
          // dueña; lo que aquí se sostiene es que no se dibuje lo pedido.
          onValueChange={alCambiar ? (quiere) => alCambiar(fila.id, quiere) : null}
        />
      ) : (
        <Text style={[estilos.valor, sans]}>{fila.chevron ? '›' : fila.valor}</Text>
      )}
    </View>
  );

  // Un interruptor cambia en el sitio y no abre nada, así que no es pulsable entero.
  if (fila.tipo === 'interruptor') {
    return <View testID={fila.testid} accessibilityLabel={fila.id}>{cuerpo}</View>;
  }
  return (
    <Pressable testID={fila.testid} accessibilityLabel={fila.id} onPress={alTocar ? () => alTocar(fila.id) : null}>
      {cuerpo}
    </Pressable>
  );
}

/**
 * @param {object} props
 *   `ajustes` lo que devuelve `componeAjustes`; `alVolver` la flecha de atrás;
 *   `alAbrirFila` una fila de valor o una puerta; `alCambiarInterruptor` un interruptor.
 */
export function PantallaAjustes({ ajustes, alVolver = null, alAbrirFila = null, alCambiarInterruptor = null }) {
  const sans = { fontFamily: familiaDe(ajustes.registro) };
  const texto = (id) => ajustes.textos.find((t) => t.id === id).texto;

  return (
    <View style={estilos.raiz} testID="ajustes">
      <View testID={TESTIDS.momento} accessibilityLabel={ajustes.momento} style={estilos.marca} />
      {/* El registro de la pantalla, con vocabulario cerrado. Es la mitad de RF-LANG-002. */}
      <View testID={TESTIDS.registro} accessibilityLabel={ajustes.registro} style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text onPress={alVolver} style={[estilos.volver, sans]}>{texto('volver')}</Text>
        <Text style={[estilos.titulo, sans]}>{texto('titulo')}</Text>

        <View testID={TESTIDS.lista} accessibilityLabel={ajustes.grupos.map((g) => g.id).join(',')}>
          {ajustes.grupos.map((grupo) => (
            <View key={grupo.id} testID={TESTIDS.grupo} accessibilityLabel={grupo.id} style={estilos.grupo}>
              <Text style={[estilos.tituloDeGrupo, sans]}>{grupo.titulo}</Text>
              {grupo.filas.map((fila) => (
                <Fila key={fila.id} fila={fila} sans={sans} alTocar={alAbrirFila} alCambiar={alCambiarInterruptor} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PAPEL },
  marca: { width: 0, height: 0 },
  contenido: { padding: 20 },
  volver: { fontSize: 14, color: LAPIZ, marginBottom: 6 },
  titulo: { fontSize: 16, fontWeight: '600', color: TINTA, marginBottom: 16 },
  grupo: { marginBottom: 20 },
  // Versalitas del color del filete: la versalita se pinta con el espaciado, que es lo que
  // React Native da sin cargar otra fuente.
  tituloDeGrupo: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: FILETE, marginBottom: 4 },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PUNTEADO,
  },
  etiqueta: { flexShrink: 1, fontSize: 14, color: TINTA },
  valor: { fontSize: 13, color: LAPIZ },
});
