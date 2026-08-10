// A2P1 · La portada: lo que se ve al abrir la app cualquier día que no sea el primero.
//
// La pantalla **no decide nada**: qué bloques hay, en qué orden, si existe la tarjeta de a
// medias, a dónde lleva «Ver qué se cuenta hoy» y qué dicen los textos sale entero de
// `partida/portada.js`. Aquí solo se dibuja lo que esa composición declara, y por eso las
// ausencias que esta pantalla defiende —panel del mundo, marcador de reputación, barra de
// pestañas, selector de mapas— se afirman contra el vocabulario cerrado del núcleo y no
// mirando esta pantalla en un simulador que no existe.
//
// Dos cosas de esta capa que sí son decisiones de dibujo:
//
// - **Las dos maneras de salir van apiladas y con el mismo peso.** La composición las declara
//   las dos en el mismo nivel; pintar una como enlace pequeño diría lo contrario de lo que el
//   diseño decidió, y lo diría más alto que cualquier texto.
// - **Las tres puertas son una fila al pie, no una barra de pestañas.** Cuelgan de la portada.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MARCA } from './marca.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

/** Un botón de la portada. Todos se pintan igual: el nivel lo declara la composición. */
function Accion({ testID, texto, onPress, secundaria = false }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[estilos.accion, secundaria && estilos.accionSecundaria]}>
      <Text style={[estilos.accionTexto, secundaria && estilos.accionTextoSecundario]}>{texto}</Text>
    </Pressable>
  );
}

/**
 * @param {object} props
 *   `portada` lo que devuelve `componePortada`; `alVerQueSeCuenta`, `alSalirSinMas`,
 *   `alSeguir`, `alDejarloAqui` y `alAbrirPuerta` qué ocurre en cada acción; `Miniatura` la
 *   lámina en pequeño, inyectada para que la portada se pueda montar sin Skia.
 */
export function PantallaPortada({
  portada,
  alVerQueSeCuenta = null,
  alSalirSinMas = null,
  alSeguir = null,
  alDejarloAqui = null,
  alAbrirPuerta = null,
  Miniatura = null,
}) {
  const accionDe = (id) => portada.acciones.find((a) => a.id === id);

  return (
    <View style={estilos.raiz} testID="portada">
      {/* El estado del momento, para poder afirmar en qué momento está la app. */}
      <View testID="momento-antes-de-salir" style={estilos.marca} />
      {/* La composición, tal cual: es el ancla de todo lo que se afirma sobre esta pantalla. */}
      <View testID="portada-bloques" accessibilityLabel={portada.bloques.join(',')} style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <View testID="portada-miniatura" style={estilos.miniatura}>
          <Text style={estilos.encabezado}>{`${portada.miniatura.encabezado} · día ${portada.dia}`}</Text>
          {portada.miniatura.titulo ? <Text style={estilos.tituloDelMundo}>{portada.miniatura.titulo}</Text> : null}
          {/* Lo entintado contra lo que sigue a lápiz, y ningún porcentaje. */}
          <View testID="portada-tintas" accessibilityLabel={portada.miniatura.tintas.join(',')} style={estilos.marca} />
          {Miniatura ? <Miniatura /> : <View style={estilos.lamina} />}
        </View>

        <Text testID="portada-identidad" style={estilos.identidad}>
          {`${portada.identidad.nombre}, ${portada.identidad.oficio}`}
        </Text>

        {portada.aMedias ? (
          <View testID="tarjeta-a-medias" style={estilos.tarjeta}>
            <Text style={estilos.tarjetaTitulo}>{portada.aMedias.titulo}</Text>
            {portada.aMedias.aventura ? <Text style={estilos.tarjetaLinea}>{portada.aMedias.aventura}</Text> : null}
            {portada.aMedias.donde ? <Text style={estilos.tarjetaLinea}>{portada.aMedias.donde}</Text> : null}
            <Accion testID="a-medias-seguir" texto={portada.aMedias.acciones[0].texto} onPress={alSeguir} />
            {/* Sin «¿seguro?»: cerrar una salida no destruye nada, produce un desenlace. */}
            <Accion testID="a-medias-dejarlo" texto={portada.aMedias.acciones[1].texto} onPress={alDejarloAqui} secundaria />
          </View>
        ) : null}

        <View style={estilos.salidas}>
          <Accion testID="ver-que-se-cuenta" texto={accionDe('ver-que-se-cuenta').texto} onPress={alVerQueSeCuenta} />
          <Accion testID="salir-sin-mas" texto={accionDe('salir-sin-mas').texto} onPress={alSalirSinMas} />
        </View>
      </ScrollView>

      <View style={estilos.puertas}>
        {portada.puertas.map((puerta) => (
          <Pressable
            key={puerta.id}
            testID={`puerta-${puerta.id}`}
            onPress={() => (alAbrirPuerta ? alAbrirPuerta(puerta.id) : null)}
            style={estilos.puerta}
          >
            <Text style={estilos.puertaTexto}>{puerta.texto}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  marca: MARCA,
  contenido: { padding: 24, gap: 16 },
  miniatura: { gap: 4 },
  encabezado: { fontSize: 13, color: LAPIZ, letterSpacing: 1 },
  tituloDelMundo: { fontSize: 26, color: TINTA },
  lamina: { height: 220, borderWidth: 1, borderColor: LAPIZ, borderRadius: 4 },
  identidad: { fontSize: 15, color: TINTA },
  tarjeta: { padding: 16, borderWidth: 1, borderColor: TINTA, borderRadius: 4, gap: 8 },
  tarjetaTitulo: { fontSize: 18, color: TINTA },
  tarjetaLinea: { fontSize: 14, color: TINTA, lineHeight: 20 },
  salidas: { gap: 12 },
  accion: { paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: TINTA, borderRadius: 4, alignItems: 'center' },
  accionSecundaria: { borderColor: LAPIZ },
  accionTexto: { fontSize: 16, color: TINTA },
  accionTextoSecundario: { color: LAPIZ },
  puertas: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 24 },
  puerta: { paddingVertical: 8, paddingHorizontal: 12 },
  puertaTexto: { fontSize: 14, color: LAPIZ },
});
