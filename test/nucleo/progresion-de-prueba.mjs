// SPEC-015 · Lo que necesitan las pruebas de la progresión: el árbol de un mapa de
// cadena ya leído, **lo oído sedimentado a mano** y los ítems con los que se afirman
// el precio y la compra.
//
// Lo oído se escribe a mano a propósito y no se propaga: la única entrada del rango
// es *cuántos rumores distintos han llegado a ese núcleo*, y con una propagación de
// verdad no se podría fijar ni el recuento, ni el nivel, ni el signo, que son las
// tres cosas de las que esta fila afirma que dos no cuentan. Donde lo que se afirma
// es que la noticia llega sola —«se puede ser alguien en un pueblo donde no has
// estado»— se usa la propagación real de `rumor-de-prueba.mjs`, no esto.
//
// Vive aquí y no en `test/dobles/` por lo mismo que `rumor-de-prueba.mjs`: los
// dobles son de la frontera del núcleo (OSM, GPS, reloj, proxy) y esto es andamiaje.
// Nada de aquí toca la red ni el reloj del sistema.

import { SIGNOS, hechosFieles } from '../../packages/nucleo/partida/deformacion.js';
import { estadoDeNucleos, sedimenta, versionQueLlego } from '../../packages/nucleo/partida/nucleos.js';
import { declaraCandidato, estadoDeMotes } from '../../packages/nucleo/partida/motes.js';
import { estadoDeObjetos } from '../../packages/nucleo/partida/objetos.js';
import { estadoDeOro } from '../../packages/nucleo/partida/oro.js';
import { arbolDeCalzadas } from '../../packages/nucleo/partida/rumores.js';
import { mundoLineal } from './rumor-de-prueba.mjs';

export { MAPA, avanza, codigoDe, desenlaceEn, mundoDe, mundoLineal, propagacionSobre } from './rumor-de-prueba.mjs';
export { SIGNOS } from '../../packages/nucleo/partida/deformacion.js';

/** El segundo mapa de la partida. El rango no viaja; la bolsa y la repisa sí. */
export const OTRO_MAPA = 'fuera';

/** La cadena de referencia, la misma de `rumores.test.mjs` y de `reputacion.test.mjs`. */
export const CADENA = ['Monfrida', 'Vilanova', 'Cadaval', 'Peiteiro', 'Ourille', 'Sanxil'];

/** Los cinco módulos que entrega esta fila, para poder afirmar sobre los cinco de una pasada. */
export const LOS_CINCO_MODULOS = [
  'packages/nucleo/partida/rango.js',
  'packages/nucleo/partida/oro.js',
  'packages/nucleo/partida/informantes.js',
  'packages/nucleo/partida/objetos.js',
  'packages/nucleo/partida/motes.js',
];

/** Cuántos rumores distintos hacen falta en un núcleo para estar en cada escalón. */
export const RUMORES_PARA = Object.freeze({ forasteria: 0, nombradia: 1, pertenencia: 3 });

/** El mapa activo ya leído: sus núcleos y la pregunta de si uno le pertenece. */
export function mapaDe(nombres = CADENA) {
  return arbolDeCalzadas(mundoLineal(nombres));
}

/** Los tres estados de partida que esta fila guarda o deriva. */
export function progresion() {
  return { oro: estadoDeOro(), objetos: estadoDeObjetos(), motes: estadoDeMotes(), nucleos: estadoDeNucleos() };
}

/** La semilla estructurada de un rumor, con el asunto del que cuelga su versión fiel. */
export const semillaDeRumor = (asunto = 'la campana rota', lugar = 'Monfrida') => ({
  asunto,
  escala: { veces: 1 },
  detalle: { con: null, lugar, motivo: null },
});

/**
 * Sedimenta en un núcleo una versión que le llegó, con su nivel, su signo y —si el
 * desenlace lo declaró— el mote candidato que trae ese rumor.
 *
 * Es la puerta pública de SPEC-012, no un atajo por dentro del estado: preguntar y
 * escribir por donde escribe la propagación es lo que hace que estas pruebas midan
 * la superficie que la spec dice que es la pieza.
 */
export function oye(nucleos, {
  mapaId = 'casa',
  nucleo,
  rumor,
  nivel = 1,
  signo = SIGNOS.BUENO,
  origen = 'Monfrida',
  candidato = null,
  motes = null,
} = {}) {
  sedimenta(nucleos, {
    mapaId,
    nucleo,
    loQueLlego: versionQueLlego({
      rumor,
      plantilla: null,
      origen,
      nivel,
      signo,
      hechos: hechosFieles(semillaDeRumor(`lo de ${rumor}`, origen), { lugar: origen }),
    }),
  });
  if (candidato != null && motes) declaraCandidato(motes, { mapaId, rumor, candidato });
  return nucleos;
}

/**
 * Un núcleo que ha oído `cuantos` rumores distintos, que es la única entrada del
 * rango. Con 0, 1 y 3 se recorren los tres escalones.
 */
export function conRumores(cuantos, {
  nucleos = estadoDeNucleos(),
  nucleo = 'Monfrida',
  mapaId = 'casa',
  nivel = 1,
  signo = SIGNOS.BUENO,
  desde = 1,
} = {}) {
  for (let k = 0; k < cuantos; k++) oye(nucleos, { mapaId, nucleo, rumor: `r${desde + k}`, nivel, signo });
  return nucleos;
}

// --- El catálogo de un informante -------------------------------------------

/** Un ítem de saber con precio base impar, que es el que hace visible el redondeo. */
export const ITEM_DE_SABER = Object.freeze({
  id: 'lo-de-la-campana',
  tipo: 'saber',
  efecto: 'version-que-oyo',
  precioBase: 7,
  rumor: 'r1',
});

/** Un favor, que es la mitad peligrosa del catálogo: es por donde se pagaría por no andar. */
export const ITEM_DE_FAVOR = Object.freeze({
  id: 'que-le-lleven-el-recado',
  tipo: 'favor',
  efecto: 'recado-llevado',
  precioBase: 4,
});

/** El catálogo de referencia: un saber y un favor. */
export const CATALOGO = Object.freeze([ITEM_DE_SABER, ITEM_DE_FAVOR]);

/** Un informante de un núcleo. Quién es lo resuelve SPEC-014; aquí solo importa de dónde. */
export const informanteDe = (nucleo, mapaId = null) => (mapaId ? { nucleo, mapaId } : { nucleo });

// --- Utilidades de aserción --------------------------------------------------

/** Todas las cifras que hay dentro de un valor, a cualquier profundidad. */
export function cifrasDe(valor, out = []) {
  if (typeof valor === 'number') out.push(valor);
  else if (valor && typeof valor === 'object') for (const k of Object.keys(valor)) cifrasDe(valor[k], out);
  return out;
}

/** Todas las claves de un valor, a cualquier profundidad. */
export function clavesDe(valor, out = []) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    for (const k of Object.keys(valor)) {
      out.push(k);
      clavesDe(valor[k], out);
    }
  } else if (Array.isArray(valor)) {
    for (const v of valor) clavesDe(v, out);
  }
  return out;
}
