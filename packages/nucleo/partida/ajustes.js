// Los ajustes de la partida y **el valor con el que llegan de origen**.
//
// Aquí solo viven los dos que `game-design/seguridad-privacidad.md` §4 declara y que
// el arranque deja puestos sin preguntar nada: el horario diurno, encendido, y los
// pasos del día a día, apagados. La pantalla que los enseña es de otra fila; que su
// valor de origen viva en el estado y no en esa pantalla es lo que permite afirmarlo
// sin abrirla, y lo que impide que el día que se dibuje llegue con otro por descuido.
//
// «Sin preguntar nada» es la mitad de la decisión: enseñarlos en el arranque sería
// preguntar por la puerta de atrás.

import { congelaHondo } from '../core/congelar.js';
import { FRANJA_DIURNA } from '../quests/aventura.js';

/**
 * Los ajustes declarados y **su valor de origen**.
 *
 * `soloDeDia` encendido: no se ofrecen salidas de noche, y cualquiera puede quitarlo.
 * `pasosDelDiaADia` apagado: leer los pasos de la app de salud es opt-in explícito, y
 * el juego es completo sin activarlo (`quests.md` §8).
 */
export const AJUSTES_DE_ORIGEN = congelaHondo({
  soloDeDia: true,
  pasosDelDiaADia: false,
});

/** Los identificadores de ajuste, en orden declarado. Lista cerrada. */
export const IDS_DE_AJUSTE = congelaHondo(Object.keys(AJUSTES_DE_ORIGEN));

/** Los ajustes de una partida recién creada: exactamente los de origen. */
export function estadoDeAjustes() {
  return { ...AJUSTES_DE_ORIGEN };
}

/** Un identificador de ajuste declarado, o un error que enumera los que hay. */
export function exigeAjuste(id) {
  if (!IDS_DE_AJUSTE.includes(id)) {
    throw new Error(`ajuste desconocido ${JSON.stringify(id) ?? String(id)}: los declarados son ${IDS_DE_AJUSTE.join(', ')}`);
  }
  return id;
}

/** Cambia un ajuste. Los dos se pueden cambiar: de origen no significa fijo. */
export function cambiaAjuste(ajustes, id, valor) {
  exigeAjuste(id);
  if (typeof valor !== 'boolean') {
    throw new Error(`el ajuste "${id}" es un interruptor y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  ajustes[id] = valor;
  return ajustes;
}

/**
 * La franja que el casting recibe según el horario diurno.
 *
 * Devuelve la franja y no un booleano porque eso es lo que `casteaAventura` espera:
 * un booleano escondería la hora dentro del motor y el ajuste no podría moverla.
 * Apagado es `null`, que es «cabe cualquiera».
 */
export function franjaPermitidaDe(ajustes) {
  return ajustes?.soloDeDia === false ? null : FRANJA_DIURNA;
}

/** Los ajustes en forma serializable, en el orden declarado. */
export function congelaAjustes(ajustes) {
  const doc = {};
  for (const id of IDS_DE_AJUSTE) doc[id] = ajustes?.[id] ?? AJUSTES_DE_ORIGEN[id];
  return doc;
}

/**
 * Los ajustes de vuelta de su documento.
 *
 * Un ajuste que falta vuelve **en su valor de origen** y no en `false`: una partida
 * guardada antes de que existiera un ajuste tiene que abrirse con el valor que el
 * diseño declara, no con el que salga de leer un `undefined`.
 */
export function levantaAjustes(doc) {
  const ajustes = estadoDeAjustes();
  if (!doc) return ajustes;
  for (const id of IDS_DE_AJUSTE) {
    if (typeof doc[id] === 'boolean') ajustes[id] = doc[id];
  }
  return ajustes;
}
