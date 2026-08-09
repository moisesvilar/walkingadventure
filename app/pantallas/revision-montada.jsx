// El punto de montaje de la revisión del render: junta lo que la pantalla de
// revisión necesita de plataforma —el enlace con Skia y un mundo que pintar— y se
// lo entrega. La pantalla en sí no sabe de dónde sale ninguna de las dos cosas, y
// por eso se lee entera sin dispositivo; esa frontera es la misma que `fetchData`
// en `buildWorld`, y se mantiene aquí a propósito.
//
// Solo tiene sentido en la compilación de desarrollo: es donde se hace la revisión
// de paridad, no una pantalla del juego.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { mensajeDeError } from '../plataforma/capacidades.js';
import { mundoDeRevision } from '../nucleo/mundo-de-revision.js';
import { creaEnlaceReal } from '../render/enlace-real.js';
import { PantallaRevisionRender } from './revision-render.jsx';

/** El nombre con el que aparece en el selector de mundos. Dice lo que es. */
const MUNDO = 'sintético (sin capa de datos)';

/** Lo que ocupan las dos tiras de selección y el paso a la pantalla de andamiaje. */
const ALTO_DE_LOS_CONTROLES = 120;

export function RevisionMontada() {
  const { width, height } = useWindowDimensions();
  const [documentos, setDocumentos] = useState({});
  const [falloDelMundo, setFalloDelMundo] = useState(null);

  // El enlace se monta una vez. El gestor de tipografías y su caché son caros, y un
  // enlace nuevo por repintado la tiraría entera en cada cambio de estilo.
  const montaje = useMemo(() => {
    try {
      return { enlace: creaEnlaceReal(), fallo: null };
    } catch (e) {
      return { enlace: null, fallo: mensajeDeError(e) };
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    mundoDeRevision()
      .then((documento) => { if (vivo) setDocumentos({ [MUNDO]: documento }); })
      .catch((e) => { if (vivo) setFalloDelMundo(mensajeDeError(e)); });
    return () => { vivo = false; };
  }, []);

  const error = montaje.fallo ?? falloDelMundo;

  const tamano = useMemo(
    () => ({ ancho: Math.round(width), alto: Math.max(0, Math.round(height) - ALTO_DE_LOS_CONTROLES) }),
    [width, height],
  );

  // El fallo se pinta como fallo y con su motivo, igual que el del núcleo en la
  // pantalla de andamiaje: una lámina en blanco no distingue «no hay Skia» de «no
  // hay mundo».
  if (error !== null) {
    return (
      <View style={estilos.aviso} testID="revision-render-error">
        <Text style={estilos.texto}>{error}</Text>
      </View>
    );
  }
  if (!montaje.enlace) return null;

  return <PantallaRevisionRender documentos={documentos} enlace={montaje.enlace} tamano={tamano} />;
}

const estilos = StyleSheet.create({
  aviso: { flex: 1, padding: 24 },
  texto: { fontSize: 14, lineHeight: 20 },
});
