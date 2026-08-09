// El contenedor de un fichero de partida: de la lista de partes que produce el núcleo
// a un fichero, y del fichero a la lista de partes.
//
// El contenedor es **texto y no un archivo comprimido**, y las dos cosas son criterio:
//
// - **No lleva ninguna fecha.** Ni de creación ni de modificación de sus entradas. Un
//   contenedor estándar las pone solo, y con ellas exportar dos veces la misma partida
//   dejaría de dar el mismo fichero — y además metería dentro un dato sobre la vida de
//   quien juega, en un fichero que se comparte por mensajería.
// - **No comprime.** Por lo mismo que SPEC-009 decidió no comprimir los documentos:
//   comprimir haría que «dos ficheros iguales byte a byte» dependiera de la versión del
//   compresor, que es una promesa que no se puede sostener entre dos móviles.
//
// La forma es una cabecera de líneas y los contenidos detrás, en el mismo orden. Los
// binarios llegan ya en base64 desde el núcleo, así que aquí no hay ninguna
// codificación que inventar y el fichero entero se lee como texto.

import { NOMBRE_DEL_MANIFIESTO } from '@walkingadventure/nucleo/partida/exportacion.js';

/** La primera línea de todo fichero de partida. Es lo que se mira para decir que no lo es. */
export const CABECERA = 'WALKINGADVENTURE-PARTIDA/1';

const SEPARADOR = '\n';

/**
 * Un error del contenedor con su **causa en vocabulario cerrado**.
 *
 * La causa viaja en el error y no se deduce leyendo el mensaje: la pantalla enseña tres
 * líneas y una de ellas depende de esto, y decidirlo con una expresión regular sobre un
 * texto en español es cómo se rompe una pantalla al corregir una tilde.
 */
export function falloDelContenedor(causa, mensaje) {
  const e = new Error(mensaje);
  e.causa = causa;
  return e;
}

/** Las causas que el contenedor sabe distinguir. Las demás son de más arriba. */
export const CAUSAS = Object.freeze({ NO_ES_PARTIDA: 'no-es-partida', INCOMPLETO: 'incompleto' });

function exigeNombreDeParte(nombre) {
  if (typeof nombre !== 'string' || !nombre || /[\t\n\r]/.test(nombre)) {
    throw new Error(`el contenedor no puede llevar la parte ${JSON.stringify(nombre)}: un nombre de parte no lleva tabuladores ni saltos de línea`);
  }
  return nombre;
}

/**
 * Empaqueta una lista de partes.
 *
 * El orden es el que llega, y llega canónico del núcleo. La longitud que va en la
 * cabecera es la del contenido tal cual viaja, que es lo que permite comprobar si el
 * fichero está entero sin decodificar nada.
 */
export function empaqueta(partes) {
  if (!Array.isArray(partes) || partes.length === 0) {
    throw new Error('un fichero de partida lleva al menos su manifiesto: la lista de partes ha llegado vacía');
  }
  if (partes[0].nombre !== NOMBRE_DEL_MANIFIESTO) {
    throw new Error(`la primera parte de un fichero de partida es "${NOMBRE_DEL_MANIFIESTO}" y ha llegado "${partes[0].nombre}"`);
  }
  const cabeceras = [CABECERA, String(partes.length)];
  for (const parte of partes) {
    exigeNombreDeParte(parte.nombre);
    cabeceras.push([parte.nombre, parte.clase, parte.codificacion, String(parte.contenido.length)].join('\t'));
  }
  return `${cabeceras.join(SEPARADOR)}${SEPARADOR}${SEPARADOR}${partes.map((p) => p.contenido).join('')}`;
}

/**
 * Desempaqueta un fichero.
 *
 * Tres fallos con nombre y ninguna interpretación optimista: **no es una partida** —la
 * cabecera no es la nuestra, y no se intenta leer nada más—, **está incompleto** —la
 * cuenta de partes o alguna longitud no cuadra con lo que hay— y **está roto**, que es
 * una cabecera que no se puede ni leer.
 */
export function desempaqueta(texto) {
  if (typeof texto !== 'string' || !texto.startsWith(CABECERA)) {
    throw falloDelContenedor(CAUSAS.NO_ES_PARTIDA, 'el fichero no es una partida de Walking Adventure');
  }
  const corte = texto.indexOf(`${SEPARADOR}${SEPARADOR}`);
  if (corte < 0) throw falloDelContenedor(CAUSAS.INCOMPLETO, 'el fichero está incompleto: la cabecera no termina');
  const lineas = texto.slice(0, corte).split(SEPARADOR);
  const cuantas = Number(lineas[1]);
  if (!Number.isInteger(cuantas) || cuantas < 1) {
    throw falloDelContenedor(CAUSAS.INCOMPLETO, `el fichero está roto: su cabecera dice tener ${JSON.stringify(lineas[1])} partes`);
  }
  if (lineas.length !== cuantas + 2) {
    throw falloDelContenedor(CAUSAS.INCOMPLETO, `el fichero está incompleto: su cabecera anuncia ${cuantas} partes y describe ${Math.max(0, lineas.length - 2)}`);
  }
  const cuerpo = texto.slice(corte + 2);
  const partes = [];
  let desde = 0;
  for (let i = 0; i < cuantas; i += 1) {
    const [nombre, clase, codificacion, longitud] = lineas[i + 2].split('\t');
    const n = Number(longitud);
    if (!Number.isInteger(n) || n < 0) {
      throw falloDelContenedor(CAUSAS.INCOMPLETO, `el fichero está roto: la parte "${nombre}" declara una longitud de ${JSON.stringify(longitud)}`);
    }
    if (desde + n > cuerpo.length) {
      throw falloDelContenedor(CAUSAS.INCOMPLETO, `el fichero está incompleto: la parte "${nombre}" declara ${n} y solo quedan ${cuerpo.length - desde}`);
    }
    partes.push({ nombre, clase, codificacion, contenido: cuerpo.slice(desde, desde + n) });
    desde += n;
  }
  if (desde !== cuerpo.length) {
    throw falloDelContenedor(CAUSAS.INCOMPLETO, `el fichero trae ${cuerpo.length - desde} caracteres que ninguna parte declara`);
  }
  return partes;
}

/** El manifiesto de una lista de partes desempaquetada, ya parseado. */
export function manifiestoDePartes(partes) {
  const parte = partes.find((p) => p.nombre === NOMBRE_DEL_MANIFIESTO);
  if (!parte) throw falloDelContenedor(CAUSAS.NO_ES_PARTIDA, 'el fichero no es una partida: no trae manifiesto');
  try {
    return JSON.parse(parte.contenido);
  } catch (e) {
    throw falloDelContenedor(CAUSAS.NO_ES_PARTIDA, `el fichero no es una partida: su manifiesto no se puede leer (${e.message})`);
  }
}
