// El lote de trabajo: la unidad de coste y el único freno que corta un bucle del
// cliente antes de que se coma el presupuesto del día.
//
// Vive **entero en memoria** y muere con su vigencia: el identificador de lote no
// aparece en ninguna entrada de la superficie de escritura, ni siquiera en la métrica,
// donde lo que suma es el coste en un cubo agregado. Se acepta a cambio que durante
// sus quince minutos de vida el proxy pueda relacionar las llamadas de un mismo lote,
// que es algo que el orden y el tiempo de las peticiones ya permitían y que no
// sobrevive a la petición.
//
// Un identificador de lote que no existe **no se registra como intento fallido**: se
// trata como un lote nuevo con su tope entero. Registrar el intento sería una fila por
// llamada con otro nombre.

import { TIPOS_DE_LOTE } from './config.mjs';

/** Este módulo no escribe nada. Va declarado para que la ausencia sea afirmable. */
export const ESCRITURAS = Object.freeze([]);

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {{ahora: () => number}} deps.reloj
 * @param {(cierre: {tipo: string, coste: number}) => Promise<any>} deps.alCerrar  qué
 *   hacer con el coste de un lote que termina. Lo cablea el proxy contra la métrica.
 */
export function creaLotes({ config, reloj, alCerrar }) {
  const vivos = new Map();

  const topeDe = (tipo) => (tipo === 'mapa' ? config.TOPE_PAGO_LOTE_MAPA : config.TOPE_PAGO_LOTE_SALIDA);

  /** Cierra los lotes cuya vigencia se agotó y suma su coste al histograma. */
  const barre = async (ahora) => {
    for (const [id, lote] of [...vivos]) {
      if (ahora - lote.desde >= config.VIGENCIA_LOTE) {
        vivos.delete(id);
        if (lote.pagos > 0) await alCerrar({ tipo: lote.tipo, coste: lote.coste });
      }
    }
  };

  return {
    ESCRITURAS,

    /**
     * Devuelve el lote en curso, creándolo si el identificador no existe o caducó.
     * Un lote se identifica por un valor efímero que sortea el cliente; el proxy no lo
     * guarda en ningún sitio persistente y no lo mira dos veces.
     */
    async usa({ id, tipo }) {
      if (!TIPOS_DE_LOTE.includes(tipo)) throw new Error(`tipo de lote no declarado: "${tipo}"`);
      const ahora = reloj.ahora();
      await barre(ahora);
      const clave = `${tipo}:${id}`;
      let lote = vivos.get(clave);
      if (!lote) {
        lote = { tipo, desde: ahora, pagos: 0, coste: 0 };
        vivos.set(clave, lote);
      }
      return {
        tipo,
        /** Si queda margen para una llamada de pago más en este lote. */
        cabeOtroPago: () => lote.pagos < topeDe(tipo),
        tope: topeDe(tipo),
        pagos: () => lote.pagos,
        anotaPago: (coste) => { lote.pagos += 1; lote.coste += coste; },
      };
    },

    /** Cierra a mano los lotes caducados. Sin temporizadores: se barre al atender. */
    async barreCaducados() { await barre(reloj.ahora()); },

    /** Cierra todos los lotes vivos. Es lo que hace un apagado ordenado. */
    async cierraTodos() {
      for (const [id, lote] of [...vivos]) {
        vivos.delete(id);
        if (lote.pagos > 0) await alCerrar({ tipo: lote.tipo, coste: lote.coste });
      }
    },

    /** Cuántos lotes hay vivos. Diagnóstico en memoria; no se escribe en ningún sitio. */
    vivos() { return vivos.size; },
  };
}
