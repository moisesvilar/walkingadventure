// El punto de montaje del mapa: junta las piezas que la pantalla necesita de
// plataforma —la puerta de red, el enlace con Skia, el reloj, el almacén— y se las
// entrega ya cableadas. La pantalla no sabe de dónde sale ninguna, y por eso se lee
// entera sin dispositivo.
//
// Es el único sitio de la app donde se decide **qué** se monta, igual que
// `plataforma/index.js` para las capacidades. Quien quiera un montaje doblado
// —los cuatro extractos congelados, un cronómetro que devuelve tiempos por encima
// del presupuesto— construye el suyo con otras piezas y llama a `PantallaMapa`
// directamente: esa es la frontera, y es lo que hace que el minuto se pueda poner
// rojo sin un dispositivo.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { RESPUESTAS_DE_TRAMO, tramoDeRespuesta } from '@walkingadventure/nucleo/partida/tramo.js';
import { colocadorDeRotulos } from '@walkingadventure/nucleo/render/colocador.js';

import { exigeAlmacenDuradero } from '../datos/almacen-duradero.js';
import { creaClienteDeProxy } from '../datos/cliente-proxy.js';
import { creaTraedorDeOsm } from '../datos/traedor.js';
import { puertaDeRed } from '../datos/red.js';
import { creaCronometro } from '../mapa/cronometro.js';
import { NUCLEO_DEL_LEVANTAMIENTO } from '../nucleo/piezas.js';
import { creaLevantamiento } from '../mapa/levantamiento.js';
import { mensajeDeError } from '../plataforma/capacidades.js';
import { creaEnlaceReal } from '../render/enlace-real.js';
import { creaMedidorSkia } from '../render/medidor-skia.js';
import { PantallaMapa } from './mapa.jsx';

/**
 * La dirección del proxy. Se lee del entorno del empaquetador y **no se adivina**:
 * un valor por defecto que apunte a algún sitio haría que una compilación mal
 * configurada pareciera una avería de red.
 */
export const DIRECCION_DEL_PROXY = typeof process !== 'undefined' && process.env
  ? process.env.EXPO_PUBLIC_PROXY ?? null
  : null;

/**
 * La coordenada de arranque mientras no exista A1P4.
 *
 * Elegir dónde se levanta —el permiso de ubicación, el pin arrastrable y su círculo
 * de alcance— es de la fila 27. Aquí entra por la firma para que el flujo se pueda
 * recorrer entero, y el valor de reserva es la misma coordenada con la que el resto
 * del repositorio compara mundos.
 */
export const PUNTO_DE_ARRANQUE = Object.freeze({ lat: 42.40, lon: -8.81 });

/**
 * La semilla de arranque mientras no exista la partida.
 *
 * Es literal y no sorteada a propósito: la semilla de una partida se crea **una vez**
 * con entropía de verdad, y ese es el único punto de azar del proyecto; sortearla en
 * cada montaje de esta pantalla haría que cada apertura levantara otro mundo. La
 * crea la fila 27, con la entropía del dispositivo, y entonces entra por la firma.
 */
export const SEMILLA_DE_ARRANQUE = '37BKQX25DHZ18ETX';

/** El tramo preseleccionado del catálogo del arranque. Sale del núcleo, no de aquí. */
export function tramoDeArranque() {
  const preseleccionada = RESPUESTAS_DE_TRAMO.find((r) => r.preseleccionada) ?? RESPUESTAS_DE_TRAMO[0];
  return tramoDeRespuesta(preseleccionada);
}

/** Lo que ocupa el paso a las otras pantallas de la compilación de desarrollo. */
const ALTO_DE_LOS_CONTROLES = 40;

export function MapaMontado({
  punto = PUNTO_DE_ARRANQUE,
  semilla = SEMILLA_DE_ARRANQUE,
  tramoM = tramoDeArranque(),
  base = DIRECCION_DEL_PROXY,
  almacen = null,
}) {
  const { width, height } = useWindowDimensions();

  const montaje = useMemo(() => {
    try {
      // Lo primero, antes de montar nada: sin almacén duradero esta pantalla generaría
      // un mapa entero y lo perdería al cerrar. Se protesta en vez de seguir (§6h).
      exigeAlmacenDuradero(almacen, 'la pantalla del mapa');
      const enlace = creaEnlaceReal();
      const cronometro = creaCronometro({ ahora: () => Date.now() });
      const cliente = creaClienteDeProxy({ pide: puertaDeRed(), base });
      const levantamiento = creaLevantamiento({
        consultaOsm: creaTraedorDeOsm({ cliente }),
        almacen,
        cronometro,
        colocador: colocadorDeRotulos,
        medidor: creaMedidorSkia(enlace.fuente),
        nucleo: NUCLEO_DEL_LEVANTAMIENTO,
      });
      return { enlace, cronometro, levantamiento, fallo: null };
    } catch (e) {
      return { enlace: null, cronometro: null, levantamiento: null, fallo: mensajeDeError(e) };
    }
  }, [almacen, base]);

  const tamano = useMemo(
    () => ({ ancho: Math.round(width), alto: Math.max(0, Math.round(height) - ALTO_DE_LOS_CONTROLES) }),
    [width, height],
  );

  // Un fallo de cableado se pinta como fallo de cableado y con su motivo: una lámina
  // en blanco no distingue «no hay Skia» de «no hay proxy configurado», y las dos se
  // arreglan en sitios distintos.
  if (montaje.fallo !== null) {
    return (
      <View style={estilos.aviso} testID="mapa-sin-cablear">
        <Text style={estilos.texto}>{montaje.fallo}</Text>
      </View>
    );
  }

  return (
    <PantallaMapa
      levantamiento={montaje.levantamiento}
      enlace={montaje.enlace}
      cronometro={montaje.cronometro}
      tamano={tamano}
      punto={punto}
      semilla={semilla}
      tramoM={tramoM}
    />
  );
}

const estilos = StyleSheet.create({
  aviso: { flex: 1, padding: 24 },
  texto: { fontSize: 14, lineHeight: 20 },
});
