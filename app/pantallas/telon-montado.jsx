// El punto de montaje del telón: **lo echa una vez**, recorre sus pantallas en su orden y
// marca el leído.
//
// Es el mismo reparto que `llegada-montada.jsx` y `en-marcha-montado.jsx`: aquí se decide qué
// se monta y con qué se cablea cada acción, y quien quiera un montaje doblado llama a
// `PantallaTelon` directamente con un telón compuesto a mano.
//
// Tres cosas que este fichero decide, y las tres están en «Decisiones asumidas» de SPEC-049:
//
// - **El telón se echa al montarse esta pantalla**, y no en la misma transición que cierra la
//   salida. `salidas.js` sostiene «cerrada sin leer» durante días y el telón es lo primero que
//   la app enseña al abrirse, así que nada de lo que el cierre escribe es observable antes; la
//   alternativa obliga a guardar la composición entera dentro de `AREA_SALIDAS`, que declara
//   «ni un campo más».
// - **Si la app murió entre echarlo y marcarlo como leído**, se enseña la entrada del día
//   recompuesta del diario, con sus dos salidas intactas. Volver a echarlo entintaría dos veces
//   e ingresaría el oro dos veces; una avería sin acción dejaría la app encallada.
// - **La cartela del hito aparece una sola vez**, entre el desenlace y la entrada del diario, y
//   no vuelve: se cierra tocando y no queda en ningún sitio consultable.
//
// Y la avería del cierre se enseña con su motivo literal **conservando la acción que marca el
// telón como leído**, que es lo que impide la app muerta de §10h: sin poder marcarlo, ninguna
// salida se podría volver a abrir jamás.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TEXTOS as TEXTOS_DEL_TELON } from '@walkingadventure/nucleo/partida/telon.js';

import { echaElTelonDeLaSalida, laEntradaDelDiaRecompuesta } from '../marcha/cierre.js';
import { NUCLEO_DEL_CIERRE_DE_SALIDA } from '../nucleo/piezas.js';
import { mensajeDeError } from '../plataforma/capacidades.js';
import { creaEnlaceReal } from '../render/enlace-real.js';
import { MARCA, capaDeMarcas } from './marca.js';
import { PantallaTelon } from './telon.jsx';

const PLACA = '#efe3c0';
const TINTA = '#1e2b18';

/**
 * @param {object} props
 *   `partida` lo que hay abierto —estado, registro y mundo levantado—; `calendario` el de la
 *   partida; `situacion` la de la salida, que viaja como marca; `alLeido` marcar el telón como
 *   leído, que es lo único que lo marca; `alDiario` la otra salida de la última pantalla, que
 *   marca igual y además abre el diario entero.
 */
export function TelonMontado({ partida, calendario, situacion = 'sin-salida', alLeido = null, alDiario = null, alEchado = null }) {
  // Cuántas pantallas se han pasado. No se persiste: la composición del telón vive lo que dura
  // su lectura, y esa frontera está declarada con su consecuencia.
  const [pasada, setPasada] = useState(0);
  const [hitoCerrado, setHitoCerrado] = useState(false);

  // El telón echado, **una sola vez por montaje**. Va en el inicializador perezoso del estado y
  // no en un `useMemo`: echarlo es una escritura de la partida —entinta el mapa e ingresa el
  // oro— y un memo se puede volver a evaluar, mientras que esto corre exactamente una vez.
  const [compuesto] = useState(() => {
    try {
      const resultado = echaElTelonDeLaSalida({
        nucleo: NUCLEO_DEL_CIERRE_DE_SALIDA,
        estado: partida.estado,
        registro: partida.registro,
        calendario,
        mundo: partida.mundo?.documento ?? null,
        mapaId: partida.mundo?.mapaId ?? null,
      });
      return { pantallas: resultado.telon.pantallas, hito: resultado.telon.hito, fallo: null, recompuesto: false };
    } catch (e) {
      // O el telón ya se echó —y entonces lo que queda es su última pantalla, recompuesta del
      // diario— o no se pudo echar, y entonces se enseña el motivo literal. Los dos casos
      // conservan la acción que marca el leído.
      const motivo = mensajeDeError(e);
      try {
        const ultima = laEntradaDelDiaRecompuesta({
          nucleo: NUCLEO_DEL_CIERRE_DE_SALIDA,
          estado: partida.estado,
          mapaId: partida.mundo?.mapaId ?? null,
        });
        return { pantallas: [ultima], hito: null, fallo: null, recompuesto: true };
      } catch {
        return { pantallas: [], hito: null, fallo: motivo, recompuesto: false };
      }
    }
  });

  // **Echar el telón es un corte del juego y se congela ahí mismo.** Va en un efecto y no
  // dentro del inicializador porque congelar es asíncrono y toca la raíz: si la app muriera
  // entre el entintado y la escritura, el telón se volvería a echar y entintaría dos veces.
  useEffect(() => {
    if (compuesto.fallo === null && !compuesto.recompuesto && alEchado) alEchado();
    // Una sola vez por montaje, que es exactamente las veces que el telón se echa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marcas = (
    <View pointerEvents="none" style={capaDeMarcas(1)}>
      <View testID="salida-situacion" accessibilityLabel={situacion} style={MARCA} />
      <View testID="telon-recompuesto" accessibilityLabel={compuesto.recompuesto ? 'si' : 'no'} style={MARCA} />
    </View>
  );

  // La avería: el telón no se pudo echar y tampoco hay diario del que recomponerlo. **Con su
  // acción**, porque una app que no puede marcar el telón como leído no puede volver a salir.
  if (compuesto.fallo !== null || !compuesto.pantallas.length) {
    return (
      <View style={estilos.raiz} testID="telon-sin-cablear">
        {marcas}
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Text style={estilos.motivo}>{compuesto.fallo ?? ''}</Text>
        </ScrollView>
        <Pressable testID="telon-cerrar" onPress={alLeido} style={estilos.accion}>
          {/* El rótulo sale del paquete, como todo lo demás: aquí no se redacta ni una palabra,
              tampoco en la avería. */}
          <Text style={estilos.accionTexto}>{TEXTOS_DEL_TELON.cerrar}</Text>
        </Pressable>
      </View>
    );
  }

  const indice = Math.min(pasada, compuesto.pantallas.length - 1);
  const pantalla = compuesto.pantallas[indice];
  // La cartela va **entre el desenlace y la entrada del diario**, que es lo que su composición
  // declara en `entre`: aparece al llegar a la última pantalla y una sola vez.
  const hito = compuesto.hito && !hitoCerrado && pantalla.estado === 'diario' ? compuesto.hito : null;

  return (
    <View style={estilos.raiz}>
      {marcas}
      <PantallaTelon
        pantalla={pantalla}
        documento={partida.mundo?.documento ?? null}
        enlace={creaEnlaceReal()}
        hito={hito}
        // Avanzar **no marca nada**: lo marca un toque de quien lo lee y nunca el paso de nada.
        alSeguir={() => setPasada((n) => Math.min(n + 1, compuesto.pantallas.length - 1))}
        alDiario={alDiario}
        alCerrar={alLeido}
        alCerrarHito={() => setHitoCerrado(true)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: PLACA },
  contenido: { padding: 28, paddingTop: 48, gap: 16 },
  motivo: { fontFamily: 'serif', fontSize: 16, lineHeight: 24, color: TINTA },
  accion: { margin: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: TINTA },
  accionTexto: { fontFamily: 'serif', fontSize: 18, color: TINTA },
});
