// Selección del paquete de nombres según la ubicación del mundo.
// Decisión de diseño (game-design/parajes.md): el idioma de los nombres depende
// de dónde se genera el mundo. Por ahora: Galicia → gallego, resto → castellano.

import { es } from './es.js';
import { gl } from './gl.js';

// Bounding aproximado de Galicia; a futuro, límites administrativos de OSM.
export function localeFor(lat, lon) {
  return lat > 41.75 && lat < 43.85 && lon > -9.4 && lon < -6.6 ? 'gl' : 'es';
}

export function namesFor(locale) {
  return locale === 'gl' ? gl : es;
}

/** Los idiomas con paquete de nombres declarado, en orden declarado. */
export const IDIOMAS = Object.freeze(['es', 'gl']);

/**
 * El paquete de un idioma, **o un error que lo nombra**.
 *
 * Convive con `namesFor` y no la sustituye: aquella cae al castellano a propósito
 * porque nombrar un mundo fuera de Galicia con el paquete castellano es la decisión
 * correcta y no una degradación. El arranque no puede caer igual — las sugerencias de
 * nombre saldrían de otro idioma sin que nadie lo dijera, y `personaje.md` §1 pide
 * justo lo contrario: que el nombre pegue con el sitio. Por eso quien necesite el
 * paquete resuelto de verdad pide este.
 */
export function exigeNombres(locale) {
  if (!IDIOMAS.includes(locale)) {
    throw new Error(
      `el idioma ${JSON.stringify(locale) ?? String(locale)} no tiene paquete de nombres declarado: los declarados son ${IDIOMAS.join(', ')}. ` +
      'Un idioma nuevo trae el suyo, en vez de resolverse en silencio con el de otro',
    );
  }
  return namesFor(locale);
}

/**
 * Cuántos sorteos como mucho se hacen para dar con un nombre de la porción de la celda.
 * Con una porción de un treintaidosavo, los ocho intentos de siempre son doscientos
 * cincuenta y seis sorteos: la celda ve los mismos ocho candidatos **de los suyos**, y
 * lo que cambia es cuántos ajenos descarta para verlos.
 */
export const TOPE_DE_SORTEOS = 512;

/**
 * Hasta dónde se insiste con la forma construida antes de fallar. Es alto a propósito:
 * la forma construida crece sin repetirse, así que lo único que la agota es que
 * ninguna de sus variantes caiga en la porción de la celda, y eso ya es un reparto
 * roto y no un mundo apretado.
 */
export const TOPE_DE_FORMAS_CONSTRUIDAS = 4096;

/**
 * Y hasta dónde con reparto, que es donde la serie de desempates de la celda tiene su
 * tope. Cuarenta bastan de sobra: más de la mitad del espacio de nombres es de las
 * formas construidas, así que la primera o la segunda ya cae dentro.
 */
export const TOPE_DE_FORMAS_CONSTRUIDAS_CON_REPARTO = 40;

/**
 * Índice de nombres de un mundo: uno solo, creado en build.js y compartido por las
 * cinco familias que nombran (núcleos, granjas, servicios, parajes y calzadas).
 *
 * Antes cada fase llevaba su propio conjunto de nombres usados —o ninguno, en el
 * caso de los núcleos y los servicios—, así que una granja podía llamarse igual
 * que otra y un paraje igual que un núcleo sin que nadie lo notase. La unicidad es
 * del mundo entero, no de la familia.
 *
 * No es un estado global del paquete a propósito: dos mundos generados en el mismo
 * proceso tienen que poder salir sin contaminarse.
 *
 * Desde SPEC-041 acepta además el **reparto de su celda**, que es lo que extiende esa
 * unicidad a las celdas vecinas del mismo mapa sin preguntarles nada. Sin reparto se
 * comporta exactamente como antes, que es como lo usan las herramientas y los mundos
 * sueltos.
 */
export function crearIndiceDeNombres({ reparto = null, idioma = null } = {}) {
  const usados = new Set();
  if (reparto !== null && typeof reparto.acepta !== 'function') {
    throw new Error(
      'el índice de nombres recibe un reparto sin "acepta(nombre)": el reparto es lo que dice qué nombres son de esta celda, ' +
      'y uno que no sabe decirlo dejaría la unicidad entre celdas sin nadie que la garantice',
    );
  }
  const libre = (nombre) => !usados.has(nombre) && (reparto === null || reparto.acepta(nombre));
  const donde = reparto ? `la celda ${reparto.clave} del mapa ${reparto.mapaId}` : 'este mundo';

  return {
    tomado: (nombre) => usados.has(nombre),

    /** El reparto con el que se nombra, o `null` si este mundo no reparte nada. */
    reparto: () => reparto,

    /**
     * Reserva un nombre concreto si está libre. Devuelve si lo consiguió.
     *
     * Existe para la capa de nombres propuestos por el narrador (SPEC-018), que no
     * sortea nada: trae un nombre ya escrito y lo único que puede hacer es tomarlo o
     * quedarse con el que había. `fija` no sirve ahí porque su contrato es
     * «devuélveme un nombre libre pase lo que pase», y aquí no adoptar es la
     * respuesta correcta.
     */
    reserva(nombre) {
      if (typeof nombre !== 'string' || !nombre) return false;
      if (!libre(nombre)) return false;
      usados.add(nombre);
      return true;
    },

    /**
     * Fija un nombre libre y lo reserva.
     *
     * `sortea()` es el sorteo de la familia que nombra, y se reintenta con la
     * cadena de azar de esa fase y no con una compartida: si todas las familias
     * desempataran con el mismo generador, tocar una fase desplazaría el azar de
     * las demás. Agotados los intentos, `desambigua(intento)` lo resuelve con la
     * regla del paquete de idioma, que sí garantiza un nombre libre porque los
     * nombres que produce crecen sin repetirse.
     *
     * **Con reparto cambia lo que cuenta como libre y nada más**: un nombre que no
     * es de esta celda se descarta igual que uno ya tomado, y por eso se sortea más
     * veces —el número de candidatos *de los suyos* que ve la celda es el mismo—. La
     * forma construida también pasa por el filtro: si no pasara, la caída de una
     * celda podría aterrizar en el repertorio libre de otra y las dos acabarían
     * llamando igual a dos sitios distintos, que es justo lo que el reparto impide.
     *
     * `que` nombra el elemento que se está nombrando y solo se usa para fallar: sin
     * él, un reparto roto se notaría como un nombre repetido tres pantallas después.
     */
    fija(sortea, desambigua, intentos = 8, que = 'un elemento del mundo') {
      // Sin reparto, el sorteo es el de siempre. Con reparto se sortea más veces —casi
      // todos los candidatos son de otra celda— para que el número de candidatos **de
      // los suyos** que ve la celda no cambie. Una celda sin repertorio libre no sortea
      // más que la base sobre la que construir.
      const sorteos = reparto === null ? intentos : (reparto.libre ? Math.min(intentos * reparto.porciones, TOPE_DE_SORTEOS) : 1);
      let nombre = '';
      for (let t = 0; t < sorteos; t++) {
        nombre = sortea();
        if (libre(nombre)) {
          usados.add(nombre);
          return nombre;
        }
      }
      const base = nombre;
      // La forma construida vive en la porción que no es de nadie y se numera con la
      // serie de esta celda, que no comparte un solo número con la de ninguna otra:
      // así dos celdas que caen sobre el mismo nombre base construyen desempates
      // distintos, y ninguno de los dos puede aparecer como nombre libre en un tercero.
      const topeConstruidas = reparto === null ? TOPE_DE_FORMAS_CONSTRUIDAS : TOPE_DE_FORMAS_CONSTRUIDAS_CON_REPARTO;
      for (let k = 0; k < topeConstruidas; k++) {
        nombre = desambigua(base, reparto === null ? k : reparto.desempate(k));
        if (!usados.has(nombre) && (reparto === null || reparto.aceptaConstruido(nombre))) {
          usados.add(nombre);
          return nombre;
        }
      }
      throw new Error(
        `el paquete de idioma ${JSON.stringify(idioma ?? 'sin declarar')} se ha quedado sin nombre libre para ${que} en ${donde}: ` +
        `ni ${sorteos} sorteos ni ${topeConstruidas} formas construidas sobre ${JSON.stringify(base)} han dado uno de su porción. ` +
        'Se dice en vez de repetir un nombre en silencio',
      );
    },
  };
}

// --- El índice de nombres de un mapa, que comprueba y ya no produce ------------
//
// Antes de SPEC-041 la unicidad la producía el índice del mundo: cada familia pedía
// un nombre libre y el índice se lo daba. Con varias celdas eso ya no vale —el índice
// de una celda no puede ver los nombres de otra sin romper el determinismo—, así que
// la unicidad la produce el reparto y este índice pasa a **comprobarla**.
//
// No es redundante: si el reparto se rompiera, sin esto nadie se enteraría hasta ver
// dos «Casal da Colmea» en el mismo mapa, que es exactamente lo que ya pasó en
// `costero#2`. Y la comprobación es **local**: le basta con el nombre y con la celda
// que lo dice, porque un nombre pertenece a una única celda por construcción.

/** De dónde puede salir un nombre dentro de una celda. Vocabulario cerrado. */
export const FAMILIAS_QUE_NOMBRAN = Object.freeze(['nucleo', 'servicio', 'paraje', 'calzada', 'ramal']);

/**
 * El índice de nombres de un mapa.
 *
 * @param {{ semilla: string, mapaId: string, reparto?: Function }} opciones
 *   `reparto` es cómo se levanta el de una celda; llega inyectado para no atar la capa
 *   de nombres a la geometría de la rejilla.
 */
export function crearIndiceDeMapa({ semilla, mapaId, reparto }) {
  if (typeof reparto !== 'function') {
    throw new Error('el índice de nombres de un mapa necesita cómo se levanta el reparto de una celda: sin él no puede comprobar nada');
  }
  // clave de celda → nombres, y nombre → clave de celda. Los dos, porque las dos
  // preguntas que hay que contestar son «¿de quién es este nombre?» y «¿qué dijo esta
  // celda?», y derivar una de la otra al vuelo la haría dependiente del orden.
  const porCelda = new Map();
  const dueno = new Map();

  const anota = (celda, familia, nombre) => {
    const r = reparto({ semilla, mapaId, celda });
    if (typeof nombre !== 'string' || !nombre) {
      throw new Error(`la celda ${r.clave} del mapa ${mapaId} declara un ${familia} con el nombre ${JSON.stringify(nombre) ?? String(nombre)}`);
    }
    const anterior = dueno.get(nombre);
    if (anterior !== undefined && anterior !== r.clave) {
      throw new Error(
        `el mapa ${mapaId} tiene dos sitios llamados ${JSON.stringify(nombre)}: uno en la celda ${anterior} y otro en la ${r.clave}. ` +
        'El reparto del repertorio se ha roto, y repetir un nombre entre celdas es lo que existe para impedir',
      );
    }
    if (!r.acepta(nombre) && !r.aceptaConstruido(nombre)) {
      throw new Error(
        `la celda ${r.clave} del mapa ${mapaId} nombra un ${familia} ${JSON.stringify(nombre)} que no es de su porción del repertorio ` +
        'ni de la de las formas construidas: un nombre de fuera del reparto puede aparecer también en otra celda, y entonces la unicidad deja de estar garantizada',
      );
    }
    dueno.set(nombre, r.clave);
    if (!porCelda.has(r.clave)) porCelda.set(r.clave, []);
    porCelda.get(r.clave).push(nombre);
  };

  return {
    mapaId,

    /** Comprueba y anota los nombres de una celda. Repetir la misma celda no la duplica. */
    registra(celda, nombres) {
      const r = reparto({ semilla, mapaId, celda });
      if (porCelda.has(r.clave)) return porCelda.get(r.clave).slice();
      porCelda.set(r.clave, []);
      if (Array.isArray(nombres)) {
        for (const nombre of nombres) anota(celda, 'sitio', nombre);
      } else {
        for (const familia of FAMILIAS_QUE_NOMBRAN) {
          for (const nombre of nombres?.[familia] ?? []) anota(celda, familia, nombre);
        }
      }
      return porCelda.get(r.clave).slice();
    },

    /** Si el mapa ya comprobó los nombres de una celda. */
    comprobada(celda) {
      return porCelda.has(reparto({ semilla, mapaId, celda }).clave);
    },

    /** De qué celda es un nombre, o `null` si el mapa no lo ha visto. */
    celdaDe(nombre) {
      return dueno.get(nombre) ?? null;
    },

    /** Todos los nombres del mapa, en orden estable y no en el de apertura. */
    todos() {
      return [...dueno.keys()].sort();
    },

    /** El índice en forma serializable: las celdas ordenadas y sus nombres ordenados. */
    congela() {
      const celdas = {};
      for (const clave of [...porCelda.keys()].sort()) celdas[clave] = porCelda.get(clave).slice().sort();
      return { mapaId, celdas };
    },
  };
}

/**
 * El índice de nombres de un mapa de vuelta de su documento.
 *
 * Vuelve entero —las mismas celdas y los mismos nombres— y comprueba lo que carga: un
 * documento con dos celdas que dicen el mismo nombre es un reparto roto guardado, y se
 * dice al abrirlo en lugar de arrastrarlo.
 */
export function levantaIndiceDeMapa(doc, { semilla, mapaId, reparto }) {
  const indice = crearIndiceDeMapa({ semilla, mapaId: mapaId ?? doc?.mapaId, reparto });
  for (const clave of Object.keys(doc?.celdas ?? {}).sort()) {
    const [i, j] = clave.split(',').map(Number);
    indice.registra({ i, j }, doc.celdas[clave]);
  }
  return indice;
}

/**
 * Los nombres de un mundo generado, por familia. Es lo que el índice del mapa
 * comprueba, y se lee del mundo congelado para que no dependa de qué fase lo produjo.
 */
export function nombresDelMundo(mundo) {
  const servicios = [];
  for (const s of mundo?.settlements ?? []) for (const p of s.services ?? []) if (p?.name) servicios.push(p.name);
  return {
    nucleo: (mundo?.settlements ?? []).map((s) => s.name).filter(Boolean),
    servicio: servicios,
    paraje: (mundo?.parajes ?? []).map((p) => p.name).filter(Boolean),
    calzada: (mundo?.routes ?? []).filter((r) => !r.ramal).map((r) => r.name).filter(Boolean),
    ramal: (mundo?.routes ?? []).filter((r) => r.ramal).map((r) => r.name).filter(Boolean),
  };
}

// Etiquetas de UI (siempre en castellano: es el idioma de la interfaz,
// independiente del idioma de los nombres de fantasía).
export const POI_LABELS = {
  posada: 'Posada — descansar y pasar la noche',
  taberna: 'Taberna — hablar con aldeanos y obtener trabajos',
  boticario: 'Boticario — plantas curativas y remedios',
  armeria: 'Armería y herrero — armas y armaduras',
  conjureria: 'Conjurería — libros y pergaminos mágicos',
  mercado: 'Mercado — provisiones y objetos varios',
};
