// La capa de conocimiento: **cuatro niveles por elemento del mundo**, el libro de
// pendientes de una salida, y el entintado que se aplica de golpe al echar el telón.
//
// Es capa sobre el mundo congelado, como el motor de pasos y la propagación: no toca la
// tubería, no importa ninguna fase de generación y no puede resembrar nada
// (`bucle-jugable.md` §1, «consecuencia arquitectónica»).
//
// Tres decisiones la gobiernan y las tres son estructura:
//
//   · **El nivel de partida lo decide la escala y no se guarda.** Lo que se ve de lejos
//     —picos, costa, bosques, núcleos y calzadas— nace en «lo ves» y lo pequeño en «no lo
//     sabes»; el estado guarda **solo lo que ha subido**, que es lo que hace que la
//     partida no crezca con el tamaño del mapa.
//   · **Dos vías de ascenso y ninguna más**: haber estado —las piernas— y que un rumor lo
//     nombre —la boca de otro—. Volver a un sitio ya conocido sube al último escalón, y el
//     último escalón es el último.
//   · **Durante la salida se apunta y no se aplica.** El libro de pendientes vive fuera del
//     estado, así que «el mapa no cambia durante la salida» es comprobable sin depender de
//     que nadie se acuerde de no pintar: no hay nada que pintar hasta el telón.

import { congelaHondo } from '../core/congelar.js';
import { campos, dic } from './formato.js';
import { exigeMapaId } from './pasos.js';

/**
 * La escalera, en orden y cerrada. Cuatro escalones y el último es el último: no hay
 * ninguna operación que suba por encima de «lo conoces bien» ni que baje de ningún sitio.
 */
export const NIVELES_DE_CONOCIMIENTO = congelaHondo(['no-lo-sabes', 'lo-ves', 'lo-conoces', 'lo-conoces-bien']);

/** El escalón más alto, que es donde se para todo. */
export const NIVEL_MAXIMO_DE_CONOCIMIENTO = NIVELES_DE_CONOCIMIENTO[NIVELES_DE_CONOCIMIENTO.length - 1];

/**
 * Cómo se dice cada escalón **en palabras del mundo**, que es lo único que sale a pantalla.
 * Ni porcentajes, ni kilómetros, ni un número de orden (`bucle-jugable.md` §8).
 */
export const PALABRAS_DEL_MUNDO = congelaHondo({
  'no-lo-sabes': 'no lo sabes',
  'lo-ves': 'lo ves',
  'lo-conoces': 'lo conoces',
  'lo-conoces-bien': 'lo conoces bien',
});

/** Las familias de elemento del mundo que tienen nivel, en orden estable. */
export const FAMILIAS_DE_ELEMENTO = congelaHondo(['bosque', 'calzada', 'costa', 'nucleo', 'paraje', 'pico', 'servicio']);

/**
 * El nivel con el que nace cada familia. **Lo decide la escala, no la partida**: lo que se
 * ve de lejos está dibujado desde el día uno y lo pequeño no está.
 */
export const NIVEL_DE_PARTIDA = congelaHondo({
  bosque: 'lo-ves',
  calzada: 'lo-ves',
  costa: 'lo-ves',
  nucleo: 'lo-ves',
  paraje: 'no-lo-sabes',
  pico: 'lo-ves',
  servicio: 'no-lo-sabes',
});

/** Las dos vías de ascenso, y ninguna más: con las piernas o con la boca de otro. */
export const VIAS_DE_ASCENSO = Object.freeze({ PIERNAS: 'piernas', BOCA: 'boca-de-otro' });

/** Las vías declaradas, en orden estable. */
export const IDS_DE_VIA_DE_ASCENSO = congelaHondo(Object.values(VIAS_DE_ASCENSO).slice().sort());

/**
 * Las tres tintas del entintado. Son las mismas que declara la miniatura de la portada
 * (`portada.js`, `TINTAS_DE_LA_MINIATURA`): un mapa y su miniatura no pueden hablar de
 * tintas distintas.
 */
export const TINTAS = congelaHondo(['de-hoy', 'asentado', 'a-lapiz']);

// El catálogo se comprueba a sí mismo al cargarse, como el de rangos y el de efectos: una
// familia sin nivel de partida saldría a pintar con `undefined` y el mapa entero se
// entintaría de lo no sabido sin que nada se pusiera rojo.
for (const familia of FAMILIAS_DE_ELEMENTO) {
  const nivel = NIVEL_DE_PARTIDA[familia];
  if (!NIVELES_DE_CONOCIMIENTO.includes(nivel)) {
    throw new Error(`la familia de elemento "${familia}" no declara nivel de partida: sin él, la escala no decidiría nada y el mapa nacería en blanco`);
  }
}

/** El nivel, o un error que **nombra el valor y enumera los cuatro**. */
export function exigeNivelDeConocimiento(nivel, quien = 'el nivel de conocimiento') {
  if (!NIVELES_DE_CONOCIMIENTO.includes(nivel)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(nivel) ?? String(nivel)}: la escalera es cerrada y sus cuatro escalones son ` +
      `${NIVELES_DE_CONOCIMIENTO.join(' < ')}`,
    );
  }
  return nivel;
}

/** La vía de ascenso, o un error que nombra la que llegó y enumera las dos. */
export function exigeViaDeAscenso(via, quien = 'la vía por la que sube un elemento') {
  if (!IDS_DE_VIA_DE_ASCENSO.includes(via)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(via) ?? String(via)}: se sube con las piernas o con la boca de otro, y las dos vías son ` +
      `${IDS_DE_VIA_DE_ASCENSO.join(', ')}`,
    );
  }
  return via;
}

/** El sitio de un escalón dentro de la escalera. Es lo único que se compara. */
export function ordenDeNivel(nivel) {
  return NIVELES_DE_CONOCIMIENTO.indexOf(exigeNivelDeConocimiento(nivel));
}

// --- La identidad de un elemento ---------------------------------------------
//
// `familia:identificador`, y la familia va delante a propósito: el nivel de partida se
// deriva de ella, así que una clave sin familia obligaría a volver al mundo para saber con
// qué nivel nace un elemento que no ha subido nunca — que es exactamente el dato que el
// estado no guarda.

const SEPARADOR = ':';

/** La clave de un elemento del mundo. La familia va delante y decide su nivel de partida. */
export function claveDeElemento({ familia, id }) {
  if (!FAMILIAS_DE_ELEMENTO.includes(familia)) {
    throw new Error(
      `"${familia}" no es una familia de elemento del mundo: las que tienen nivel son ${FAMILIAS_DE_ELEMENTO.join(', ')}`,
    );
  }
  if (typeof id !== 'string' && !Number.isInteger(id)) {
    throw new Error(`el elemento de familia "${familia}" llega sin identificador: llegó ${JSON.stringify(id) ?? String(id)}`);
  }
  return `${familia}${SEPARADOR}${id}`;
}

/** La familia de una clave, o un error que nombra la clave. */
export function familiaDeClave(clave) {
  if (typeof clave !== 'string' || !clave.includes(SEPARADOR)) {
    throw new Error(`"${JSON.stringify(clave) ?? String(clave)}" no es la clave de ningún elemento: se escribe familia${SEPARADOR}identificador`);
  }
  const familia = clave.slice(0, clave.indexOf(SEPARADOR));
  if (!FAMILIAS_DE_ELEMENTO.includes(familia)) {
    throw new Error(`la clave "${clave}" declara la familia "${familia}", que no es ninguna de las que tienen nivel (${FAMILIAS_DE_ELEMENTO.join(', ')})`);
  }
  return familia;
}

/** El identificador dentro de su familia: el nombre de un sitio, o el índice del terreno. */
export function idDeClave(clave) {
  familiaDeClave(clave);
  return clave.slice(clave.indexOf(SEPARADOR) + 1);
}

/**
 * Los elementos del mundo congelado que tienen nivel, en orden canónico y con su nombre
 * cuando lo tienen.
 *
 * Los sitios se identifican por su nombre, que es su identificador en toda la partida; el
 * terreno —picos, costa, bosques— y las calzadas, **por su sitio en el documento
 * congelado**, que es estable porque el documento no se regenera nunca. Un elemento de
 * terreno no sube de nivel por ninguna vía, así que su identificador no tiene que ser
 * legible: tiene que ser estable.
 */
export function elementosDelMundo(mundo) {
  if (!mundo || typeof mundo !== 'object') {
    throw new Error(`los elementos con nivel de conocimiento salen del mundo congelado y llegó ${JSON.stringify(mundo) ?? String(mundo)}`);
  }
  const salida = [];
  const mete = (familia, id, nombre) => salida.push({ clave: claveDeElemento({ familia, id }), familia, id: String(id), nombre: nombre ?? null });

  for (const s of mundo.settlements ?? []) {
    if (typeof s?.name !== 'string' || !s.name) {
      throw new Error('un núcleo del mundo llega sin nombre, y el nombre es su identificador: sin él no se puede saber qué se conoce');
    }
    mete('nucleo', s.name, s.name);
    for (const v of s.services ?? []) mete('servicio', v.name, v.name);
  }
  for (const p of mundo.parajes ?? []) mete('paraje', p.name, p.name);
  (mundo.routes ?? []).forEach((r, i) => mete('calzada', i, r?.name ?? null));
  const geo = mundo.geo ?? {};
  (geo.peaks ?? []).forEach((p, i) => mete('pico', i, p?.name ?? null));
  (geo.coastlines ?? []).forEach((_, i) => mete('costa', i, null));
  (geo.forests ?? []).forEach((_, i) => mete('bosque', i, null));
  return congelaHondo(salida);
}

// --- El estado ----------------------------------------------------------------

/**
 * El conocimiento de una partida recién creada: **ningún ascenso apuntado**.
 *
 * Vacío no significa que no se sepa nada: significa que todo está en el nivel que le da la
 * escala. Guardar un nivel por elemento haría crecer la partida con el mapa y duplicaría un
 * dato que el documento congelado ya determina.
 */
export function estadoDeConocimiento() {
  return { mapas: {} };
}

/** El área del conocimiento dentro del estado: por mapa, la clave del elemento y su nivel. */
export const ESQUEMA_CONOCIMIENTO = campos({ mapas: dic(dic('texto')) });

function exigeConocimiento(estado) {
  if (!estado || typeof estado !== 'object' || !estado.mapas || typeof estado.mapas !== 'object') {
    throw new Error('el estado de conocimiento llega mal formado: se espera lo que devuelve estadoDeConocimiento(), un objeto con "mapas"');
  }
  return estado;
}

function ascensosDeMapa(estado, mapaId) {
  const id = exigeMapaId(mapaId, 'el conocimiento de un mapa');
  const suyo = exigeConocimiento(estado);
  if (!suyo.mapas[id]) suyo.mapas[id] = {};
  return suyo.mapas[id];
}

/**
 * El nivel de un elemento: **el que ha subido, o el que le da la escala**.
 *
 * Es la única consulta de la capa y no lee el mundo: la familia va dentro de la clave
 * justamente para que preguntar por un elemento no obligue a tener el documento delante.
 */
export function nivelDe(estado, { mapaId, clave }) {
  const familia = familiaDeClave(clave);
  const subido = ascensosDeMapa(estado, mapaId)[clave];
  if (subido === undefined) return NIVEL_DE_PARTIDA[familia];
  return exigeNivelDeConocimiento(subido, `el nivel guardado de "${clave}"`);
}

/** El nivel de partida de un elemento, sin mirar la partida. Es función de la escala. */
export function nivelDePartidaDe(clave) {
  return NIVEL_DE_PARTIDA[familiaDeClave(clave)];
}

/**
 * A qué escalón lleva una vía desde un nivel dado, o `null` si no sube.
 *
 * Las piernas suben a «lo conoces» la primera vez y a «lo conoces bien» al volver; la boca
 * de otro rotula lo que no has pisado y llega hasta «lo conoces» y no más allá, porque su
 * historia y quién vive ahí no te los cuenta un rumor.
 */
export function ascensoPor(nivel, via) {
  const desde = ordenDeNivel(nivel);
  const conoces = NIVELES_DE_CONOCIMIENTO.indexOf('lo-conoces');
  if (exigeViaDeAscenso(via) === VIAS_DE_ASCENSO.BOCA) {
    return desde < conoces ? 'lo-conoces' : null;
  }
  if (desde < conoces) return 'lo-conoces';
  if (desde === conoces) return NIVEL_MAXIMO_DE_CONOCIMIENTO;
  return null;
}

// --- El libro de pendientes ---------------------------------------------------

/**
 * El libro de pendientes de una salida: lo que subiría, apuntado y **sin aplicar**.
 *
 * Vive fuera del estado a propósito. Es lo que hace comprobable «el mapa no cambia durante
 * la salida» sin depender de que nadie se acuerde de no pintar: mientras se anda no hay
 * nada que pintar porque el estado no se ha movido.
 */
export function libroDePendientes() {
  return { anotaciones: [] };
}

function exigeLibro(libro) {
  if (!libro || typeof libro !== 'object' || !Array.isArray(libro.anotaciones)) {
    throw new Error('el libro de pendientes llega mal formado: se espera lo que devuelve libroDePendientes(), un objeto con "anotaciones"');
  }
  return libro;
}

/**
 * Apunta un ascenso pendiente. **No cambia ningún nivel** y apuntarlo dos veces por la
 * misma vía deja una sola anotación: dar dos vueltas al mismo sitio en la misma salida no
 * es volver otro día.
 */
export function apuntaPendiente(libro, { clave, via }) {
  const suyo = exigeLibro(libro);
  familiaDeClave(clave);
  exigeViaDeAscenso(via, `la vía por la que se apunta "${clave}"`);
  if (!suyo.anotaciones.some((a) => a.clave === clave && a.via === via)) suyo.anotaciones.push({ clave, via });
  return suyo;
}

/** Apunta que se ha estado en un sitio. Es la vía de las piernas. */
export function apuntaHaberEstado(libro, { familia, id }) {
  return apuntaPendiente(libro, { clave: claveDeElemento({ familia, id }), via: VIAS_DE_ASCENSO.PIERNAS });
}

/** Apunta que un rumor ha nombrado un sitio. Es la vía de la boca de otro. */
export function apuntaLoNombradoPorUnRumor(libro, { familia, id }) {
  return apuntaPendiente(libro, { clave: claveDeElemento({ familia, id }), via: VIAS_DE_ASCENSO.BOCA });
}

/** Lo apuntado, en orden declarado —por clave y, dentro de ella, por vía— y no en el de llegada. */
export function pendientesDe(libro) {
  return congelaHondo(exigeLibro(libro).anotaciones.slice().sort(
    (a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : a.via < b.via ? -1 : a.via > b.via ? 1 : 0),
  ));
}

/** Cuántas anotaciones lleva la salida. Cero es una respuesta y es el día normal. */
export function cuantosPendientes(libro) {
  return exigeLibro(libro).anotaciones.length;
}

// --- El entintado, que llega de golpe ------------------------------------------

/**
 * Los ascensos que aplicaría el libro, **sin tocar nada**.
 *
 * Se calcula entero antes de escribir nada, que es la forma que exige el cierre a todo o
 * nada: un nivel corrupto en la tercera anotación no puede dejar dos elementos entintados.
 */
export function planDeEntintado(estado, { mapaId, libro }) {
  const id = exigeMapaId(mapaId, 'el entintado del mapa');
  exigeConocimiento(estado);
  const trabajo = {};
  const ascensos = [];
  for (const { clave, via } of pendientesDe(libro)) {
    const antes = trabajo[clave] ?? nivelDe(estado, { mapaId: id, clave });
    const escalon = ascensoPor(antes, via);
    if (escalon === null) continue;
    trabajo[clave] = escalon;
    // `antes` y `escalon`, y nunca `desde` y `hasta`: el registro de hechos rechaza esos dos
    // nombres de campo por privacidad —serían el camino de un sitio a otro— y llamar igual a
    // dos cosas distintas es cómo se acaba guardando la que no era.
    ascensos.push({ clave, familia: familiaDeClave(clave), nombre: idDeClave(clave), via, antes, escalon, palabra: PALABRAS_DEL_MUNDO[escalon] });
  }
  return congelaHondo({ mapa: id, ascensos, niveles: trabajo });
}

/**
 * Aplica el libro entero **de una vez**: todos los ascensos pendientes o ninguno.
 *
 * Es el momento en el que el mapa se entinta, y es el único: durante la salida esta función
 * no se llama, y por eso mirar el móvil andando no aporta nada.
 */
export function aplicaElEntintado(estado, { mapaId, libro }) {
  const plan = planDeEntintado(estado, { mapaId, libro });
  const ascensos = ascensosDeMapa(estado, plan.mapa);
  for (const clave of Object.keys(plan.niveles).sort()) ascensos[clave] = plan.niveles[clave];
  return plan.ascensos;
}

/**
 * Sube un elemento a un nivel concreto, sin pasar por el libro. Es lo que usa la
 * reconstrucción desde el registro, donde el hecho ya dice a qué escalón se llegó.
 *
 * **Nunca baja**: un hecho reproducido dos veces, o dos hechos en desorden, dejan el
 * escalón más alto de los dos, que es la propiedad de esta capa.
 */
export function subeA(estado, { mapaId, clave, escalon }) {
  familiaDeClave(clave);
  exigeNivelDeConocimiento(escalon, `el nivel al que sube "${clave}"`);
  const antes = nivelDe(estado, { mapaId, clave });
  if (ordenDeNivel(escalon) <= ordenDeNivel(antes)) return antes;
  ascensosDeMapa(estado, mapaId)[clave] = escalon;
  return escalon;
}

/**
 * La tinta de un elemento: **tres y ninguna más**, y sin leyenda que las explique.
 *
 * La correspondencia entre cuatro niveles y tres tintas es de esta capa y va escrita como
 * dato: subió hoy → la de hoy; «lo conoces» o «lo conoces bien» sin subir hoy → la de lo
 * sabido; «lo ves» o «no lo sabes» → la de lo no sabido, a lápiz. Con una tinta por nivel
 * habría que explicar en el mapa la diferencia entre los dos escalones altos, que es
 * exactamente la leyenda que `bucle-jugable.md` §8 prohíbe.
 */
export function tintaDe(estado, { mapaId, clave, deHoy = [] }) {
  if (deHoy.includes(clave)) return 'de-hoy';
  return ordenDeNivel(nivelDe(estado, { mapaId, clave })) >= ordenDeNivel('lo-conoces') ? 'asentado' : 'a-lapiz';
}

/**
 * La tinta de cada elemento del mundo, en orden canónico. Es lo que el render consume para
 * llenar la capa reservada, y **no lleva ningún nivel dentro**: el mapa enseña tres tintas,
 * no cuatro escalones.
 */
export function entintadoDelMundo(estado, { mapaId, mundo, ascensos = [] }) {
  const deHoy = ascensos.map((a) => (typeof a === 'string' ? a : a.clave));
  return congelaHondo(elementosDelMundo(mundo).map((e) => ({
    clave: e.clave,
    familia: e.familia,
    id: e.id,
    tinta: tintaDe(estado, { mapaId, clave: e.clave, deHoy }),
  })));
}

// --- Serialización -------------------------------------------------------------

/** El conocimiento en documento: por mapa y por clave, en orden declarado. */
export function congelaConocimiento(estado) {
  const suyo = exigeConocimiento(estado);
  const mapas = {};
  for (const mapaId of Object.keys(suyo.mapas).sort()) {
    const ascensos = {};
    for (const clave of Object.keys(suyo.mapas[mapaId]).sort()) {
      familiaDeClave(clave);
      ascensos[clave] = exigeNivelDeConocimiento(suyo.mapas[mapaId][clave], `el nivel guardado de "${clave}"`);
    }
    mapas[mapaId] = ascensos;
  }
  return { mapas };
}

/** El conocimiento de vuelta de su documento, elemento a elemento y sin perder ninguno. */
export function levantaConocimiento(doc) {
  const estado = estadoDeConocimiento();
  for (const mapaId of Object.keys(doc?.mapas ?? {}).sort()) {
    const guardados = doc.mapas[mapaId] ?? {};
    const ascensos = {};
    for (const clave of Object.keys(guardados).sort()) {
      familiaDeClave(clave);
      ascensos[clave] = exigeNivelDeConocimiento(guardados[clave], `el nivel guardado de "${clave}" en el mapa ${mapaId}`);
    }
    estado.mapas[mapaId] = ascensos;
  }
  return estado;
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión:
//
//   · No hay ninguna función que devuelva cuánto mapa llevas descubierto, ni en
//     porcentaje ni en cuenta de elementos. Un recuento sobre el total es la barra de
//     progreso que `bucle-jugable.md` §8 se niega a tener, solo que sin pintar.
//   · No hay ninguna operación que baje un nivel ni que lo olvide.
//   · El casting no pasa por aquí, y es requisito: lo descubierto afecta a **lo que ves**,
//     nunca a **lo que existe** (RF-QUEST-002, `bucle-jugable.md` §1).
