// Quién juega: nombre, género gramatical, oficio y tramo. Es el área del estado que
// el arranque rellena, y la única del personaje que existe — porque el personaje
// tiene identidad y **no tiene cuerpo** (`game-design/personaje.md` §1).
//
// Vive en el paquete y no en la pantalla por lo mismo que la secuencia del arranque:
// el femenino de origen, el tope del nombre, el sorteo de sugerencias con las
// femeninas primero y **la permanencia del oficio** son reglas del estado, no botones
// que una pantalla no dibuja. Un oficio que solo es permanente porque los ajustes no
// lo ofrecen deja de serlo el día que alguien añade otra pantalla.
//
// Y una regla que este módulo sostiene por construcción: **nada de aquí toca el
// cuerpo**. No hay velocidad, ni resistencia, ni fatiga, ni distancia; el esfuerzo es
// del tramo, que es del cuerpo de quien juega y no del personaje que interpreta.

import { congelaHondo } from '../core/congelar.js';
import { makeRng, pick } from '../core/rng.js';
import { exigeSemilla, semillaDeSugerencias } from '../core/semilla.js';
import { exigeNombres } from '../names/index.js';
import { GENERO_POR_DEFECTO, resuelveConcordancia } from '../names/lenguaje.js';
import { OFICIOS, exigeOficio } from '../quests/oficios.js';
import { GENEROS, IDS_DE_GENERO, exigeGenero } from './puestos.js';
import { declaraTramo } from './tramo.js';

/** Los dos géneros gramaticales. Son los mismos que los del reparto de caras, a propósito. */
export { GENEROS, IDS_DE_GENERO };

/**
 * El género con el que **llega** un personaje recién creado.
 *
 * Femenino, y no es un valor por defecto que tape un olvido: es la decisión declarada
 * de `game-design/lenguaje.md` —«en la duda, femenino»— y se reexporta desde donde ya
 * vive en lugar de escribirla otra vez, para que cambiarla sea imposible a medias.
 */
export const GENERO_DE_ORIGEN = GENERO_POR_DEFECTO;

/**
 * El tope de longitud del nombre escrito a mano.
 *
 * El nombre acaba dentro de textos generados —el mundo llama a alguien por su nombre
 * a partir del hito— y un nombre larguísimo los rompe por donde no se ve. El número
 * vive aquí y **no se enseña**: la pantalla dice que es demasiado largo, sin nombrar
 * ninguna cifra interna.
 */
export const TOPE_DEL_NOMBRE = 24;

/**
 * Cuántas sugerencias se sortean. Cuatro, porque caben en una línea a cualquier
 * tamaño de letra; el número vive aquí para que cambiarlo no toque la pantalla.
 */
export const SUGERENCIAS_DE_NOMBRE = 4;

/**
 * El reparto de género de las sugerencias, **en el orden en que se enseñan**.
 *
 * Dos femeninas y dos masculinas: `lenguaje.md` pide femeninos primero y repertorio
 * equilibrado. Cuatro femeninas convertirían un sesgo en una imposición, y seguir al
 * género elegido obligaría a resortear cada vez que se cambia, que es ruido.
 */
export const REPARTO_DE_SUGERENCIAS = congelaHondo([
  GENEROS.FEMENINO,
  GENEROS.FEMENINO,
  GENEROS.MASCULINO,
  GENEROS.MASCULINO,
]);

/** Los campos del personaje. Lista cerrada: el esquema del estado no admite ninguno más. */
export const CAMPOS_DEL_PERSONAJE = congelaHondo(['nombre', 'genero', 'oficio', 'oficioPermanente', 'tramo']);

/**
 * Lo que un personaje no puede tener nunca, nombrado para que la ausencia se pueda
 * poner roja.
 *
 * `personaje.md` §1 es categórico —«el personaje tiene identidad, pero no cuerpo»— y
 * una lista de campos prohibidos es más barata de comprobar que revisar a ojo cada
 * spec que toque el personaje. El día que alguien añada `resistencia`, falla aquí.
 */
export const CAMPOS_DE_CUERPO_PROHIBIDOS = congelaHondo([
  'velocidad', 'resistencia', 'fatiga', 'aguante', 'fuerza', 'destreza', 'vitalidad',
  'energia', 'cansancio', 'distancia', 'alcance', 'nivel', 'experiencia',
]);

/** Los motivos por los que un nombre escrito a mano no se guarda. Catálogo cerrado. */
export const MOTIVOS_DEL_NOMBRE = Object.freeze({
  /** Se vació el campo del todo: no se guarda un nombre vacío, vuelve el precargado. */
  VACIO: 'nombre-vacio',
  /** Pasa del tope. La pantalla lo dice sin nombrar el número. */
  DEMASIADO_LARGO: 'nombre-demasiado-largo',
  /** El filtro de aptitud lo rechaza. La pantalla lo dice **sin repetirlo**. */
  NO_VALE: 'nombre-que-no-vale',
});

/** Un personaje recién creado: sin nombre, en femenino, sin oficio y sin tramo. */
export function estadoDePersonaje() {
  return { nombre: null, genero: GENERO_DE_ORIGEN, oficio: null, oficioPermanente: false, tramo: null };
}

// --- El nombre ----------------------------------------------------------------

/** El repertorio de un género en un paquete, o un error que nombra el paquete y la función. */
function repertorioDe(paquete, locale, genero) {
  if (typeof paquete?.personNames !== 'function') {
    throw new Error(
      `el paquete de idioma "${locale}" no implementa personNames(genero): sin él no hay de dónde sortear las sugerencias del arranque, ` +
      'y enseñar una lista vacía sería peor que no enseñarla',
    );
  }
  const repertorio = paquete.personNames(genero);
  if (!Array.isArray(repertorio)) {
    throw new Error(`el paquete de idioma "${locale}" devuelve de personNames(${JSON.stringify(genero)}) algo que no es una lista: ${JSON.stringify(repertorio)}`);
  }
  return repertorio;
}

/**
 * Las cuatro sugerencias de nombre de una ronda, **femeninas primero** y sin repetir.
 *
 * Deterministas: la misma semilla y la misma ronda dan las mismas y en el mismo
 * orden. Un paquete que no tenga repertorio para sortear sin repetir **falla
 * nombrando el paquete y la función que se queda corta**, en lugar de enseñar dos
 * veces el mismo nombre y dejar que parezca una casualidad.
 */
export function sugerenciasDeNombre({ semilla, locale, paquete = null, ronda = 0 }) {
  const nombres = paquete ?? exigeNombres(locale);
  const rng = makeRng(semillaDeSugerencias(exigeSemilla(semilla), ronda));

  // Se comprueba el repertorio entero **antes** de sortear nada: si falta, tiene que
  // fallar igual con suerte que sin ella.
  for (const genero of IDS_DE_GENERO) {
    const hacenFalta = REPARTO_DE_SUGERENCIAS.filter((g) => g === genero).length;
    if (hacenFalta === 0) continue;
    const repertorio = repertorioDe(nombres, locale, genero);
    if (repertorio.length < hacenFalta) {
      throw new Error(
        `el paquete de idioma "${locale}" se queda corto en personNames(${JSON.stringify(genero)}): declara ${repertorio.length} nombres y ` +
        `el arranque sortea ${hacenFalta} sin repetir. Un idioma nuevo trae repertorio suficiente, en vez de enseñar sugerencias repetidas`,
      );
    }
  }

  const sorteadas = [];
  for (const genero of REPARTO_DE_SUGERENCIAS) {
    const libres = repertorioDe(nombres, locale, genero).filter((n) => !sorteadas.includes(n));
    sorteadas.push(pick(rng, libres));
  }
  return congelaHondo(sorteadas);
}

/**
 * Valida un nombre escrito a mano contra el tope y el filtro de aptitud.
 *
 * Devuelve `{ ok, nombre, motivo }` con el motivo del catálogo cerrado y **nunca una
 * frase redactada**: la redacción es del guion del arranque, y el motivo es lo que la
 * pantalla usa para elegir cuál. El nombre válido vuelve **tal cual**, con sus tildes
 * y sus mayúsculas: normalizarlo sería cambiarle el nombre a alguien sin avisar.
 */
export function validaNombre(texto, { filtro, tope = TOPE_DEL_NOMBRE } = {}) {
  if (!filtro || typeof filtro.valida !== 'function') {
    throw new Error(
      'la validación del nombre necesita el filtro de aptitud inyectado (`creaFiltroDeAptitud`): sin él aceptaría cualquier cosa, ' +
      'y ese texto acaba dentro de los textos que lee alguien de once años',
    );
  }
  const escrito = typeof texto === 'string' ? texto.trim() : '';
  if (!escrito) return congelaHondo({ ok: false, nombre: null, motivo: MOTIVOS_DEL_NOMBRE.VACIO, detalle: null });
  if (escrito.length > tope) {
    return congelaHondo({ ok: false, nombre: null, motivo: MOTIVOS_DEL_NOMBRE.DEMASIADO_LARGO, detalle: null });
  }
  const veredicto = filtro.valida(escrito, { tope, esNombre: true });
  if (!veredicto.apto) {
    // El motivo de aptitud viaja como **detalle** y no como texto: la pantalla no lo
    // enseña y no repite el nombre rechazado, que es lo que pide el criterio.
    return congelaHondo({ ok: false, nombre: null, motivo: MOTIVOS_DEL_NOMBRE.NO_VALE, detalle: veredicto.motivo.clave });
  }
  return congelaHondo({ ok: true, nombre: escrito, motivo: null, detalle: null });
}

/**
 * Pone el nombre. Un nombre que no pasa **no se guarda** y el personaje se queda con
 * el que tenía, que en el arranque es siempre el precargado: así vaciar el campo no
 * deja a nadie sin nombre.
 */
export function ponNombre(personaje, texto, { filtro, tope = TOPE_DEL_NOMBRE } = {}) {
  const veredicto = validaNombre(texto, { filtro, tope });
  if (veredicto.ok) personaje.nombre = veredicto.nombre;
  return veredicto;
}

/** Pone el nombre sorteado, sin pasar por el filtro: el repertorio del paquete ya es apto. */
export function precargaNombre(personaje, nombre) {
  if (typeof nombre !== 'string' || !nombre) {
    throw new Error(`el nombre precargado del arranque llega como ${JSON.stringify(nombre) ?? String(nombre)}: sale del sorteo y nunca está vacío`);
  }
  personaje.nombre = nombre;
  return personaje;
}

// --- El género gramatical ------------------------------------------------------

/**
 * Cambia el género gramatical. **Es dato vivo y no siembra nada**: el mundo generado
 * no depende de él, y por eso cambiarlo después del arranque deja el mapa idéntico
 * byte a byte.
 */
export function ponGenero(personaje, genero) {
  personaje.genero = exigeGenero(genero, 'el género gramatical de quien juega');
  return personaje;
}

/**
 * Cómo se dirige el mundo al personaje **ahora**.
 *
 * Antes del hito de fin de arranque, forastera o forastero según su género; después,
 * su nombre. `personaje.md` §1: «el mundo no te llama por tu nombre hasta que te
 * conoce», y el hito de `arranque.md` §3 es justo el momento en que empieza a
 * llamarte por él. La palabra sale del paquete de idioma, no de aquí.
 */
export function comoTeLlaman({ personaje, arranque, locale = 'es' }) {
  const genero = exigeGenero(personaje?.genero ?? GENERO_DE_ORIGEN, 'el género gramatical de quien juega');
  const yaTeConocen = arranque ? arranque.abierto === false || arranque.marcado === true : false;
  if (yaTeConocen) {
    if (typeof personaje?.nombre !== 'string' || !personaje.nombre) {
      throw new Error('el arranque está cerrado y el personaje no tiene nombre: a partir del hito el mundo llama por el nombre, y no hay ninguno que usar');
    }
    return personaje.nombre;
  }
  return resuelveConcordancia('{forastera}', { locale, genero });
}

// --- El oficio -----------------------------------------------------------------

/**
 * Marca el oficio. Se puede cambiar **mientras el arranque no se haya cerrado**: la
 * maqueta da flecha de atrás hasta A1P4 y dice «quien no se convence lo cambia antes
 * de generar nada», así que fijarlo al pulsar «Seguir» haría de esa flecha una
 * promesa falsa.
 */
export function marcaOficio(personaje, oficio) {
  if (personaje?.oficioPermanente) {
    throw new Error(
      `el oficio ya está fijado en "${personaje.oficio}" y no se cambia: es la única palanca mecánica del personaje y lo que le da peso es que ` +
      `haya aventuras que con esta persona no verás nunca (personaje.md §3). La salida es empezar de nuevo. Los declarados son ${OFICIOS.join(', ')}`,
    );
  }
  personaje.oficio = exigeOficio(oficio, 'el oficio que se marca en el arranque');
  return personaje;
}

/**
 * Sella el oficio. Lo llama el cierre del arranque y nadie más: a partir de aquí no
 * hay ajuste ni camino en la ficción que lo cambie.
 */
export function fijaElOficio(personaje) {
  exigeOficio(personaje?.oficio, 'el oficio que se sella al cerrar el arranque');
  personaje.oficioPermanente = true;
  return personaje;
}

// --- El tramo ------------------------------------------------------------------

/** Declara el tramo del personaje a partir de la respuesta del arranque (SPEC-004). */
export function ponTramo(personaje, respuesta) {
  personaje.tramo = declaraTramo(respuesta);
  return personaje;
}

// --- Nada de esto toca el cuerpo -------------------------------------------------

/**
 * Comprueba que un personaje no ha criado cuerpo. Se llama al congelarlo, no solo
 * desde las pruebas: una guarda que nadie invoca es decoración.
 */
export function sinCuerpo(personaje, donde = 'el personaje') {
  for (const campo of Object.keys(personaje ?? {})) {
    if (CAMPOS_DE_CUERPO_PROHIBIDOS.includes(campo)) {
      throw new Error(
        `${donde} declara "${campo}": el personaje tiene identidad y no tiene cuerpo (personaje.md §1). El cansancio, el ritmo y las piernas ` +
        'son de quien juega y ya están medidos por el tramo personal',
      );
    }
  }
  return personaje;
}

// --- Serialización ---------------------------------------------------------------

/** El personaje en forma serializable. Sin nombre, sin oficio o sin tramo es un personaje a medias, y se dice. */
export function congelaPersonaje(personaje) {
  sinCuerpo(personaje, 'el personaje que se guarda');
  const tramo = personaje?.tramo ?? null;
  return {
    nombre: personaje?.nombre ?? null,
    genero: exigeGenero(personaje?.genero ?? GENERO_DE_ORIGEN, 'el género gramatical de quien juega'),
    oficio: personaje?.oficio ?? null,
    oficioPermanente: personaje?.oficioPermanente === true,
    tramo: tramo
      ? {
        respuesta: tramo.respuesta ?? null,
        declaradoM: tramo.declaradoM,
        estimadoM: Number.isFinite(tramo.estimadoM) ? tramo.estimadoM : tramo.declaradoM,
        salidasMedidas: Number.isInteger(tramo.salidasMedidas) ? tramo.salidasMedidas : 0,
      }
      : null,
  };
}

/** El personaje de vuelta de su documento. Un oficio ya sellado vuelve sellado. */
export function levantaPersonaje(doc) {
  const personaje = estadoDePersonaje();
  if (!doc) return personaje;
  personaje.nombre = doc.nombre ?? null;
  personaje.genero = exigeGenero(doc.genero ?? GENERO_DE_ORIGEN, 'el género gramatical guardado');
  personaje.oficio = doc.oficio ?? null;
  if (personaje.oficio !== null) exigeOficio(personaje.oficio, 'el oficio guardado del personaje');
  personaje.oficioPermanente = doc.oficioPermanente === true;
  personaje.tramo = doc.tramo ? { ...doc.tramo } : null;
  return personaje;
}
