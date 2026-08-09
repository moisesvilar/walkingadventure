// La repisa, A6P5: **lo que se te ha quedado, de quién vino y de qué día**, y debajo
// los motes, que son lo único parecido a una ficha de personaje en todo el juego.
//
// La repisa **no es un inventario**, y esta pieza gasta código en afirmarlo: no hay
// peso, no hay huecos, no hay nada que tirar y no hay orden que gestionar. No es una
// regla que haya que vigilar al pintar — es que aquí no sale ninguna de esas cosas, ni
// hay dónde escribirla (`progresion.md` §4, y la misma decisión que cierra `objetos.js`).
//
// Los motes van **debajo y en la misma columna**: separarlos en otra pantalla los
// convertiría en un perfil, y ponerlos arriba, en el marcador de reputación que
// `progresion.md` §1 descarta. Y son **los del mapa activo**, porque el rango no viaja
// (`alcance-del-mundo.md` §3): en un mapa nuevo vuelves a ser forastera.
//
// Se compone preguntando **núcleo a núcleo**, con la consulta que SPEC-015 sí ofrece, y
// no abriendo la de todos los motes de un mapa a la vez que aquella spec se niega a
// tener. Esto es una proyección de lectura y **ninguna regla del juego bifurca por
// ella**, que es exactamente el motivo por el que aquella consulta no existe.
//
// Deuda anotada, para que no pase por descuido: el nombre visible de un objeto y el de
// un mote se leen de **su identificador**, porque SPEC-015 no guarda ningún otro —la
// plantilla conoce el nombre acentuado en el resultado de su beat y no lo persiste—.
// Escribir aquí un catálogo de nombres sería una segunda fuente del mismo dato.

import { congelaHondo } from '../core/congelar.js';
import { REGISTROS, coloca, textoConRegistro } from '../lenguaje/registro.js';
import { objetosDe } from './objetos.js';
import { moteEn, motesDeMapa } from './motes.js';
import { loQueSeCuentaEn } from './nucleos.js';
import { saldoDe } from './oro.js';
import { exigeMapaId } from './pasos.js';
import { exigeMapaDeNucleos } from './rango.js';

/** El sitio del juego en el que vive esta pantalla. Habla como mundo, como todo el bucle. */
export const SITIO = 'repisa';

/** El momento del bucle que declara la pantalla. Las dos de consulta declaran el mismo. */
export const MOMENTO = 'de-consulta';

/** Los localizadores de A6P5. Los consume la pantalla y no se inventa ninguno. */
export const TESTIDS = congelaHondo({
  momento: 'momento',
  objetos: 'repisa-objetos',
  objeto: 'repisa-objeto',
  motes: 'repisa-motes',
  mote: 'repisa-mote',
  oro: 'repisa-oro',
});

/**
 * Lo que la repisa **no** tiene, nombrado para que su ausencia se pueda poner roja.
 *
 * No es documentación: es la otra mitad del vocabulario. Los tres gestos de un
 * inventario —pulsación larga, deslizar para borrar, arrastrar para ordenar— no están
 * conectados a nada, y las cuatro acciones no existen. Una de estas que apareciera en
 * la proyección sería un rediseño con nombre y apellidos.
 */
export const LO_QUE_LA_REPISA_NO_TIENE = congelaHondo([
  'peso',
  'huecos',
  'tirar',
  'equipar',
  'ordenar',
  'combinar',
  'descartar',
  'pestanas',
  'secciones-plegables',
  'barra-de-reputacion',
  'escalones-por-nucleo',
  'numero-junto-a-un-pueblo',
  'oro-ganado',
  'icono',
  'miniatura',
  'contador',
  'casilla',
]);

/**
 * Las cifras que la repisa no enseña. El día sí es una cifra y sí se enseña —es la
 * mitad de RF-PROG-007, «de quién viene y de qué día»—, y el saldo también, porque el
 * oro es una moneda que se gasta (`progresion.md` §2). Ninguna de estas otras.
 */
export const CIFRAS_QUE_LA_REPISA_NO_ENSENA = congelaHondo(['distancia', 'tiempo', 'ritmo', 'pasos', 'progreso']);

/**
 * Cómo apareció un objeto, en **enumerado cerrado**. Ninguno queda en blanco: un
 * hallazgo de cuneta no tiene cara detrás y aun así declara cómo llegó.
 */
export const MANERAS_DE_APARECER = congelaHondo(['de-alguien', 'de-un-sitio', 'de-una-salida', 'de-camino']);

/**
 * Los textos propios de la pantalla, **en voz de mundo**.
 *
 * La línea del oro no está aquí: se compone en tiempo de ejecución a partir del saldo,
 * porque escribir la cifra a mano es exactamente lo que convierte una moneda en un
 * marcador. Y los dos huecos dicen que no hay nada **sin explicar por qué**: explicarlo
 * sería la voz de aplicación asomando en el bucle.
 */
export const TEXTOS = congelaHondo({
  volver: '‹ Volver',
  titulo: 'La repisa',
  motes: 'Y cómo te llaman',
  sinObjetos: 'Todavía no se te ha quedado nada de lo que has hecho.',
  sinMotes: 'Por aquí todavía no te llaman de ninguna manera.',
});

/** El nombre visible de un identificador escrito en palabras. Ver la deuda de la cabecera. */
function enPalabras(id) {
  return String(id).split('-').join(' ');
}

/** Lo mismo, con la primera en mayúscula: los objetos se rotulan y los motes no. */
function comoTitulo(id) {
  const palabras = enPalabras(id);
  return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

/**
 * De dónde viene un objeto, en clave y en texto.
 *
 * Un objeto **sin procedencia declarada falla nombrándolo**, en lugar de pintar media
 * línea: RF-PROG-007 pide que cada uno diga de quién viene y de qué día, y una línea a
 * medias cumple el criterio por fuera y lo incumple por dentro.
 *
 * `caras` resuelve la cara que hay detrás, si la hay. Se inyecta y no se supone: sin
 * ella todos los objetos dirían cómo aparecieron y ninguno de quién viene, que es la
 * forma de fallo de §6h —una pieza que, al no estar, no protesta—. Quien no tenga
 * caras que resolver pasa `SIN_CARAS` **por escrito**.
 */
export function procedenciaLegible(objeto, caras) {
  const suyas = exigeCaras(caras, `la procedencia del objeto "${objeto?.id ?? '(sin id)'}"`);
  if (!objeto?.procedencia) {
    throw new Error(
      `el objeto "${objeto?.id ?? '(sin id)'}" no declara de dónde viene, y la repisa lo enseña: RF-PROG-007 pide que cada objeto diga ` +
      'de quién viene y de qué día, así que se falla nombrándolo en lugar de pintar una línea a medias',
    );
  }
  const { desenlace = null, lugar = null } = objeto.procedencia;
  const nombre = suyas.nombreDe(objeto.procedencia) ?? null;
  if (nombre != null) {
    if (typeof nombre !== 'string' || !nombre) {
      throw new Error(`la cara que resuelve la procedencia del objeto "${objeto.id}" llega como ${JSON.stringify(nombre)}: es un nombre, o nada`);
    }
    return congelaHondo({ manera: 'de-alguien', quien: nombre, texto: `de ${nombre}` });
  }
  if (lugar) return congelaHondo({ manera: 'de-un-sitio', quien: null, texto: `de ${lugar}` });
  if (desenlace) return congelaHondo({ manera: 'de-una-salida', quien: null, texto: 'de una salida' });
  // Sin cara, sin sitio y sin salida: el hallazgo de cuneta. Declara cómo apareció y no
  // queda en blanco, que es lo que pide el criterio.
  return congelaHondo({ manera: 'de-camino', quien: null, texto: 'de camino' });
}

/** Quien no tenga caras que resolver. Se pasa por escrito, igual que `SIN_OBJETOS`. */
export const SIN_CARAS = congelaHondo({ nombreDe: () => null });

/** La resolución de caras, exigida. Una mal formada falla nombrando lo que llegó. */
export function exigeCaras(caras, quien = 'la repisa') {
  if (!caras || typeof caras.nombreDe !== 'function') {
    throw new Error(
      `${quien} necesita con qué resolver de quién viene un objeto —{ nombreDe(procedencia) → nombre | null }— o SIN_CARAS por escrito: ` +
      `llegó ${JSON.stringify(caras) ?? String(caras)}, y sin ella ningún objeto diría de quién viene sin que nada protestara`,
    );
  }
  return caras;
}

// El orden de la repisa: **del más reciente al más antiguo por el día**, y dentro del
// mismo día por identidad. El desempate está declarado porque dos objetos obtenidos el
// mismo día son un caso corriente y el orden de llegada no puede decidirlo.
const delUltimoAlPrimero = (a, b) => (a.dia !== b.dia ? b.dia - a.dia : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Y el de los motes: por el momento del rumor más reciente que los pegó, del más
// reciente al más antiguo, y a igualdad por el núcleo. Ordenarlos por «cuánto te
// conocen» sería el marcador de reputación con otro nombre.
const delMoteMasReciente = (a, b) => (
  a.momento !== b.momento ? b.momento - a.momento : a.nucleo < b.nucleo ? -1 : a.nucleo > b.nucleo ? 1 : 0
);

/**
 * La línea del oro, **compuesta a partir del saldo** y nunca escrita a mano.
 *
 * La bolsa a cero lo dice sin cifra y sin reproche: no tener nada no es un fallo, y una
 * frase que lo lamentase convertiría el saldo en una nota.
 */
export function lineaDeOro(saldo) {
  if (!Number.isInteger(saldo) || saldo < 0) {
    throw new Error(`la línea del oro se compone del saldo de la bolsa y llegó ${JSON.stringify(saldo) ?? String(saldo)}`);
  }
  if (saldo === 0) return 'Ni una moneda.';
  if (saldo === 1) return 'Una moneda.';
  return `${saldo} monedas.`;
}

/**
 * Compone la repisa.
 *
 * @param {object} opciones
 *   `objetos`, `oro`, `motes` y `nucleos` las áreas del estado de la partida (SPEC-016);
 *   `mapaId` el mapa activo —los motes son suyos, la repisa y la bolsa no—; `mapa` el
 *   árbol de calzadas ya leído (`arbolDeCalzadas(mundo)`), del que salen los núcleos que
 *   se preguntan; `caras` con qué resolver de quién viene un objeto, o `SIN_CARAS`.
 * @returns `{ momento, registro, textos, objetos, motes, oro }`, congelado.
 */
export function componeRepisa({ objetos, oro, motes, nucleos, mapaId, mapa, caras }) {
  const id = exigeMapaId(mapaId, 'la repisa');
  const activo = exigeMapaDeNucleos(mapa, 'la repisa');
  const suyas = exigeCaras(caras, 'la repisa');

  // Los objetos son de la jugadora y no del sitio: se leen de la partida entera y uno
  // obtenido en otro mapa aparece igual. No hay filtro por mapa y no es un olvido.
  const enLaRepisa = objetosDe(objetos).slice().sort(delUltimoAlPrimero).map((o) => {
    const procedencia = procedenciaLegible(o, suyas);
    return {
      id: o.id,
      nombre: comoTitulo(o.id),
      // La clase viaja porque el estado la tiene, y **no se pinta**: una llave y un
      // recuerdo se presentan igual, y nada distingue al que abre puertas.
      clase: o.clase,
      dia: o.dia,
      procedencia,
      // La línea de la derecha del dibujo, compuesta: de quién viene y de qué día.
      linea: `${procedencia.texto} · día ${o.dia}`,
    };
  });

  const candidatos = motesDeMapa(motes, id).candidatos ?? {};
  const conMote = [];
  // Los núcleos se recorren en orden declarado y no en el de inserción: dos partidas que
  // oyeran lo mismo en otro orden tienen que enseñar la misma lista.
  for (const nucleo of activo.nucleos.slice().sort()) {
    const candidato = moteEn(nucleos, { mapaId: id, nucleo, mapa: activo, motes });
    if (candidato === null) continue; // un núcleo sin mote no aparece, y su ausencia no se declara
    let momento = -1;
    for (const version of loQueSeCuentaEn(nucleos, { mapaId: id, nucleo })) {
      if (candidatos[version.rumor] !== candidato) continue;
      if (Number.isInteger(version.oidoEn) && version.oidoEn > momento) momento = version.oidoEn;
    }
    conMote.push({ nucleo, candidato, mote: enPalabras(candidato), momento });
  }
  conMote.sort(delMoteMasReciente);

  const saldo = saldoDe(oro);
  const linea = lineaDeOro(saldo);

  // Todos los textos de esta pantalla pasan por la colocación: es lo que impide que uno
  // con voz de aplicación se cuele aquí, y lo que deriva la tipografía sin que la
  // pantalla la elija.
  const textos = coloca([
    textoConRegistro({ id: 'volver', registro: REGISTROS.MUNDO, texto: TEXTOS.volver }),
    textoConRegistro({ id: 'titulo', registro: REGISTROS.MUNDO, texto: TEXTOS.titulo }),
    textoConRegistro({ id: 'motes', registro: REGISTROS.MUNDO, texto: TEXTOS.motes }),
    textoConRegistro({ id: 'sin-objetos', registro: REGISTROS.MUNDO, texto: TEXTOS.sinObjetos }),
    textoConRegistro({ id: 'sin-motes', registro: REGISTROS.MUNDO, texto: TEXTOS.sinMotes }),
    textoConRegistro({ id: 'oro', registro: REGISTROS.MUNDO, texto: linea }),
  ], { sitio: SITIO, pantalla: 'a6p5' });

  return congelaHondo({
    momento: MOMENTO,
    // La repisa habla como mundo, como todo el bucle. Es la mitad de RF-LANG-002 que
    // esta pantalla sostiene, y por eso viaja en el dato y no en un comentario.
    registro: REGISTROS.MUNDO,
    textos,
    objetos: {
      lista: enLaRepisa,
      // El hueco dice que no hay nada, en voz de mundo, y no es un error.
      vacio: enLaRepisa.length ? null : TEXTOS.sinObjetos,
    },
    motes: {
      titulo: TEXTOS.motes,
      lista: conMote.map((m) => ({ nucleo: m.nucleo, candidato: m.candidato, mote: m.mote })),
      vacio: conMote.length ? null : TEXTOS.sinMotes,
    },
    oro: { saldo, linea },
  });
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión: no hay
// peso, no hay huecos, no hay tope, no hay ninguna operación que quite un objeto de la
// repisa ni que la reordene, no hay oro ganado a lo largo de la partida y no hay ningún
// número junto a un pueblo. Ninguna de esas ausencias es una regla que haya que
// vigilar: es que no existe la función que las escribiría.
