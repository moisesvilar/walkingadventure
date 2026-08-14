// La pantalla de andamiaje: la única pantalla de esta entrega, y provisional.
// NO es ninguna de las cuarenta pantallas dibujadas y no entra en docs/flujo.md —
// existe para que el arranque de la app sea observable, y la fila 27 la sustituye
// por la primera pantalla del onboarding. Habla como aplicación de principio a
// fin y lo dice de sí misma; la única voz de mundo es el título que sortea el
// núcleo, y por eso es lo único en serif.

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ETIQUETAS, estadoLegible, mensajeDeError } from '../plataforma/capacidades.js';
import { creaRegistro } from '../plataforma/registro.js';
import { SEMILLA_DE_ANDAMIAJE, idiomaDeAndamiaje, tituloDeAndamiaje } from '../nucleo/andamiaje.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const FILETE = '#8a6d34';

function Filete() {
  return <View style={estilos.filete} />;
}

/**
 * @param {object} props
 * @param {Array}  props.modulos       los módulos de plataforma, inyectados.
 * @param {string[]} props.ausentes    capacidades forzadas a ausentes por el gancho.
 * @param {string[]} props.noReconocidos  nombres que el gancho no supo reconocer.
 */
export function PantallaAndamiaje({ modulos = [], ausentes = [], noReconocidos = [], herramienta = null }) {
  const [capacidades, setCapacidades] = useState([]);

  // Se sondea una sola vez, al abrir. No hay re-sonda periódica: solo serviría
  // para que la pantalla cambiara sola mientras alguien la lee.
  useEffect(() => {
    let vivo = true;
    creaRegistro(modulos, { ausentes })
      .sondea()
      .then((estado) => {
        if (vivo) setCapacidades(estado);
      });
    return () => {
      vivo = false;
    };
  }, [modulos, ausentes]);

  // El núcleo se llama aquí, en el momento de pintar, y su fallo se pinta como
  // fallo: la pantalla se dibuja entera igual, con su lista de capacidades.
  let titulo = null;
  let errorDelNucleo = null;
  try {
    titulo = tituloDeAndamiaje();
  } catch (e) {
    errorDelNucleo = mensajeDeError(e);
  }

  const hayModulos = modulos.length > 0;

  return (
    <ScrollView style={estilos.fondo} contentContainerStyle={estilos.contenido} testID="pantalla-andamiaje">
      <Text style={estilos.tituloApp}>Walking Adventure</Text>
      <Text style={estilos.parrafo}>
        Andamiaje. Esto no es el juego: desaparece cuando llegue el arranque de verdad.
      </Text>

      <Filete />

      <Text style={estilos.epigrafe}>El núcleo, desde el móvil</Text>
      <Text style={estilos.parrafo}>
        semilla {SEMILLA_DE_ANDAMIAJE} · idioma {idiomaDeAndamiaje()}
      </Text>

      {errorDelNucleo === null ? (
        <Text style={estilos.tituloDeMundo} testID="titulo-de-mundo">
          «{titulo}»
        </Text>
      ) : (
        <View testID="nucleo-error">
          <Text style={estilos.epigrafe}>El núcleo no respondió</Text>
          <Text style={estilos.parrafo}>{errorDelNucleo}</Text>
        </View>
      )}

      <Filete />

      <Text style={estilos.epigrafe}>Las capacidades</Text>

      {hayModulos ? (
        <View testID="capacidades">
          {capacidades.map((c) => (
            <View key={c.nombre} style={estilos.fila} testID={`capacidad-${c.nombre}`}>
              <Text style={estilos.filaTexto}>
                {ETIQUETAS[c.nombre]} — {estadoLegible(c)}
              </Text>
              {c.motivo ? <Text style={estilos.motivo}>{c.motivo}</Text> : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={estilos.parrafo} testID="capacidades-vacio">
          Ninguna capacidad montada todavía
        </Text>
      )}

      {noReconocidos.length > 0 ? (
        <Text style={estilos.motivo} testID="gancho-no-reconocido">
          No reconozco la capacidad «{noReconocidos.join('», «')}»
        </Text>
      ) : null}

      {herramienta}
    </ScrollView>
  );
}

// Serif para lo que dice el mundo, sans para todo lo demás. Son las del sistema:
// vestir la app es de la fila que dibuje la primera pantalla de verdad.
const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: PLACA },
  contenido: { paddingHorizontal: 24, paddingVertical: 64 },
  tituloApp: { fontFamily: 'System', fontSize: 24, fontWeight: '600', color: TINTA },
  epigrafe: { fontFamily: 'System', fontSize: 16, fontWeight: '600', color: TINTA, marginTop: 4 },
  parrafo: { fontFamily: 'System', fontSize: 15, color: TINTA, opacity: 0.7, marginTop: 6, lineHeight: 21 },
  tituloDeMundo: { fontFamily: 'serif', fontSize: 26, color: TINTA, marginTop: 18 },
  filete: { height: 1, backgroundColor: FILETE, marginVertical: 24 },
  fila: { marginTop: 12 },
  filaTexto: { fontFamily: 'System', fontSize: 15, color: TINTA },
  motivo: { fontFamily: 'System', fontSize: 13, color: TINTA, opacity: 0.7, marginTop: 2, lineHeight: 18 },
});
