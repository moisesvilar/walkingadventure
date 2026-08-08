// Monta mapas, rejillas y celdas del paquete compartido sobre datos de OSM que
// no salen de la red: los cuatro mundos congelados de SPEC-001 y unos callejeros
// sintéticos colocados a propósito respecto del borde de la celda.
//
// Existe por lo mismo que `mundo-de-prueba.mjs`: la frontera de inyección de la
// rejilla es `consultaOsm({ celda, limites, margenM })`, y escribirla a mano en
// cada prueba la convertiría en quince fronteras distintas. Nada de aquí toca la
// red ni el reloj; el azar viene de la semilla y de la entropía inyectada.

import { creaSemilla } from '../../packages/nucleo/core/semilla.js';
import { proyectorDeRejilla } from '../../packages/nucleo/world/rejilla.js';
import { mundoCongelado } from '../dobles/mundo-congelado.mjs';

// Dos semillas de partida fijas, creadas con entropía inyectada y escrita aquí:
// es el único punto de azar del proyecto y una prueba tiene que poder fijarlo sin
// tocar el generador. Los quince valores son arbitrarios pero constantes.
export const ENTROPIA_A = [3, 7, 11, 19, 23, 29, 2, 5, 13, 17, 31, 1, 8, 14, 26];
export const ENTROPIA_B = [30, 1, 4, 9, 15, 22, 27, 6, 12, 18, 24, 0, 7, 13, 19];

export const SEMILLA_A = creaSemilla(ENTROPIA_A);
export const SEMILLA_B = creaSemilla(ENTROPIA_B);

/** La coordenada con la que se capturó un mundo congelado. */
export function coordenadaDe(nombre) {
  return mundoCongelado(nombre).manifiesto.coordenada;
}

/**
 * `consultaOsm` que sirve siempre el mismo mundo congelado, apunte donde apunte
 * la celda. Lleva colgado el registro de lo que se le pidió, que es lo que
 * permite afirmar «esto no se ha vuelto a generar».
 */
export function consultaDeFixture(nombre, opciones = {}) {
  const llamadas = [];
  const fn = async (peticion) => {
    llamadas.push(peticion);
    const datos = mundoCongelado(nombre, opciones);
    // El callejero se sirve **siempre**, por lo mismo que en `mundo-de-prueba.mjs`:
    // desde SPEC-007 la app lo pide y el grafo se cose con él. Sin servirlo, las
    // celdas y las rejillas de estas pruebas se generaban sobre un grafo solo de
    // carreteras —una configuración que ya no existe en producción— y lo que
    // afirmaban dejaba de decir nada del mundo real.
    return { geoJson: datos.geo, poiJson: datos.pois, callejeroJson: datos.callejero };
  };
  fn.llamadas = llamadas;
  return fn;
}

/**
 * `consultaOsm` sintética: una calzada recta que cruza la celda de oeste a este
 * por su centro y se detiene a `retranqueoM` de cada borde.
 *
 * Sirve para lo que ningún fixture puede servir —los cuatro mundos congelados
 * caben en menos de un kilómetro y nunca llegan al borde de una celda de cuatro—,
 * que es colocar dos calzadas a una distancia elegida del borde compartido y ver
 * si la costura las une o no.
 */
export function consultaSintetica(rejilla, { retranqueoM = 40, puntos = 20 } = {}) {
  const proy = proyectorDeRejilla(rejilla);
  const llamadas = [];
  const fn = async (peticion) => {
    llamadas.push(peticion);
    const { celda, limites } = peticion;
    const { minX, maxX, minY, maxY } = limites.metros;
    const y = (minY + maxY) / 2;
    const x0 = minX + retranqueoM;
    const x1 = maxX - retranqueoM;
    const geometry = [];
    for (let k = 0; k <= puntos; k++) {
      const g = proy.toLatLon({ x: x0 + ((x1 - x0) * k) / puntos, y });
      geometry.push({ lat: g.lat, lon: g.lon });
    }
    return {
      geoJson: {
        elements: [
          {
            type: 'way',
            // El identificador depende de la celda: dos celdas con el mismo id de
            // OSM serían el mismo trozo de mundo repetido, y eso no es lo que se
            // está probando.
            id: 100000 + (celda.i + 50) * 1000 + (celda.j + 50),
            tags: { highway: 'residential', name: `calzada ${celda.i},${celda.j}` },
            geometry,
          },
        ],
      },
      poiJson: { elements: [] },
    };
  };
  fn.llamadas = llamadas;
  return fn;
}

/** `consultaOsm` que devuelve datos sin una sola calle ni un solo anclaje. */
export function consultaVacia() {
  const llamadas = [];
  const fn = async (peticion) => {
    llamadas.push(peticion);
    return { geoJson: { elements: [] }, poiJson: { elements: [] } };
  };
  fn.llamadas = llamadas;
  return fn;
}

/** `consultaOsm` que se cae, para el estado de error de la consulta a mitad. */
export function consultaQueFalla(mensaje = 'Overpass no contesta') {
  const llamadas = [];
  const fn = async (peticion) => {
    llamadas.push(peticion);
    throw new Error(mensaje);
  };
  fn.llamadas = llamadas;
  return fn;
}

/**
 * Serialización completa, que es la única comparación que afirma «idéntico byte a
 * byte». Campo a campo pasa por encima de las polilíneas y deja pasar la
 * regresión que importa.
 */
export const serializado = (valor) => JSON.stringify(valor);

/** Un registro de celda sin su motivo de apertura: el motivo es dato de la partida, no del mundo. */
export const sinMotivo = (registro) => serializado({ ...registro, motivo: null });

/** Todos los nodos de un objeto que no están congelados, salvo las vistas sobre ArrayBuffer. */
export function nodosSinCongelar(valor, ruta = 'raíz', out = []) {
  if (valor === null || typeof valor !== 'object') return out;
  if (ArrayBuffer.isView(valor)) return out;
  if (!Object.isFrozen(valor)) out.push(ruta);
  for (const [k, v] of Object.entries(valor)) nodosSinCongelar(v, `${ruta}.${k}`, out);
  return out;
}
