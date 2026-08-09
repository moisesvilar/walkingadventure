// La raíz de la app: monta la pantalla de andamiaje con los módulos de plataforma
// inyectados y con lo que diga el gancho de enlace profundo. Sin navegación: un
// enrutador para pasar entre pantallas de herramienta es una librería para nada. La
// fila 27 es la que tendrá el onboarding entero que encadenar, y es la que sustituye
// el andamiaje por la primera pantalla de verdad.
//
// Desde esta fila hay una segunda pantalla que **sí es del juego**: el mapa. Aquí
// cuelga de un paso porque todavía no existe el flujo que lleva hasta ella —dónde se
// levanta, con qué permiso, con qué tramo— y sin ese paso no habría manera de
// recorrer el levantamiento de punta a punta ni de medir el minuto.
//
// Y una tercera, la revisión del render, detrás de un paso que solo existe con
// `__DEV__`. Esa no es navegación: es el equivalente del hook `__wa.style()` que el
// prototipo tiene en consola, y es donde se hace la revisión de paridad.

import React, { useEffect, useState } from 'react';
import { Linking, Pressable, SafeAreaView, StyleSheet, Text } from 'react-native';

import { MODULOS_DE_PLATAFORMA } from './plataforma/index.js';
import { leeGancho } from './plataforma/gancho.js';
import { ArranqueMontado } from './pantallas/arranque-montado.jsx';
import { PantallaAndamiaje } from './pantallas/andamiaje.js';
import { MapaMontado } from './pantallas/mapa-montado.jsx';
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
  const [enMapa, setEnMapa] = useState(false);
  // La app abre en el arranque, que es lo que ve quien la instala. Se sale de él por
  // el botón «Salir a andar» de A1P7, que es la frontera de registro y el único
  // camino: no hay manera de volver a entrar salvo por «empezar de nuevo».
  const [enArranque, setEnArranque] = useState(true);

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

  if (enArranque) {
    return (
      <SafeAreaView style={estilos.raiz}>
        <ArranqueMontado alSalirAAndar={() => setEnArranque(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.raiz}>
      {/* El paso al mapa. Existe en todas las compilaciones porque el mapa es del
          juego; lo provisional es el paso, no la pantalla. */}
      {!enRevision ? (
        <Pressable onPress={() => setEnMapa((estaba) => !estaba)} style={estilos.paso} testID="paso-mapa">
          <Text style={estilos.pasoTexto}>{enMapa ? 'Volver al andamiaje' : 'El mapa'}</Text>
        </Pressable>
      ) : null}

      {/* El paso a la revisión del render. Solo en desarrollo: el flujo de Maestro
          abre la app en el andamiaje y ahí se queda. */}
      {EN_DESARROLLO && !enMapa ? (
        <Pressable onPress={() => setEnRevision((estaba) => !estaba)} style={estilos.paso} testID="paso-revision-render">
          <Text style={estilos.pasoTexto}>{enRevision ? 'Volver al andamiaje' : 'El render en Skia'}</Text>
        </Pressable>
      ) : null}

      {enMapa ? <MapaMontado /> : enRevision ? (
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
