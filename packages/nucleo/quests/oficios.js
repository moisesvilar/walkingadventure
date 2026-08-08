// El enumerado cerrado de oficios, la afinidad que cada plantilla declara, el
// filtro que se aplica **antes** de castear y la medida de cobertura por oficio.
//
// El oficio es la única palanca mecánica del personaje (`game-design/personaje.md`
// §3): decide qué aventuras se te ofrecen y cambia cómo te habla el mundo, y actúa
// sobre el mundo y nunca sobre el cuerpo. De ahí las dos propiedades que este
// módulo sostiene: **filtra de verdad** —hay plantillas que con este personaje no
// verás nunca— y **no castea**, porque quien castea es SPEC-010 y el filtro se
// aplica antes de llamarlo.
//
// La lista exacta es **pendiente 4 de `personaje.md`**: hay criterio —tres o cuatro,
// y salen de los servicios que el mundo ya sabe generar— y no hay lista. Se trata
// como parámetro con un valor por defecto justificado y en un sitio único, de modo
// que cerrarla de otra manera sea cambiar esta lista y las afinidades que la citan.

import { congelaHondo } from '../core/congelar.js';

/**
 * Los cuatro oficios, **claves sin género**: la palabra con la que se dice cada uno
 * la pone el paquete de idioma y concuerda con el género gramatical de quien juega.
 *
 * Es el mismo criterio que el catálogo de puestos —«las claves de puesto no llevan
 * género»—: escribir «buhonera» como clave pegaría el estereotipo a la clave y
 * dejaría sin resolver la mitad de las partidas.
 */
export const OFICIOS = congelaHondo(['taberna', 'botica', 'forja', 'mercado']);

/**
 * De qué servicio del mundo sale cada oficio, «para que siempre exista un sitio
 * donde te reconozcan» (`personaje.md` §3).
 *
 * Se declara aquí y no se importa de la generación a propósito: el catálogo de
 * quests no depende de ningún módulo de mundo, y lo que este mapa afirma —que el
 * mundo sabe generar ese servicio— es exactamente lo que una prueba tiene que
 * cruzar contra `SERVICES`, no algo que este módulo pueda darse por bueno solo.
 */
export const SERVICIO_ANCLA_DE_OFICIO = congelaHondo({
  taberna: 'taberna',
  botica: 'boticario',
  forja: 'armeria',
  mercado: 'mercado',
});

/** Un oficio del enumerado, o un error que nombra el recibido y enumera los válidos. */
export function exigeOficio(oficio, quien = 'el oficio de quien juega') {
  if (oficio === undefined || oficio === null || oficio === '') {
    throw new Error(
      `${quien} no llega: el filtro del catálogo lo recibe inyectado y no lo consulta en ninguna partida. ` +
      `Los declarados son ${OFICIOS.join(', ')}`,
    );
  }
  if (!OFICIOS.includes(oficio)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(oficio) ?? String(oficio)}, que no está en el enumerado cerrado: los declarados son ${OFICIOS.join(', ')}`,
    );
  }
  return oficio;
}

/**
 * La afinidad declarada de una plantilla, normalizada y validada.
 *
 * **Se declara y no se deduce** de los roles que pide: una plantilla que manda a la
 * forja no es por eso una aventura de quien trabaja el hierro, y deducirlo ataría el
 * oficio al reparto en vez de a la historia.
 */
export function afinidadDePlantilla(plantilla) {
  const id = plantilla?.id ?? '(sin id)';
  const declarada = plantilla?.oficios;
  if (!Array.isArray(declarada) || declarada.length === 0) {
    throw new Error(
      `la plantilla "${id}" no declara con qué oficios tiene afinidad: "oficios" es una lista con al menos uno de ${OFICIOS.join(', ')}, ` +
      'y una plantilla sin afinidad no la vería nadie',
    );
  }
  for (const oficio of declarada) exigeOficio(oficio, `la plantilla "${id}" declara afinidad con el oficio`);
  if (new Set(declarada).size !== declarada.length) {
    throw new Error(`la plantilla "${id}" repite un oficio en su afinidad: ${declarada.join(', ')}`);
  }
  return declarada;
}

/**
 * Las plantillas que un oficio ve, **en el orden declarado del catálogo**.
 *
 * No castea nada y no toca el mundo: devuelve plantillas. Quien las castea es
 * SPEC-010, y esa frontera ya la decidió aquella spec —«la afinidad de oficio se
 * aplica antes de llamar al casting»—.
 */
export function plantillasDeOficio(oficio, catalogo) {
  const suyo = exigeOficio(oficio, 'el oficio con el que se filtra el catálogo');
  return exigeCatalogo(catalogo).filter((p) => afinidadDePlantilla(p).includes(suyo));
}

/** Las plantillas que **solo** ese oficio ve. Son las que hacen que elegir signifique algo. */
export function exclusivasDeOficio(oficio, catalogo) {
  const suyo = exigeOficio(oficio, 'el oficio del que se piden las exclusivas');
  return exigeCatalogo(catalogo).filter((p) => {
    const afinidad = afinidadDePlantilla(p);
    return afinidad.length === 1 && afinidad[0] === suyo;
  });
}

/** Cuántos oficios ve de media una plantilla del catálogo. */
export function mediaDeAfinidades(catalogo) {
  const lista = exigeCatalogo(catalogo);
  const total = lista.reduce((n, p) => n + afinidadDePlantilla(p).length, 0);
  return total / lista.length;
}

/**
 * La cobertura por oficio de un casteo ya hecho: cuántas de las plantillas que ese
 * oficio ve castean, y cuáles no y por qué.
 *
 * Vive en el paquete y no en el informe por dos motivos. El de propiedad:
 * `.claude/rules/naming.md` dice que `test/**` lo escribe solo `wa-qa-dev`, así que
 * exigir el suelo por oficio como criterio obligaría a tocar un directorio ajeno. Y
 * el de método, que es el de SPEC-010: **el recuento sale de las declaraciones y del
 * motivo estructurado, sin parsear ninguna frase**.
 *
 * @param {object} opciones
 *   `resultados` lo que devuelve `casteaCatalogo`, una entrada por plantilla castee
 *   o no; `catalogo` el catálogo con el que se casteó.
 * @returns `{ [oficio]: { total, casteables, plantillas, noCasteables: [{ plantilla, motivo }] } }`
 */
export function coberturaPorOficio({ resultados, catalogo }) {
  const lista = exigeCatalogo(catalogo);
  if (!Array.isArray(resultados)) {
    throw new Error(`la cobertura por oficio necesita el resultado de castear el catálogo y llegó ${JSON.stringify(resultados) ?? String(resultados)}`);
  }
  const porPlantilla = new Map();
  for (const r of resultados) {
    const id = r?.plantilla ?? r?.tpl?.id;
    if (typeof id !== 'string') {
      throw new Error(`una entrada del casteo no dice de qué plantilla es: ${JSON.stringify(r)}`);
    }
    porPlantilla.set(id, r);
  }
  const out = {};
  for (const oficio of OFICIOS) {
    const suyas = lista.filter((p) => afinidadDePlantilla(p).includes(oficio));
    const noCasteables = [];
    let casteables = 0;
    for (const p of suyas) {
      const r = porPlantilla.get(p.id);
      if (!r) {
        throw new Error(
          `la plantilla "${p.id}" no aparece en el resultado del casteo: el casting devuelve una entrada por plantilla, castee o no, ` +
          'y omitir las que fallan convertiría la cobertura en una media de lo que ya salió bien',
        );
      }
      if (r.ok) { casteables += 1; continue; }
      noCasteables.push({ plantilla: p.id, motivo: r.motivo });
    }
    out[oficio] = {
      total: suyas.length,
      casteables,
      plantillas: suyas.map((p) => p.id),
      noCasteables,
    };
  }
  return out;
}

function exigeCatalogo(catalogo) {
  if (!Array.isArray(catalogo) || catalogo.length === 0) {
    throw new Error('el catálogo con el que se filtra por oficio llega vacío o no es una lista: sin plantillas no hay nada que filtrar');
  }
  return catalogo;
}

// El mapa de anclas se comprueba a sí mismo al cargarse: un oficio nuevo sin
// servicio detrás dejaría a alguien sin ningún sitio donde le reconozcan, y eso
// tiene que fallar aquí y no en la partida de alguien.
for (const oficio of OFICIOS) {
  if (typeof SERVICIO_ANCLA_DE_OFICIO[oficio] !== 'string' || !SERVICIO_ANCLA_DE_OFICIO[oficio]) {
    throw new Error(`el oficio "${oficio}" no declara de qué servicio del mundo sale: sin él no existe el sitio donde te reconocen (personaje.md §3)`);
  }
}
if (OFICIOS.length < 3 || OFICIOS.length > 4) {
  throw new Error(`el enumerado de oficios tiene ${OFICIOS.length} entradas y el criterio de "personaje.md" §3 son tres o cuatro, no diez`);
}
