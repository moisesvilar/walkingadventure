// Los cupos de una celda —núcleos, servicios y parajes— reexpresados en tramos y
// no en metros: un cupo calibrado en metros absolutos deja de significar lo mismo
// para dos personas distintas. Se calculan **una vez, al generar la celda**, y se
// congelan con ella: cambiar el tramo después no redimensiona lo que ya existe.

import { congelaHondo } from '../core/congelar.js';
import { TEMPLATES } from '../quests/templates.js';
import { ESCENAS_POR_PARAJE, PESO_MINIMO_DE_ESCENA, normalizaVocabulario, sueloDeVocabulario } from './escenas.js';
import { SERVICES } from './settlements.js';

// El suelo y la forma del vocabulario viven en `escenas.js` y se reexportan desde
// aquí: quien pide cupos no tiene por qué saber que son dos módulos, y el
// generador de parajes importa el de abajo para no arrastrar el catálogo.
export { ESCENAS_POR_PARAJE, PESO_MINIMO_DE_ESCENA };

/**
 * El tramo con el que `parametros-mundo.md` calibró las tablas de hoy. Es el factor
 * de conversión y nada más: con él los números actuales salen clavados para quien
 * anda 2 km en media hora, y escalan solos para quien anda 300 m.
 */
export const TRAMO_DE_REFERENCIA_M = 2000;

/**
 * Cupos exactos de núcleos por **radio de celda en tramos**: la tabla de
 * `settlements.js` dividida por el tramo de referencia, no una tabla nueva.
 * `[ciudades, pueblos, aldeas, granjas]`, interpolando entre tramos.
 */
const NUCLEOS_POR_TRAMOS = [
  [0.25, [1, 1, 1, 2]],
  [0.5, [1, 1, 2, 3]],
  [1, [1, 2, 3, 4]],
  [2.5, [1, 3, 4, 5]],
  [5, [2, 5, 7, 5]],
  [10, [2, 9, 14, 20]],
];

/** Por debajo de medio tramo de radio la tabla ya no interpola: son los dos mínimos absolutos. */
const NUCLEOS_MINIMO_ABSOLUTO = [1, 1, 1, 1];
const NUCLEOS_BAJO_MEDIO = [1, 1, 1, 2];

/**
 * Techo de parajes **por ritmo**, en tramos de radio: más hitos no añaden beats a
 * una salida, así que satura. No es el cupo final — el suelo no está en esta tabla
 * porque no se elige, sale de contar el catálogo.
 *
 * Es la tabla de `parametros-mundo.md` (250 m → 1, 500 → 2, 1000 → 4, 2000 → 7,
 * saturando en 8) **dividida por el tramo de referencia**, no una tabla nueva: la
 * escala cambia de unidad y no de forma, y por eso el techo de una celda coincide
 * al número con el cupo por radio del prototipo cuando quien juega anda 2 km.
 */
const TECHO_PARAJES_POR_TRAMOS = [
  [0.125, 1],
  [0.25, 2],
  [0.5, 4],
  [1, 7],
  [2.5, 8],
];

const ORDEN_DE_NUCLEOS = ['ciudad', 'pueblo', 'aldea', 'granja'];

function interpola(tabla, x, minimoBajoTabla) {
  const [primerX] = tabla[0];
  if (x < primerX) return minimoBajoTabla;
  const ultimo = tabla[tabla.length - 1];
  if (x >= ultimo[0]) return ultimo[1];
  for (let i = 0; i < tabla.length - 1; i++) {
    const [x0, y0] = tabla[i];
    const [x1, y1] = tabla[i + 1];
    if (x >= x0 && x < x1) {
      const t = (x - x0) / (x1 - x0);
      return Array.isArray(y0) ? y0.map((v, k) => Math.round(v + (y1[k] - v) * t)) : Math.round(y0 + (y1 - y0) * t);
    }
  }
  return ultimo[1];
}

/**
 * El suelo de parajes de cualquier celda, derivado del catálogo de plantillas.
 *
 * Escenas distintas que piden los roles ÷ escenas que lleva un paraje, hacia
 * arriba. **Es una regla viva**: si el catálogo se ensancha con escenas nuevas, el
 * suelo sube solo, sin tocar ninguna constante.
 */
export function sueloDeParajes(plantillas = TEMPLATES) {
  const vocabulario = vocabularioDeEscenas(plantillas);
  return { suelo: sueloDeVocabulario(vocabulario), escenas: vocabulario.map((e) => e.escena), vocabulario };
}

/**
 * El vocabulario de escenas de paraje que pide un catálogo, con el peso mínimo que
 * cada rol le exige.
 *
 * Es el **valor de arranque** de la frontera de inyección de SPEC-006: mientras la
 * fila del catálogo no exista, quien orquesta la tubería lo construye leyendo las
 * plantillas de aquí. El generador de parajes no llama a esta función: recibe ya
 * el vocabulario.
 */
export function vocabularioDeEscenas(plantillas = TEMPLATES) {
  if (!Array.isArray(plantillas) || plantillas.length === 0) {
    throw new Error('el catálogo de plantillas está vacío: sin plantillas no hay escenas que contar y el suelo de parajes no se puede derivar');
  }
  const pedidas = [];
  for (const plantilla of plantillas) {
    for (const clave of Object.keys(plantilla?.roles ?? {}).sort()) {
      const rol = plantilla.roles[clave];
      if (rol?.tipo !== 'paraje' || !rol.escena) continue;
      // Un rol admite alternativa (`['vigilancia', 'revelación']`), y las dos son
      // vocabulario que el mundo tiene que saber decir: cuentan las dos.
      for (const escena of Array.isArray(rol.escena) ? rol.escena : [rol.escena]) {
        pedidas.push({ escena, pesoMinimo: rol.minPeso ?? PESO_MINIMO_DE_ESCENA });
      }
    }
  }
  if (pedidas.length === 0) {
    throw new Error('el catálogo de plantillas no pide ni una escena de paraje: el suelo de parajes no se puede derivar de él');
  }
  // Normalizar ordena y funde repetidas quedándose con el peso más exigente.
  return normalizaVocabulario(pedidas);
}

/** Las escenas distintas que los roles del catálogo piden a un paraje, en orden alfabético. */
export function escenasPedidasPorElCatalogo(plantillas = TEMPLATES) {
  return vocabularioDeEscenas(plantillas).map((e) => e.escena);
}

/**
 * El techo de parajes **por ritmo** de una celda de ese radio en tramos.
 *
 * Se exporta suelto porque quien genera el mundo lo necesita sin pedir la ficha
 * entera de cupos: los cupos son de la celda y los calcula `celda.js` una sola vez,
 * mientras que lo que existe dentro del mundo se dimensiona con la geometría de la
 * rejilla, que no se mueve nunca (`accesibilidad.md` §1: el tramo cambia hasta
 * dónde te manda una quest, nunca qué existe).
 */
export function techoDeParajes(radioEnTramos) {
  if (!Number.isFinite(radioEnTramos) || radioEnTramos <= 0) {
    throw new Error(`el techo de parajes necesita el radio de la celda en tramos y llegó ${radioEnTramos}`);
  }
  return interpola(TECHO_PARAJES_POR_TRAMOS, radioEnTramos, TECHO_PARAJES_POR_TRAMOS[0][1]);
}

function exigeRadioEnTramos({ radioEnTramos, ladoEnTramos }) {
  const radio = Number.isFinite(radioEnTramos) ? radioEnTramos : Number.isFinite(ladoEnTramos) ? ladoEnTramos / 2 : null;
  if (!Number.isFinite(radio) || radio <= 0) {
    throw new Error(`la celda no declara su tamaño: cuposDeCelda necesita "radioEnTramos" (o "ladoEnTramos") y llegó radioEnTramos=${radioEnTramos}, ladoEnTramos=${ladoEnTramos}`);
  }
  return radio;
}

/**
 * Los cupos de una celda a partir de su tamaño **en tramos** y del catálogo.
 *
 * No consume azar y no depende de ningún radio en metros absolutos: dos celdas del
 * mismo tamaño en tramos tienen los mismos cupos, ande lo que ande quien juega.
 */
export function cuposDeCelda({ radioEnTramos, ladoEnTramos, plantillas = TEMPLATES, vocabulario = null } = {}) {
  // El catálogo antes que el tamaño: un catálogo vacío es un fallo del que se sale
  // arreglando el catálogo, y verlo tapado por «falta el tamaño» cuesta una tarde.
  // El vocabulario inyectado manda sobre el catálogo cuando llega: es la frontera
  // que deja al generador sin depender de quién declara las escenas.
  const vocab = vocabulario == null ? vocabularioDeEscenas(plantillas) : normalizaVocabulario(vocabulario);
  const suelo = sueloDeVocabulario(vocab);
  const escenas = vocab.map((e) => e.escena);
  const radio = exigeRadioEnTramos({ radioEnTramos, ladoEnTramos });

  const bajoTabla = radio < 0.125 ? NUCLEOS_MINIMO_ABSOLUTO : NUCLEOS_BAJO_MEDIO;
  const cuentas = interpola(NUCLEOS_POR_TRAMOS, radio, bajoTabla);
  const nucleos = {};
  ORDEN_DE_NUCLEOS.forEach((tipo, i) => { nucleos[tipo] = cuentas[i]; });
  nucleos.total = cuentas.reduce((a, b) => a + b, 0);

  const techo = techoDeParajes(radio);

  return congelaHondo({
    radioEnTramos: radio,
    ladoEnTramos: radio * 2,
    nucleos,
    servicios: serviciosDe(nucleos),
    parajes: {
      // Techo por ritmo, suelo por aritmética, y cuando chocan gana el suelo.
      cupo: Math.max(suelo, techo),
      suelo,
      techo,
      escenasPedidas: escenas.length,
      escenasPorParaje: ESCENAS_POR_PARAJE,
      // El vocabulario viaja con el cupo porque quien reparte lo necesita entero:
      // el número dice cuántos parajes, y esta lista, de qué tipo tienen que ser.
      vocabulario: vocab,
    },
  });
}

// Los servicios no tienen tabla propia: salen de los núcleos que caben, leyendo la
// misma declaración que usa la generación en lugar de copiarla aquí. Se cuentan
// solo los garantizados —los `fixed` de cada tipo—: cuántos extras salen lo decide
// un sorteo que vive en la generación, y adelantarlo sería inventarse un número.
function serviciosDe(nucleos) {
  let garantizados = 0;
  for (const tipo of ORDEN_DE_NUCLEOS) garantizados += SERVICES[tipo].fixed.length * nucleos[tipo];
  return { garantizados };
}
