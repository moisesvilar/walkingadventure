// El punto de montaje del momento «antes de salir»: junta el calendario, los clientes de las
// rutas de contenido del proxy, el conseguidor de recursos y la preparación, y se los entrega
// ya cableados a las cinco pantallas.
//
// Es el mismo reparto que `arranque-montado.jsx`: aquí se decide **qué** se monta, y quien
// quiera un montaje doblado —un proveedor que nunca responde, un calendario parado en el día
// veintitrés— construye el suyo y llama a `PantallaAntesDeSalir` directamente. Esa frontera es
// lo que permite recorrer las cinco pantallas en `node --test` sin ningún dispositivo.
//
// Y si algo no se puede cablear, **no se dibuja el momento**: se enseña la avería con su
// mensaje. Una portada que se monta con media tubería es indistinguible de una tarde sin
// cobertura, y son dos cosas distintas (§6h).

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PRESUPUESTO_FOTOS_MAPA_MS, PRESUPUESTO_PREPARACION_MS } from '@walkingadventure/nucleo/partida/recursos.js';

import { creaCalendario } from '../datos/calendario.js';
import { creaClienteDeLotes } from '../datos/cliente-de-lotes.js';
import { puertaDeRed } from '../datos/red.js';
import { mensajeDeError } from '../plataforma/capacidades.js';
import { creaAlmacenDeBinarios } from '../recursos/almacen-de-binarios.js';
import { creaConseguidorDeRecursos } from '../recursos/conseguidor.js';
import { creaPreparacion } from '../salida/preparacion.js';
import { PantallaAntesDeSalir } from './antes-de-salir.jsx';
import { DIRECCION_DEL_PROXY } from './mapa-montado.jsx';

/**
 * @param {object} props
 *   `partida` el estado de la partida; `personaje` quien juega; `mundo` el mapa levantado;
 *   `arrancadaEn` cuándo empezó la partida, que es de donde sale el día; `base` la dirección
 *   del proxy; `almacen` dónde viven los binarios de las ilustraciones; `llamada` el cliente
 *   del narrador, que hoy no tiene montaje propio y se declara ausente en lugar de suponerse.
 */
export function AntesDeSalirMontado({
  partida,
  personaje,
  mundo,
  arrancadaEn,
  base = DIRECCION_DEL_PROXY,
  almacen = null,
  llamada = null,
  zurron = {},
  alAndar = null,
  alAbrirPuerta = null,
  alEcharElTelon = null,
}) {
  const montaje = useMemo(() => {
    try {
      const pide = puertaDeRed();
      const conseguidor = creaConseguidorDeRecursos({
        clienteDeImagenes: creaClienteDeLotes({ pide, base, ruta: 'imagen' }),
        clienteDeFotos: creaClienteDeLotes({ pide, base, ruta: 'places' }),
        almacen: almacen ?? creaAlmacenDeBinarios(),
        presupuestoIlustracionesMs: PRESUPUESTO_PREPARACION_MS,
        presupuestoFotosMs: PRESUPUESTO_FOTOS_MAPA_MS,
      });
      return {
        calendario: creaCalendario({ arrancadaEn }),
        // Sin cliente de narrador montado todavía, y **declarado**: los textos salen de
        // plantilla porque alguien lo decidió, no porque se olvidara una pieza.
        preparacion: creaPreparacion({ conseguidor, llamada, sinNarrador: !llamada, locale: mundo?.locale ?? 'es' }),
        fallo: null,
      };
    } catch (e) {
      return { calendario: null, preparacion: null, fallo: mensajeDeError(e) };
    }
  }, [base, almacen, llamada, arrancadaEn, mundo]);

  if (montaje.fallo !== null) {
    return (
      <View style={estilos.aviso} testID="antes-de-salir-sin-cablear">
        <Text style={estilos.texto}>{montaje.fallo}</Text>
      </View>
    );
  }

  return (
    <PantallaAntesDeSalir
      calendario={montaje.calendario}
      personaje={personaje}
      mundo={mundo}
      estado={partida}
      preparacion={montaje.preparacion}
      zurron={zurron}
      alAndar={alAndar}
      alAbrirPuerta={alAbrirPuerta}
      alEcharElTelon={alEcharElTelon}
    />
  );
}

const estilos = StyleSheet.create({
  aviso: { flex: 1, padding: 24 },
  texto: { fontSize: 14, lineHeight: 20 },
});
