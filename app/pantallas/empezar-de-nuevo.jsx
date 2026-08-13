// A6P7 · Empezar de nuevo: dos o tres bloques de texto y tres acciones, y esa pobreza
// es la decisión — lo que hay que hacer aquí es escribir bien, no dibujar.
//
// La pantalla **no sabe qué se pierde**: recibe la composición de `empezar-de-nuevo.js`,
// que a su vez la pide al núcleo, y se limita a pintar sus bloques y sus tres acciones.
// Eso es lo que permite afirmar sin simulador que la enumeración nombra los mapas por su
// título y que una partida del primer día no enumera ceros.
//
// Tres decisiones de dibujo, y las tres salen del artefacto y de `partida-guardada.md`
// §4:
//
// - **En sans desde el titular**, porque hereda el registro de aplicación de los
//   ajustes de los que cuelga. No se elige aquí: sale del registro que declara la
//   composición.
// - **Lo destructivo no es el botón principal.** Guardar una copia va arriba y es la
//   única sólida; borrar la partida es hueca, con el borde y el texto en el color de lo
//   destructivo; dejarlo como está es texto sin caja y **no desaparece en ningún
//   estado**. Que guardar y borrar sean dos gestos no asciende lo destructivo: la
//   jerarquía es exactamente la misma que antes.
// - **La espera se cuenta con una línea y sin cifra**: ninguna barra y ningún
//   porcentaje, el mismo criterio que SPEC-026 aplicó a la generación y SPEC-039 a la
//   exportación.
//
// Y lo que aquí **no** hay, que es una afirmación: ninguna casilla de confirmación,
// ningún texto que teclear, ninguna cuenta atrás y ningún segundo aviso encima del
// aviso. Un segundo aviso es la manera de no tener que escribir bien el primero.
//
// El segundo toque de esta pantalla **no es un segundo aviso**: guardar una copia y
// borrar la partida son dos acciones distintas, con su texto y su botón, y quien guarda
// puede perfectamente no querer borrar. Guardar deja la pantalla donde está y las tres
// acciones vuelven siempre — se guardara o no —, porque *lo destructivo no se ejecuta
// sobre una señal que el sistema no garantiza* y la hoja de compartir de Android no
// garantiza ninguna.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BLOQUES, TEXTOS_DE_EMPEZAR_DE_NUEVO } from '../datos/empezar-de-nuevo.js';

import { familiaDe } from './tipografia.js';
import { MARCA } from './marca.js';

const PAPEL = '#f6f2e6';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';
const DESTRUCTIVO = '#8c2f22';

/**
 * @param {object} props
 *   `pantalla` lo que devuelve `pregunta()`; `empezarDeNuevo` la orquestación;
 *   `alVolver` la vuelta a los ajustes, que es «dejarlo como está»; `alBorrada` lo que
 *   ocurre cuando ya no queda partida, que es ir al arranque y a ningún otro sitio.
 */
export function PantallaEmpezarDeNuevo({ pantalla, empezarDeNuevo, alVolver = null, alBorrada = null }) {
  const [estado, setEstado] = useState(pantalla.estado);
  const [aviso, setAviso] = useState(null);
  const sans = { fontFamily: familiaDe(pantalla.registro) };
  const bloque = (id) => pantalla.textos.find((t) => t.id === id) ?? null;
  const congelado = bloque(BLOQUES.CONGELADO);
  // Las cinco palabras del estado vienen en la composición: aquí no se escribe ninguna.
  const ESTADOS = pantalla.estados;

  // Guardar **solo guarda**: lo que vuelve nunca trae `borrado`, así que de aquí no se
  // sale de la pantalla por ninguna rama.
  async function alGuardarCopia() {
    setAviso(null);
    setEstado(ESTADOS.GUARDANDO_COPIA);
    aplica(await empezarDeNuevo.guardaCopia());
  }

  async function alBorrar() {
    setAviso(null);
    setEstado(ESTADOS.BORRANDO);
    aplica(await empezarDeNuevo.borra());
  }

  function aplica(resultado) {
    setEstado(resultado.estado);
    setAviso(resultado.aviso ?? null);
    if (resultado.borrado && alBorrada) alBorrada(resultado);
  }

  const enEspera = estado === ESTADOS.GUARDANDO_COPIA || estado === ESTADOS.BORRANDO;

  return (
    <View style={estilos.raiz} testID={pantalla.testids.pantalla}>
      <View testID={pantalla.testids.momento} accessibilityLabel={pantalla.momento} style={estilos.marca} />
      <View testID={pantalla.testids.estado} accessibilityLabel={estado} style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text onPress={alVolver} style={[estilos.volver, sans]}>{TEXTOS_DE_EMPEZAR_DE_NUEVO.volver}</Text>
        <Text style={[estilos.titulo, sans]}>{TEXTOS_DE_EMPEZAR_DE_NUEVO.titulo}</Text>

        <Text testID={pantalla.testids.perdida} style={[estilos.parrafo, sans]}>{bloque(BLOQUES.PERDIDA).texto}</Text>
        {/* Sin mapa levantado no hay mundo congelado que explicar, y el párrafo no existe. */}
        {congelado ? (
          <Text testID={pantalla.testids.congelado} style={[estilos.parrafo, sans]}>{congelado.texto}</Text>
        ) : null}
        <Text style={[estilos.parrafo, sans]}>{bloque(BLOQUES.SALIDA).texto}</Text>
      </ScrollView>

      <View style={estilos.acciones}>
        {/* La línea de estado va encima de las acciones: se lee antes de volver a tocar,
            y es donde cae tanto la copia hecha como la que no se pudo hacer. */}
        {aviso ? <Text style={[estilos.aviso, sans]}>{aviso}</Text> : null}
        {enEspera ? (
          <Text style={[estilos.espera, sans]}>
            {estado === ESTADOS.BORRANDO ? TEXTOS_DE_EMPEZAR_DE_NUEVO.borrando : TEXTOS_DE_EMPEZAR_DE_NUEVO.guardando}
          </Text>
        ) : (
          <>
            <Pressable
              testID={pantalla.testids.guardar}
              accessibilityLabel={TEXTOS_DE_EMPEZAR_DE_NUEVO.guardar}
              onPress={alGuardarCopia}
              style={estilos.principal}
            >
              <Text style={[estilos.textoPrincipal, sans]}>{TEXTOS_DE_EMPEZAR_DE_NUEVO.guardar}</Text>
            </Pressable>
            <Pressable
              testID={pantalla.testids.borrar}
              accessibilityLabel={TEXTOS_DE_EMPEZAR_DE_NUEVO.borrar}
              onPress={alBorrar}
              style={estilos.hueca}
            >
              <Text style={[estilos.textoHueco, sans]}>{TEXTOS_DE_EMPEZAR_DE_NUEVO.borrar}</Text>
            </Pressable>
          </>
        )}
        {/* Dejarlo como está no desaparece en ningún estado, ni siquiera esperando. */}
        <Pressable
          testID={pantalla.testids.dejarlo}
          accessibilityLabel={TEXTOS_DE_EMPEZAR_DE_NUEVO.dejarlo}
          onPress={alVolver}
          style={estilos.salida}
        >
          <Text style={[estilos.textoSalida, sans]}>{TEXTOS_DE_EMPEZAR_DE_NUEVO.dejarlo}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PAPEL },
  marca: MARCA,
  contenido: { padding: 20 },
  volver: { fontSize: 14, color: LAPIZ, marginBottom: 6 },
  titulo: { fontSize: 16, fontWeight: '600', color: TINTA, marginBottom: 16 },
  parrafo: { fontSize: 14, lineHeight: 21, color: TINTA, marginBottom: 14 },
  // Empujadas abajo: el texto se lee antes de que haya nada que tocar.
  acciones: { padding: 20, gap: 10 },
  principal: { backgroundColor: TINTA, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  textoPrincipal: { fontSize: 14, color: PAPEL },
  hueca: { borderWidth: 1, borderColor: DESTRUCTIVO, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  textoHueco: { fontSize: 14, color: DESTRUCTIVO },
  salida: { paddingVertical: 10, alignItems: 'center' },
  textoSalida: { fontSize: 14, color: LAPIZ },
  espera: { fontSize: 14, color: LAPIZ, textAlign: 'center', paddingVertical: 12 },
  aviso: { fontSize: 13, color: LAPIZ, textAlign: 'center' },
});
