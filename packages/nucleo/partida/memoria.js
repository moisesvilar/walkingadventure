// La memoria de una cara: corta, fiel y gratis.
//
// Es la mejor pieza de la capa de NPCs y la que hace posible triangular. En un
// mundo donde todo lo que se cuenta llega deformado, **el testigo es la única
// fuente de verdad** (`game-design/npcs.md` §2): guarda solo los hechos en los que
// fue rol, los guarda en **versión nivel 0**, y te los cuenta sin cobrarte nada.
//
// Y guarda **hechos estructurados, nunca prosa**, con los ejes cerrados de
// SPEC-012 intactos y sin transformar. Con la versión guardada como texto,
// comprobar «el testigo es fiel» exigiría un LLM delante, que es exactamente lo
// que la batería `@nucleo` no puede tener (`quests.md` decisión 1).
//
// Las dos direcciones están cerradas a propósito y son la mitad del valor de la
// fila: **la memoria no se actualiza nunca con lo que circula por el pueblo**, y
// consultar a la cara **no toca lo sedimentado en su núcleo**. Búscalo, no está:
// aquí no hay ninguna función que reciba una versión que llegó a un núcleo.

import { congelaHondo } from '../core/congelar.js';
import { exigeHechos, exigeSigno } from './deformacion.js';
import { exigeMapaId } from './pasos.js';
import { caraDeClave, claveDeCara, exigeCara } from './puestos.js';

/**
 * Cuántos hechos recuerda una cara. Cinco es «corta» en el sentido del diseño —lo
 * que se puede recordar y volver a preguntar— y encaja con el tamaño del reparto:
 * nueve personas en un mundo de paseo, con lo suyo cada una.
 */
export const TOPE_DE_MEMORIA = 5;

/** El nivel en el que un testigo guarda lo que vivió, y el único que guarda. */
export const NIVEL_DEL_TESTIGO = 0;

/**
 * Lo que las caras de una partida recuerdan: un registro por mapa y nada más.
 *
 * Viaja con la partida y **nunca dentro del documento congelado de una celda**: el
 * documento describe el mundo, que no cambia porque alguien recuerde algo. Y va por
 * mapa porque las caras cuelgan de sitios de un mapa concreto, y dos mapas no
 * comparten sitios (`npcs.md`, y RF-PROG-003 para el rango).
 */
export function estadoDeMemorias() {
  return { mapas: {} };
}

/** El registro de un mapa dentro del estado, creándolo si es la primera vez. */
export function memoriasDeMapa(estado, mapaId) {
  const id = exigeMapaId(mapaId, 'la memoria de las caras');
  if (!estado || typeof estado !== 'object' || !estado.mapas || typeof estado.mapas !== 'object') {
    throw new Error('el estado de memorias llega mal formado: se espera lo que devuelve estadoDeMemorias(), un objeto con "mapas"');
  }
  if (!Object.prototype.hasOwnProperty.call(estado.mapas, id)) estado.mapas[id] = {};
  return estado.mapas[id];
}

/**
 * Un hecho recordable, ya normalizado: lo que ocurrió, en su versión fiel, y **con
 * quiénes fueron rol dentro**.
 *
 * Los dos rechazos son los que impiden que la memoria se llene de cosas que no
 * sostienen la triangulación: **sin versión fiel** —sin hechos estructurados o con
 * un nivel que no sea el 0— falla nombrando el hecho, en vez de guardar lo que le
 * llegó a alguien; y quien no participó no puede recordarlo, que se comprueba al
 * escribir.
 *
 * @param {object} hecho
 *   `id` la identidad del suceso, la misma con la que nace el rumor; `hechos` la
 *   versión fiel de `hechosFieles()`; `signo` el del acto; `origen` el núcleo donde
 *   ocurrió; `caras` quiénes fueron rol; `plantilla`, si salió de una.
 */
export function hechoRecordado({ id, hechos, signo, origen = null, caras = [], plantilla = null, nivel = NIVEL_DEL_TESTIGO }) {
  if (typeof id !== 'string' || !id) {
    throw new Error(`un hecho sin identidad no se puede recordar: llegó ${JSON.stringify(id) ?? String(id)}, y sin ella no se sabe de qué está hablando la cara`);
  }
  if (nivel !== NIVEL_DEL_TESTIGO) {
    throw new Error(
      `el hecho "${id}" se intenta guardar en nivel ${JSON.stringify(nivel) ?? String(nivel)} y un testigo solo guarda el ${NIVEL_DEL_TESTIGO}: ` +
      'lo que guarda es lo que vivió, no lo que le llegó contado',
    );
  }
  const fieles = exigeHechos(hechos, `la versión fiel del hecho "${id}"`);
  const elSigno = exigeSigno(signo, `el signo del hecho "${id}"`);
  if (!Array.isArray(caras) || caras.length === 0) {
    throw new Error(`el hecho "${id}" no dice qué caras fueron rol en él: sin eso no se puede saber quién puede recordarlo y quién no`);
  }
  const quienes = caras.map((c) => exigeCara(c, `una de las caras que fueron rol en el hecho "${id}"`));
  return congelaHondo({
    id,
    plantilla,
    origen,
    nivel: NIVEL_DEL_TESTIGO,
    signo: elSigno,
    hechos: fieles,
    caras: quienes,
  });
}

// El orden de desalojo: **por paso del mundo** y no por orden de llegada, que es lo
// único que lo hace independiente del orden en que se cerraron las salidas —la
// misma paranoia que rige la clave de generación de una cara—. La identidad
// desempata para que dos hechos del mismo paso tengan un orden declarado.
const masViejo = (a, b) => (a.n !== b.n ? a.n - b.n : a.hecho.id < b.hecho.id ? -1 : a.hecho.id > b.hecho.id ? 1 : 0);

/**
 * Lo que una cara recordaría al guardar un hecho, **sin tocar nada**: la lista
 * completa que quedaría, ya con el tope aplicado.
 *
 * Existe para que el cierre de una salida se aplique entero o no se aplique: quien
 * llama calcula todas las memorias primero y escribe después, así que un hecho que
 * no encaje no deja media partida escrita.
 */
export function planDeRecuerdo(estado, { mapaId, cara, hecho, n = 0 }) {
  const registro = memoriasDeMapa(estado, mapaId);
  const { sitio, puesto } = exigeCara(cara, 'la cara que recuerda');
  const clave = claveDeCara({ sitio, puesto });
  if (!hecho.caras.some((c) => c.sitio === sitio && c.puesto === puesto)) {
    throw new Error(
      `la cara "${puesto}" de "${sitio}" no fue rol en el hecho "${hecho.id}" y no puede recordarlo: ` +
      'un testigo guarda lo que vivió, y lo que no vivió le llega por rumor como a todo el mundo',
    );
  }
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`el paso en el que la cara "${puesto}" de "${sitio}" recuerda el hecho "${hecho.id}" llega como ${JSON.stringify(n) ?? String(n)}: los pasos son enteros no negativos`);
  }
  const actuales = (registro[clave] ?? []).filter((e) => e.hecho.id !== hecho.id);
  const lista = [...actuales, { hecho, n }].sort(masViejo);
  // Al desbordar se olvida el más antiguo por paso del mundo y la memoria se queda
  // en su tope: no crece, y lo que sale es lo de más atrás.
  return { clave, lista: lista.slice(Math.max(0, lista.length - TOPE_DE_MEMORIA)) };
}

/** Guarda un hecho en la memoria de una cara. Aplica el plan que acaba de calcular. */
export function recuerda(estado, { mapaId, cara, hecho, n = 0 }) {
  const registro = memoriasDeMapa(estado, mapaId);
  const { clave, lista } = planDeRecuerdo(estado, { mapaId, cara, hecho, n });
  registro[clave] = lista;
  return congelaHondo(lista.slice());
}

/**
 * Lo que una cara recuerda: **hechos estructurados en nivel 0** y ningún texto
 * redactado. Una cara sin nada que recordar devuelve la lista vacía, que no es un
 * error: no haber estado en nada es una respuesta.
 */
export function loQueRecuerda(estado, { mapaId, cara }) {
  const registro = memoriasDeMapa(estado, mapaId);
  const clave = claveDeCara(exigeCara(cara, 'la cara a la que se pregunta'));
  return congelaHondo((registro[clave] ?? []).map((e) => e.hecho));
}

/**
 * La consulta al testigo: lo que vivió, fiel, y **gratis**.
 *
 * El precio va dentro como dato y en cero a propósito. `progresion.md` engancha por
 * aquí: un informante te **vende** lo que oyó, deformado; un testigo te **cuenta**
 * lo que vivió, fiel, porque ya lo compartisteis. Que el cero esté declarado es lo
 * que permite afirmarlo sin leer el catálogo de informantes, que es de otra fila.
 */
export function consultaAlTestigo(estado, { mapaId, cara }) {
  const hechos = loQueRecuerda(estado, { mapaId, cara });
  return congelaHondo({
    cara: exigeCara(cara, 'la cara a la que se pregunta'),
    gratis: true,
    coste: { oro: 0 },
    nivel: NIVEL_DEL_TESTIGO,
    hechos,
  });
}

/** Las memorias en forma serializable, con mapas y caras en **orden declarado**. */
export function congelaMemorias(estado) {
  const mapas = {};
  for (const mapaId of Object.keys(estado?.mapas ?? {}).sort()) {
    const registro = estado.mapas[mapaId];
    const caras = [];
    for (const clave of Object.keys(registro).sort()) {
      const lista = registro[clave];
      if (!lista.length) continue;
      const { sitio, puesto } = caraDeClave(clave);
      caras.push({
        sitio,
        puesto,
        memoria: lista.map((e) => ({
          n: e.n,
          hecho: {
            id: e.hecho.id,
            plantilla: e.hecho.plantilla,
            origen: e.hecho.origen,
            nivel: e.hecho.nivel,
            signo: e.hecho.signo,
            hechos: e.hecho.hechos,
            caras: e.hecho.caras.map((c) => ({ sitio: c.sitio, puesto: c.puesto })),
          },
        })),
      });
    }
    mapas[mapaId] = { caras };
  }
  return { mapas };
}

/** Las memorias de vuelta de su documento, con su nivel y su tope intactos. */
export function levantaMemorias(doc) {
  const estado = estadoDeMemorias();
  for (const mapaId of Object.keys(doc?.mapas ?? {}).sort()) {
    const registro = memoriasDeMapa(estado, mapaId);
    for (const guardada of doc.mapas[mapaId]?.caras ?? []) {
      const clave = claveDeCara(exigeCara(guardada, `una cara guardada del mapa ${mapaId}`));
      const lista = (guardada.memoria ?? []).map((e) => ({ n: e.n, hecho: hechoRecordado(e.hecho) })).sort(masViejo);
      if (lista.length > TOPE_DE_MEMORIA) {
        throw new Error(`la memoria guardada de la cara "${guardada.puesto}" de "${guardada.sitio}" trae ${lista.length} hechos y el tope son ${TOPE_DE_MEMORIA}`);
      }
      registro[clave] = lista;
    }
  }
  return estado;
}
