// El colocador de rótulos del render: traduce lo que la escena sabe —cada rótulo con
// su medida, su glifo y lo que el pintado le añade alrededor— a la colocación pura de
// `core/rotulos.js`, y devuelve las cajas ya colocadas más los retirados con su motivo.
//
// Sustituye al provisional `colocador-simple.js`, que se queda como referencia contra
// la que medir la deuda que esta fila cierra. Aquí no hay ni geometría de solape ni
// política de sacrificio: las dos viven en el núcleo, y esto solo cambia de sistema de
// coordenadas —del centro de la caja al punto donde el dibujo escribe el texto—.

import { colocarRotulos } from '../core/rotulos.js';

/** Lo que este colocador promete, como dato y no como comentario. */
export const COLOCADOR = Object.freeze({
  id: 'declutter',
  provisional: false,
  puedeSolapar: false,
  motivo: 'ninguna pareja de cajas se solapa; lo que no cabe se retira por orden inverso de prioridad',
});

/**
 * El medidor que la colocación exige. El render mide **antes** de colocar —es él quien
 * tiene la tipografía cargada—, así que todos los candidatos llegan con su medida y
 * esto no debería llamarse nunca. Si se llama, se dice en voz alta en lugar de estimar.
 */
function medidorYaMedido(texto) {
  throw new Error(`colocador: el rótulo "${texto}" llegó sin medida y aquí no se estima ninguna; mide antes de colocar`);
}

/**
 * Coloca los rótulos de una escena.
 *
 * @param {Array} rotulos los que compone la escena, con rol, texto, anclaje y medida.
 * @param {object} contexto `estilo` con las métricas de caja, `marco` del área
 *   pintada, `glifos` y `reservadas` como obstáculos ya calculados, y `extras` con lo
 *   que solo la escena sabe de cada rótulo: su glifo, su rango, su trazado y el
 *   desfase entre el centro de la caja pintada y el punto donde se escribe el texto.
 * @returns {{ colocados: object[], retirados: object[], coste: object }}
 */
export function colocadorDeRotulos(rotulos, contexto) {
  const { estilo, marco, tamano, extras = {}, glifos = [], reservadas = [] } = contexto ?? {};
  if (!estilo || !marco) throw new Error('colocadorDeRotulos: el contexto tiene que traer el estilo y el marco del área pintada');
  const tracking = Number.isFinite(estilo.label?.tracking) ? estilo.label.tracking : 0;

  const candidatos = rotulos.map((r) => {
    const extra = extras[r.id] ?? {};
    const letras = [...r.texto].length;
    return {
      id: r.id,
      rol: r.rol,
      texto: r.texto,
      // El anclaje del reparto es el glifo, no el sitio donde hoy cae el texto: las
      // ocho posiciones se miden desde el bulto que dibuja el elemento.
      ancla: extra.ancla ?? r.ancla,
      glifo: extra.glifo ?? null,
      radio: extra.radio ?? 0,
      rango: extra.rango ?? null,
      encargado: extra.encargado === true,
      trazado: extra.trazado ?? null,
      margen: extra.margen ?? { x: 0, y: 0 },
      giro: r.rotacion ?? 0,
      // La escala ya midió con el tracking dentro; la colocación lo vuelve a sumar
      // porque es su regla, así que se descuenta aquí para no contarlo dos veces.
      medida: { ancho: r.medida.ancho - (letras > 1 ? tracking * (letras - 1) : 0), alto: r.medida.alto },
      datos: { desfase: extra.desfase ?? 0 },
    };
  });

  const { colocados, retirados, coste } = colocarRotulos({
    candidatos,
    encuadre: { lienzo: tamano, marco },
    estilo,
    medidor: medidorYaMedido,
    glifos,
    reservadas,
  });

  return {
    colocados: colocados.map((c) => {
      // Del centro de la caja al punto donde el dibujo escribe: el texto va a
      // `desfase` del centro sobre el eje propio de la caja, girado con ella.
      const desfase = c.datos?.desfase ?? 0;
      return Object.freeze({
        id: c.id,
        x: c.caja.cx + Math.sin(c.giro) * desfase,
        y: c.caja.cy - Math.cos(c.giro) * desfase,
        rotacion: c.giro,
        posicion: c.posicion,
        cajaColocada: c.caja,
        tirador: c.tirador,
        alejado: c.alejado,
      });
    }),
    retirados,
    coste,
  };
}
