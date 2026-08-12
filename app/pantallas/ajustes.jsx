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
import { MARCA } from './marca.js';

const PAPEL = '#f6f2e6';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';
const FILETE = '#8a6d34';
const PUNTEADO = '#d9d2be';

/** Una fila. Los tres tipos se pintan aquí y no hay un cuarto camino. */
function Fila({ fila, sans, aviso, alTocar, alCambiar }) {
  const encendida = fila.valor === PALABRAS_DE_INTERRUPTOR.si;
  const cuerpo = (
    <View style={estilos.fila}>
      <Text style={[estilos.etiqueta, sans]}>{fila.etiqueta}</Text>
      {fila.tipo === 'interruptor' ? (
        // **El interruptor no recibe el toque: lo recibe la fila entera**, y por eso va
        // dentro de un envoltorio sordo. Dos cosas, y las dos están medidas:
        //
        // - **La fila es el control.** El `Switch` ocupa la esquina derecha —medido en
        //   `wa-pixel`: `[906,1428][1028,1499]` dentro de una fila `[53,1397][1028,1532]`—,
        //   así que tocar la etiqueta no hacía absolutamente nada: ni se pedía el permiso,
        //   ni cambiaba el valor, ni aparecía la línea de aviso. Una fila de ajustes cuyo
        //   85 % izquierdo es inerte es la degradación silenciosa de §6h con forma de
        //   pantalla normal, y además deja un estado que su dueña no puede producir —el
        //   valor no cambió y tampoco hay motivo escrito—, que es como se descubrió.
        // - **Y el valor que se pinta no se puede mover solo.** Un `Switch` que recibe el
        //   toque se dibuja encendido en el acto y avisa después; si quien decide dice que
        //   no, queda un interruptor pintado en «sí» que no lee nada. Sordo, eso es
        //   imposible por construcción: lo que se ve es siempre el valor real.
        <View pointerEvents="none">
          <Switch value={encendida} />
        </View>
      ) : (
        <Text style={[estilos.valor, sans]}>{fila.chevron ? '›' : fila.valor}</Text>
      )}
    </View>
  );

  // Un interruptor cambia en el sitio y no abre ninguna pantalla, pero **sí es pulsable
  // entero**: lo que no abre nada es el destino, no el área que responde. Tocarlo no lo
  // enciende —lo pide—, y el valor que se pinta sigue siendo el real.
  if (fila.tipo === 'interruptor') {
    return (
      <View testID={fila.testid} accessibilityLabel={fila.id}>
        <Pressable
          onPress={alCambiar ? () => alCambiar(fila.id, !encendida) : null}
          // Se anuncia como interruptor y con su valor, que es lo que un lector de pantalla
          // necesita para decir qué hace la fila y en qué estado está.
          accessibilityRole="switch"
          accessibilityState={{ checked: encendida }}
        >
          {cuerpo}
        </Pressable>
        {/* La línea que aparece **solo** cuando el permiso se ha denegado o revocado. En
            voz de aplicación —el único sitio del juego donde eso está permitido—, del color
            tenue de los valores y **sin ningún control dentro**: no ofrece ir a los ajustes
            del sistema, no ofrece reintentar y no insiste después. El texto lo trae quien
            sabe por qué no se pudo; aquí no se redacta ninguno. */}
        {aviso ? <Text testID={aviso.testid} style={[estilos.aviso, sans]}>{aviso.texto}</Text> : null}
      </View>
    );
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
 *   `alAbrirFila` una fila de valor o una puerta; `alCambiarInterruptor` un interruptor;
 *   `aviso` la línea que va bajo la fila que no se pudo encender, con su localizador y el
 *   identificador de la fila a la que pertenece. Es `{ texto, testid, fila }` o nada: la
 *   pantalla no decide cuándo aparece ni qué dice.
 */
export function PantallaAjustes({ ajustes, aviso = null, alVolver = null, alAbrirFila = null, alCambiarInterruptor = null }) {
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
                <Fila
                  key={fila.id}
                  fila={fila}
                  sans={sans}
                  // El aviso va bajo **su** fila y no bajo cualquiera: lo dice el
                  // identificador que trae, y sin él una línea de una fila se leería como si
                  // fuera de otra.
                  aviso={aviso && aviso.fila === fila.id ? aviso : null}
                  alTocar={alAbrirFila}
                  alCambiar={alCambiarInterruptor}
                />
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
  marca: MARCA,
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
  // Del color tenue de los valores y con aire arriba: es una línea que se lee bajo la fila,
  // no una descripción de la fila. Sin ningún control dentro.
  aviso: { fontSize: 13, lineHeight: 19, color: LAPIZ, marginTop: -4, marginBottom: 10 },
});
