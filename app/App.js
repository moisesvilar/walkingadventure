// La raíz de la app: monta la pantalla de andamiaje con los módulos de plataforma
// inyectados y con lo que diga el gancho de enlace profundo. Sin navegación: hay
// una sola pantalla, y un enrutador con una sola pantalla es una librería para
// nada. La fila 27 es la que tendrá dos pantallas que encadenar.

import React, { useEffect, useState } from 'react';
import { Linking, SafeAreaView, StyleSheet } from 'react-native';

import { MODULOS_DE_PLATAFORMA } from './plataforma/index.js';
import { leeGancho } from './plataforma/gancho.js';
import { PantallaAndamiaje } from './pantallas/andamiaje.js';

// Referencia estable: si fuera un literal en el cuerpo, cada repintado sería un
// re-sondeo de las cuatro capacidades.
const SIN_GANCHO = { ausentes: [], noReconocidos: [] };

// `__DEV__` lo define el empaquetador. En una compilación de producción vale
// false y el gancho queda inerte, que es lo que impide que sea una puerta trasera.
const EN_DESARROLLO = typeof __DEV__ !== 'undefined' && __DEV__;

export function App() {
  const [gancho, setGancho] = useState(SIN_GANCHO);

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
      <PantallaAndamiaje
        modulos={MODULOS_DE_PLATAFORMA}
        ausentes={gancho.ausentes}
        noReconocidos={gancho.noReconocidos}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#efe3c0' },
});
