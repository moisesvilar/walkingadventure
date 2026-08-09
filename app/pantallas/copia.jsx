// Las dos acciones de esta fila, para embeberlas donde viven: **Guardar una copia** en
// la fila «Guardar una copia» de los ajustes (A6P6, fila 38) y en empezar de nuevo
// (A6P7, fila 40), y **Abrir una copia** como acción secundaria del arranque (A1P1,
// fila 27), por debajo de la principal y con menos peso.
//
// Son dos acciones y ningún flujo, y esa es la razón de que aquí no haya pantalla: la
// hoja de compartir y el selector son del sistema y se usan tal cual.
//
// Dos reglas de dibujo que no son gusto:
//
// - **La espera se cuenta con una línea y sin cifra**: ninguna barra y ningún
//   porcentaje (`design-system.md`, y el precedente de SPEC-026, donde la generación se
//   cuenta en fases y no en tantos por ciento).
// - **Lo destructivo no es el botón principal**: en el aviso de sustitución, guardar una
//   copia primero va arriba, abrir la copia en medio y dejarlo como está siempre
//   disponible (`partida-guardada.md` §4).

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CAUSAS_DE_ERROR, ESTADOS_DE_ABRIR, ESTADOS_DE_GUARDAR } from '../datos/copia.js';

const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/** Los textos, en voz de aplicación, que es donde estamos. */
export const TEXTOS_DE_COPIA = Object.freeze({
  guardar: 'Guardar una copia',
  guardando: 'Preparando la copia…',
  guardada: 'La copia está guardada.',
  noSePudoGuardar: 'No se ha podido guardar la copia.',
  abrir: 'Abrir una copia',
  validando: 'Comprobando la copia…',
  avisoDeSustitucion: 'Al abrir esta copia se pierde la partida que tienes en este móvil.',
  guardarPrimero: 'Guardar una copia primero',
  abrirIgual: 'Abrir la copia',
  dejarlo: 'Dejarlo como está',
});

/**
 * La acción de guardar. La fila se sustituye en el sitio por la línea de espera y, al
 * volver de la hoja del sistema, recupera su forma con una línea debajo que lo dice una
 * sola vez. Si falla, la fila sigue disponible: ninguna partida se ha tocado.
 */
export function GuardarCopia({ copia, etiqueta = TEXTOS_DE_COPIA.guardar }) {
  const [estado, setEstado] = useState(ESTADOS_DE_GUARDAR.INACTIVA);

  async function alTocar() {
    setEstado(ESTADOS_DE_GUARDAR.EMPAQUETANDO);
    try {
      await copia.guarda();
      setEstado(ESTADOS_DE_GUARDAR.GUARDADA);
    } catch {
      setEstado(ESTADOS_DE_GUARDAR.NO_SE_PUDO);
    }
  }

  return (
    <View>
      <View testID="guardar-copia-estado" accessibilityLabel={estado} style={estilos.marca} />
      {estado === ESTADOS_DE_GUARDAR.EMPAQUETANDO ? (
        <Text style={estilos.espera}>{TEXTOS_DE_COPIA.guardando}</Text>
      ) : (
        <Pressable testID="guardar-copia" accessibilityLabel={etiqueta} onPress={alTocar}>
          <Text style={estilos.accion}>{etiqueta}</Text>
        </Pressable>
      )}
      {estado === ESTADOS_DE_GUARDAR.GUARDADA ? <Text style={estilos.nota}>{TEXTOS_DE_COPIA.guardada}</Text> : null}
      {estado === ESTADOS_DE_GUARDAR.NO_SE_PUDO ? <Text style={estilos.nota}>{TEXTOS_DE_COPIA.noSePudoGuardar}</Text> : null}
    </View>
  );
}

/**
 * La acción de abrir. Con partida existente aparece el aviso; sin ella —el móvil
 * nuevo, que es el caso normal— se abre y ya está.
 */
export function AbrirCopia({ copia, alAbrir = null }) {
  const [estado, setEstado] = useState(ESTADOS_DE_ABRIR.INACTIVA);
  const [pendiente, setPendiente] = useState(null);
  const [error, setError] = useState(null);

  async function alTocar() {
    setEstado(ESTADOS_DE_ABRIR.VALIDANDO);
    setError(null);
    try {
      const resultado = await copia.abre();
      if (resultado.error) {
        setError(resultado.error);
        setEstado(ESTADOS_DE_ABRIR.NO_SE_PUDO);
        return;
      }
      if (resultado.sustituye) {
        setPendiente(resultado);
        setEstado(ESTADOS_DE_ABRIR.SUSTITUIR);
        return;
      }
      setEstado(resultado.estado);
      if (resultado.estado === ESTADOS_DE_ABRIR.ABIERTA && alAbrir) alAbrir(resultado);
    } catch (e) {
      setError({ causa: CAUSAS_DE_ERROR.NO_ES_PARTIDA, texto: e?.message ?? String(e) });
      setEstado(ESTADOS_DE_ABRIR.NO_SE_PUDO);
    }
  }

  async function confirma() {
    const resultado = await copia.sustituye(pendiente);
    setPendiente(null);
    setEstado(ESTADOS_DE_ABRIR.ABIERTA);
    if (alAbrir) alAbrir(resultado);
  }

  return (
    <View style={estilos.secundaria}>
      <View testID="abrir-copia-estado" accessibilityLabel={estado} style={estilos.marca} />
      {estado === ESTADOS_DE_ABRIR.VALIDANDO ? (
        <Text style={estilos.espera}>{TEXTOS_DE_COPIA.validando}</Text>
      ) : (
        <Pressable testID="abrir-copia" accessibilityLabel={TEXTOS_DE_COPIA.abrir} onPress={alTocar}>
          <Text style={estilos.accion}>{TEXTOS_DE_COPIA.abrir}</Text>
        </Pressable>
      )}

      {estado === ESTADOS_DE_ABRIR.SUSTITUIR ? (
        <View testID="importar-aviso-sustitucion">
          <Text style={estilos.nota}>{TEXTOS_DE_COPIA.avisoDeSustitucion}</Text>
          <GuardarCopia copia={copia} etiqueta={TEXTOS_DE_COPIA.guardarPrimero} />
          <Pressable accessibilityLabel={TEXTOS_DE_COPIA.abrirIgual} onPress={confirma}>
            <Text style={estilos.accion}>{TEXTOS_DE_COPIA.abrirIgual}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={TEXTOS_DE_COPIA.dejarlo}
            onPress={() => { setPendiente(null); setEstado(ESTADOS_DE_ABRIR.INACTIVA); }}
          >
            <Text style={estilos.accion}>{TEXTOS_DE_COPIA.dejarlo}</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <Text testID="importar-error" accessibilityLabel={error.causa} style={estilos.nota}>{error.texto}</Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  marca: { width: 0, height: 0 },
  secundaria: { paddingHorizontal: 24, paddingVertical: 8 },
  accion: { fontSize: 13, color: LAPIZ, paddingVertical: 6 },
  espera: { fontSize: 13, color: LAPIZ, paddingVertical: 6 },
  nota: { fontSize: 12, color: TINTA, opacity: 0.8, paddingVertical: 4 },
});
