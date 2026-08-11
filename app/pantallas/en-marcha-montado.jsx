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
// Desde SPEC-048 el seguidor **sí llega montado**: cuelga de la única suscripción al sensor
// de la salida abierta, que es la misma que sostiene el rótulo del sistema. Sigue entrando
// por la firma, así que quien monte el momento sin ella recibe el sin montar y ve la avería
// en vez de un mapa con la marca quieta.
//
// Y la avería del momento tiene **vocabulario cerrado** (`MOTIVOS_SIN_UBICACION`): el
// permiso denegado, el permiso que no se pudo preguntar, el sensor que no responde y el
// rótulo sin montar llevan a sitios distintos, y un motivo en prosa los haría iguales.

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
import { MARCA_SUPERPUESTA } from './marca.js';

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

/**
 * Los cuatro motivos por los que el momento en marcha no tiene ubicación. **Cerrado**, y
 * los cuatro se arreglan en sitios distintos: el primero en los ajustes del sistema, el
 * segundo es avería nuestra, el tercero se pasa esperando y el cuarto es una compilación
 * sin rótulo, en la que una salida ni siquiera se abre.
 */
export const MOTIVOS_SIN_UBICACION = Object.freeze([
  'permiso-denegado',
  'permiso-no-preguntable',
  'sensor-sin-responder',
  'rotulo-sin-montar',
]);

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
  motivoSinUbicacion = null,
  // Cuántas posiciones han llegado. **No se usa para nada más que recomponer**: el seguidor
  // es un objeto estable, así que sin un valor que cambie el momento se compondría una vez
  // y la marca se quedaría donde entró — indistinguible de andar en círculos.
  paso = 0,
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
  }, [seguidor, vibrador, salidas, mundo, trazado, guia, marcasDeAviso, noticia, desvio, caminoEvitado, paso]);

  const fallo = falloDeCableado ?? montaje.fallo;
  const sinUbicacion = MOTIVOS_SIN_UBICACION.includes(motivoSinUbicacion) ? motivoSinUbicacion : null;
  if (fallo !== null || sinUbicacion !== null) {
    return (
      <View style={estilos.aviso} testID="en-marcha-sin-cablear">
        {/* La avería del momento con su motivo del vocabulario cerrado, y de qué está el
            sensor. Van como marca porque lo que se lee sigue sin nombrar ningún código. */}
        <View testID="marcha-sin-ubicacion" accessibilityLabel={sinUbicacion ?? ''} style={estilos.marca} />
        <View testID="ubicacion-estado" accessibilityLabel="sin-montar" style={estilos.marca} />
        <Text style={estilos.texto}>{fallo ?? TEXTOS_SIN_UBICACION[sinUbicacion]}</Text>
      </View>
    );
  }

  return (
    <View style={estilos.pila}>
      {/* El sensor está montado y la marca se mueve con él. La marca de estado va aquí y
          no dentro de la pantalla porque es del montaje: dice qué se cableó, no qué se ve. */}
      <View testID="ubicacion-estado" accessibilityLabel={seguidor ? 'montado' : 'sin-montar'} style={estilos.marca} />
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
    </View>
  );
}

/**
 * Lo que se lee en cada avería. **Ninguno nombra la red, el permiso del sistema ni ningún
 * código**: son las palabras del juego, y el identificador viaja en la marca.
 */
const TEXTOS_SIN_UBICACION = Object.freeze({
  'permiso-denegado': 'No puedo saber por dónde andas: el permiso de ubicación está desactivado. Se enciende desde los ajustes del móvil.',
  'permiso-no-preguntable': 'No he podido pedirte el permiso de ubicación. No es cosa tuya: vuelve a intentarlo dentro de un rato.',
  'sensor-sin-responder': 'Todavía no sé por dónde andas. En cuanto el móvil me lo diga, la marca se pone en su sitio.',
  'rotulo-sin-montar': 'Esta versión no puede mantener la salida abierta con la pantalla apagada, así que no la abro.',
});

const estilos = StyleSheet.create({
  // La lámina sigue a sangre: la pila no recorta nada, solo lleva la marca de estado.
  pila: { flex: 1 },
  aviso: { flex: 1, padding: 24 },
  texto: { fontSize: 14, lineHeight: 20 },
  marca: MARCA_SUPERPUESTA,
});
