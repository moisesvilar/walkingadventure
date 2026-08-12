// A5P1, A5P1B, A5P2, A5P2B, A5P3 y A5P4 · La secuencia del telón, y la cartela del hito.
//
// Una pantalla por elemento de `telon.pantallas`, **en su orden y sin reordenar ninguna**: la
// secuencia y sus dos ramas las decide `packages/nucleo/partida/telon.js` desde SPEC-036, y
// aquí no hay ninguna condición que elija qué se enseña. Lo que hay es un dibujo por estado
// del vocabulario cerrado, y un estado que no esté en la lista se enseña como avería en lugar
// de saltarse.
//
// Las reglas de dibujo, todas ellas ausencias, y todas del diseño:
//
// - **Ni flecha de volver, ni barra, ni indicador de en qué pantalla vas.** El telón se lee una
//   vez (`bucle-jugable.md` §8) y ninguna pantalla intermedia ofrece salir, para no partir la
//   lectura por la mitad.
// - **Ninguna leyenda de tintas.** Las tres se ven y no se explican: una leyenda convertiría el
//   mapa ganado en un cuadro de mandos.
// - **La única cifra de toda la secuencia es la del oro.** Ni porcentajes, ni kilómetros, ni
//   tiempos, ni barras en la lista de ascensos.
// - **El fragmento de A5P3 no tiene destino**: la misma lámina con una vista centrada en el
//   núcleo de origen, sin ninguna línea hacia ningún sitio. Lo que se le entrega para pintar es
//   el núcleo de origen y nada más — el núcleo no le da nada más.
// - **La cartela del hito no es una pantalla de la secuencia**: es una capa que aparece una
//   sola vez entre el desenlace y la entrada del diario, se cierra tocando y no queda en ningún
//   sitio consultable.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ESTADOS_DEL_TELON } from '@walkingadventure/nucleo/partida/telon.js';
import { ESTILO_POR_DEFECTO } from '@walkingadventure/nucleo/render/estilos.js';

import { Lamina } from '../render/lamina.jsx';
import { MARCA, capaDeMarcas } from './marca.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/** Cuánto mundo cabe en el fragmento de A5P3, en metros. Lo justo para que salga uno solo. */
const RADIO_DEL_FRAGMENTO_M = 700;

/** La vista centrada en un núcleo del mundo, o `null` si el mundo no lo tiene. */
export function vistaDelFragmento(documento, nucleo) {
  const suyo = (documento?.settlements ?? []).find((s) => s.name === nucleo) ?? null;
  if (!suyo) return null;
  return { cx: suyo.x, cy: suyo.y, r: RADIO_DEL_FRAGMENTO_M, foco: null, paraje: null, escala: false };
}

/**
 * @param {object} props
 *   `pantalla` un elemento de `telon.pantallas`; `documento` el mundo congelado, para las dos
 *   pantallas que llevan lámina; `enlace` el enlace con Skia; `hito` la cartela cuando toca
 *   aparecer, o `null`; `alSeguir` avanzar —la única acción de todas menos la última—;
 *   `alDiario` y `alCerrar` las dos salidas de la última, que marcan el telón como leído;
 *   `alCerrarHito` quitar la cartela.
 */
export function PantallaTelon({
  pantalla,
  documento = null,
  enlace = null,
  estilo = ESTILO_POR_DEFECTO,
  hito = null,
  alSeguir = null,
  alDiario = null,
  alCerrar = null,
  alCerrarHito = null,
}) {
  const { width, height } = useWindowDimensions();
  const tamano = { ancho: Math.round(width), alto: Math.round(height * 0.45) };
  const marcas = (
    <View pointerEvents="none" style={capaDeMarcas(0)}>
      <View testID="telon-estado" accessibilityLabel={pantalla?.estado ?? 'sin-telon'} style={MARCA} />
    </View>
  );

  // Un estado que no está en el vocabulario cerrado. Es inalcanzable con el telón que compone
  // el paquete —esos seis son los únicos que emite— y existe para que un montaje doblado no se
  // salte una pantalla en silencio. **Sin prosa**: lo que se enseña es el estado que llegó y la
  // lista de los declarados, que son los dos datos del núcleo.
  if (!ESTADOS_DEL_TELON.includes(pantalla?.estado)) {
    return (
      <View style={estilos.raiz} testID="telon">
        {marcas}
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Text style={estilos.titulo}>{String(pantalla?.estado)}</Text>
          <Text style={estilos.linea}>{ESTADOS_DEL_TELON.join(' · ')}</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={estilos.raiz} testID="telon">
      {marcas}

      {/* 1 · El mapa, con tinta o sin ella. Es la misma pantalla y lo que cambia es el título,
          la lista y la línea: saltársela haría desaparecer el objeto central del juego justo el
          día en que menos apetece salir. */}
      {pantalla.estado === 'mapa' || pantalla.estado === 'mapa-sin-tinta' ? (
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Text style={estilos.rotulo}>{pantalla.situacion}</Text>
          <Text testID="telon-titulo" style={estilos.titulo}>{pantalla.titulo}</Text>
          {documento && enlace ? (
            <View testID="telon-mapa" style={{ width: tamano.ancho, height: tamano.alto, marginHorizontal: -28 }}>
              <Lamina
                documento={documento}
                estilo={estilo}
                tamano={tamano}
                enlace={enlace}
                entintado={pantalla.entintado}
                telon
              />
            </View>
          ) : null}
          {/* Una línea por elemento, con su nombre y su escalón **en palabras del mundo**. Sin
              ascensos la lista está vacía y no se sustituye por ninguna disculpa: lo que se
              enseña entonces son los sitios por los que se pasó, sin escalón al lado. */}
          <View testID="telon-ascensos">
            {pantalla.ascensos.map((a) => (
              <Text key={a.clave} style={estilos.linea}>{`${a.nombre} · ${a.escalon}`}</Text>
            ))}
            {pantalla.porDondeSePaso.map((sitio) => (
              <Text key={sitio} style={estilos.linea}>{sitio}</Text>
            ))}
          </View>
          {pantalla.linea ? <Text style={estilos.mundo}>{pantalla.linea}</Text> : null}
        </ScrollView>
      ) : null}

      {/* 2 y 3 · El desenlace, o el cierre en corto en su sitio. Se pintan igual porque son la
          misma pantalla con otro titular y otro párrafo: lo que las distingue lo decidió el
          motor al declarar cómo acabó la aventura, no este dibujo. */}
      {pantalla.estado === 'desenlace' || pantalla.estado === 'cierre-en-corto' ? (
        <ScrollView contentContainerStyle={estilos.contenido}>
          {pantalla.aventura ? <Text style={estilos.rotulo}>{pantalla.aventura}</Text> : null}
          <Text style={estilos.titulo}>{pantalla.titular}</Text>
          {pantalla.parrafo ? <Text style={estilos.mundo}>{pantalla.parrafo}</Text> : null}
          {pantalla.oro ? (
            <Text testID="desenlace-oro" accessibilityLabel={String(pantalla.oro.cantidad)} style={estilos.oro}>
              {String(pantalla.oro.cantidad)}
            </Text>
          ) : null}
          {pantalla.objetos.length ? (
            <View testID="desenlace-objetos">
              {pantalla.objetos.map((o) => (
                <Text key={o.id} style={estilos.linea}>{o.id}</Text>
              ))}
            </View>
          ) : null}
          {/* La frase del rango, **una sola y ausente si no se movió**: no se sustituye por
              ninguna que diga que no subió, que sería el medidor con signo negativo. */}
          {pantalla.rango ? <Text testID="desenlace-rango" style={estilos.mundo}>{pantalla.rango.texto}</Text> : null}
          {pantalla.cierre ? <Text style={estilos.mundo}>{pantalla.cierre}</Text> : null}
        </ScrollView>
      ) : null}

      {/* 4 · Lo que se pone en camino. El rumor se ve salir y no se ve llegar. */}
      {pantalla.estado === 'rumor' ? (
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Text style={estilos.rotulo}>{pantalla.rotulo}</Text>
          <Text style={estilos.titulo}>{pantalla.titular}</Text>
          <Text style={estilos.mundo}>{pantalla.consecuencia}</Text>
          <View testID="rumor-sale" accessibilityLabel={pantalla.sale.origen} style={estilos.fragmento}>
            {documento && enlace && vistaDelFragmento(documento, pantalla.sale.origen) ? (
              <Lamina
                documento={documento}
                estilo={estilo}
                vista={vistaDelFragmento(documento, pantalla.sale.origen)}
                tamano={{ ancho: tamano.ancho - 56, alto: Math.round(tamano.alto * 0.6) }}
                enlace={enlace}
              />
            ) : null}
          </View>
          <Text style={estilos.mundo}>{pantalla.espera}</Text>
        </ScrollView>
      ) : null}

      {/* 5 · La entrada del diario. Siempre, y cierra. */}
      {pantalla.estado === 'diario' ? (
        <ScrollView contentContainerStyle={estilos.contenido} testID="diario-del-dia">
          <Text style={estilos.rotulo}>{pantalla.rotulo}</Text>
          <Text style={estilos.titulo}>{pantalla.titulo}</Text>
          <Text testID="diario-lo-propio" accessibilityLabel={pantalla.propio.autoridad} style={estilos.mundo}>
            {pantalla.propio.texto}
          </Text>
          {pantalla.oido.length ? (
            <View testID="diario-lo-oido">
              {pantalla.oido.map((e) => (
                <Text key={`${e.suceso}:${e.lugar}`} accessibilityLabel={e.autoridad} style={estilos.oido}>
                  {`«${e.texto ?? e.suceso}»`}
                </Text>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      {/* Las acciones. Una sola —«Seguir»— en todas menos la última, que tiene las dos salidas
          naturales y **las dos marcan el telón como leído**: si alguna no marcara, la app
          quedaría sin poder abrir ninguna salida (§10h). */}
      {pantalla.estado === 'diario' ? (
        <View style={estilos.acciones}>
          <Pressable testID="telon-diario" onPress={alDiario} style={estilos.accion}>
            <Text style={estilos.accionTexto}>{pantalla.acciones[0]}</Text>
          </Pressable>
          <Pressable testID="telon-cerrar" onPress={alCerrar} style={estilos.accion}>
            <Text style={estilos.accionTexto}>{pantalla.acciones[1]}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable testID="telon-seguir" onPress={alSeguir} style={[estilos.accion, estilos.accionSola]}>
          <Text style={estilos.accionTexto}>{pantalla.accion ?? ''}</Text>
        </Pressable>
      )}

      {/* La cartela del hito: papel, un filete y las dos líneas que trae. Sin acción propia más
          que cerrarse, y la secuencia sigue donde estaba. */}
      {hito ? (
        <Pressable testID="hito-arranque" onPress={alCerrarHito} style={estilos.capa}>
          <View style={estilos.cartela}>
            <View style={estilos.filete} />
            <Text style={estilos.mundo}>{hito.cartela}</Text>
            <Text style={estilos.mundo}>{hito.remate}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  contenido: { padding: 28, paddingTop: 48, gap: 16 },
  rotulo: { fontFamily: 'serif', fontSize: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: LAPIZ },
  titulo: { fontFamily: 'serif', fontSize: 26, lineHeight: 34, color: TINTA },
  mundo: { fontFamily: 'serif', fontSize: 20, lineHeight: 30, color: TINTA },
  linea: { fontFamily: 'serif', fontSize: 17, lineHeight: 26, color: TINTA },
  oro: { fontFamily: 'serif', fontSize: 30, color: TINTA },
  oido: { fontFamily: 'serif', fontSize: 18, lineHeight: 28, color: LAPIZ },
  fragmento: { alignItems: 'center' },
  acciones: { flexDirection: 'row', gap: 12, margin: 24 },
  accion: { flex: 1, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  accionSola: { margin: 24 },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
  capa: { ...StyleSheet.absoluteFillObject, backgroundColor: PLACA, justifyContent: 'center', padding: 32 },
  cartela: { gap: 16 },
  filete: { height: 1, backgroundColor: TINTA, opacity: 0.5 },
});
