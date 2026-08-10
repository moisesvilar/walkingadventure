// A6P2 y A6P4 · El diario, por días y por historias. Las dos son la misma pantalla
// leída de dos maneras, y por eso viven en el mismo fichero: comparten la tira de
// capítulos, el capítulo abierto y la lámina.
//
// No calculan nada. Los capítulos, sus días, sus historias, los órdenes y el cierre
// del hilo vienen hechos de `partida/capitulos.js`; aquí solo se pintan, y las cuatro
// reglas de dibujo son del diseño:
//
// - **La tira de capítulos no es un selector de mapas**: el activo se marca con filete
//   grueso, no con un control, y abrir otro capítulo cambia lo que se lee y nada más.
// - **La segunda manera de leer no se desactiva: no existe.** Mientras el marcador no
//   está hecho, el pie no dibuja «Ver por historias» — ni gris, ni con candado, que
//   enseñaría que hay algo que descubrir.
// - **Ninguna versión lleva icono, color, orden ni tipografía distinta de las demás.**
//   Es barato de sostener: el nivel no llega hasta aquí.
// - **Ninguna cifra que no sea una cuenta de lo que hay dentro.** Los días de un
//   capítulo y las fuentes de una historia; ni distancia, ni ritmo, ni progreso.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TEXTOS, VISTAS } from '@walkingadventure/nucleo/partida/capitulos.js';
import { MARCA } from './marca.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';
const FILETE = '#8a6d34';

/** El texto de una versión: el redactado si lo hay, y si no, el de su plantilla. */
function textoDeVersion(version, textos = {}) {
  return textos[version.texto]?.texto ?? version.plantilla ?? version.suceso;
}

/** La tira de capítulos: uno por mapa, el activo con filete grueso y sin ningún control. */
function TiraDeCapitulos({ capitulos, abierto, alAbrirCapitulo }) {
  return (
    <View testID="diario-capitulos" style={estilos.tira}>
      {capitulos.map((capitulo) => {
        const esElAbierto = capitulo.mapa === abierto;
        return (
          <Pressable
            key={capitulo.mapa}
            testID={esElAbierto ? 'diario-capitulo-activo' : 'diario-capitulo'}
            accessibilityLabel={capitulo.mapa}
            onPress={alAbrirCapitulo ? () => alAbrirCapitulo(capitulo.mapa) : null}
            style={[estilos.capitulo, esElAbierto ? estilos.capituloAbierto : estilos.capituloTenue]}
          >
            <Text style={estilos.tituloDeMundo}>{capitulo.titulo}</Text>
            <Text style={estilos.subtitulo}>{TEXTOS.subtitulo(capitulo.cuantosDias, capitulo.subtitulo)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Una caja de versión: el mismo componente aquí y en la escena de la triangulación. */
export function CajaDeVersion({ version, cuando, textos }) {
  return (
    <View testID="diario-version" style={estilos.version}>
      <Text style={estilos.cuando}>{cuando}</Text>
      <Text style={estilos.dicho}>«{textoDeVersion(version, textos)}»</Text>
    </View>
  );
}

/**
 * @param {object} props
 *   `diario` lo que devuelve `abreElDiario`; `capitulo` lo que devuelve `abreCapitulo`
 *   para el que está abierto; `textos` el área de textos de la partida; `lamina` el
 *   elemento ya montado con el mundo congelado de ese mapa, o nulo; `fallo` la línea en
 *   voz de mundo cuando el capítulo no se pudo abrir.
 */
export function PantallaDiarioPorDias({
  diario,
  capitulo,
  textos = {},
  lamina = null,
  fallo = null,
  alVolver = null,
  alAbrirCapitulo = null,
  alVerPorHistorias = null,
}) {
  const hayHistorias = diario.vistas.includes(VISTAS.HISTORIAS);
  return (
    <View style={estilos.raiz} testID="diario-por-dias">
      <View testID="momento" accessibilityLabel="de-consulta" style={estilos.marca} />
      <View testID="diario-vista" accessibilityLabel={VISTAS.DIAS} style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <Pressable testID="diario-volver" onPress={alVolver}>
          <Text style={estilos.volver}>{TEXTOS.volver}</Text>
        </Pressable>
        <Text style={estilos.titular}>{TEXTOS.titulo}</Text>

        <TiraDeCapitulos capitulos={diario.capitulos} abierto={capitulo?.mapa ?? diario.abierto} alAbrirCapitulo={alAbrirCapitulo} />

        {fallo ? <Text style={estilos.mundo}>{fallo}</Text> : null}

        {capitulo && lamina ? (
          <View testID="diario-capitulo-lamina" style={estilos.lamina}>{lamina}</View>
        ) : null}

        {capitulo ? (
          <>
            <Text style={estilos.seccion}>{TEXTOS.losUltimosDias}</Text>
            {capitulo.dias.length === 0 ? (
              <Text style={estilos.mundo}>{TEXTOS.capituloSinDias}</Text>
            ) : (
              <View testID="diario-dias">
                {capitulo.dias.map((hoja) => (
                  <View key={hoja.dia} testID="diario-dia" accessibilityLabel={String(hoja.dia)} style={estilos.hoja}>
                    <Text style={estilos.dia}>{TEXTOS.hojaDeDia(hoja.dia)}</Text>
                    {/* Lo propio en primera persona, y lo oído aparte y con filete: dos
                        clases con distinta autoridad, que la proyección ya trae separadas. */}
                    {hoja.propio.map((version) => (
                      <Text key={version.id} style={estilos.propio}>{textoDeVersion(version, textos)}</Text>
                    ))}
                    {hoja.oido.map((version) => (
                      <View key={version.id} testID="diario-version" style={estilos.oido}>
                        <Text style={estilos.cuando}>{version.lugar}</Text>
                        <Text style={estilos.dicho}>«{textoDeVersion(version, textos)}»</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {hayHistorias ? (
        <Pressable testID="diario-ver-por-historias" onPress={alVerPorHistorias} style={estilos.accion}>
          <Text style={estilos.accionTexto}>{TEXTOS.verPorHistorias}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A6P4 · El diario, por historias.
 *
 * No tiene estado vacío y no le hace falta: no se puede abrir sin haber triangulado, y
 * triangular implica que hay al menos una historia con dos versiones.
 */
export function PantallaDiarioPorHistorias({ capitulo, textos = {}, alVerPorDias = null }) {
  return (
    <View style={estilos.raiz} testID="diario-por-historias">
      <View testID="momento" accessibilityLabel="de-consulta" style={estilos.marca} />
      <View testID="diario-vista" accessibilityLabel={VISTAS.HISTORIAS} style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <Pressable testID="diario-ver-por-dias-arriba" onPress={alVerPorDias}>
          <Text style={estilos.volver}>{TEXTOS.volverAlDiario}</Text>
        </Pressable>
        <Text style={estilos.titular}>{TEXTOS.tituloDeHistorias}</Text>

        <View testID="diario-historias">
          {(capitulo?.historias ?? []).map((historia) => (
            <View key={historia.suceso} testID="diario-historia" accessibilityLabel={historia.suceso} style={estilos.historia}>
              <Text style={estilos.nombreDeSuceso}>{historia.suceso}</Text>
              {historia.versiones.map((version) => (
                <CajaDeVersion
                  key={version.id}
                  version={version}
                  cuando={`${version.lugar} · ${TEXTOS.hojaDeDia(version.dia)}`}
                  textos={textos}
                />
              ))}
              {/* El cierre del hilo se compone con el dato —cuántas fuentes distintas la
                  contaron— y su redacción es de la fila 17: aquí solo está el hueco. */}
              {historia.cierre.versiones > 1 ? (
                <Text testID="diario-cierre-del-hilo" accessibilityLabel={String(historia.cierre.fuentes)} style={estilos.cierre} />
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <Pressable testID="diario-ver-por-dias" onPress={alVerPorDias} style={estilos.accion}>
        <Text style={estilos.accionTexto}>{TEXTOS.verPorDias}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  marca: MARCA,
  contenido: { padding: 28, gap: 14 },
  volver: { fontFamily: 'System', fontSize: 14, color: LAPIZ },
  titular: { fontFamily: 'serif', fontSize: 28, color: TINTA },
  tira: { gap: 10, marginTop: 8 },
  capitulo: { paddingVertical: 10, paddingHorizontal: 14, borderLeftColor: FILETE },
  capituloAbierto: { borderLeftWidth: 4 },
  capituloTenue: { borderLeftWidth: 1, opacity: 0.6 },
  tituloDeMundo: { fontFamily: 'serif', fontSize: 20, color: TINTA },
  subtitulo: { fontFamily: 'System', fontSize: 13, color: LAPIZ, marginTop: 2 },
  lamina: { height: 220, marginTop: 12 },
  seccion: { fontFamily: 'System', fontSize: 13, color: LAPIZ, marginTop: 20, letterSpacing: 1 },
  hoja: { borderTopWidth: 1, borderTopColor: LAPIZ, borderStyle: 'dotted', paddingTop: 12, marginTop: 12, gap: 8 },
  dia: { fontFamily: 'System', fontSize: 12, color: LAPIZ, letterSpacing: 2 },
  propio: { fontFamily: 'serif', fontSize: 18, lineHeight: 27, color: TINTA },
  oido: { borderLeftWidth: 1, borderLeftColor: FILETE, paddingLeft: 12 },
  version: { borderWidth: 1, borderColor: FILETE, padding: 14, marginTop: 10 },
  cuando: { fontFamily: 'System', fontSize: 12, color: LAPIZ, letterSpacing: 1 },
  dicho: { fontFamily: 'serif', fontSize: 18, lineHeight: 27, color: TINTA, fontStyle: 'italic' },
  mundo: { fontFamily: 'serif', fontSize: 18, lineHeight: 27, color: TINTA },
  historia: { marginTop: 24 },
  nombreDeSuceso: { fontFamily: 'serif', fontSize: 22, color: TINTA },
  cierre: { marginTop: 8 },
  accion: { margin: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
});
