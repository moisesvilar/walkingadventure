// La forma de una aventura casteada: la cadena de beats con su lugar, su
// disparador, su escena y su resultado, más el guiado y el presupuesto.
//
// Vive aparte del motor porque la consumen agentes distintos —la lista de
// aventuras, el mapa en marcha y la escena de cada beat son tres filas del
// checklist— y porque es aquí donde se comprueba que una plantilla está bien
// escrita antes de gastar un solo camino del grafo en ella.
//
// Todo lo que hay aquí es **esqueleto**: lugares, disparadores, franjas,
// resultados y lazo. Ninguno lo escribe el LLM y por eso la estructura es idéntica
// con red y sin ella (`game-design/quests.md` decisión 1). Los textos que viajan
// son los de la plantilla, tal cual, y este módulo no redacta ninguno.

import { congelaHondo } from '../core/congelar.js';
import { IDS_DE_TAMANO } from '../partida/salida.js';

/** Los tres tipos de disparador de `game-design/quests.md` §2. No hay un cuarto. */
export const DISPARADORES = Object.freeze(['llegada', 'franja', 'con_objeto']);

/** Lo que un beat produce y empuja al siguiente: `quests.md` §2, «resultado». */
export const RESULTADOS = Object.freeze(['informacion', 'objeto', 'estado']);

/**
 * Las franjas del mundo, en minutos desde medianoche.
 *
 * Son del **beat** y no de ninguna persona del reparto (`npcs.md` §3): nadie ficha
 * ni se va a dormir, así que una cita al caer la tarde es una propiedad de la
 * escena. Y llegar fuera de la franja no cancela nada: cambia la variante de
 * escena y ya, que es la regla de la casa aplicada al tiempo.
 */
export const FRANJAS = congelaHondo([
  { id: 'manana', desdeMin: 6 * 60, hastaMin: 12 * 60 },
  { id: 'mediodia', desdeMin: 12 * 60, hastaMin: 16 * 60 },
  { id: 'tarde', desdeMin: 16 * 60, hastaMin: 20 * 60 },
  { id: 'atardecer', desdeMin: 20 * 60, hastaMin: 22 * 60 },
  // La única que cruza la medianoche, y la única que el horario diurno deja fuera.
  { id: 'noche', desdeMin: 22 * 60, hastaMin: 6 * 60 },
]);

/** Los identificadores válidos, en el orden del catálogo. */
export const IDS_DE_FRANJA = congelaHondo(FRANJAS.map((f) => f.id));

/**
 * El horario diurno: la franja permitida que llega **activada de origen**
 * (`game-design/seguridad-privacidad.md`, «no se ofrecen salidas de noche»).
 *
 * Se exporta como franja y no como booleano porque eso es lo que el casting
 * recibe: un booleano escondería la hora dentro del motor, y entonces el ajuste
 * de las filas 27 y 38 no podría moverla. Quien lo desactive pasa `null`.
 */
export const FRANJA_DIURNA = Object.freeze({ desdeMin: 6 * 60, hastaMin: 22 * 60 });

/** La franja del catálogo con ese identificador. Falla enumerando las válidas. */
export function franjaDe(id) {
  const encontrada = FRANJAS.find((f) => f.id === id);
  if (!encontrada) {
    throw new Error(`franja desconocida ${JSON.stringify(id)}: las declaradas son ${IDS_DE_FRANJA.join(', ')}`);
  }
  return encontrada;
}

/**
 * Si una franja cabe entera dentro de la permitida.
 *
 * `permitida` a `null` es el horario diurno desactivado y entonces cabe cualquiera.
 * Una franja que cruza la medianoche no cabe en ninguna ventana de un solo día, y
 * eso es exactamente lo que hace que `noche` no castee con el ajuste encendido.
 */
export function franjaCabeEn(franja, permitida) {
  if (permitida == null) return true;
  if (franja.hastaMin <= franja.desdeMin) return false;
  return franja.desdeMin >= permitida.desdeMin && franja.hastaMin <= permitida.hastaMin;
}

const TIPOS_DE_ROL = Object.freeze(['servicio', 'nucleo', 'paraje', 'humano']);

/** Los tipos de rol que una plantilla puede declarar, para poder enumerarlos al fallar. */
export { TIPOS_DE_ROL };

/**
 * Comprueba que una plantilla está bien escrita, y falla nombrando qué le pasa.
 *
 * Es validación de **construcción**, no de mundo: una plantilla mal escrita no es
 * un mundo pobre, es un error de quien la escribió, y devolver un motivo de
 * catálogo lo mezclaría con los fallos que sí miden la salud del generador.
 *
 * @returns el orden de resolución de roles, declarado.
 */
export function validaPlantilla(plantilla) {
  const id = plantilla?.id ?? '(sin id)';
  if (!plantilla || typeof plantilla !== 'object') {
    throw new Error(`la plantilla ${JSON.stringify(plantilla)} no es una plantilla`);
  }
  if (!IDS_DE_TAMANO.includes(plantilla.tamano)) {
    throw new Error(
      `la plantilla "${id}" declara el tamaño ${JSON.stringify(plantilla.tamano)}, que no existe: ` +
      `los tres declarados son ${IDS_DE_TAMANO.join(', ')}`,
    );
  }
  const roles = plantilla.roles ?? {};
  for (const rid of Object.keys(roles)) {
    const tipo = roles[rid]?.tipo;
    if (!TIPOS_DE_ROL.includes(tipo)) {
      throw new Error(
        `la plantilla "${id}" declara el rol "${rid}" de tipo ${JSON.stringify(tipo)}, que no existe: ` +
        `los declarados son ${TIPOS_DE_ROL.join(', ')}`,
      );
    }
    if (tipo === 'humano' && !roles[rid].en) {
      throw new Error(`el rol humano "${rid}" de la plantilla "${id}" no dice en qué sitio trabaja: un NPC hereda el anclaje del suyo y nunca consume uno propio`);
    }
  }

  // El orden de resolución **se declara**. Sacarlo de `Object.keys` lo hacía
  // depender del orden de escritura del objeto, que es exactamente el patrón que
  // `CLAUDE.md` prohíbe: funciona por accidente y eso no es determinismo.
  const orden = plantilla.orden;
  if (!Array.isArray(orden) || orden.length !== Object.keys(roles).length) {
    throw new Error(
      `la plantilla "${id}" no declara el orden de resolución de sus roles: "orden" tiene que listar ` +
      `los ${Object.keys(roles).length} roles y llegó ${JSON.stringify(orden)}`,
    );
  }
  for (const rid of orden) {
    if (!Object.prototype.hasOwnProperty.call(roles, rid)) {
      throw new Error(`la plantilla "${id}" declara en su orden el rol "${rid}", que no está entre sus roles`);
    }
  }
  if (new Set(orden).size !== orden.length) {
    throw new Error(`la plantilla "${id}" repite algún rol en su orden de resolución: ${orden.join(', ')}`);
  }

  const beats = plantilla.beats ?? [];
  if (!Array.isArray(beats) || beats.length === 0) {
    throw new Error(`la plantilla "${id}" no tiene cadena de beats`);
  }
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (!Object.prototype.hasOwnProperty.call(roles, b.rol)) {
      throw new Error(`el beat ${i + 1} de la plantilla "${id}" usa el rol huérfano "${b.rol}", que no está declarado en sus roles`);
    }
    const disparador = b.disparador;
    if (!disparador || !DISPARADORES.includes(disparador.tipo)) {
      throw new Error(
        `el beat ${i + 1} de la plantilla "${id}" declara el disparador ${JSON.stringify(disparador?.tipo)}: ` +
        `los tres válidos son ${DISPARADORES.join(', ')}`,
      );
    }
    if (disparador.tipo === 'franja') franjaDe(disparador.franja);
    if (disparador.tipo === 'con_objeto') {
      if (!disparador.objeto) {
        throw new Error(`el beat ${i + 1} de la plantilla "${id}" dispara con objeto y no dice cuál`);
      }
      // Un objeto es una llave, no un requisito (`npcs.md`, «lo que ya gobierna
      // cuatro sistemas»). Si la estructura permitiera el beat sin salida, la
      // garantía dependería de que quien escriba la plantilla se acuerde.
      // Lo que se exige es **la declaración**, no su redacción: el texto de la vía
      // alternativa es fallback de plantilla y podría venir de otro sitio, pero que
      // la vía exista es estructura y por eso se comprueba aquí.
      if (!disparador.viaAlternativa || typeof disparador.viaAlternativa !== 'object') {
        throw new Error(
          `el beat ${i + 1} de la plantilla "${id}" dispara con el objeto "${disparador.objeto}" y no declara otra manera ` +
          'de resolverse sin él: un objeto es una llave y no un requisito',
        );
      }
    }
    if (!b.resultado || !RESULTADOS.includes(b.resultado.tipo)) {
      throw new Error(
        `el beat ${i + 1} de la plantilla "${id}" declara el resultado ${JSON.stringify(b.resultado?.tipo)}: ` +
        `los tres válidos son ${RESULTADOS.join(', ')}`,
      );
    }
    if (!b.escena) throw new Error(`el beat ${i + 1} de la plantilla "${id}" no declara escena`);
  }
  return orden;
}

/**
 * El guiado de un beat: a dónde vas, por qué calzadas y dónde cae la marca.
 *
 * Ni una cifra: nada de distancia, de tiempo, de ritmo ni de progreso
 * (`game-design/quests.md` decisión 2, «el texto ambienta, el mapa confirma»). Los
 * nombres son los que produjo el paquete de idioma del mundo, y un tramo sin
 * nombre propio simplemente no se nombra: inventarle uno sería prometer un camino
 * que nadie ha comprobado.
 */
export function guiadoDeBeat({ destino, tramos }) {
  const calzadas = [];
  for (const t of tramos ?? []) {
    const nombre = t.nombre ?? null;
    if (!nombre) continue;
    if (calzadas[calzadas.length - 1] === nombre) continue;
    calzadas.push(nombre);
  }
  return {
    destino: destino.nombre,
    calzadas,
    marca: { x: destino.x, y: destino.y, tipo: destino.tipo, nombre: destino.nombre },
  };
}

/**
 * Un beat ya casteado: lugar, disparador, escena y resultado, y los cuatro
 * presentes siempre.
 *
 * El resultado apunta al beat siguiente **por su número** y el último no apunta a
 * ninguno: eso es lo que hace de la cadena una cadena y no un grafo, que es lo que
 * `quests.md` §2 pide para la primera iteración.
 */
export function beatCasteado({ n, plantillaBeat, lugar, escenaDelLugar, siguiente, tramos }) {
  const disparador = { tipo: plantillaBeat.disparador.tipo };
  if (disparador.tipo === 'franja') {
    const franja = franjaDe(plantillaBeat.disparador.franja);
    // La franja viaja entera con el beat, con sus minutos: llegar dentro cambia la
    // variante de escena y llegar fuera resuelve el beat igual, así que quien pinta
    // la escena necesita saber cuál era y nadie necesita saber si se llegó a tiempo
    // para decidir si el beat ocurre.
    disparador.franja = { id: franja.id, desdeMin: franja.desdeMin, hastaMin: franja.hastaMin };
    disparador.variantes = { dentro: plantillaBeat.disparador.variante ?? null, fuera: null };
  }
  if (disparador.tipo === 'con_objeto') {
    disparador.objeto = plantillaBeat.disparador.objeto;
    disparador.viaAlternativa = { texto: plantillaBeat.disparador.viaAlternativa.texto ?? null };
  }
  return {
    n,
    rol: plantillaBeat.rol,
    lugar,
    disparador,
    escena: {
      tipo: plantillaBeat.escena,
      // Qué afinidad del lugar sostiene esta escena. En un paraje es la que casó
      // con el peso pedido; en un servicio o un núcleo no hay ninguna que anotar.
      afinidadUsada: escenaDelLugar ?? null,
      texto: plantillaBeat.texto,
    },
    resultado: {
      tipo: plantillaBeat.resultado.tipo,
      ...(plantillaBeat.resultado.objeto ? { objeto: plantillaBeat.resultado.objeto } : {}),
      siguienteBeat: siguiente,
    },
    guiado: guiadoDeBeat({ destino: lugar, tramos }),
  };
}
