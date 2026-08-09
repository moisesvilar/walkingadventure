// La raíz de la app: monta la pantalla de andamiaje con los módulos de plataforma
// inyectados y con lo que diga el gancho de enlace profundo. Sin navegación: en la
// compilación de tienda hay una sola pantalla, y un enrutador con una sola pantalla
// es una librería para nada. La fila 27 es la que tendrá dos pantallas que encadenar.
//
// En desarrollo hay una segunda, la revisión del render, detrás de un paso que solo
// existe con `__DEV__`. No es navegación: es el equivalente del hook `__wa.style()`
// que el prototipo tiene en consola, y es donde se hace la revisión de paridad.

import React, { useEffect, useState } from 'react';
import { Linking, Pressable, SafeAreaView, StyleSheet, Text } from 'react-native';

import { MODULOS_DE_PLATAFORMA } from './plataforma/index.js';
import { leeGancho } from './plataforma/gancho.js';
import { PantallaAndamiaje } from './pantallas/andamiaje.js';
import { RevisionMontada } from './pantallas/revision-montada.jsx';

// Referencia estable: si fuera un literal en el cuerpo, cada repintado sería un
// re-sondeo de las cuatro capacidades.
const SIN_GANCHO = { ausentes: [], noReconocidos: [] };

// `__DEV__` lo define el empaquetador. En una compilación de producción vale
// false y el gancho queda inerte, que es lo que impide que sea una puerta trasera.
const EN_DESARROLLO = typeof __DEV__ !== 'undefined' && __DEV__;

export function App() {
  const [gancho, setGancho] = useState(SIN_GANCHO);
  const [enRevision, setEnRevision] = useState(false);

  useEffect(() => {
    let vivo = true;
    const aplica = (url) => {
      const leido = leeGancho(url, EN_DESARROLLO);
      if (!vivo) return;
      if (leido.ausentes.length === 0 && leido.noReconocidos.length === 0) return;
      setGancho(leido);
    };
    Linking.getInitialURL().then(aplica).catch(() => {});
    const suscripcion = Linking.addEventListener('url', (evento) => aplica(evento?.url));
    return () => {
      vivo = false;
      suscripcion.remove();
    };
  }, []);

  return (
    <SafeAreaView style={estilos.raiz}>
      {/* El paso a la revisión del render. Va arriba y solo en desarrollo: el flujo
          de Maestro abre la app en el andamiaje y ahí se queda. */}
      {EN_DESARROLLO ? (
        <Pressable onPress={() => setEnRevision((estaba) => !estaba)} style={estilos.paso} testID="paso-revision-render">
          <Text style={estilos.pasoTexto}>{enRevision ? 'Volver al andamiaje' : 'El render en Skia'}</Text>
        </Pressable>
      ) : null}

      {enRevision ? (
        <RevisionMontada />
      ) : (
        <PantallaAndamiaje
          modulos={MODULOS_DE_PLATAFORMA}
          ausentes={gancho.ausentes}
          noReconocidos={gancho.noReconocidos}
        />
      )}
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#efe3c0' },
  paso: { paddingHorizontal: 24, paddingVertical: 8 },
  pasoTexto: { fontSize: 13, color: '#1e2b18', opacity: 0.7 },
});
