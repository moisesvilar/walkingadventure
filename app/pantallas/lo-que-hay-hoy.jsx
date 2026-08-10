// A2P3 · Lo que hay hoy, y A2P4 · La ficha.
//
// Las dos pantallas se dibujan desde lo que compone `partida/lo-que-hay-hoy.js` y no deciden
// nada: cuántas entradas hay, en qué orden, qué medida declara cada una, si en lugar de lista
// hay oferta de estirón y qué dice cada texto viene hecho.
//
// Tres decisiones de dibujo, y las tres son del diseño:
//
// - **La lista no se pagina y no tiene «ver más».** El tope de tres existe precisamente para
//   que no haga falta.
// - **El estirón sustituye a la lista, no se añade debajo**; y la línea de andar sin coger
//   ninguna se queda, que es lo que impide que la oferta sea la única salida.
// - **La ficha enseña el lazo entero y rotula solo la primera parada.** Las demás están
//   dibujadas y sin nombre: se decide la caminata sin destripar la historia.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MARCA } from './marca.js';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const LAPIZ = '#9a9483';

function Accion({ testID, texto, onPress, secundaria = false }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[estilos.accion, secundaria && estilos.accionSecundaria]}>
      <Text style={[estilos.accionTexto, secundaria && estilos.accionTextoSecundario]}>{texto}</Text>
    </Pressable>
  );
}

/**
 * @param {object} props
 *   `lista` lo que devuelve `componeLoQueHayHoy`; `alAbrirFicha` qué ocurre al tocar una
 *   entrada; `alEstiron` qué ocurre al aceptar la oferta; `alAndarSinNada` la salida de
 *   siempre, que existe con lista y sin ella.
 */
export function PantallaLoQueHayHoy({ lista, alAbrirFicha = null, alEstiron = null, alAndarSinNada = null }) {
  return (
    <View style={estilos.raiz} testID="lo-que-hay-hoy">
      <View testID="momento-antes-de-salir" style={estilos.marca} />
      <View testID="lista-bloques" accessibilityLabel={lista.bloques.join(',')} style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        {lista.hayLista ? (
          <>
            <Text style={estilos.titulo}>{lista.titulo}</Text>
            <Text style={estilos.subtitulo}>{lista.subtitulo}</Text>
            <View testID="lista-de-hoy" accessibilityLabel={String(lista.entradas.length)} style={estilos.lista}>
              {lista.entradas.map((entrada) => (
                <Pressable
                  key={entrada.id}
                  testID={`oferta-${entrada.id}`}
                  onPress={() => (alAbrirFicha ? alAbrirFicha(entrada) : null)}
                  style={estilos.tarjeta}
                >
                  {entrada.titulo ? <Text style={estilos.tarjetaTitulo}>{entrada.titulo}</Text> : null}
                  {entrada.gancho ? <Text style={estilos.tarjetaGancho}>{entrada.gancho}</Text> : null}
                  {/* La palabra del mundo y su hora orientativa. Ninguna distancia. */}
                  <Text testID="oferta-medida" style={estilos.medida}>{entrada.medida}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          // Sustituye a la lista y no se añade debajo: es la respuesta honesta a que hoy no
          // hay nada por aquí, no un extra.
          <View testID="sin-reparto" style={estilos.tarjeta}>
            <Text style={estilos.tarjetaGancho}>{lista.sinReparto.texto}</Text>
            {/* La oferta es siempre la misma, aparezca por el mundo pequeño, por el
                filtro o por los sitios que quien juega marcó (SPEC-035): el texto no
                nombra ninguna de las tres causas, y menos aún los descartes. */}
            {lista.estiron ? (
              <View testID="estiron-oferta" accessibilityLabel={lista.motivo}>
                <Accion testID="estiron" texto={lista.estiron.texto} onPress={alEstiron} />
              </View>
            ) : null}
          </View>
        )}

        <Pressable testID="andar-sin-nada" onPress={alAndarSinNada}>
          <Text style={estilos.andarSinNada}>{lista.andarSinNada}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/**
 * @param {object} props
 *   `ficha` lo que devuelve `componeFicha`; `alAceptar` y `alOtraCosa` las dos acciones del
 *   pie; `Lazo` cómo se dibuja el lazo, inyectado para poder montar la ficha sin Skia.
 */
export function PantallaFicha({ ficha, alAceptar = null, alOtraCosa = null, Lazo = null }) {
  return (
    <View style={estilos.raiz} testID="ficha-aventura">
      <View testID="momento-antes-de-salir" style={estilos.marca} />

      <ScrollView contentContainerStyle={estilos.contenido}>
        <View testID="ficha-lazo" style={estilos.lazo}>
          {Lazo ? <Lazo lazo={ficha.lazo} /> : null}
          {/* Los puntos van numerados y **solo el primero lleva nombre**. */}
          {ficha.lazo.paradas.map((parada) => (
            <View
              key={parada.n}
              testID={parada.n === 1 ? 'ficha-primera-parada' : 'ficha-parada'}
              accessibilityLabel={parada.nombre ?? String(parada.n)}
              style={estilos.marca}
            />
          ))}
          <Text style={estilos.primeraParada}>{ficha.primeraParada}</Text>
        </View>

        {ficha.titulo ? <Text style={estilos.titulo}>{ficha.titulo}</Text> : null}
        {/* El del narrador si lo hubo, el de plantilla si no. La pantalla es la misma. */}
        <Text testID="ficha-gancho" style={estilos.gancho}>{`«${ficha.gancho.texto}»`}</Text>
        <Text testID="ficha-pie" style={estilos.pie}>{ficha.pie}</Text>
        <Text style={estilos.empiezas}>{ficha.empiezas}</Text>

        <Accion testID="ficha-aceptar" texto={ficha.acciones[0].texto} onPress={alAceptar} />
        <Accion testID="ficha-otra-cosa" texto={ficha.acciones[1].texto} onPress={alOtraCosa} secundaria />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  marca: MARCA,
  contenido: { padding: 24, gap: 16 },
  titulo: { fontSize: 26, color: TINTA },
  subtitulo: { fontSize: 15, color: LAPIZ },
  lista: { gap: 12 },
  tarjeta: { padding: 16, borderWidth: 1, borderColor: TINTA, borderRadius: 4, gap: 8 },
  tarjetaTitulo: { fontSize: 18, color: TINTA },
  tarjetaGancho: { fontSize: 14, color: TINTA, lineHeight: 20 },
  medida: { fontSize: 13, color: LAPIZ },
  andarSinNada: { fontSize: 14, color: LAPIZ, lineHeight: 20 },
  lazo: { minHeight: 220, borderWidth: 1, borderColor: LAPIZ, borderRadius: 4, padding: 12, justifyContent: 'flex-end' },
  primeraParada: { fontSize: 12, color: TINTA, letterSpacing: 1 },
  gancho: { fontSize: 17, color: TINTA, lineHeight: 24 },
  pie: { fontSize: 13, color: LAPIZ },
  empiezas: { fontSize: 14, color: TINTA, lineHeight: 20 },
  accion: { paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: TINTA, borderRadius: 4, alignItems: 'center' },
  accionSecundaria: { borderColor: LAPIZ },
  accionTexto: { fontSize: 16, color: TINTA },
  accionTextoSecundario: { color: LAPIZ },
});
