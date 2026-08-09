// La pantalla de revisión del render. **Solo existe en la compilación de
// desarrollo**: no es una pantalla del juego, no está en `docs/flujo.md` ni en
// `docs/pantallas/`, y no se compila en la build de tienda. Es el equivalente de
// los hooks `__wa.style()`, `__wa.demo()` y `__wa.world()` que el prototipo tiene
// en consola, y es donde se hace la revisión de paridad visual: ocho mundos de
// referencia por cinco estilos, cuarenta pares.
//
// Es el único sitio donde la barra de escala se enciende. En el juego está apagada
// siempre, porque una escala cartográfica es una cifra de distancia y el sistema de
// diseño las prohíbe.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ESTILOS, ESTILO_POR_DEFECTO } from '@walkingadventure/nucleo/render/estilos.js';

import { Lamina } from '../render/lamina.jsx';

/** Los ocho extractos congelados de `test/fixtures/mundos-referencia/`. */
export const MUNDOS_DE_REFERENCIA = Object.freeze([
  'barrio-tres-calles-semilla-1', 'barrio-tres-calles-semilla-2',
  'costero-semilla-1', 'costero-semilla-2',
  'suelo-250m-semilla-1', 'suelo-250m-semilla-2',
  'urbano-denso-semilla-1', 'urbano-denso-semilla-2',
]);

/**
 * @param {object} props
 *   `documentos` los mundos de referencia ya levantados, por su nombre de fichero
 *   —se inyectan: esta pantalla no lee del disco ni genera nada—; `enlace` el
 *   enlace con Skia; `tamano` el hueco de la lámina.
 */
export function PantallaRevisionRender({ documentos, enlace, tamano }) {
  const nombres = MUNDOS_DE_REFERENCIA.filter((nombre) => documentos[nombre]);
  const [mundo, setMundo] = useState(nombres[0] ?? null);
  const [estilo, setEstilo] = useState(ESTILO_POR_DEFECTO);
  const documento = mundo ? documentos[mundo] : null;

  return (
    <View style={estilos.raiz} testID="revision-render">
      <ScrollView horizontal style={estilos.tira} testID="revision-render-mundo">
        {nombres.map((nombre) => (
          <Pressable key={nombre} onPress={() => setMundo(nombre)} style={[estilos.ficha, nombre === mundo && estilos.elegida]}>
            <Text style={estilos.texto}>{nombre}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal style={estilos.tira} testID="revision-render-estilo">
        {/* El selector se construye desde el catálogo y enseña el `title`: un estilo
            nuevo aparece aquí sin tocar esta pantalla. */}
        {ESTILOS.map((uno) => (
          <Pressable key={uno.id} onPress={() => setEstilo(uno.id)} style={[estilos.ficha, uno.id === estilo && estilos.elegida]}>
            <Text style={estilos.texto}>{uno.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {documento
        // La barra de escala, encendida: es lo que hace comparable la lámina con la
        // del prototipo, y esta pantalla no es del juego.
        ? <Lamina documento={documento} estilo={estilo} vista={vistaDeRevision(documento)} tamano={tamano} enlace={enlace} />
        : <Text style={estilos.texto}>No hay ningún mundo de referencia cargado en esta compilación.</Text>}
    </View>
  );
}

/** El mundo entero, centrado, con la escala encendida. */
export function vistaDeRevision(documento) {
  return { cx: 0, cy: 0, r: documento.radius, foco: null, paraje: null, escala: true };
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  tira: { flexGrow: 0 },
  ficha: { paddingHorizontal: 10, paddingVertical: 6 },
  elegida: { borderBottomWidth: 2 },
  texto: { fontSize: 13 },
});
