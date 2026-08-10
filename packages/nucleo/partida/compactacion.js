// La compactación: sellar un estado y empezar el registro desde el sello.
//
// SPEC-016 fijó el presupuesto de tamaño —500 bytes por entrada de diario, 300 por
// hecho, 6 MB de registro y 2 MB de estado en una partida de mil días— y declaró qué
// palanca se toca si no se cumple: **compactar por instantánea, nunca podar hechos
// sueltos**. Podar rompe en silencio la propiedad que da sentido a la capa entera —que
// el registro basta para reconstruir—; compactar la conserva desde el sello. Aquí no
// hay ninguna función de podar, y es a propósito.
//
// La otra mitad del módulo es de escritura y es donde está la dificultad real:
// compactar cambia **dos claves a la vez** y el almacén solo promete la atomicidad de
// una. El orden de abajo está elegido para que cada punto en el que se puede morir deje
// una partida entera, y `recuperaCompactacion` —que corre al abrir— la remate o la
// deshaga sin ambigüedad.

import { congelaHondo } from '../core/congelar.js';
import { congelaEstado } from './estado.js';
import { texto as textoCanonico } from './formato.js';
import { congelaRegistro, cuantosHechos, registroInicial } from './hechos.js';
import { exigeAlmacen } from './mapa.js';
import { CLAVES_DE_COMPACTACION, CLAVES_DE_PARTIDA } from './reconstruccion.js';

/** El presupuesto de SPEC-016 para el registro de hechos de una partida de mil días. */
export const PRESUPUESTO_DE_REGISTRO_BYTES = 6 * 1024 * 1024;

/** El presupuesto de SPEC-016 para el estado. Aquí solo se mide: la palanca es el registro. */
export const PRESUPUESTO_DE_ESTADO_BYTES = 2 * 1024 * 1024;

/** Cuánto ocupan el estado y el registro en su forma canónica, y si pasan del presupuesto. */
export function medidaDeLaPartida({ estado, registro }) {
  const bytesDeEstado = textoCanonico(congelaEstado(estado)).length;
  const bytesDeRegistro = textoCanonico(congelaRegistro(registro)).length;
  return congelaHondo({
    estado: bytesDeEstado,
    registro: bytesDeRegistro,
    hechos: cuantosHechos(registro),
    pasaElPresupuesto: bytesDeRegistro > PRESUPUESTO_DE_REGISTRO_BYTES || bytesDeEstado > PRESUPUESTO_DE_ESTADO_BYTES,
    presupuesto: { estado: PRESUPUESTO_DE_ESTADO_BYTES, registro: PRESUPUESTO_DE_REGISTRO_BYTES },
  });
}

/**
 * Sella un estado y devuelve el registro que empieza desde él.
 *
 * **Solo se puede sellar un estado que ya tiene todo el registro aplicado.** Sellar uno
 * que va por detrás perdería los hechos que le faltan sin que nada protestara, que es
 * exactamente lo que «nunca se poda un hecho suelto» prohíbe: o están todos desde el
 * sello, o está el sello.
 */
export function sella({ estado, registro }) {
  const total = cuantosHechos(registro);
  const aplicado = Number.isInteger(estado?.aplicadoHasta) ? estado.aplicadoHasta : -1;
  if (aplicado !== total - 1) {
    throw new Error(
      `no se puede sellar: el estado está aplicado hasta el hecho ${aplicado} y el registro tiene ${total}. ` +
      'Sellar un estado que va por detrás del registro perdería los hechos que le faltan, y compactar nunca poda hechos',
    );
  }
  const nuevo = registroInicial();
  // Las reglas con las que nació el registro se conservan: son lo que permite avisar de
  // que una reconstrucción puede diferir, y perderlas al compactar dejaría el aviso sin
  // con qué compararse.
  nuevo.reglas = registro?.reglas ?? nuevo.reglas;
  return congelaHondo({
    estado: { ...estado, aplicadoHasta: -1 },
    registro: nuevo,
    sellados: total,
  });
}

/**
 * Compacta la partida en el almacén.
 *
 * El orden, que es todo el diseño:
 *
 *   1 · se guarda el **sello** aparte y el **registro anterior** aparte. Hasta aquí las
 *       dos claves de la partida siguen intactas: morir en este punto deja la partida
 *       anterior entera y sin ningún sello a medias, y al abrir se deshace.
 *   2 · se escribe el registro nuevo, vacío desde el sello.
 *   3 · se escribe el estado sellado. Este es el punto de compromiso: a partir de aquí
 *       la compactación ha ocurrido, y al abrir se remata en vez de deshacerse — lo que
 *       lo distingue del punto anterior es que el estado que hay es **idéntico** al
 *       sello guardado.
 *   4 · se retiran las dos claves de trabajo.
 *
 * Morir entre 2 y 3 deja el estado anterior con un registro vacío delante, que es la
 * única combinación que no abre; por eso la recuperación restaura el registro anterior,
 * que sigue guardado entero.
 */
export async function compacta({ estado, registro, almacen } = {}) {
  exigeAlmacen(almacen, 'compacta');
  const sellado = sella({ estado, registro });
  const textoDelSello = textoCanonico(congelaEstado(sellado.estado));
  const textoDelRegistroAnterior = textoCanonico(congelaRegistro(registro));
  const textoDelRegistroNuevo = textoCanonico(congelaRegistro(sellado.registro));

  await almacen.escribe(CLAVES_DE_COMPACTACION.sello, textoDelSello);
  await almacen.escribe(CLAVES_DE_COMPACTACION.registroAnterior, textoDelRegistroAnterior);
  await almacen.escribe(CLAVES_DE_PARTIDA.registro, textoDelRegistroNuevo);
  await almacen.escribe(CLAVES_DE_PARTIDA.estado, textoDelSello);
  await almacen.borra(CLAVES_DE_COMPACTACION.registroAnterior);
  await almacen.borra(CLAVES_DE_COMPACTACION.sello);

  return congelaHondo({
    estado: sellado.estado,
    registro: sellado.registro,
    sellados: sellado.sellados,
    bytes: { sello: textoDelSello.length, registroAnterior: textoDelRegistroAnterior.length, registro: textoDelRegistroNuevo.length },
  });
}

export { CLAVES_DE_COMPACTACION };
