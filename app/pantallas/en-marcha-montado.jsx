// El punto de montaje del momento «en marcha»: junta el seguidor de posición, el vibrador
// y el enlace con Skia, compone el momento contra el mundo levantado y se lo entrega ya
// cableado a `PantallaEnMarcha`.
//
// Es el mismo reparto que `mapa-montado.jsx` y `antes-de-salir-montado.jsx`: aquí se decide
// **qué** se monta, y quien quiera un montaje doblado —un recorrido guionizado, un vibrador
// que registra— construye el suyo y llama a `PantallaEnMarcha` directamente. Esa frontera es
// lo que permite recorrer el momento en `node --test` sin ningún dispositivo.
//
// Y **si algo no se puede cablear, no se dibuja el momento**: se enseña la avería con su
// mensaje y con la pieza que falta nombrada. En esta pantalla eso pesa más que en ninguna
// otra, porque la forma de fallo que evita es exactamente la que el momento no perdona: un
// mapa con la marca quieta es indistinguible de andar en círculos, y un aviso sin capa de
// bolsillo es indistinguible de un aviso que llegó (§6h, y `accesibilidad.md` §3).
//
// Lo que hoy no se puede cablear, y por eso el momento se queda en la avería: **el seguidor
// de posición**. La app no trae módulo de ubicación en marcha —eso es el rótulo del sistema
// con su servicio en primer plano, que es de la fila 30— y ninguna spec ha nombrado todavía
// la dependencia que lo daría. Entra por la firma para que el día que exista sea una línea.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

import { componeEnMarcha } from '@walkingadventure/nucleo/partida/en-marcha.js';
import { ESTILO_POR_DEFECTO } from '@walkingadventure/nucleo/render/estilos.js';

import { encuadraCelda } from '../mapa/camara.js';
import { seguidorSinMontar } from '../marcha/seguidor.js';
import { mensajeDeError } from '../plataforma/capacidades.js';
import { creaVibradorDeExpo } from '../plataforma/vibrador.js';
import { creaEnlaceReal } from '../render/enlace-real.js';
import { Lamina } from '../render/lamina.jsx';
import { PantallaEnMarcha } from './en-marcha.jsx';

/**
 * El encuadre con el que se abre el momento: la celda entera, recentrada sobre la marca de
 * posición si el seguidor responde. No es una cámara nueva —es la de SPEC-026 con otro
 * centro—, y sigue sin rotación porque el norte va arriba siempre.
 */
/**
 * Referencia estable para el mapa sin marcas de aviso. Si fuera un literal en la firma, cada
 * repintado compondría el momento otra vez —y componerlo lee la posición del seguidor—.
 */
const SIN_MARCAS = Object.freeze([]);

export function encuadreEnMarcha(documento, punto) {
  const celda = encuadraCelda(documento);
  if (!punto) return celda;
  return Object.freeze({ cx: punto.x, cy: punto.y, r: celda.r });
}

/**
 * @param {object} props
 *   `mundo` el documento congelado del mapa levantado; `salidas` el registro de la salida
 *   abierta; `trazado` el lazo aceptado con su lista de sitios, o `null`; `guia`, `noticia`,
 *   `desvio` y `caminoEvitado` los cuatro contenidos posibles del zócalo; `aviso` el último
 *   emitido con sus capas; `seguidor` y `vibrador` la frontera de inyección, y si no llegan
 *   se monta lo que hay —que hoy, para el seguidor, es el sin montar que protesta—;
 *   `falloDeCableado` una avería que ya viene de fuera, para que quien monta el mundo no
 *   tenga que declarar su propia pantalla de avería con otro identificador.
 */
export function EnMarchaMontado({
  mundo,
  falloDeCableado = null,
  salidas = null,
  trazado = null,
  guia = null,
  marcasDeAviso = SIN_MARCAS,
  noticia = null,
  desvio = null,
  caminoEvitado = null,
  aviso = null,
  seguidor = null,
  vibrador = null,
  estilo = ESTILO_POR_DEFECTO,
  factorTexto = 1,
}) {
  const { width, height } = useWindowDimensions();
  // A sangre: la lámina ocupa la pantalla entera, sin cabecera y sin pie que la recorten.
  const tamano = useMemo(
    () => ({ ancho: Math.round(width), alto: Math.round(height) }),
    [width, height],
  );

  const montaje = useMemo(() => {
    try {
      return {
        momento: componeEnMarcha({
          seguidor: seguidor ?? seguidorSinMontar(),
          vibrador: vibrador ?? creaVibradorDeExpo(Haptics),
          salidas,
          mundo,
          trazado,
          guia,
          marcasDeAviso,
          noticia,
          desvio,
          caminoEvitado,
        }),
        enlace: creaEnlaceReal(),
        fallo: null,
      };
    } catch (e) {
      return { momento: null, enlace: null, fallo: mensajeDeError(e) };
    }
  }, [seguidor, vibrador, salidas, mundo, trazado, guia, marcasDeAviso, noticia, desvio, caminoEvitado]);

  const fallo = falloDeCableado ?? montaje.fallo;
  if (fallo !== null) {
    return (
      <View style={estilos.aviso} testID="en-marcha-sin-cablear">
        <Text style={estilos.texto}>{fallo}</Text>
      </View>
    );
  }

  return (
    <PantallaEnMarcha
      momento={montaje.momento}
      documento={mundo}
      camara={encuadreEnMarcha(mundo, montaje.momento.marcaPosicion.punto)}
      tamano={tamano}
      estilo={estilo}
      factorTexto={factorTexto}
      enlace={montaje.enlace}
      Lamina={Lamina}
      aviso={aviso}
    />
  );
}

const estilos = StyleSheet.create({
  aviso: { flex: 1, padding: 24 },
  texto: { fontSize: 14, lineHeight: 20 },
});
