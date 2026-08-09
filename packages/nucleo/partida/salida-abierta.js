// El registro de la salida abierta: si hay una salida en marcha, cuál, en qué mapa, con
// qué aventura y dónde se quedó.
//
// **Hoy nadie lo posee**: `cierraSalida` de SPEC-019 recibe la identidad de la salida como
// parámetro y no la crea, y la tarjeta de a medias de la portada no se puede componer sin
// saber si hay una abierta. Lo entrega esta fila por ser la primera que lo necesita, y lo
// consumen las filas 29, 30 y 36.
//
// Guarda lo mínimo, y las dos ausencias son requisito y no descuido: **ninguna coordenada
// y ninguna marca de tiempo** (RF-PRIV-002). El sitio donde se quedó se dice con el nombre
// del mundo —«camino del Torreón»—, que es lo único que la tarjeta necesita enseñar; y sin
// marca de tiempo, una salida abierta desde hace días se lee exactamente igual que la de
// hace un rato, que es lo que pide `bucle-jugable.md` §4.
//
// Una salida y una aventura: el registro no admite dos abiertas ni dos aventuras en la
// misma salida, y las dos cosas fallan nombrando la que ya estaba en lugar de pisarla.

import { congelaHondo } from '../core/congelar.js';

/**
 * Las dos maneras de cerrar una salida, y **las dos disparan lo mismo**.
 *
 * `bucle-jugable.md` §8: cerrar a mano «no es una salida de emergencia sino la misma puerta
 * en otro sitio». La vía se guarda porque el diario querrá contarla, no porque cambie el
 * cierre: los dos caminos pasan por `cierraLaSalida` y los dos producen cierre en corto.
 */
export const VIAS_DE_CIERRE = Object.freeze({
  VOLVER: 'volver',
  DEJARLO_AQUI: 'dejarlo-aqui',
});

/** Las vías declaradas, en orden estable. */
export const IDS_DE_VIA = congelaHondo(Object.values(VIAS_DE_CIERRE).slice().sort());

/** El registro de una partida recién empezada: ninguna salida abierta. */
export function estadoDeSalidaAbierta() {
  return { abierta: null };
}

function exigeRegistro(estado) {
  if (!estado || typeof estado !== 'object' || !('abierta' in estado)) {
    throw new Error('el registro de la salida abierta llega mal formado: se espera lo que devuelve estadoDeSalidaAbierta()');
  }
  return estado;
}

function exigeTexto(valor, quien) {
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${quien} se declara con su identificador y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  return valor;
}

/** La salida abierta, congelada, o `null`. `null` es una respuesta y no un error. */
export function salidaAbierta(estado) {
  const abierta = exigeRegistro(estado).abierta;
  return abierta ? congelaHondo({ ...abierta }) : null;
}

/** Si hay una salida abierta. Es la condición entera de la tarjeta de a medias. */
export function haySalidaAbierta(estado) {
  return salidaAbierta(estado) !== null;
}

/**
 * Abre una salida. Con una ya abierta **falla nombrándola**: dos salidas a la vez harían
 * que «lo dejaste a medias» tuviera que elegir cuál, y no hay ninguna manera de elegir bien.
 */
export function abreSalida(estado, { salida, mapaId, aventura = null }) {
  const registro = exigeRegistro(estado);
  exigeTexto(salida, 'la salida que se abre');
  exigeTexto(mapaId, 'el mapa de la salida que se abre');
  if (registro.abierta) {
    throw new Error(
      `no se puede abrir la salida "${salida}" con la salida "${registro.abierta.salida}" todavía abierta: ` +
      'hay una salida y una aventura, y la anterior se cierra por volver o a mano antes de abrir otra',
    );
  }
  registro.abierta = {
    salida,
    mapa: mapaId,
    aventura: aventura == null ? null : exigeTexto(aventura, 'la aventura aceptada'),
    sitio: null,
  };
  return salidaAbierta(registro);
}

/**
 * Acepta una aventura en la salida abierta. Con una ya aceptada falla nombrándola: «hay una
 * salida y una aventura» es la regla, y aceptar la segunda en silencio perdería la primera.
 */
export function aceptaAventuraEnLaSalida(estado, { aventura }) {
  const registro = exigeRegistro(estado);
  exigeTexto(aventura, 'la aventura que se acepta');
  if (!registro.abierta) {
    throw new Error(`no hay ninguna salida abierta en la que aceptar la aventura "${aventura}": la salida se abre antes de aceptar nada`);
  }
  if (registro.abierta.aventura) {
    throw new Error(
      `la salida "${registro.abierta.salida}" ya tiene aceptada la aventura "${registro.abierta.aventura}" y no admite "${aventura}": ` +
      'hay una salida y una aventura',
    );
  }
  registro.abierta.aventura = aventura;
  return salidaAbierta(registro);
}

/**
 * Anota dónde se quedó, **con el nombre del mundo**. Es lo único que la tarjeta de a medias
 * cuenta, y por eso es texto de sitio y jamás una coordenada.
 */
export function anotaDondeSeQuedo(estado, { sitio }) {
  const registro = exigeRegistro(estado);
  exigeTexto(sitio, 'el sitio donde se quedó la salida');
  if (!registro.abierta) {
    throw new Error(`no hay ninguna salida abierta donde anotar que se quedó en "${sitio}"`);
  }
  registro.abierta.sitio = sitio;
  return salidaAbierta(registro);
}

/**
 * Cierra la salida abierta, por la vía que sea, y devuelve lo que hacía falta para echar el
 * telón: la identidad de la salida, su mapa, su aventura si la había y dónde se quedó.
 *
 * **El cierre en corto va declarado y no depende de la vía.** Es la mitad que impide que
 * «dejarlo aquí» sea una vía de emergencia distinta: quien echa el telón (fila 36) recibe
 * lo mismo llegando a casa que desde la tarjeta.
 */
export function cierraLaSalida(estado, { via }) {
  const registro = exigeRegistro(estado);
  if (!IDS_DE_VIA.includes(via)) {
    throw new Error(`la vía de cierre "${via}" no está declarada: las que hay son ${IDS_DE_VIA.join(', ')}`);
  }
  if (!registro.abierta) {
    throw new Error('no hay ninguna salida abierta que cerrar: cerrarla dos veces echaría el telón dos veces sobre la misma salida');
  }
  const cerrada = registro.abierta;
  registro.abierta = null;
  return congelaHondo({
    salida: cerrada.salida,
    mapa: cerrada.mapa,
    aventura: cerrada.aventura,
    sitio: cerrada.sitio,
    via,
    cierreEnCorto: true,
  });
}

/** El registro en documento. Sin salida abierta escribe `null`, que es su estado normal. */
export function congelaSalidaAbierta(estado) {
  const abierta = exigeRegistro(estado).abierta;
  if (!abierta) return { abierta: null };
  return {
    abierta: {
      salida: abierta.salida,
      mapa: abierta.mapa,
      aventura: abierta.aventura ?? null,
      sitio: abierta.sitio ?? null,
    },
  };
}

/** El registro de vuelta de su documento. */
export function levantaSalidaAbierta(doc) {
  const abierta = doc?.abierta ?? null;
  if (!abierta) return estadoDeSalidaAbierta();
  return {
    abierta: {
      salida: exigeTexto(abierta.salida, 'la salida abierta guardada'),
      mapa: exigeTexto(abierta.mapa, 'el mapa de la salida abierta guardada'),
      aventura: abierta.aventura ?? null,
      sitio: abierta.sitio ?? null,
    },
  };
}
