// El vocabulario de la capa de NPCs: qué puestos tiene cada tipo de sitio, cómo se
// nombra una cara por dentro y cómo se reparte el género sobre el mapa entero.
//
// Vive aparte de `npcs.js` porque lo consumen también la memoria y la relación, y
// porque es donde se cierran las dos listas de las que cuelga todo lo demás: la
// plantilla de puestos —que además **es el tope de caras por sitio**— y el
// enumerado de género. Las claves de puesto **no llevan género** a propósito
// (`game-design/lenguaje.md`, «el oficio no arrastra el estereotipo»): con la clave
// marcada, el reparto se colaría por la puerta de atrás y el criterio de que el
// género no se deduce del puesto dejaría de ser verificable.

import { congelaHondo } from '../core/congelar.js';
import { makeRng, shuffle } from '../core/rng.js';

/**
 * El sufijo de azar de esta capa, declarado una sola vez.
 *
 * Va **aparte de `SUFIJOS_DE_FASE`** por lo mismo que el del paso y el del prólogo:
 * una cara no es una fase de la tubería —es estado de quien juega sobre un mundo ya
 * congelado— y meterlo allí haría que `semillasDeFase` prometiera una semilla de
 * NPCs por celda que nadie debe usar.
 */
export const SUFIJO_DE_NPCS = ':npcs';

/**
 * El género gramatical de una cara: **enumerado cerrado de dos valores**, y el
 * femenino primero porque es el que desempata (`lenguaje.md`, «donde el castellano
 * obliga a elegir sin motivo, el sesgo va hacia el femenino»).
 */
export const GENEROS = Object.freeze({ FEMENINO: 'femenino', MASCULINO: 'masculino' });

/** Los dos valores admitidos, en el orden en que se reparten. */
export const IDS_DE_GENERO = congelaHondo([GENEROS.FEMENINO, GENEROS.MASCULINO]);

/**
 * La plantilla de puestos por tipo de sitio: **cerrada, ordenada y con el titular
 * en primer lugar** (SPEC-014, «La plantilla de puestos»).
 *
 * De aquí sale el tope de caras por sitio sin necesidad de un número aparte: una
 * posada muy jugada acaba con tres personas, no con ocho, y las tres se recuerdan
 * (`game-design/npcs.md` §1). Que el tope salga de la plantilla y no de una
 * constante es lo que evita el caso feo de una lista con hueco y ningún puesto que
 * ponerle dentro.
 */
export const PUESTOS_POR_TIPO = congelaHondo({
  // Los cuatro tipos de núcleo. Un núcleo es un sitio como lo es un servicio: tiene
  // anclaje y una persona puede pertenecerle, y por eso una aldea sin ningún
  // servicio tiene cara igualmente.
  ciudad: ['regencia', 'vigilancia', 'vecindad'],
  pueblo: ['regencia', 'vigilancia', 'vecindad'],
  aldea: ['regencia', 'vigilancia', 'vecindad'],
  granja: ['regencia', 'vigilancia', 'vecindad'],
  // Los seis tipos de servicio que ya produce la generación.
  taberna: ['regencia', 'cocina', 'sala'],
  posada: ['regencia', 'cuadra', 'limpieza'],
  boticario: ['regencia', 'aprendizaje'],
  armeria: ['regencia', 'aprendizaje'],
  conjureria: ['regencia', 'aprendizaje'],
  mercado: ['regencia', 'acarreo'],
});

/** Los tipos de sitio con plantilla declarada, en el orden del catálogo. */
export const TIPOS_DE_SITIO = congelaHondo(Object.keys(PUESTOS_POR_TIPO));

/**
 * Todos los puestos que existen, en orden declarado y sin repetir.
 *
 * Es sobre esta lista sobre la que se estratifica el género, así que su orden es
 * el del catálogo y nunca el de inserción de ningún conjunto.
 */
export const PUESTOS = congelaHondo(
  TIPOS_DE_SITIO.reduce((out, tipo) => {
    for (const puesto of PUESTOS_POR_TIPO[tipo]) if (!out.includes(puesto)) out.push(puesto);
    return out;
  }, []),
);

// La forma de persona de un oficio en castellano: es la que arrastra el género
// —«tabernera», «mozo», «aprendiza», «condesa»— y la que no puede entrar como clave.
// Las nueve claves del catálogo son sustantivos de actividad, no de quien la ejerce.
const FORMA_DE_PERSONA = /(ero|era|eros|eras|esa|esas|ista|istas|izo|iza)$/;

// El catálogo se comprueba a sí mismo al cargarse, igual que el de efectos y el de
// ejes deformables. Cierra la puerta por la que esto se rompería de verdad: no con
// un sitio raro, sino con una plantilla añadida aquí dentro el día que alguien
// quiera «que se lea mejor» y escriba el oficio como se llama a quien lo ejerce.
for (const tipo of TIPOS_DE_SITIO) {
  const plantilla = PUESTOS_POR_TIPO[tipo];
  if (!Array.isArray(plantilla) || plantilla.length === 0) {
    throw new Error(`el catálogo de puestos declara el tipo de sitio "${tipo}" sin ningún puesto: sin titular no hay cara del día 1`);
  }
  if (new Set(plantilla).size !== plantilla.length) {
    throw new Error(`la plantilla de puestos de "${tipo}" repite un puesto (${plantilla.join(', ')}): el tope de caras del sitio es su longitud y un puesto repetido dejaría un hueco sin nada que ponerle dentro`);
  }
}
for (const puesto of PUESTOS) {
  if (FORMA_DE_PERSONA.test(puesto)) {
    throw new Error(`el puesto "${puesto}" está escrito como se llama a quien ejerce el oficio: las claves de puesto no llevan género (game-design/lenguaje.md)`);
  }
}

/**
 * La plantilla de puestos de un tipo de sitio. **Falla nombrando el tipo** en lugar
 * de suponer una plantilla vacía: un tipo nuevo de la generación que apareciera sin
 * caras y sin que nadie se enterara es exactamente la forma de fallo de
 * `pipeline/decisiones-orquestador.md` §6h.
 */
export function plantillaDePuestos(tipo) {
  const plantilla = Object.prototype.hasOwnProperty.call(PUESTOS_POR_TIPO, tipo) ? PUESTOS_POR_TIPO[tipo] : null;
  if (!plantilla) {
    throw new Error(
      `el tipo de sitio ${JSON.stringify(tipo) ?? String(tipo)} no declara plantilla de puestos: los declarados son ${TIPOS_DE_SITIO.join(', ')}. ` +
      'Un tipo nuevo declara la suya con él, en vez de nacer sin caras',
    );
  }
  return plantilla;
}

/** El puesto titular de un tipo de sitio: el primero de su plantilla, siempre. */
export function puestoTitular(tipo) {
  return plantillaDePuestos(tipo)[0];
}

/** Si un puesto está en la plantilla de ese tipo de sitio. */
export function esPuestoDe(tipo, puesto) {
  return plantillaDePuestos(tipo).includes(puesto);
}

/** El puesto, o un error que nombra el puesto y el tipo de sitio. */
export function exigePuesto(tipo, puesto) {
  if (!esPuestoDe(tipo, puesto)) {
    throw new Error(
      `el puesto ${JSON.stringify(puesto) ?? String(puesto)} no está en la plantilla de un sitio de tipo "${tipo}": ` +
      `los suyos son ${plantillaDePuestos(tipo).join(', ')}, y crear uno fuera rompería a la vez el tope de caras y el reparto de género`,
    );
  }
  return puesto;
}

/** El género, o un error que nombra lo que llegó. */
export function exigeGenero(valor, quien = 'el género de la cara') {
  if (!IDS_DE_GENERO.includes(valor)) {
    throw new Error(`${quien} llega como ${JSON.stringify(valor) ?? String(valor)}, que no está en el enumerado cerrado: los dos valores son ${IDS_DE_GENERO.join(', ')}`);
  }
  return valor;
}

// El separador de la clave de una cara: un carácter que ningún nombre del mundo
// puede llevar. Con un espacio, un sitio llamado «Casa Manuela regencia» daría la
// misma clave que la regencia de «Casa Manuela», y que dos caras colisionen no
// puede depender de cómo se llame un bar. Se escribe así y no como literal porque
// un carácter de control dentro de una cadena no se ve al leer el módulo.
const SEPARADOR_DE_CLAVE = String.fromCharCode(0);

/**
 * La clave interna de una cara: su sitio y su puesto, nunca el orden en que se
 * conoció (`game-design/npcs.md` §1, «el puesto es la clave, no el orden»).
 *
 * Vive aquí y no en `npcs.js` para que la memoria y la relación puedan referirse a
 * una cara sin depender del módulo que las produce: con la clave allí, los tres
 * módulos formarían un ciclo de imports por una función de dos líneas.
 */
export function claveDeCara(cara) {
  const { sitio, puesto } = exigeCara(cara);
  return `${sitio}${SEPARADOR_DE_CLAVE}${puesto}`;
}

/** La cara que hay detrás de una clave. Es la inversa exacta de `claveDeCara`. */
export function caraDeClave(clave) {
  const i = typeof clave === 'string' ? clave.indexOf(' ') : -1;
  if (i < 0) {
    throw new Error(`${JSON.stringify(clave) ?? String(clave)} no es la clave de una cara: se espera lo que devuelve claveDeCara({ sitio, puesto })`);
  }
  return exigeCara({ sitio: clave.slice(0, i), puesto: clave.slice(i + 1) });
}

/** Una referencia a cara bien formada, o un error que dice qué le falta. */
export function exigeCara(cara, quien = 'la cara') {
  if (!cara || typeof cara !== 'object' || typeof cara.sitio !== 'string' || !cara.sitio || typeof cara.puesto !== 'string' || !cara.puesto) {
    throw new Error(`${quien} llega como ${JSON.stringify(cara) ?? String(cara)}: se espera { sitio, puesto }, que es la clave entera de una cara`);
  }
  return { sitio: cara.sitio, puesto: cara.puesto };
}

/**
 * El reparto de género sobre el **reparto potencial completo del mapa**:
 * estratificado por puesto, con la diferencia acotada a uno dentro de cada puesto y
 * el desempate en femenino.
 *
 * Se mide **por mundo y no por partida** (SPEC-014, «El equilibrio»): es lo único
 * afirmable sin jugar, y estratificar por puesto es lo que hace imposible el oficio
 * monocolor, que es la mitad del requisito que un total cuadrado no cubre.
 *
 * El azar es **por puesto**: cada estrato siembra el suyo, así que añadir un tipo
 * de sitio con un puesto nuevo no reordena el género de los demás.
 *
 * @param {string} semilla  la del mundo del que cuelgan las caras.
 * @param {Array<{id: string, tipo: string}>} sitios  los del mapa, en **orden
 *   canónico** (SPEC-009). Esta capa no lo inventa ni lo reordena.
 * @returns `{ generoDe(sitioId, puesto), estratos }`, con los estratos en el orden
 *   declarado de `PUESTOS` para poder contarlos.
 */
export function repartoDeGenero(semilla, sitios) {
  if (typeof semilla !== 'string' || !semilla) {
    throw new Error(`el reparto de género necesita la semilla del mundo y llegó ${JSON.stringify(semilla) ?? String(semilla)}`);
  }
  const asignado = new Map();
  const estratos = [];

  for (const puesto of PUESTOS) {
    const estrato = sitios.filter((s) => plantillaDePuestos(s.tipo).includes(puesto)).map((s) => s.id);
    // El sorteo decide **quién** se lleva cada género, nunca cuántos: los cuántos
    // los fija el reparto y por eso el equilibrio es una propiedad y no una tirada.
    const orden = shuffle(makeRng(`${semilla}${SUFIJO_DE_NPCS}:genero:${puesto}`), estrato);
    // Con un número impar desempata el femenino, que es la regla de fondo de
    // `lenguaje.md` aplicada al único sitio donde el reparto obliga a elegir.
    const femeninas = Math.ceil(orden.length / 2);
    const caras = [];
    orden.forEach((sitioId, i) => {
      const genero = i < femeninas ? GENEROS.FEMENINO : GENEROS.MASCULINO;
      asignado.set(claveDeCara({ sitio: sitioId, puesto }), genero);
    });
    // La lista del estrato se entrega en orden canónico de sitio y no en el del
    // sorteo: quien la lea para contar no debe poder leer de paso el orden interno.
    for (const sitioId of estrato) caras.push({ sitio: sitioId, genero: asignado.get(claveDeCara({ sitio: sitioId, puesto })) });
    estratos.push({
      puesto,
      caras,
      femeninas: caras.filter((c) => c.genero === GENEROS.FEMENINO).length,
      masculinos: caras.filter((c) => c.genero === GENEROS.MASCULINO).length,
    });
  }

  return congelaHondo({
    estratos,
    /** El género de una cara concreta. Falla nombrando el sitio y el puesto. */
    generoDe(sitioId, puesto) {
      const genero = asignado.get(claveDeCara({ sitio: sitioId, puesto }));
      if (!genero) {
        throw new Error(`el reparto de género no tiene entrada para el puesto "${puesto}" del sitio "${sitioId}": o el sitio no es de este mapa, o el puesto no está en su plantilla`);
      }
      return genero;
    },
  });
}
