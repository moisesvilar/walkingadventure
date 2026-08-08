// SPEC-014 · Lo que necesitan las pruebas de la capa de NPCs: los ocho extractos ya
// generados, una copia del mundo con identidad nueva —para que el reparto se
// recalcule de verdad y el orden de despertar se pueda comparar contra sí mismo—, y
// el mundo de mesa con el que se afirman la memoria y la relación.
//
// Vive aquí y no en `test/dobles/` por lo mismo que `rumor-de-prueba.mjs`: los
// dobles son de la frontera del núcleo (OSM, GPS, reloj, proxy) y esto es andamiaje.
// Nada de aquí toca la red ni el reloj del sistema: el mundo sale de fixtures
// congelados, el azar de la semilla y los pasos los pide la prueba.

import { namesFor } from '../../packages/nucleo/names/index.js';
import { estadoDeMemorias } from '../../packages/nucleo/partida/memoria.js';
import { creaCapaDeNpcs, estadoDeNpcs } from '../../packages/nucleo/partida/npcs.js';
import { estadoDeRelaciones } from '../../packages/nucleo/partida/relacion.js';
import { SUPOSICIONES } from '../../packages/nucleo/world/grafo.js';
import { generaMundo, semillaDe } from './mundo-de-prueba.mjs';

export { codigoDe } from './rumor-de-prueba.mjs';

/** Los ocho extractos de referencia: los cuatro mundos congelados por sus dos semillas. */
export const LOS_OCHO = ['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso']
  .flatMap((nombre) => ['1', '2'].map((semilla) => ({ nombre, semilla, clave: `${nombre}#${semilla}` })));

/** El mapa activo de casi todas las pruebas. El segundo aparece donde hay dos. */
export const MAPA = 'casa';
export const OTRO_MAPA = 'fuera';

// Generar los ocho cuesta unos tres segundos y aquí se miran muchas veces. El mundo
// es función de la semilla y del fixture, así que compartirlo entre casos no puede
// contaminar a nadie mientras ninguno lo mute — y ninguno lo hace.
const MUNDOS = new Map();

/** Uno de los ocho extractos, ya generado. */
export async function mundoDe(nombre, semilla) {
  const clave = `${nombre}#${semilla}`;
  if (!MUNDOS.has(clave)) MUNDOS.set(clave, await generaMundo(nombre, semillaDe(nombre, semilla)));
  return MUNDOS.get(clave);
}

/** Los ocho, en el orden declarado, cada uno con su clave. */
export async function losOcho() {
  const out = [];
  for (const { nombre, semilla, clave } of LOS_OCHO) out.push({ clave, mundo: await mundoDe(nombre, semilla) });
  return out;
}

/**
 * Una copia del mundo con **identidad nueva** y el mismo contenido.
 *
 * Hace falta para que el reparto potencial se recalcule entero en lugar de salir
 * memorizado: sin ella, comparar dos órdenes de despertar compararía dos veces el
 * mismo objeto y el caso no afirmaría nada.
 */
export function copiaDelMundo(mundo) {
  return JSON.parse(JSON.stringify({
    title: mundo.title ?? null,
    seed: mundo.seed,
    locale: mundo.locale ?? null,
    settlements: mundo.settlements ?? [],
    parajes: mundo.parajes ?? [],
    routes: (mundo.routes ?? []).map((r) => ({ name: r.name ?? null })),
  }));
}

/** El paquete de idioma de un mundo, que es el que la capa recibe inyectado. */
export const idiomaDe = (mundo) => namesFor(mundo.locale);

/**
 * La capa de NPCs de un mundo, con sus tres estados de partida a la vista para que
 * la prueba pueda serializarlos y volverlos a levantar.
 */
export function capaSobre(mundo, {
  mapaId = MAPA,
  semilla = mundo.seed,
  idioma = idiomaDe(mundo),
  estado = estadoDeNpcs(),
  memorias = estadoDeMemorias(),
  relaciones = estadoDeRelaciones(),
} = {}) {
  const capa = creaCapaDeNpcs({ semilla, mapaId, mundo, idioma, estado, memorias, relaciones });
  return { capa, estado, memorias, relaciones, idioma, semilla, mapaId };
}

/**
 * El mundo de mesa: dos núcleos unidos por una calzada real y una taberna anclada
 * al bar «Casa Manuela», que es el sitio con nombre del escenario de la batería.
 *
 * Se escribe a mano porque lo que se afirma sobre él son metros y participaciones
 * concretas —un salto de propagación, quién fue rol y quién no—, y con un mundo
 * generado no se podría fijar ninguna de las dos cosas.
 */
export function mundoDeMesa() {
  return {
    title: 'Tierras de Mesa',
    seed: '42.40,-8.81#1',
    locale: 'gl',
    settlements: [
      { name: 'Ourela', type: 'pueblo', x: 0, y: 0, anchor: { osmId: 'node/1', kind: 'plaza' }, services: [] },
      {
        name: 'Vilanova',
        type: 'aldea',
        x: 1000,
        y: 0,
        anchor: { osmId: 'node/2', kind: 'iglesia' },
        services: [
          { kind: 'taberna', name: 'Casa Manuela', x: 1010, y: 0, real: { osmId: 'node/3', kind: 'bar' } },
          { kind: 'mercado', name: 'A Praza', x: 1020, y: 0, real: { osmId: 'node/4', kind: 'tienda' } },
        ],
      },
    ],
    parajes: [{ name: 'A Furna', kind: 'cova', x: 2000, y: 0, real: { osmId: 'node/5' } }],
    routes: [{
      from: { name: 'Ourela', x: 0, y: 0 },
      to: { name: 'Vilanova', x: 1000, y: 0 },
      name: 'Camiño Vello',
      pts: [],
      nodos: [],
      tramos: [{ metros: 1000, suposicion: SUPOSICIONES.NINGUNA, desde: { x: 0, y: 0 }, hasta: { x: 1000, y: 0 } }],
    }],
  };
}

/** La cara titular de la taberna del mundo de mesa, que es de quien habla la batería. */
export const LA_TABERNERA = Object.freeze({ sitio: 'Casa Manuela', puesto: 'regencia' });

/** La semilla estructurada de un rumor, con el asunto que la deformación abulta. */
export function semillaDeRumor(asunto = 'la campana rota', lugar = 'Ourela') {
  return { asunto, escala: { veces: 1 }, detalle: { con: null, lugar, motivo: null } };
}

/**
 * El desenlace que SPEC-010 entrega al terminar una aventura, con lo que esta capa
 * mira de él: quiénes fueron rol, el hecho en su versión fiel y los efectos de
 * relación **declarados por la plantilla**.
 */
export function desenlaceDe({ id = 'r1', hechos, signo = 'bueno', lugar = 'Ourela', caras = [], efectos = [], plantilla = null } = {}) {
  return { id, hechos, signo, lugar: { tipo: 'nucleo', id: lugar }, caras, efectos, ...(plantilla ? { plantilla } : {}) };
}
