// La adopción condicionada de un nombre que propone el narrador.
//
// El suelo es el paquete de idioma: **todo nombre propio lo produce primero él**, y
// existe sin una sola llamada de red (`game-design/quests.md` decisión 1). Encima de
// ese suelo, el modelo puede **proponer**; el código adopta la propuesta solo si pasa
// las cuatro validaciones —unicidad contra el índice global del mundo, longitud,
// caracteres y aptitud— más una quinta que es de privacidad: **un nombre de fantasía
// idéntico al nombre real de un anclaje se descarta**, porque revelaría por la puerta
// de atrás lo que el prompt tiene prohibido llevar (`seguridad-privacidad.md` §1).
//
// En cualquier otro caso se conserva el nombre base, y eso no es un fallo: es el
// camino normal. Lo que sí se declara siempre es **de dónde salió el nombre**, para
// que «esto lo escribió el modelo» sea un dato y no una suposición.

import { congelaHondo } from '../core/congelar.js';
import { MOTIVOS_DE_APTITUD, motivoDeAptitud } from './aptitud-de-texto.js';

/**
 * El tope de longitud de un nombre propio.
 *
 * Sale del mismo sitio que los topes del catálogo: es lo que cabe en el rótulo del
 * mapa y en la cartela sin recortarse. Los nombres más largos que produce el paquete
 * de idioma andan por los treinta caracteres, así que cuarenta deja margen y no invita
 * a una frase disfrazada de nombre.
 */
export const TOPE_DE_NOMBRE = 40;

/**
 * A qué se aplica la capa **de origen**.
 *
 * `quests.md` decisión 1 lo dice literalmente: por defecto solo a lo que nace dentro
 * de una aventura, y extenderla a las entidades del mundo «cuesta una llamada extra al
 * crear el mundo y es decisión de presupuesto, no de diseño». Va como parámetro
 * apagado y no como una llamada que alguien pueda añadir sin darse cuenta.
 */
export const ALCANCE_DE_LA_CAPA = congelaHondo({
  aventura: true,
  mundo: false,
});

/** Los orígenes declarados de un nombre. El base es el del paquete de idioma. */
export const ORIGENES_DE_NOMBRE = congelaHondo(['idioma', 'llm']);

/**
 * Adopta —o no— un nombre propuesto por el narrador.
 *
 * @param opciones
 *   `propuesto` el nombre que llegó, o `null` si no llegó ninguno;
 *   `base` el que produjo el paquete de idioma, que es lo que se conserva si algo falla;
 *   `indice` el índice global de nombres del mundo (`crearIndiceDeNombres`);
 *   `filtro` el filtro de aptitud ya construido con sus listas y sus datos reales;
 *   `tope` el máximo de caracteres;
 *   `dentroDeAventura` si el elemento nace dentro de una aventura, que es el único
 *     alcance encendido de origen.
 *
 * @returns `{ nombre, origen, base, motivo }`. `motivo` es `null` cuando se adoptó, y
 *   una clave del catálogo cerrado de aptitud cuando no.
 */
export function adoptaNombrePropuesto({
  propuesto,
  base,
  indice,
  filtro,
  tope = TOPE_DE_NOMBRE,
  dentroDeAventura = true,
}) {
  if (typeof base !== 'string' || !base) {
    throw new Error(
      `la adopción de un nombre propuesto necesita el nombre base del paquete de idioma y llegó ${JSON.stringify(base) ?? String(base)}: ` +
      'el suelo determinista existe siempre, y sin él no habría a qué volver',
    );
  }
  if (!indice || typeof indice.reserva !== 'function' || typeof indice.tomado !== 'function') {
    throw new Error('la adopción de un nombre propuesto necesita el índice global de nombres del mundo: sin él la unicidad no se puede resolver');
  }
  if (!filtro || typeof filtro.valida !== 'function') {
    throw new Error('la adopción de un nombre propuesto necesita el filtro de aptitud: un nombre generado se valida como cualquier otro texto generado');
  }

  const conserva = (motivo) => congelaHondo({ nombre: base, origen: 'idioma', base, motivo });

  // El alcance, primero: fuera de una aventura la capa está apagada de origen y no se
  // mira siquiera lo que propuso el modelo.
  if (!dentroDeAventura && !ALCANCE_DE_LA_CAPA.mundo) return conserva(null);
  if (propuesto == null) return conserva(null);

  const nombre = typeof propuesto === 'string' ? propuesto.trim() : propuesto;
  const veredicto = filtro.valida(nombre, { tope, esNombre: true });
  if (!veredicto.apto) return conserva(veredicto.motivo);

  // La unicidad va **la última** de las validaciones, y es deliberado: reservar es lo
  // único que deja huella en el índice, así que no se reserva nada hasta que todo lo
  // demás ha pasado. Al revés, un nombre rechazado por aptitud habría quedado tomado
  // sin que nadie lo llevara puesto.
  const choque = () => conserva(motivoDeAptitud({
    clave: MOTIVOS_DE_APTITUD.NOMBRE_QUE_CHOCA,
    fragmento: nombre,
    detalle: { indice: 'el índice global de nombres del mundo ya lo tenía' },
  }));
  if (indice.tomado(nombre)) return choque();
  if (!indice.reserva(nombre)) return choque();

  return congelaHondo({ nombre, origen: 'llm', base, motivo: null });
}
