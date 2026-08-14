// Los controles del cuaderno, separados para que Metro los elimine enteros en producción.
// La fila completa del interruptor responde y el Switch pintado no captura el toque.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';
const FILETE = '#8a6d34';

export function CuadernoEnAndamiaje({ cuaderno }) {
  const [estado, setEstado] = useState(() => cuaderno.estado());
  useEffect(() => cuaderno.suscribe(setEstado), [cuaderno]);
  const recoge = async (accion) => {
    try { await accion(); } catch (e) { setEstado((actual) => ({ ...actual, averia: e?.message ?? String(e) })); }
  };
  return (
    <View testID="cuaderno-de-a-bordo">
      <View style={estilos.filete} />
      <Text style={estilos.epigrafe}>Cuaderno de a bordo</Text>
      <Text style={estilos.parrafo}>Registra posiciones, decisiones y errores para poder medir la app sin Metro.</Text>
      <Pressable onPress={() => recoge(estado.encendido ? cuaderno.apaga : cuaderno.enciende)} style={estilos.interruptor} testID="cuaderno-interruptor">
        <View style={estilos.interruptorTexto}>
          <Text style={estilos.texto}>{estado.encendido ? 'Apagar y borrar el cuaderno' : 'Cuaderno de a bordo'}</Text>
          <Text style={estilos.motivo} testID="cuaderno-estado">{estado.encendido ? 'Encendido · escribiendo' : 'Apagado'}</Text>
        </View>
        <Switch pointerEvents="none" value={estado.encendido} />
      </Pressable>
      <Text style={estilos.privacidad} testID="cuaderno-privacidad">Contiene posiciones y sitios reales. La app no lo envía: solo sale de este aparato si pulsas compartir.</Text>
      <Pressable disabled={!estado.tieneContenido} onPress={() => recoge(cuaderno.compartir)} style={[estilos.boton, !estado.tieneContenido && estilos.deshabilitado]} testID="cuaderno-compartir"><Text style={estilos.botonTexto}>Compartir el cuaderno</Text></Pressable>
      <View style={estilos.diagnosticos}>
        <Pressable disabled={!estado.encendido} onPress={cuaderno.provocaError} style={[estilos.secundario, !estado.encendido && estilos.deshabilitado]} testID="cuaderno-provocar-error"><Text style={estilos.texto}>Provocar error JS</Text></Pressable>
        <Pressable disabled={!estado.encendido} onPress={cuaderno.provocaRechazo} style={[estilos.secundario, !estado.encendido && estilos.deshabilitado]} testID="cuaderno-provocar-rechazo"><Text style={estilos.texto}>Provocar rechazo</Text></Pressable>
      </View>
      <Text style={estilos.motivo}>{estado.averia ?? (estado.tieneContenido ? 'Cuaderno listo para compartir.' : 'Todavía no hay nada que compartir.')}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  filete: { height: 1, backgroundColor: FILETE, marginVertical: 24 },
  epigrafe: { fontFamily: 'System', fontSize: 16, fontWeight: '600', color: TINTA, marginTop: 4 },
  parrafo: { fontFamily: 'System', fontSize: 15, color: TINTA, opacity: 0.7, marginTop: 6, lineHeight: 21 },
  texto: { fontFamily: 'System', fontSize: 15, color: TINTA },
  motivo: { fontFamily: 'System', fontSize: 13, color: TINTA, opacity: 0.7, marginTop: 2, lineHeight: 18 },
  interruptor: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  interruptorTexto: { flex: 1, paddingRight: 12 },
  privacidad: { fontFamily: 'System', fontSize: 13, color: TINTA, opacity: 0.8, lineHeight: 18, marginTop: 10 },
  boton: { backgroundColor: TINTA, borderRadius: 6, padding: 13, alignItems: 'center', marginTop: 18 },
  botonTexto: { fontFamily: 'System', fontSize: 15, fontWeight: '600', color: PLACA },
  diagnosticos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  secundario: { borderWidth: 1, borderColor: FILETE, borderRadius: 6, padding: 11, flexGrow: 1, alignItems: 'center' },
  deshabilitado: { opacity: 0.35 },
});
