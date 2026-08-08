// El mote: **de qué te conocen en cada pueblo**, y es distinto en cada uno.
//
// «El mote nace del rumor, no del hecho» (`personaje.md` §2): el apodo se pega a
// partir de lo que se cuenta, así que pueden llamarte «la que cruzó el monte de
// noche» por algo que no ocurrió exactamente así. Cada desenlace y cada suceso
// declaran su **mote candidato** igual que ya declaran su rumor, y en cada núcleo se
// pega **el que más suena** entre los rumores que ese núcleo ha oído.
//
// Dos cosas que son decisión y no aritmética:
//
//   · **El desempate no usa nunca el orden de llegada**, por la misma paranoia que
//     rige SPEC-012 y SPEC-014: un desempate por orden haría que oír un rumor más
//     cambiara el mote de un núcleo al que no llegó nada nuevo. Se resuelve por el
//     nivel más bajo con el que llegó —lo que llegó más fiel suena más claro— y,
//     si persiste, por identidad de rumor y de candidato.
//   · **El mote puede cambiar**, y eso no contradice que el rango no baje: el mote
//     es *de qué* te conocen y el rango es *cuánto*. Dejar de ser «la que cruzó el
//     monte» para ser «la del paquete» no te devuelve a forastera.
//
// Lo que se guarda es la **declaración** —qué candidato trae cada rumor—, no el
// mote: el mote se deriva de lo oído, como el rango, y por eso en un mapa nuevo no
// hay ninguno sin que haya que borrar nada.

import { congelaHondo } from '../core/congelar.js';
import { loQueSeCuentaEn } from './nucleos.js';
import { exigeMapaId } from './pasos.js';
import { exigeMapaDeNucleos } from './rango.js';

/**
 * Los motes de una partida: un registro por mapa y nada más. **Por mapa** porque los
 * rumores lo son —dos mapas no comparten árbol ni identidades— y porque el mote, como
 * el rango, no viaja.
 */
export function estadoDeMotes() {
  return { mapas: {} };
}

/** El registro de un mapa dentro del estado, creándolo si es la primera vez. */
export function motesDeMapa(estado, mapaId) {
  const id = exigeMapaId(mapaId, 'los motes de los núcleos');
  if (!estado || typeof estado !== 'object' || !estado.mapas || typeof estado.mapas !== 'object') {
    throw new Error('el estado de motes llega mal formado: se espera lo que devuelve estadoDeMotes(), un objeto con "mapas"');
  }
  if (!Object.prototype.hasOwnProperty.call(estado.mapas, id)) estado.mapas[id] = { candidatos: {} };
  return estado.mapas[id];
}

/** Una clave de mote candidato bien formada: **una referencia, nunca un texto redactado**. */
export function exigeCandidato(candidato, quien = 'el mote candidato') {
  if (typeof candidato !== 'string' || !candidato) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(candidato) ?? String(candidato)}: es la clave del candidato que declara la plantilla o el suceso, ` +
      'y las palabras con que se dice las pone quien escribe',
    );
  }
  return candidato;
}

/**
 * La declaración de un candidato, **sin tocar nada**. Declarar dos veces el mismo
 * candidato para el mismo rumor no cambia nada; declarar otro distinto falla, porque
 * un rumor trae el mote de su desenlace y no dos.
 */
export function planDeCandidato(estado, { mapaId, rumor, candidato }) {
  const registro = motesDeMapa(estado, mapaId);
  if (typeof rumor !== 'string' || !rumor) {
    throw new Error(`un mote candidato cuelga de un rumor y llegó ${JSON.stringify(rumor) ?? String(rumor)}: sin él no se sabe a qué núcleos llega`);
  }
  const clave = exigeCandidato(candidato, `el mote candidato del rumor "${rumor}"`);
  const ya = registro.candidatos[rumor];
  if (ya !== undefined && ya !== clave) {
    throw new Error(`el rumor "${rumor}" ya declaró el mote candidato "${ya}" y ahora declara "${clave}": un rumor trae el mote de su desenlace, y cambiarlo reescribiría lo que ya se pegó en varios pueblos`);
  }
  return { rumor, candidato: clave, nuevo: ya === undefined };
}

/** Apunta el candidato que declara un desenlace, contra el rumor que acaba de nacer. */
export function declaraCandidato(estado, { mapaId, rumor, candidato }) {
  const registro = motesDeMapa(estado, mapaId);
  const plan = planDeCandidato(estado, { mapaId, rumor, candidato });
  registro.candidatos[plan.rumor] = plan.candidato;
  return plan.candidato;
}

// El orden con el que se resuelve el empate, **total y declarado**: más veces
// primero, después el nivel más bajo con el que llegó, después la identidad del
// rumor y por último la del candidato. Con los cuatro criterios no queda ningún par
// que dependa de por dónde se recorrió nada.
const masSuena = (a, b) => (
  a.veces !== b.veces ? b.veces - a.veces
    : a.nivelMinimo !== b.nivelMinimo ? a.nivelMinimo - b.nivelMinimo
      : a.rumorMinimo !== b.rumorMinimo ? (a.rumorMinimo < b.rumorMinimo ? -1 : 1)
        : a.candidato < b.candidato ? -1 : a.candidato > b.candidato ? 1 : 0
);

/**
 * El mote de un núcleo: **la clave del candidato que más ha sonado allí**, o `null`
 * si no ha oído nada que traiga uno — que no es un error.
 *
 * Se pregunta núcleo a núcleo, como el rango y como lo oído: no hay ninguna consulta
 * de todos los motes de un mapa a la vez, porque la repisa enseña motes y no una
 * lista de pueblos con lo suyo.
 */
export function moteEn(nucleos, { mapaId, nucleo, mapa, motes }) {
  const id = exigeMapaId(mapaId, 'el mote de un núcleo');
  const activo = exigeMapaDeNucleos(mapa, 'el mote de un núcleo');
  if (typeof nucleo !== 'string' || !nucleo) {
    throw new Error(`el mote se pide de un núcleo y llegó ${JSON.stringify(nucleo) ?? String(nucleo)}`);
  }
  if (!activo.tiene(nucleo)) {
    throw new Error(`el núcleo "${nucleo}" no existe en el mapa activo ${id}: el mote es de un pueblo de este mapa, y un núcleo de otro tiene el suyo o ninguno`);
  }
  const registro = motesDeMapa(motes, id);

  // Se acumula en un objeto y se recorre por claves ordenadas, nunca por el orden en
  // que se insertaron: dos partidas que oyeran lo mismo en otro orden tienen que
  // pegar el mismo mote.
  const porCandidato = {};
  for (const version of loQueSeCuentaEn(nucleos, { mapaId: id, nucleo })) {
    const candidato = registro.candidatos[version.rumor];
    if (candidato === undefined) continue; // ese rumor no declaró ninguno: el mote no cambia
    const entrada = porCandidato[candidato] ?? (porCandidato[candidato] = { candidato, veces: 0, nivelMinimo: Infinity, rumorMinimo: null });
    entrada.veces += 1;
    if (version.nivel < entrada.nivelMinimo) entrada.nivelMinimo = version.nivel;
    if (entrada.rumorMinimo === null || version.rumor < entrada.rumorMinimo) entrada.rumorMinimo = version.rumor;
  }

  const candidatos = Object.keys(porCandidato).sort().map((k) => porCandidato[k]).sort(masSuena);
  return candidatos.length ? candidatos[0].candidato : null;
}

// --- Serialización ----------------------------------------------------------

/** Las declaraciones de mote en forma serializable, con mapas y rumores en orden declarado. */
export function congelaMotes(estado) {
  const mapas = {};
  for (const mapaId of Object.keys(estado?.mapas ?? {}).sort()) {
    const registro = estado.mapas[mapaId];
    mapas[mapaId] = {
      candidatos: Object.keys(registro.candidatos ?? {}).sort().map((rumor) => ({ rumor, candidato: registro.candidatos[rumor] })),
    };
  }
  return { mapas };
}

/** Las declaraciones de vuelta de su documento. El mote no se guarda: se vuelve a derivar de lo oído. */
export function levantaMotes(doc) {
  const estado = estadoDeMotes();
  for (const mapaId of Object.keys(doc?.mapas ?? {}).sort()) {
    const registro = motesDeMapa(estado, mapaId);
    for (const guardado of doc.mapas[mapaId]?.candidatos ?? []) {
      if (typeof guardado?.rumor !== 'string' || !guardado.rumor) {
        throw new Error(`una declaración de mote guardada del mapa ${mapaId} vuelve sin rumor: sin él no se sabe a qué núcleos llegó`);
      }
      registro.candidatos[guardado.rumor] = exigeCandidato(guardado.candidato, `el mote candidato guardado del rumor "${guardado.rumor}"`);
    }
  }
  return estado;
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión: no
// hay ninguna función que devuelva los motes de todos los núcleos de un mapa a la
// vez, y no hay ninguna que fije el mote de un núcleo a mano. El mote se deriva de
// lo oído; lo que se declara es el candidato, y lo declara quien entrega el rumor.
