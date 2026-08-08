// La capa de NPCs: los sitios de un mapa, la cara titular de cada uno, las que
// despiertan cuando una aventura las necesita, y la resolución de rol humano que
// consume el casting.
//
// Tres cosas la gobiernan y las tres son fáciles de romper sin darse cuenta:
//
//   1. **La clave de una cara es `semilla + sitio + puesto`, jamás el orden.** Dos
//      partidas sobre el mismo mundo que despierten las mismas caras en orden
//      distinto obtienen exactamente las mismas caras (`game-design/npcs.md` §1).
//      Por eso la identidad de una cara —su género y su nombre— es **función pura
//      de la semilla y del mundo**, y despertar no es crear nada: es apuntar una
//      clave. Si el despertar generase algo no derivable de esos tres datos, el
//      criterio dejaría de cumplirse el día que alguien reordene una lista.
//   2. **El NPC hereda el anclaje del sitio y no consume uno propio.** Aquí no se
//      pide el pool, no se toman anclajes y no se piden libres: búscalo, no está.
//      Es la enmienda que abarata la capa entera y la que permite que una aldea sin
//      servicios tenga cara igualmente.
//   3. **El casting no falla por gente.** Si una plantilla pide un rol humano, el
//      sitio lo produce: un puesto afín que no esté en la plantilla del tipo de
//      sitio se resuelve con la cara titular en lugar de fallar, porque crear un
//      puesto fuera de la plantilla rompería a la vez el tope y el reparto.
//
// Es capa sobre el mundo ya congelado: no importa `buildWorld` ni ninguna fase de
// la generación, ninguna cara entra en el documento de una celda, y esta capa **no
// se registra como productor de paso** —una relación no baja porque pase el tiempo,
// y no estar en el motor es la prueba estructural de que no puede pasar—.

import { congelaHondo } from '../core/congelar.js';
import { makeRng } from '../core/rng.js';
import { estadoDeMemorias, consultaAlTestigo, hechoRecordado, memoriasDeMapa, planDeRecuerdo } from './memoria.js';
import { exigeMapaId } from './pasos.js';
import {
  SUFIJO_DE_NPCS,
  caraDeClave,
  claveDeCara,
  exigeCara,
  exigePuesto,
  plantillaDePuestos,
  puestoTitular,
  repartoDeGenero,
} from './puestos.js';
import { aplicaActo, estadoDeRelaciones, planDeActo, relacionCon, relacionesDeMapa } from './relacion.js';

/** Las dos familias de sitio, que son las dos cosas del mundo que tienen anclaje. */
export const FAMILIAS_DE_SITIO = congelaHondo(['nucleo', 'servicio']);

/**
 * Los sitios de un mapa, en **orden canónico**: cada núcleo y, detrás, sus
 * servicios, en el orden en que el mundo congelado los declara (SPEC-009). Esta
 * capa no lo inventa ni lo reordena — de él sale el reparto de género, y
 * reordenarlo cambiaría quién es quién sin que nadie lo pidiera.
 *
 * El identificador de un sitio es **su nombre**, igual que el de un núcleo en la
 * propagación de rumores: es único en todo el mapa por construcción y es lo único
 * que se puede citar sin depender de una posición en una lista. Dos sitios con el
 * mismo nombre fallan nombrándolo, en lugar de compartir caras en silencio.
 *
 * Un mapa sin ningún núcleo devuelve la lista vacía y no falla: no hay sitios es
 * una respuesta.
 */
export function sitiosDeMapa(mundo) {
  const settlements = mundo?.settlements ?? [];
  if (!Array.isArray(settlements)) {
    throw new Error('los sitios se leen del mundo congelado y necesitan sus "settlements"; ha llegado otra cosa');
  }
  const sitios = [];
  const vistos = new Set();
  const anota = (sitio) => {
    if (typeof sitio.id !== 'string' || !sitio.id) {
      throw new Error(`un ${sitio.familia} del mapa llega sin nombre, y el nombre es su identificador: sin él no se sabe de quién es cada cara`);
    }
    if (vistos.has(sitio.id)) {
      throw new Error(`dos sitios del mapa comparten el nombre "${sitio.id}", que es su identificador: compartirían caras, memorias y relaciones sin que nadie lo notara`);
    }
    vistos.add(sitio.id);
    // La plantilla se pide aquí para que un tipo de sitio sin plantilla declarada
    // falle al enumerar y no tres capas más allá, cuando alguien pida una cara suya.
    plantillaDePuestos(sitio.tipo);
    sitios.push(sitio);
  };

  for (const s of settlements) {
    anota({ id: s.name, familia: 'nucleo', tipo: s.type, en: null, x: s.x, y: s.y, anclaje: s.anchor ?? null });
    for (const v of s.services ?? []) {
      anota({ id: v.name, familia: 'servicio', tipo: v.kind, en: s.name, x: v.x, y: v.y, anclaje: v.real ?? null });
    }
  }
  return congelaHondo(sitios);
}

// Los nombres que el mundo ya gastó. Una cara no puede llamarse como un pueblo, un
// servicio, un paraje ni una calzada: la unicidad es del mapa entero, igual que en
// `crearIndiceDeNombres`, y no de la familia que nombra.
function nombresDelMundo(mundo) {
  const usados = new Set();
  if (mundo?.title) usados.add(mundo.title);
  for (const s of mundo?.settlements ?? []) {
    usados.add(s.name);
    for (const v of s.services ?? []) usados.add(v.name);
  }
  for (const p of mundo?.parajes ?? []) usados.add(p.name);
  for (const r of mundo?.routes ?? []) if (r?.name) usados.add(r.name);
  return usados;
}

// El desempate de un nombre ya cogido, con la regla del paquete de idioma. Es la
// misma mecánica que `crearIndiceDeNombres().fija`, y se escribe aquí porque el
// índice del mundo se construye al generar y esta capa llega mucho después: lo que
// se comparte es la regla, no el objeto.
function fijaNombre(usados, sortea, desempata, intentos = 8) {
  let nombre = '';
  for (let t = 0; t < intentos; t++) {
    nombre = sortea();
    if (!usados.has(nombre)) {
      usados.add(nombre);
      return nombre;
    }
  }
  const base = nombre;
  for (let k = 0; ; k++) {
    nombre = desempata(base, k);
    if (!usados.has(nombre)) {
      usados.add(nombre);
      return nombre;
    }
  }
}

function exigePaqueteDeIdioma(idioma) {
  if (!idioma || typeof idioma.personName !== 'function') {
    throw new Error(
      `el paquete de idioma "${idioma?.locale ?? '(sin locale)'}" no implementa personName(rng, genero): ` +
      'la capa de NPCs lo necesita para nombrar a las caras, y un idioma que no lo traiga nacería sin ninguna',
    );
  }
  return idioma;
}

// El reparto potencial de un mapa se calcula entero de una vez y se memoriza por
// mundo y semilla. No es «poblar el mundo»: es la función pura de la que salen las
// caras, y se calcula entera porque la unicidad de los nombres es del mapa y no de
// la cara. Que se calcule de golpe o de una en una no cambia ni un resultado — que
// es exactamente lo que el criterio del orden exige.
const REPARTOS = new WeakMap();

/**
 * El reparto potencial completo de un mapa: todos los sitios por todos los puestos
 * de su plantilla, en orden canónico, cada uno con su género y su nombre.
 *
 * @param {object} peticion
 *   `mundo` el mundo congelado; `semilla` la del mundo, de la que cuelga todo;
 *   `idioma` el paquete de nombres, que llega inyectado y no se elige aquí.
 */
export function repartoPotencial({ mundo, semilla, idioma }) {
  const pack = exigePaqueteDeIdioma(idioma);
  if (typeof semilla !== 'string' || !semilla) {
    throw new Error(`la capa de NPCs necesita la semilla del mundo y llegó ${JSON.stringify(semilla) ?? String(semilla)}`);
  }
  const clave = `${semilla}|${pack.locale}`;
  const porSemilla = REPARTOS.get(mundo) ?? new Map();
  if (!REPARTOS.has(mundo)) REPARTOS.set(mundo, porSemilla);
  if (porSemilla.has(clave)) return porSemilla.get(clave);

  const sitios = sitiosDeMapa(mundo);
  const genero = repartoDeGenero(semilla, sitios);
  const usados = nombresDelMundo(mundo);
  const caras = [];
  const porClave = new Map();

  for (const sitio of sitios) {
    for (const puesto of plantillaDePuestos(sitio.tipo)) {
      const g = genero.generoDe(sitio.id, puesto);
      // El azar de una cara sale de `makeRng` con un sufijo propio que lleva dentro
      // el sitio y el puesto, y nada más: ni un contador de aparición, ni una fecha,
      // ni una posición en ninguna lista de conocidos.
      const rng = makeRng(`${semilla}${SUFIJO_DE_NPCS}:${sitio.id}:${puesto}`);
      const nombre = fijaNombre(
        usados,
        () => pack.personName(rng, g),
        (base, intento) => pack.personName(null, g, { base, intento }),
      );
      const cara = {
        id: claveDeCara({ sitio: sitio.id, puesto }),
        sitio: sitio.id,
        puesto,
        titular: puesto === puestoTitular(sitio.tipo),
        genero: g,
        nombre,
        // El anclaje **se hereda** y no se consume: es el mismo objeto que lleva el
        // sitio, y por eso cuatro caras de una posada declaran el mismo identificador
        // nativo. Aquí no se toma nada del pool.
        anclaje: sitio.anclaje,
        // De qué sitio cuelga, siempre. El anclaje real puede faltar —un núcleo
        // colocado por geometría no tiene ficha de OSM— y entonces esto es lo que
        // ancla la cara, que es lo que el diseño dice de verdad.
        anclado: sitio.id,
        trabajaEn: sitio,
      };
      caras.push(cara);
      porClave.set(cara.id, cara);
    }
  }

  const reparto = congelaHondo({
    semilla,
    idioma: pack.locale,
    sitios,
    caras,
    estratos: genero.estratos,
    /** La identidad de una cara. Falla nombrando el sitio o el puesto que no existen. */
    identidad(sitioId, puesto) {
      const sitio = sitios.find((s) => s.id === sitioId);
      if (!sitio) {
        throw new Error(`el sitio "${sitioId}" no existe en el mapa activo: una cara pertenece a un sitio de este mapa, y no se inventa el más parecido`);
      }
      exigePuesto(sitio.tipo, puesto);
      return porClave.get(claveDeCara({ sitio: sitioId, puesto }));
    },
    /** El sitio con ese identificador, o null. */
    sitio(sitioId) {
      return sitios.find((s) => s.id === sitioId) ?? null;
    },
  });
  porSemilla.set(clave, reparto);
  return reparto;
}

/**
 * La identidad de una cara concreta: su puesto, su género, su nombre y el anclaje
 * que hereda del sitio. Función pura de `semilla + sitio + puesto`.
 *
 * **Un servicio sin anclaje real falla nombrándose**: un servicio nace de un
 * anclaje del pool (SPEC-005), así que uno sin él es un dato roto y dar su cara
 * sería la degradación silenciosa que esta capa existe para no cometer.
 *
 * **Un núcleo sin anclaje real, no.** Y es medido, no supuesto: cuando el pool no
 * llega al cupo, la generación coloca núcleos por geometría —los cinco de
 * `barrio-tres-calles` y tres de los cinco de `suelo-250m` están así—. La cara
 * hereda **el sitio**, que es lo que dice `game-design/npcs.md` («el granjero está
 * anclado en la granja»), y el sitio existe en el mapa tenga o no ficha de OSM
 * detrás. Hacerlo fallar dejaría al mundo mínimo entero sin una sola cara y
 * convertiría un rol humano allí en una excepción, que es peor que el fallo que la
 * regla quería evitar: el casting volvería a fallar por gente. Por eso la cara lo
 * **declara** —`anclaje` a null y `anclado` al sitio— en lugar de callarlo, y la
 * capa sabe enumerar esos sitios.
 */
export function identidadDeCara({ mundo, semilla, idioma, sitio, puesto }) {
  const reparto = repartoPotencial({ mundo, semilla, idioma });
  const cara = reparto.identidad(sitio, puesto);
  const suyo = reparto.sitio(sitio);
  if (suyo.familia === 'servicio' && !cara.anclaje) {
    throw new Error(
      `el sitio "${sitio}" es un servicio sin anclaje real y no puede tener caras: un NPC hereda el anclaje del sitio donde ` +
      'trabaja y nunca consume uno propio, así que un servicio sin el suyo dejaría la cara sin anclar',
    );
  }
  return cara;
}

/**
 * La resolución de un rol humano contra un sitio ya asignado por el casting: **la
 * promesa que SPEC-010 dio por hecha**.
 *
 * Devuelve siempre una cara. El puesto sale del que pide el rol si está en la
 * plantilla de ese tipo de sitio, y de la cara titular si no; el sitio no se elige
 * aquí —eso es del casting— y el anclaje se hereda.
 *
 * @param {object} peticion
 *   `mundo` y `semilla` los del casting; `sitio` el candidato ya asignado, con su
 *   nombre, su tipo, su posición y su anclaje; `rol` el rol humano de la plantilla;
 *   `idioma` el paquete de nombres; `despierta` lo que hay que hacer con la cara
 *   —la capa la despierta, la función pura no—.
 */
export function caraDeSitio({ mundo, semilla, sitio, rol, idioma, despierta = null }) {
  if (!sitio || typeof sitio.nombre !== 'string' || !sitio.nombre) {
    throw new Error(`el rol humano llega con un sitio que no se puede nombrar: ${JSON.stringify(sitio) ?? String(sitio)}`);
  }
  const reparto = repartoPotencial({ mundo, semilla, idioma });
  const suyo = reparto.sitio(sitio.nombre);
  if (!suyo) {
    throw new Error(`el sitio "${sitio.nombre}" no existe en el mapa activo: una cara pertenece a un sitio de este mapa y no se puede inventar uno`);
  }
  const plantilla = plantillaDePuestos(suyo.tipo);
  const puesto = rol?.puesto && plantilla.includes(rol.puesto) ? rol.puesto : puestoTitular(suyo.tipo);
  const cara = identidadDeCara({ mundo, semilla, idioma, sitio: suyo.id, puesto });
  if (despierta) despierta(cara);
  return congelaHondo({
    tipo: 'humano',
    kind: puesto,
    // El lugar que se nombra sigue siendo el sitio: **dos caras del mismo sitio son
    // el mismo lugar para el casting** (`npcs.md` pendiente 1), y una aventura que
    // te manda dos veces al mismo portal no es una aventura.
    nombre: sitio.nombre,
    x: sitio.x,
    y: sitio.y,
    en: sitio.nombre,
    real: sitio.real ?? suyo.anclaje,
    trabajaEn: sitio,
    // La cara viaja **sin su nombre propio**: cómo se la nombra lo decide
    // `comoNombrar`, que es lo único que sabe si ya la has conocido.
    cara: { id: cara.id, sitio: cara.sitio, puesto: cara.puesto, genero: cara.genero, anclaje: cara.anclaje, anclado: cara.anclado, titular: cara.titular },
  });
}

/** El estado de NPCs de una partida: qué caras están despiertas y cuáles conocidas. */
export function estadoDeNpcs() {
  return { mapas: {} };
}

/** El registro de un mapa dentro del estado, creándolo si es la primera vez. */
export function npcsDeMapa(estado, mapaId) {
  const id = exigeMapaId(mapaId, 'la capa de NPCs');
  if (!estado || typeof estado !== 'object' || !estado.mapas || typeof estado.mapas !== 'object') {
    throw new Error('el estado de NPCs llega mal formado: se espera lo que devuelve estadoDeNpcs(), un objeto con "mapas"');
  }
  if (!Object.prototype.hasOwnProperty.call(estado.mapas, id)) estado.mapas[id] = { despiertas: [], conocidas: [] };
  return estado.mapas[id];
}

/**
 * Levanta la capa de NPCs de un mapa.
 *
 * @param {object} opciones
 *   `semilla` la del mundo del que cuelgan las caras; `mapaId` el mapa activo;
 *   `mundo` el mundo congelado; `idioma` el paquete de nombres; `estado`,
 *   `memorias` y `relaciones` los tres estados de partida, que llegan inyectados
 *   porque se guardan y se cargan con ella.
 */
export function creaCapaDeNpcs({
  semilla,
  mapaId,
  mundo,
  idioma,
  estado = estadoDeNpcs(),
  memorias = estadoDeMemorias(),
  relaciones = estadoDeRelaciones(),
}) {
  const id = exigeMapaId(mapaId, 'la capa de NPCs');
  const reparto = repartoPotencial({ mundo, semilla, idioma });
  const registro = npcsDeMapa(estado, id);

  // La cara de este mapa, exigida. Una cara de otro mapa se rechaza nombrando el
  // mapa en lugar de crearse aquí: las caras cuelgan de sitios y dos mapas no
  // comparten ninguno.
  const laCara = (cara, quien) => {
    const { sitio, puesto } = exigeCara(cara, quien);
    if (!reparto.sitio(sitio)) {
      throw new Error(`la cara "${puesto}" de "${sitio}" no es del mapa ${id}: las caras no viajan entre mapas, y su sitio no está en este`);
    }
    return identidadDeCara({ mundo, semilla, idioma, sitio, puesto });
  };

  const estaDespierta = (cara) => cara.titular || registro.despiertas.includes(cara.id);
  const apunta = (lista, clave) => {
    if (!lista.includes(clave)) lista.push(clave);
  };

  return {
    mapaId: id,
    semilla: reparto.semilla,

    /** Los sitios del mapa, en orden canónico. */
    sitios() {
      return reparto.sitios;
    },

    /**
     * Los sitios del mapa que no tienen anclaje real detrás. Es dato de salud del
     * mundo, no un error: se enumera para que «este núcleo lo colocó la geometría»
     * se pueda ver en lugar de descubrirse por un null tres capas más allá.
     */
    sitiosSinAnclajeReal() {
      return congelaHondo(reparto.sitios.filter((s) => !s.anclaje).map((s) => ({ sitio: s.id, familia: s.familia, tipo: s.tipo })));
    },

    /** La plantilla de puestos de un sitio, con el titular primero. */
    plantillaDe(sitioId) {
      const sitio = reparto.sitio(sitioId);
      if (!sitio) throw new Error(`el sitio "${sitioId}" no existe en el mapa activo: no se puede pedir su plantilla de puestos`);
      return plantillaDePuestos(sitio.tipo);
    },

    /**
     * La cara titular de un sitio, que **existe desde el día 1**: no hay que jugar
     * nada para que esté, porque su identidad es función de la semilla y no ocupa
     * un byte de la partida.
     */
    titular(sitioId) {
      const sitio = reparto.sitio(sitioId);
      if (!sitio) throw new Error(`el sitio "${sitioId}" no existe en el mapa activo: no tiene cara titular que dar`);
      return laCara({ sitio: sitioId, puesto: puestoTitular(sitio.tipo) }, 'la cara titular');
    },

    /** La cara de un sitio y un puesto, exista o no todavía en la partida. */
    cara(cara) {
      return laCara(cara, 'la cara que se pide');
    },

    /**
     * Despierta una cara: **apunta su clave**. Ni crea datos nuevos ni cambia nada
     * de lo ya despierto, y despertarla dos veces devuelve la misma.
     */
    despierta(cara) {
      const suya = laCara(cara, 'la cara que despierta');
      apunta(registro.despiertas, suya.id);
      return suya;
    },

    /** Si una cara ya existe en la partida. La titular lo está desde el principio. */
    estaDespierta(cara) {
      return estaDespierta(laCara(cara, 'la cara que se consulta'));
    },

    /** Las caras despiertas de este mapa, en orden declarado y no en el de despertar. */
    despiertas() {
      return congelaHondo(reparto.caras.filter((c) => estaDespierta(c)).map((c) => ({ sitio: c.sitio, puesto: c.puesto })));
    },

    /** La jugadora acaba de hablar con ella por primera vez. */
    conoce(cara) {
      const suya = laCara(cara, 'la cara que se conoce');
      apunta(registro.despiertas, suya.id);
      apunta(registro.conocidas, suya.id);
      return suya;
    },

    /**
     * Cómo nombrar a una cara: **por su puesto mientras no la hayas conocido**, y
     * su nombre propio en cuanto has hablado con ella. Es la simetría de «el mundo
     * no te llama por tu nombre hasta conocerte» (`personaje.md`).
     *
     * No devuelve ni una frase: el puesto, el género y el nombre cuando toca. Las
     * palabras las pone quien pinta.
     */
    comoNombrar(cara) {
      const suya = laCara(cara, 'la cara que se nombra');
      const conocida = registro.conocidas.includes(suya.id);
      return congelaHondo({
        sitio: suya.sitio,
        puesto: suya.puesto,
        genero: suya.genero,
        conocida,
        nombre: conocida ? suya.nombre : null,
      });
    },

    /**
     * La resolución de rol humano que consume el casting, **con despertar**: la cara
     * que una aventura necesita nace la primera vez que se la pide y se queda.
     */
    resuelveRolHumano({ sitio, rol }) {
      return caraDeSitio({ mundo, semilla: reparto.semilla, idioma, sitio, rol, despierta: (cara) => apunta(registro.despiertas, cara.id) });
    },

    /** Lo que una cara recuerda, gratis y en nivel 0. */
    consultaAlTestigo(cara) {
      return consultaAlTestigo(memorias, { mapaId: id, cara: laCara(cara, 'la cara a la que se pregunta') });
    },

    /** Cómo está el trato con una cara: el escalón y si hay cicatriz. Ni un número. */
    relacionCon(cara) {
      return relacionCon(relaciones, { mapaId: id, cara: laCara(cara, 'la cara cuya relación se consulta') });
    },

    /** Aplica un acto declarado hacia una cara concreta. */
    aplicaActo({ cara, signo }) {
      return aplicaActo(relaciones, { mapaId: id, cara: laCara(cara, 'la cara sobre la que se aplica el acto'), signo });
    },

    /**
     * El cierre de una salida: entra el desenlace y salen las memorias de quienes
     * fueron rol y las relaciones que los actos declarados mueven.
     *
     * **Se aplica entero o no se aplica.** Todo se valida y se calcula primero, y
     * solo cuando no queda nada que pueda fallar se escribe: si algo no encaja a
     * mitad, ni una memoria ni una relación han cambiado.
     *
     * @param {object} opciones
     *   `desenlace` con `id`, `hechos` fieles, `signo`, `lugar`, las `caras` que
     *   fueron rol y los `efectos` de relación **declarados por la plantilla** —la
     *   taxonomía de qué acto es feo y cuál repara es de la fila 17 y no de aquí—;
     *   `n` el paso en el que se cierra.
     */
    cierraSalida({ desenlace, n = 0 }) {
      if (!desenlace || typeof desenlace !== 'object') {
        throw new Error(`el cierre de una salida necesita el desenlace y llegó ${JSON.stringify(desenlace) ?? String(desenlace)}`);
      }
      const participantes = (desenlace.caras ?? []).map((c) => laCara(c, 'una de las caras que fueron rol'));
      const hecho = participantes.length
        ? hechoRecordado({
          id: desenlace.id,
          hechos: desenlace.hechos,
          signo: desenlace.signo,
          origen: desenlace.lugar?.id ?? null,
          plantilla: desenlace.plantilla?.id ?? desenlace.plantilla ?? null,
          caras: participantes.map((c) => ({ sitio: c.sitio, puesto: c.puesto })),
        })
        : null;

      // Primero el cálculo entero, sobre el estado sin tocar.
      const recuerdos = participantes.map((cara) => planDeRecuerdo(memorias, { mapaId: id, cara, hecho, n }));
      const actos = (desenlace.efectos ?? []).map((efecto) => {
        const cara = laCara(efecto?.cara, 'la cara de un efecto de relación del desenlace');
        return planDeActo(relaciones, { mapaId: id, cara, signo: efecto?.signo });
      });

      // Y solo entonces la escritura, que ya no puede fallar.
      const memoriasDelMapa = memoriasDeMapa(memorias, id);
      for (const plan of recuerdos) memoriasDelMapa[plan.clave] = plan.lista;
      const relacionesDelMapa = relacionesDeMapa(relaciones, id);
      for (const plan of actos) relacionesDelMapa[plan.clave] = { escalon: plan.despues.escalon, cicatriz: plan.despues.cicatriz };
      for (const cara of participantes) apunta(registro.despiertas, cara.id);

      return congelaHondo({
        recordado: participantes.map((c) => ({ sitio: c.sitio, puesto: c.puesto })),
        relaciones: actos.map((plan) => ({ ...caraDeClave(plan.clave), escalon: plan.despues.escalon, cicatriz: plan.despues.cicatriz })),
      });
    },

    /** El registro vivo de este mapa, para quien lo serialice con la partida. */
    registro() {
      return registro;
    },
  };
}

/** El estado de NPCs en forma serializable, con mapas y caras en orden declarado. */
export function congelaNpcs(estado) {
  const mapas = {};
  for (const mapaId of Object.keys(estado?.mapas ?? {}).sort()) {
    const registro = estado.mapas[mapaId];
    const lista = (claves) => claves.slice().sort().map((clave) => caraDeClave(clave));
    mapas[mapaId] = { despiertas: lista(registro.despiertas), conocidas: lista(registro.conocidas) };
  }
  return { mapas };
}

/** El estado de NPCs de vuelta de su documento, con las mismas caras despiertas. */
export function levantaNpcs(doc) {
  const estado = estadoDeNpcs();
  for (const mapaId of Object.keys(doc?.mapas ?? {}).sort()) {
    const registro = npcsDeMapa(estado, mapaId);
    const claves = (caras, quien) => (caras ?? []).map((c) => claveDeCara(exigeCara(c, `una cara ${quien} guardada del mapa ${mapaId}`)));
    registro.despiertas = claves(doc.mapas[mapaId]?.despiertas, 'despierta');
    registro.conocidas = claves(doc.mapas[mapaId]?.conocidas, 'conocida');
  }
  return estado;
}
