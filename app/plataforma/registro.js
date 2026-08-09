// El registro de capacidades: se construye con los módulos INYECTADOS, igual que
// el núcleo recibe su `fetchData`. Es lo que permite montar un registro con un
// módulo doblado —o sin ninguno— sin tocar el código de la app, y con ello que
// «la app funciona aunque falte» se pueda poner rojo en lugar de afirmarse.

import { CAPACIDADES, CAPAS, mensajeDeError, normalizaRespuesta } from './capacidades.js';

/**
 * La capa de pantalla que no cuelga de ningún módulo de plataforma: la propia
 * pantalla de la app. Existe declarada porque `accesibilidad.md` §3 exige que
 * ninguna capa sea portadora única, y sin ella un dispositivo sin háptico y sin
 * notificaciones se quedaría sin ninguna forma de avisar.
 */
export const CAPA_PROPIA = { capa: 'pantalla', portador: 'la propia pantalla de la app', siempre: true };

function valida(modulo) {
  if (!modulo || typeof modulo !== 'object') throw new Error('un módulo de capacidad tiene que ser un objeto');
  if (!CAPACIDADES.includes(modulo.nombre)) {
    throw new Error(`capacidad desconocida "${modulo.nombre}": las declaradas son ${CAPACIDADES.join(', ')}`);
  }
  if (!CAPAS.includes(modulo.capa)) {
    throw new Error(`el módulo "${modulo.nombre}" declara la capa "${modulo.capa}", que no es ${CAPAS.join(', ')}`);
  }
  if (typeof modulo.sonda !== 'function') {
    throw new Error(`el módulo "${modulo.nombre}" no expone una sonda de disponibilidad`);
  }
}

/**
 * Crea el registro.
 *
 * @param {Array} modulos      los módulos de capacidad, inyectados. Sin ninguno el
 *   registro es legítimo y responde que no hay nada montado, que es distinto de
 *   una lista vacía sin explicación.
 * @param {string[]} ausentes  capacidades que se fuerzan a ausentes (el gancho de
 *   andamiaje). Se aplica antes de sondear: una capacidad forzada no se sondea.
 */
export function creaRegistro(modulos = [], { ausentes = [] } = {}) {
  const porNombre = new Map();
  for (const modulo of modulos) {
    valida(modulo);
    if (porNombre.has(modulo.nombre)) throw new Error(`la capacidad "${modulo.nombre}" se ha montado dos veces`);
    porNombre.set(modulo.nombre, modulo);
  }
  const forzadas = new Set(ausentes);

  let sondeado = null;

  return {
    /** Cuántas capacidades tienen módulo. Cero es un estado válido y con frase propia. */
    montadas: () => porNombre.size,

    /**
     * Sondea una sola vez, al abrir. No se re-sondea solo: volver a mirar es una
     * decisión de la fila que use cada capacidad, y aquí solo serviría para que la
     * pantalla cambiara sola mientras alguien la lee.
     */
    async sondea() {
      const out = [];
      for (const nombre of CAPACIDADES) {
        const modulo = porNombre.get(nombre);
        if (!modulo) {
          out.push({ nombre, capa: 'ninguna', montado: false, disponible: false, motivo: 'ningún módulo la monta en esta compilación' });
          continue;
        }
        if (forzadas.has(nombre)) {
          out.push({ nombre, capa: modulo.capa, montado: false, disponible: false, motivo: 'ausente por el gancho de andamiaje' });
          continue;
        }
        try {
          out.push(normalizaRespuesta(nombre, modulo.capa, await modulo.sonda()));
        } catch (e) {
          // Una sonda que lanza deja su capacidad no disponible con el motivo, y
          // la app arranca igual: la ausencia se declara, nunca tumba nada.
          out.push({ nombre, capa: modulo.capa, montado: true, disponible: false, motivo: `la sonda falló: ${mensajeDeError(e)}` });
        }
      }
      sondeado = out;
      return out.slice();
    },

    /** Las cinco capacidades en orden estable. Antes de sondear, la lista está vacía. */
    estado: () => (sondeado ? sondeado.slice() : []),

    /**
     * Lo que devuelve pedir una capacidad. Nunca lanza: quien pide una capacidad
     * que no está tiene que poder seguir, que es la mitad de RF-INFRA-006.
     */
    capacidad(nombre) {
      const fila = (sondeado ?? []).find((c) => c.nombre === nombre);
      if (!fila) return { hay: false, modulo: null, motivo: `la capacidad "${nombre}" no está en el registro` };
      if (!fila.disponible) return { hay: false, modulo: null, motivo: fila.motivo };
      return { hay: true, modulo: porNombre.get(nombre), motivo: null };
    },

    /**
     * Qué capas quedan para avisar. Siempre incluye la propia pantalla de la app,
     * que no es un módulo y por tanto no puede faltar: es lo que hace que sin
     * háptico y sin notificaciones siga habiendo una capa de pantalla declarada.
     */
    capasDeAviso() {
      const out = [CAPA_PROPIA];
      for (const fila of sondeado ?? []) {
        if (!fila.disponible) continue;
        if (fila.capa === 'ninguna') continue;
        out.push({ capa: fila.capa, portador: fila.nombre, siempre: false });
      }
      return out;
    },
  };
}
