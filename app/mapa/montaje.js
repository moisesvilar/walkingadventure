// El levantamiento y el traedor de topónimos, montados **con la partida ya abierta**.
//
// Hasta SPEC-050 el levantamiento solo se montaba en dos sitios, y los dos son del
// arranque o de la puerta de desarrollo: `arranque-montado.jsx` y `mapa-montado.jsx`. La
// raíz no tenía ninguno, y por eso no podía ni resolver en qué mapa estás ni ofrecer
// levantar uno donde no llega ninguno — que es la mitad de SPEC-041 que nunca llegó a la
// app.
//
// **No unifica los otros dos montajes a propósito.** Cada uno arma su cadena con lo que
// su momento necesita —el del arranque lleva su cronómetro de fases y su medidor de
// lámina— y refundirlos aquí sería tocar el camino por el que nace una partida para
// arreglar otra cosa. Lo que sí comparten es esta cadena de datos, y si algún día divergen
// será visible: son las mismas cuatro líneas.

import { atestacionDeLaApp } from '../datos/atestacion.js';
import { creaClienteDeProxy } from '../datos/cliente-proxy.js';
import { puertaDeRed } from '../datos/red.js';
import { creaTraedorDeOsm } from '../datos/traedor.js';
import { creaTraedorDeToponimos } from '../datos/toponimo.js';
import { evidenciaDelSistema, mecanismoDeAtestacion } from '../plataforma/atestacion.js';
import { mensajeDeError } from '../plataforma/capacidades.js';
import { colocadorDeRotulos } from '@walkingadventure/nucleo/render/colocador.js';
import { NUCLEO_DEL_LEVANTAMIENTO } from '../nucleo/piezas.js';
import { creaEnlaceReal } from '../render/enlace-real.js';
import { creaMedidorSkia } from '../render/medidor-skia.js';
import { creaLevantamiento } from './levantamiento.js';
import { creaCronometro } from './cronometro.js';

/**
 * Monta lo que la raíz necesita para saber dónde estás y para levantar un mapa desde ahí.
 *
 * @param {object} piezas `almacen` el duradero de la partida; `base` la dirección del
 *   proxy. La costura que se puede recorrer sin dispositivo **no es ésta**: es
 *   `resuelveDondeEstas`, que recibe el levantamiento y el traedor ya montados y por eso
 *   se dobla entero en `node --test`. Aquí se decide qué se monta, y eso incluye Skia.
 * @returns `{ levantamiento, toponimos, enlace, fallo }`. Si algo no se puede cablear, `fallo`
 *   trae su motivo literal y las otras dos son nulas: **no se devuelve un levantamiento a
 *   medias**, porque una app que ofrece levantar un mapa y no puede es peor que una que
 *   dice por qué (§6h).
 */
export function montaElMapaDeLaPartida({ almacen, base, ahora = () => Date.now() } = {}) {
  try {
    if (!almacen) throw new Error('el mapa de la partida se monta sobre el almacén duradero, y no lo adivina');
    if (typeof base !== 'string' || !base) {
      throw new Error('el mapa de la partida necesita la dirección del proxy: sin ella no hay con qué levantar nada');
    }
    const pide = puertaDeRed();
    const atestacion = atestacionDeLaApp({
      pide,
      base,
      plataforma: mecanismoDeAtestacion(),
      evidencia: evidenciaDelSistema(),
    });
    const cliente = creaClienteDeProxy({ pide, base, ficha: () => atestacion.ficha() });
    const enlace = creaEnlaceReal();
    return {
      enlace,
      levantamiento: creaLevantamiento({
        consultaOsm: creaTraedorDeOsm({ cliente }),
        almacen,
        cronometro: creaCronometro({ ahora }),
        colocador: colocadorDeRotulos,
        medidor: creaMedidorSkia(enlace.fuente),
        nucleo: NUCLEO_DEL_LEVANTAMIENTO,
      }),
      // Por el mismo cliente y la misma ficha que el levantamiento, que es lo que sostiene
      // que preguntar cómo se llama esto no manda nada nuevo fuera del móvil.
      toponimos: creaTraedorDeToponimos({ cliente }),
      fallo: null,
    };
  } catch (e) {
    return { levantamiento: null, toponimos: null, enlace: null, fallo: mensajeDeError(e) };
  }
}
