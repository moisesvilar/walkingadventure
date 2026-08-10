// El desenlace de una aventura terminada: lo que la plantilla declara, **resuelto
// contra la aventura casteada**.
//
// Existe porque nadie lo componía. `echaElTelon` lo exige entero —lo consumen el
// nacimiento del rumor, la progresión, la capa de NPCs y la pantalla del telón—, la
// plantilla declara la mitad y el casting la otra mitad, y entre las dos no había
// ninguna función que las juntara: la partida se terminaba y el telón salía sin
// desenlace, sin oro, sin objeto y sin rumor (`pipeline/decisiones-orquestador.md` §6v).
//
// Tres decisiones lo gobiernan:
//
//   · **No redacta nada.** El texto, el oro, los objetos, el mote y la semilla del
//     rumor son de la plantilla y viajan tal cual. Lo único que se calcula aquí es
//     dónde ocurrió y quién estuvo delante, que es lo que la plantilla no puede saber.
//   · **La identidad distingue dos salidas de la misma plantilla.** `aventura.id` es
//     `plantilla@semilla`, así que es la misma el día 1 y el día 6: colgar el rumor de
//     ella hacía reventar la segunda vuelta con «ya hay un rumor con esa identidad en
//     este mapa». La salida es lo que separa dos veces lo mismo.
//   · **Ningún efecto de relación se aplica sin su decisión.** La plantilla los cuelga
//     de decisiones de beat, y este juego no tiene ramificación (exclusión 9 del PRD):
//     sin decisiones tomadas no hay actos, y darlos todos por hechos aplicaría a la vez
//     el que rompe y el que repara.

import { congelaHondo } from '../core/congelar.js';
import { SIGNOS, hechosFieles } from '../partida/deformacion.js';

/** Los campos del desenlace, en orden declarado. Es lo que sus cuatro consumidores leen. */
export const CAMPOS_DEL_DESENLACE = congelaHondo([
  'id', 'plantilla', 'aventura', 'salida', 'texto', 'oro', 'objetos', 'mote',
  'signo', 'lugar', 'caras', 'efectos', 'hechos', 'semilla',
]);

function exigeTexto(valor, quien) {
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${quien} se nombra con su identificador y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  return valor;
}

/**
 * Dónde ocurrió el desenlace: **el sitio del último beat**, que es donde la aventura
 * acaba y por tanto donde el mundo se entera.
 *
 * Un rol humano no es un sitio: lo que se nombra es el sitio en el que trabaja. Y un
 * servicio tampoco nace rumores por su cuenta —el árbol de calzadas une núcleos—, así
 * que lo que se declara es el núcleo que lo contiene.
 */
export function lugarDelDesenlace(beats) {
  if (!Array.isArray(beats) || !beats.length) {
    throw new Error('el desenlace se compone sobre la cadena de beats de la aventura casteada, y llegó vacía: sin ella no se sabe ni dónde acabó');
  }
  const ultimo = beats[beats.length - 1]?.lugar;
  const sitio = ultimo?.tipo === 'humano' ? ultimo.trabajaEn : ultimo;
  if (!sitio || typeof sitio.nombre !== 'string' || !sitio.nombre) {
    throw new Error(`el último beat de la aventura no dice en qué sitio ocurre: llegó ${JSON.stringify(ultimo) ?? String(ultimo)}`);
  }
  if (sitio.tipo === 'servicio') {
    const dentroDe = exigeTexto(sitio.en, `el núcleo en el que está el servicio "${sitio.nombre}", donde acaba la aventura,`);
    return congelaHondo({ tipo: 'nucleo', id: dentroDe });
  }
  return congelaHondo({ tipo: sitio.tipo, id: sitio.nombre });
}

/**
 * Las caras que fueron rol: las de los roles humanos de la cadena, sin repetir y en el
 * orden en que aparecen. Son las que recuerdan lo que pasó.
 */
export function carasDelDesenlace(beats) {
  const vistas = new Set();
  const caras = [];
  for (const beat of beats ?? []) {
    const cara = beat?.lugar?.tipo === 'humano' ? beat.lugar.cara : null;
    if (!cara || typeof cara.sitio !== 'string' || typeof cara.puesto !== 'string') continue;
    const clave = `${cara.sitio} ${cara.puesto}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    caras.push({ sitio: cara.sitio, puesto: cara.puesto });
  }
  return caras;
}

/**
 * Compone el desenlace de una aventura terminada.
 *
 * @param {object} opciones
 *   `plantilla` la del catálogo, entera —la declaración de rumor se lee de ella y no de
 *   una copia—; `aventura` la casteada de SPEC-010, con su cadena de beats; `salida` la
 *   identidad de la salida que se cierra, que es lo que distingue dos vueltas de la
 *   misma plantilla; `decisiones` las que se tomaron dentro de la aventura, que hoy son
 *   siempre ninguna.
 * @returns el desenlace entero, congelado. **Nunca uno a medias**: lo que falta falla
 *   nombrándolo.
 */
export function componeElDesenlace({ plantilla, aventura, salida, decisiones = [] }) {
  if (!plantilla || typeof plantilla !== 'object') {
    throw new Error(`el desenlace se compone sobre la plantilla del catálogo y llegó ${JSON.stringify(plantilla) ?? String(plantilla)}: de ella salen el texto, el oro y lo que entrega`);
  }
  const idDePlantilla = exigeTexto(plantilla.id, 'la plantilla del desenlace');
  const declarado = plantilla.desenlace;
  if (!declarado || typeof declarado !== 'object') {
    throw new Error(`la plantilla "${idDePlantilla}" no declara desenlace: sin él no hay ni qué se cuenta ni qué se entrega al terminar`);
  }
  if (!aventura || typeof aventura !== 'object') {
    throw new Error(`el desenlace de "${idDePlantilla}" se compone contra la aventura casteada y llegó ${JSON.stringify(aventura) ?? String(aventura)}`);
  }
  const idDeAventura = exigeTexto(aventura.id, `la aventura de la que se compone el desenlace de "${idDePlantilla}"`);
  const laSalida = exigeTexto(salida, `la salida en la que se termina la aventura "${idDeAventura}"`);
  const beats = aventura.beats ?? [];
  const lugar = lugarDelDesenlace(beats);

  // El signo es el que declara la plantilla cuando su desenlace es notable. Cuando no
  // lo es no hay ninguno que declarar —nadie lo cuenta— y lo que queda es el signo de
  // haberla terminado, que es bueno: las memorias de quienes estuvieron delante lo
  // exigen, y el rumor no llega a mirarlo porque no nace.
  const signo = plantilla.rumor?.notable ? plantilla.rumor.signo : SIGNOS.BUENO;
  const semilla = plantilla.rumor?.semilla ?? null;
  // Los hechos que recuerdan las caras. Con semilla declarada son los suyos; sin ella
  // —una plantilla que nadie cuenta— el asunto es la propia plantilla, que es una
  // derivación y no una invención: es lo que permite agrupar dos versiones de lo mismo.
  const hechos = hechosFieles(
    semilla ?? { asunto: idDePlantilla, escala: { veces: 1 }, detalle: { lugar: lugar.id } },
    { lugar: lugar.id, quien: `la semilla del desenlace de la plantilla "${idDePlantilla}"` },
  );

  const tomadas = new Set(decisiones ?? []);
  const efectos = (plantilla.relacion ?? [])
    .filter((e) => tomadas.has(e.decision))
    .map((e) => ({ cara: carasDelDesenlace(beats.filter((b) => b.rol === e.rol))[0] ?? null, signo: e.signo, decision: e.decision }));
  for (const efecto of efectos) {
    if (efecto.cara) continue;
    throw new Error(
      `el desenlace de "${idDePlantilla}" aplica el acto de la decisión "${efecto.decision}", y el rol que nombra no puso ninguna cara en la cadena: ` +
      'un acto es hacia alguien, y aplicarlo sin cara sería moverle la relación a nadie',
    );
  }

  return congelaHondo({
    // La identidad, que es de la que cuelga el rumor: plantilla, mundo **y salida**.
    // Sin la salida, terminar dos veces la misma aventura reventaba al nacer el rumor.
    id: `${idDeAventura}#desenlace:${laSalida}`,
    plantilla,
    aventura: idDeAventura,
    salida: laSalida,
    texto: declarado.texto ?? null,
    oro: declarado.oro,
    objetos: (declarado.objetos ?? []).map((o) => ({ ...o })),
    // El mote solo existe si la plantilla lo declara, y solo lo declara con desenlace
    // notable: la progresión lo vuelve a comprobar contra el rumor que nació.
    mote: plantilla.mote ?? null,
    signo,
    lugar,
    caras: carasDelDesenlace(beats),
    efectos,
    hechos,
    semilla,
  });
}

/** Los dos textos de repuesto de una plantilla, que es lo que el cierre en corto lee. */
export function repuestoDe(plantilla) {
  const repuesto = plantilla?.repuesto;
  if (!repuesto || typeof repuesto !== 'object') {
    throw new Error(
      `la plantilla "${plantilla?.id ?? '(sin id)'}" no trae sus desenlaces de repuesto: son los dos textos con los que se echa el telón ` +
      'a mitad de camino, y sin ellos el cierre en corto dejaría el hilo colgando',
    );
  }
  return congelaHondo({ sinTi: repuesto.sinTi, conLoConseguido: repuesto.conLoConseguido });
}
