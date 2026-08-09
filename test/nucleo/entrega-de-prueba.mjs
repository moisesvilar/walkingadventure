// SPEC-019 · Lo que necesitan las pruebas de la cola de entregas y de los
// micro-encuentros: mundos con sus sitios y sus afinidades de escena escritos a mano
// —para poder fijar cuál es apto y cuál no—, y las tres maneras de llenar una cola.
//
// Vive aquí y no en `test/dobles/` por lo mismo que `rumor-de-prueba.mjs` y
// `prologo-de-prueba.mjs`: los dobles son de la frontera del núcleo (datos de OSM,
// GPS, reloj, proxy) y esto es andamiaje. Nada de aquí toca la red ni el reloj del
// sistema: los sitios se declaran, el azar sale de la semilla y los pasos del mundo
// se avanzan a mano.

import { encola, estadoDeEntregas } from '../../packages/nucleo/partida/entregas.js';

/** El mapa activo de casi todas estas pruebas. Los dos mapas conviven en «por mapa». */
export const MAPA = 'casa';

/** Un segundo mapa de la misma partida, para afirmar que la cola no se comparte. */
export const OTRO_MAPA = 'playa';

/**
 * Un mundo con sus sitios y sus afinidades de escena, escrito a mano.
 *
 * Se escribe y no se genera a propósito: lo que estas pruebas afirman es contra qué
 * sitio resuelve un lugar diferido, y eso depende de qué escenas admite cada uno. Con
 * un mundo generado no se podría fijar cuál es el primero apto del trazado ni tener
 * un sitio que a propósito no admite ninguna escena.
 *
 * Los pesos van por encima de `PESO_MINIMO_DE_ESCENA` cuando la escena tiene que
 * admitirse y por debajo cuando no, que es la única frontera que importa aquí.
 */
export function mundoDeSitios({ nucleos = ['Vilaboa'], servicios = [], parajes = null } = {}) {
  const losParajes = parajes ?? [
    { nombre: 'A Fonte Vella', escenas: { encuentro: 0.5, refugio: 0.3 } },
    { nombre: 'O Cruceiro Branco', escenas: { encuentro: 0.4, ritual: 0.3 } },
    { nombre: 'As Laxes da Moura', escenas: { misterio: 0.6 } },
    // El sitio que nunca resuelve un lugar de encuentro: su afinidad se queda por
    // debajo del mínimo, que es distinto de no declararla.
    { nombre: 'O Pozo Cego', escenas: { encuentro: 0.05, saber: 0.6 } },
  ];
  return {
    settlements: nucleos.map((nombre, i) => ({
      name: nombre,
      anchor: { name: `${nombre} real`, osmId: `way/${1000 + i}` },
      services: servicios.map((s, k) => ({ name: s, real: { name: `${s} real`, osmId: `node/${2000 + k}` } })),
    })),
    parajes: losParajes.map((p, i) => ({
      name: p.nombre,
      scenes: p.escenas,
      real: p.anclaje ?? { name: `${p.nombre} real`, osmId: `node/${3000 + i}` },
    })),
  };
}

/** Los nombres de los parajes de un mundo de sitios, en el orden en que se declararon. */
export const sitiosDe = (mundo) => mundo.parajes.map((p) => p.name);

/**
 * Una producción de oportunidad con su escena declarada, que es lo que la cola exige.
 * El asunto es una clave del catálogo, nunca una frase redactada.
 */
export const oportunidad = ({ asunto, escena = 'encuentro', clase = null, origen = null, paso = 1 }) => ({
  tipo: 'oportunidad',
  asunto,
  escena,
  clase,
  origen,
  paso,
});

/** Una producción de noticia, con el núcleo donde sedimenta y su signo. */
export const noticia = ({ asunto, nucleo = 'Vilaboa', signo = 'bueno', paso = 1 }) => ({
  tipo: 'noticia',
  asunto,
  nucleo,
  signo,
  paso,
});

/**
 * Una cola con las oportunidades que se le pidan, ya encoladas.
 *
 * Entra por `encola`, que es la puerta de verdad: construir las entradas a mano
 * dejaría sin ejercitar justamente la validación que decide qué se puede encolar.
 */
export function colaCon(producciones, { mapaId = MAPA, estado = estadoDeEntregas() } = {}) {
  for (const p of producciones) encola(estado, { mapaId, produccion: p });
  return estado;
}

/**
 * Una cola con `cuantas` oportunidades de la misma escena, numeradas.
 *
 * El paso las separa: dos entradas con la misma procedencia comparten identidad base
 * y la cola las desempata, pero para estas pruebas interesa que se distingan por lo
 * que son y no por un sufijo.
 */
export function colaDe(cuantas, { escena = 'encuentro', mapaId = MAPA, estado = estadoDeEntregas(), desde = 0 } = {}) {
  const producciones = [];
  for (let k = 0; k < cuantas; k++) producciones.push(oportunidad({ asunto: `encargo-${desde + k}`, escena, paso: desde + k }));
  return colaCon(producciones, { mapaId, estado });
}

/** La huella comparable de una entrada: lo que la spec dice que tiene que sobrevivir. */
export const huellaDeEntrada = (e) => ({
  id: e.id,
  tipo: e.tipo,
  asunto: e.asunto,
  escena: e.escena,
  estado: e.estado,
  procedencia: e.procedencia,
  ofertas: e.ofertas,
});
