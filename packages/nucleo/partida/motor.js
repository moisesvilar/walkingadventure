// El motor de pasos **de la partida**: el del mapa activo, con sus productores ya
// cableados.
//
// Existe porque no existía. `creaMotorDePasos` es genérico a propósito —el motor sabe
// cuándo ocurre un paso y con qué azar, nunca qué ocurre en él— y el único sitio del
// paquete que le colgaba productores era `prologo.js`, que monta el suyo de usar y
// tirar. Consecuencia medida (`pipeline/decisiones-orquestador.md` §6v): con la partida
// en marcha **la noticia de la jugadora no salía del pueblo donde ocurrió**, porque
// nadie propagaba nada entre paso y paso. Seis salidas daban rango `{forastería 9,
// pertenencia 1}` y 13 entradas de diario; con la propagación cableada, `{7, 3}` y 17.
//
// Los dos productores son los dos que este paquete declara, y en su orden declarado:
// **la propagación de rumores primero y la cola de entregas después** (`entregas.js`,
// «segundo productor»). El azar de cada uno cuelga de su identificador y no de su
// posición, así que el orden no resiembra nada: lo que fija es en qué orden salen los
// efectos de un paso.
//
// Y lo que este módulo **no** hace: no decide cuándo avanza el mundo. Los pasos los
// dan `abreSalidaDePasos` y `kilometrosDeFondo` a partir de lo andado, y aquí solo se
// arma el motor que ellos empujan.

import { congelaHondo } from '../core/congelar.js';
import { creaColaDeEntregas, estadoDeEntregas } from './entregas.js';
import { estadoDeNucleos } from './nucleos.js';
import { creaMotorDePasos, estadoDePasos, exigeMapaId } from './pasos.js';
import { arbolDeCalzadas, creaPropagacionDeRumores, estadoDeRumores } from './rumores.js';

/** Los productores que cuelga la partida, en el orden en que se registran. */
export const PRODUCTORES_DE_LA_PARTIDA = congelaHondo(['rumores', 'entregas']);

/**
 * Arma el motor del mapa activo con sus productores.
 *
 * @param {object} piezas
 *   `semilla` la de la partida; `mapaId` el mapa activo; `mundo` su mundo congelado, del
 *   que se lee el árbol de calzadas; `tramo` el tramo personal con el que viajan los
 *   rumores; `rumores`, `nucleos`, `entregas` y `pasos` las áreas del estado de la
 *   partida, que llegan inyectadas porque se guardan y se cargan con ella;
 *   `producciones` lo que el mundo produce en un paso, o nada —sin fuente, la cola no
 *   inventa ninguna entrada—; `arbol` el árbol ya leído, si quien llama lo tiene;
 *   `baseDePaso` la base de siembra, para quien corra con una rama de azar propia.
 * @returns `{ motor, propagacion, cola, arbol }`. La propagación y la cola se devuelven
 *   porque tienen operaciones propias —sembrar, consultar lo pendiente— que el motor no
 *   expone, y esconderlas obligaría a montarlas dos veces.
 */
export function creaMotorDeLaPartida({
  semilla,
  mapaId,
  mundo,
  tramo,
  rumores = estadoDeRumores(),
  nucleos = estadoDeNucleos(),
  entregas = estadoDeEntregas(),
  pasos = estadoDePasos(),
  producciones = null,
  arbol = null,
  baseDePaso = null,
}) {
  const id = exigeMapaId(mapaId, 'el motor de la partida');
  if (typeof semilla !== 'string' || !semilla) {
    throw new Error(`el motor de la partida cuelga su azar de la semilla de la partida y llegó ${JSON.stringify(semilla) ?? String(semilla)}`);
  }
  // El árbol se exige aquí y no dentro de la propagación para que la ausencia de mundo
  // falle nombrando el mundo: sin él no hay por dónde viajar, y un motor sin propagación
  // avanzaría el contador dejando el mundo mudo sin que nada se pusiera rojo.
  const elArbol = arbol ?? arbolDeCalzadas(mundo);

  const propagacion = creaPropagacionDeRumores({ semilla, mapaId: id, arbol: elArbol, estado: rumores, nucleos, tramo, baseDePaso });
  const cola = creaColaDeEntregas({ mapaId: id, estado: entregas, nucleos, producciones });
  const motor = creaMotorDePasos({ semilla, mapaId: id, estado: pasos, productores: [propagacion, cola], baseDePaso });

  return { motor, propagacion, cola, arbol: elArbol };
}
