// SPEC-013 · Lo que necesitan las pruebas del prólogo del mundo: mundos sintéticos
// con su grafo, su árbol de calzadas y su casting escritos a mano —para poder fijar
// quién oye qué, en qué nivel y qué aventura pasa por dónde—, y los ocho extractos
// de referencia sobre los que se mide que la puesta en escena ocurre de verdad.
//
// Vive aquí y no en `test/dobles/` por lo mismo que `rumor-de-prueba.mjs`: los
// dobles son de la frontera del núcleo (datos de OSM, GPS, reloj, proxy) y esto es
// andamiaje. Nada de aquí toca la red ni el reloj del sistema: los datos de OSM
// salen de fixtures congelados y el azar sale siempre de la semilla.

import { estadoDeNucleos, sedimenta, versionQueLlego } from '../../packages/nucleo/partida/nucleos.js';
import { arbolDeCalzadas, estadoDeRumores, naceSuceso } from '../../packages/nucleo/partida/rumores.js';
import { SUCESOS_DEL_MUNDO, hechosDelSuceso } from '../../packages/nucleo/partida/sucesos-prologo.js';
import { SUPOSICIONES, construyeGrafo } from '../../packages/nucleo/world/grafo.js';
import { SEMILLA_A, SEMILLA_B } from './celda-de-prueba.mjs';
import { LAS_DOS_SEMILLAS, LOS_CUATRO, generaMundo, semillaDe } from './mundo-de-prueba.mjs';

export { SEMILLA_A, SEMILLA_B, LOS_CUATRO, LAS_DOS_SEMILLAS };

/** El mapa activo de casi todas las pruebas. Los dos mapas conviven en «dos mapas». */
export const MAPA = 'casa';

/** Dónde vive la jugadora en los mundos sintéticos: encima del primer núcleo de la cadena. */
export const PARTIDA = { x: 0, y: 0 };

/** El tramo con el que se dimensionaron todos los mundos de estas pruebas. */
export const TRAMO = 2000;

// Firme afirmado en los cuatro criterios: los mundos sintéticos no van de
// accesibilidad, y una vía sin tags dejaría el filtro en «no se sabe» y movería lo
// que estas pruebas afirman a otro sitio.
export const ASFALTO = { highway: 'residential', surface: 'asphalt' };

/** Una escalera: el firme que el criterio de accesibilidad deja fuera del grafo transitable. */
export const ESCALERA = { highway: 'steps' };

const via = (nodes, puntos, tags = ASFALTO) => ({ nodes, pts: puntos.map(([x, y]) => ({ x, y })), filtrables: tags });

/**
 * Un mundo sintético: una o varias cadenas de núcleos unidos por calzada, sus
 * aislados al otro lado de la ría, y el casting ya resuelto que la cuarta cláusula
 * lee.
 *
 * Las cadenas se escriben a mano a propósito. Lo que estas pruebas afirman es quién
 * oyó qué y en qué nivel, y eso depende de los saltos entre núcleos: con un trazado
 * generado no se podría fijar ni la topología ni qué aventura pasa por dónde.
 *
 * La **primera cadena** es la de quien juega: arranca en el punto de partida. Las
 * demás son componentes conexas aparte —tienen calzada entre sí y ningún camino
 * hasta la primera—, que es lo que permite montar un mapa con reparto donde nadie
 * puede llegar.
 *
 * @param {object} opciones
 *   `nucleos` los nombres de la cadena de quien juega, en orden; `cadenas` la forma
 *   larga, una lista de cadenas; `aislados` los que existen sin ninguna calzada, a
 *   unos cientos de metros en línea recta y sin camino por el grafo, que es el caso
 *   de la ría; `separacionM` los metros entre dos núcleos consecutivos; `casting`
 *   las aventuras ya casteadas, `{ id, en: [núcleos] }`.
 */
export function mundoSintetico({ nucleos = null, cadenas = null, aislados = [], separacionM = 600, casting = [], tags = null }) {
  const lasCadenas = cadenas ?? [nucleos ?? []];
  const settlements = [];
  const vias = [];
  const routes = [];
  const porNombre = new Map();

  // `separacionM` puede ser un número —cadena regular— o la lista de huecos, que es
  // lo que hace falta para colgar un núcleo tan lejos que no le llegue nada dentro
  // del tope de pasos.
  const hueco = (i) => (Array.isArray(separacionM) ? separacionM[i] : separacionM);

  lasCadenas.forEach((cadena, c) => {
    // Cada cadena arranca en su propio corredor, lo bastante lejos como para que
    // ningún punto de una se enganche al viario de otra al proyectarlo.
    const y = c * 100000;
    const xs = cadena.map((_, i) => (i === 0 ? 0 : 0));
    for (let i = 1; i < cadena.length; i++) xs[i] = xs[i - 1] + hueco(i - 1);
    cadena.forEach((nombre, i) => {
      const s = { name: nombre, type: 'aldea', x: xs[i], y, services: [] };
      settlements.push(s);
      porNombre.set(nombre, s);
    });
    if (cadena.length) vias.push(via(cadena.map((_, i) => 100 + c * 100 + i), cadena.map((_, i) => [xs[i], y]), tags?.[c] ?? ASFALTO));
    for (let i = 0; i + 1 < cadena.length; i++) {
      routes.push({
        from: porNombre.get(cadena[i]),
        to: porNombre.get(cadena[i + 1]),
        name: `Calzada de ${cadena[i]} a ${cadena[i + 1]}`,
        pts: [{ x: xs[i], y }, { x: xs[i + 1], y }],
        nodos: [],
        tramos: [{
          metros: xs[i + 1] - xs[i],
          suposicion: SUPOSICIONES.NINGUNA,
          desde: { x: xs[i], y },
          hasta: { x: xs[i + 1], y },
        }],
      });
    }
  });

  aislados.forEach((nombre, k) => {
    const x = -Math.round(hueco(0) / 2) - k * 50;
    const s = { name: nombre, type: 'aldea', x, y: 0, services: [] };
    settlements.push(s);
    porNombre.set(nombre, s);
    // Componente conexa propia: el núcleo está a unos cientos de metros en línea
    // recta y no hay ningún camino por el grafo hasta él.
    vias.push(via([900 + k * 2, 901 + k * 2], [[x, 0], [x - 10, 0]]));
  });

  return {
    settlements,
    routes,
    parajes: [],
    viario: construyeGrafo(vias),
    casting: casting.map(({ id, en, ok = true }) => ({
      ok,
      tpl: { id },
      beats: en.map((nombre) => ({
        lugar: {
          tipo: 'nucleo',
          nombre,
          en: null,
          x: porNombre.get(nombre).x,
          y: porNombre.get(nombre).y,
        },
      })),
    })),
  };
}

/** Una entrada del catálogo cerrado de sucesos del prólogo, por su identificador. */
export function sucesoDelCatalogo(id) {
  const entrada = SUCESOS_DEL_MUNDO.find((s) => s.id === id);
  if (!entrada) throw new Error(`el catálogo del prólogo no trae el suceso "${id}"`);
  return entrada;
}

/**
 * Un estado de prólogo escrito a mano: los sucesos que nacieron y lo que oyó cada
 * núcleo, con su nivel puesto por la prueba.
 *
 * Existe porque la condición de composición hay que poder ejercitarla en sus cuatro
 * cláusulas por separado —mismo nivel, sucesos distintos, núcleo no alcanzable, sin
 * aventura que pase—, y esperar a que una propagación produzca cada caso sería
 * afirmar sobre lo que salga en vez de sobre lo que se quiere probar.
 *
 * @param {object} opciones
 *   `mundo` el mundo sintético; `sucesos` los que nacen, `{ id, catalogo, origen }`;
 *   `oyeron` lo que sedimenta en cada sitio, `{ nucleo, suceso, nivel }`.
 */
export function prologoEscritoAMano({ mundo, mapaId = MAPA, sucesos = [], oyeron = [] }) {
  const arbol = arbolDeCalzadas(mundo);
  const rumores = estadoDeRumores();
  const nucleos = estadoDeNucleos();
  const nacidos = new Map();

  for (const { id, catalogo = 'burro-perdido', origen } of sucesos) {
    const entrada = sucesoDelCatalogo(catalogo);
    nacidos.set(id, naceSuceso({
      estado: rumores,
      nucleos,
      mapaId,
      arbol,
      id,
      origen,
      signo: entrada.signo,
      hechos: hechosDelSuceso(entrada, origen),
    }));
  }

  for (const { nucleo, suceso, nivel } of oyeron) {
    const rumor = nacidos.get(suceso);
    if (!rumor) throw new Error(`la prueba pide que "${nucleo}" oiga "${suceso}", que no ha nacido`);
    sedimenta(nucleos, {
      mapaId,
      nucleo,
      loQueLlego: versionQueLlego({
        rumor: rumor.id,
        origen: rumor.origen,
        nivel,
        signo: rumor.signo,
        hechos: rumor.hechos,
      }),
    });
  }

  return { arbol, rumores, nucleos, mapaId };
}

// --- Los ocho extractos de referencia ----------------------------------------

// Generar los ocho cuesta unos segundos y varias pruebas piden el mismo. Los mundos
// salen congelados de la tubería, así que compartirlos no puede contaminar a nadie.
const generados = new Map();

/** Uno de los ocho extractos de referencia, generado con la semilla de su cabecera. */
export async function mundoDeReferencia(nombre, semilla) {
  const clave = `${nombre}#${semilla}`;
  if (!generados.has(clave)) generados.set(clave, await generaMundo(nombre, semillaDe(nombre, semilla)));
  return generados.get(clave);
}

/** Los ocho extractos de referencia, en orden estable. */
export function losOchoExtractos() {
  return LOS_CUATRO.flatMap((nombre) => LAS_DOS_SEMILLAS.map((semilla) => ({ nombre, semilla, clave: `${nombre}#${semilla}` })));
}

/**
 * Los dos mundos de referencia con reparto de sobra, que son donde la puesta en
 * escena **se exige** y no se acepta que degrade.
 *
 * `costero` y `urbano-denso` castean seis de seis plantillas en sus dos semillas;
 * `barrio-tres-calles` castea una y cero y no tiene ni un servicio, y `suelo-250m`
 * castea dos y tres. Exigirla en los cuatro sería pedirle a un mundo sin reparto que
 * produzca una aventura (SPEC-013-iter-1, decisiones asumidas).
 */
export const CON_REPARTO_DE_SOBRA = ['costero', 'urbano-denso'];

/** Los dos mundos de referencia pobres, donde la degradación es el comportamiento correcto. */
export const SIN_REPARTO_SUFICIENTE = ['barrio-tres-calles', 'suelo-250m'];
