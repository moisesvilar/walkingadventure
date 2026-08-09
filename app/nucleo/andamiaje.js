// El único uso que la app hace hoy del paquete compartido: sortear el título de
// mundo de una semilla literal. Es lo que demuestra RF-INFRA-001 dentro del móvil
// —mismo paquete, misma semilla, mismo resultado que en Node— sin necesitar datos
// de OSM, que no llegan hasta la fila 26.

import { localeFor, namesFor } from '@walkingadventure/nucleo/names/index.js';
import { makeRng } from '@walkingadventure/nucleo/core/rng.js';
import { SUFIJOS_DE_FASE } from '@walkingadventure/nucleo/core/semilla.js';

/** La semilla de andamiaje, literal: la misma con la que el resto del repositorio compara mundos. */
export const SEMILLA_DE_ANDAMIAJE = '42.40,-8.81#1';

/**
 * La coordenada sale de la propia semilla y no de dos constantes al lado, que
 * serían una segunda fuente de verdad esperando a divergir de la primera.
 */
function coordenadaDe(semilla) {
  const [lat, lon] = semilla.split('#')[0].split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`la semilla de andamiaje "${semilla}" no lleva una coordenada legible`);
  }
  return { lat, lon };
}

/** El idioma que decide `localeFor` con esa coordenada. No es un literal de pantalla. */
export function idiomaDeAndamiaje(semilla = SEMILLA_DE_ANDAMIAJE) {
  const { lat, lon } = coordenadaDe(semilla);
  return localeFor(lat, lon);
}

/**
 * El título de mundo, sorteado igual que lo sortea la tubería: mismo paquete de
 * idioma, mismo sufijo de fase, misma semilla. Que coincida con el de Node es el
 * criterio, así que aquí no se copia nada del generador — se le llama.
 */
export function tituloDeAndamiaje(semilla = SEMILLA_DE_ANDAMIAJE) {
  const nombres = namesFor(idiomaDeAndamiaje(semilla));
  return nombres.worldTitle(makeRng(semilla + SUFIJOS_DE_FASE.titulo));
}
