// Qué mapa de la partida es el de donde estás, y qué se enseña cuando no hay ninguno.
//
// Vive en `app/` y no en el paquete por lo mismo que `primera-lista.js` y que el propio
// levantamiento: es orquestación. Encadena tres cosas que ya existían y no aporta ni una
// regla propia — la posición del sistema, `resuelveMapaActivo` del núcleo y, cuando la
// respuesta es «ninguno», el topónimo y `componeOfrecimiento`.
//
// Existe porque hasta SPEC-050 **nadie resolvía el mapa activo**: `levantamiento.mapaActivo`
// no tenía un solo consumidor, `NUCLEO_DEL_OFRECIMIENTO` no lo importaba ningún fichero, y
// `antes-de-salir.jsx` aceptaba `ofrecimiento` como propiedad que nadie le pasaba nunca. O
// sea que A2P0 existía, estaba probada y **era inalcanzable**: la mitad de SPEC-041 que
// nunca llegó a la app. Es §6h en su variante de cableado.
//
// Lo que aquí **no** se hace, y es la decisión: no se pregunta nada, no se recuerda ningún
// rechazo y no se ofrece ningún selector. El mapa activo lo decide dónde estás
// (`alcance-del-mundo.md` §3), y al volver a un sitio conocido la portada aparece sin
// transición ni aviso, que es lo que se consigue no haciendo nada especial.

/**
 * Lo que resolver dónde estás necesita del núcleo, ni una función más.
 *
 * Se declara como lista y no se comprueba a ojo por la regla de siempre en este repo: es lo
 * que hace que meter una pieza en `piezas.js` que nadie pide se ponga rojo solo
 * (`test/nucleo/piezas-sin-consumidor.test.mjs`), que es cómo se caza §6h antes de que
 * cueste una fila entera.
 */
export const DEL_NUCLEO_DEL_OFRECIMIENTO = Object.freeze(['hayQueOfrecerMapa', 'componeOfrecimiento']);

/** Lo que levantar un mapa que no es el primero necesita del núcleo, ni una función más. */
export const DEL_NUCLEO_DEL_MAPA_NUEVO = Object.freeze(['correPrologo', 'siembraLaCola']);

/** Las tres respuestas de resolver dónde estás. No hay una cuarta. */
export const DONDE = Object.freeze({
  /** Hay mapa de la partida donde estás: se abre su portada. */
  EN_UN_MAPA: 'en-un-mapa',
  /** No llega ninguno: se ofrece levantar uno. */
  SIN_MAPA: 'sin-mapa',
  /** No se pudo saber dónde estás. Se dice; no se supone que hay mapa ni que no lo hay. */
  NO_SE_SABE: 'no-se-sabe',
});

/**
 * Resuelve dónde estás y, si hace falta, compone el ofrecimiento.
 *
 * @param {object} deps
 *   `levantamiento` el de la app, de quien sale `mapaActivo`; `ubicacion` el proveedor de
 *   posición; `toponimos` el traedor del nombre del sitio, que puede faltar y entonces se
 *   resuelve con el respaldo; `nucleo` las piezas de `NUCLEO_DEL_OFRECIMIENTO`.
 * @param {object} donde `semilla` y `tramoM` de la partida.
 * @returns `{ donde, resolucion, ofrecimiento, motivo }`. **Nunca lanza**: no saber dónde
 *   estás es una respuesta, y convertirla en excepción dejaría la app sin nada que pintar.
 */
export async function resuelveDondeEstas({ levantamiento, ubicacion, toponimos = null, nucleo }, { semilla, tramoM = null } = {}) {
  if (!levantamiento || typeof levantamiento.mapaActivo !== 'function') {
    throw new Error('resolver dónde estás necesita el levantamiento inyectado: es quien sabe qué mapas tiene la partida');
  }
  if (!ubicacion || typeof ubicacion.pide !== 'function') {
    throw new Error('resolver dónde estás necesita el proveedor de ubicación inyectado');
  }
  for (const pieza of DEL_NUCLEO_DEL_OFRECIMIENTO) {
    if (typeof nucleo?.[pieza] !== 'function') {
      throw new Error(`resolver dónde estás necesita ${pieza} del núcleo, y el bloque que llegó no la trae`);
    }
  }

  // Con el permiso ya concedido esto no enseña ningún diálogo: es la misma puerta que usa
  // el arranque, y volver a pedirlo con la partida abierta sería pedirlo por la puerta de
  // atrás. Denegar es una respuesta prevista y **no** significa que no haya mapa donde
  // estás: significa que no se sabe dónde estás, que es otra cosa y se dice.
  let posicion = null;
  try {
    const respuesta = await ubicacion.pide();
    if (respuesta?.concedido !== true) {
      return { donde: DONDE.NO_SE_SABE, resolucion: null, ofrecimiento: null, motivo: 'sin permiso de ubicación no se puede saber en qué mapa estás' };
    }
    posicion = respuesta.posicion;
  } catch (e) {
    return { donde: DONDE.NO_SE_SABE, resolucion: null, ofrecimiento: null, motivo: e?.message ?? 'no se pudo leer la posición' };
  }
  if (!posicion || !Number.isFinite(posicion.lat) || !Number.isFinite(posicion.lon)) {
    return { donde: DONDE.NO_SE_SABE, resolucion: null, ofrecimiento: null, motivo: 'el sensor no ha dado ninguna posición' };
  }

  let resolucion;
  try {
    resolucion = await levantamiento.mapaActivo({ lat: posicion.lat, lon: posicion.lon, semilla, tramoM });
  } catch (e) {
    return { donde: DONDE.NO_SE_SABE, resolucion: null, ofrecimiento: null, motivo: e?.message ?? 'no se pudieron leer los mapas de la partida' };
  }

  if (!nucleo.hayQueOfrecerMapa(resolucion)) {
    return { donde: DONDE.EN_UN_MAPA, resolucion, ofrecimiento: null, motivo: null };
  }

  // El topónimo y el mapa vienen por la misma puerta —la ruta ciega del proxy—, así que
  // si el nombre no llegó, dibujar tampoco iba a llegar: una puerta y no dos. Por eso el
  // mismo `null` gobierna el respaldo del sitio y el aviso de que hoy no se deja dibujar.
  const sitio = toponimos ? await toponimos.nombreDe({ lat: posicion.lat, lon: posicion.lon }) : null;
  return {
    donde: DONDE.SIN_MAPA,
    resolucion,
    // La coordenada **no viaja en el resultado**: lo único que sale de aquí es cómo se
    // llama el sitio, que es lo que la pantalla dice (RF-PRIV-002).
    ofrecimiento: nucleo.componeOfrecimiento(sitio ? { sitio } : { sinRed: true }),
    motivo: null,
  };
}

/**
 * Levanta un mapa donde estás **ahora**, y le corre su prólogo.
 *
 * La posición se vuelve a preguntar y no se reutiliza la de la resolución: entre ver el
 * ofrecimiento y decidirte puedes haber andado, y el mapa se levanta donde estás cuando lo
 * pides. Es además lo que permite que `resuelveDondeEstas` no devuelva ninguna coordenada.
 *
 * **El prólogo va con `primerMapa: false`**, y no es un detalle de paso: la puesta en
 * escena —el par compuesto y la regla de la primera aventura— es del arranque y solo del
 * arranque (`arranque.md` §2), así que un mapa levantado de vacaciones no puede pisar el
 * par del de casa. Y corre sobre **las áreas vivas de la partida**, que aquí ya existe:
 * el trasplante que hace `guardaElPrologo` solo hace falta en el arranque, donde el
 * prólogo corre antes de que haya partida donde asentarlo.
 *
 * Hasta SPEC-050 esto no existía: `levanta()` no corría ningún prólogo, así que un segundo
 * mapa nacía sin rumores, sin nada que contar en sus núcleos y con la cola vacía.
 *
 * @returns `{ levantado, prologo, sembradas }`. Los errores **se propagan**: que no se
 *   pueda levantar un mapa que se ha pedido levantar no es una respuesta, es una avería, y
 *   quien llama tiene dónde enseñarla.
 */
export async function levantaElMapaDeAqui({ levantamiento, ubicacion, nucleo }, { estado, tramoM = null, tamano, anclaje }) {
  // El anclaje llega por la firma y **no se importa de `primera-lista.js`**, que es donde
  // vive: ese módulo cita el paquete por su nombre, y con el import puesto la batería de
  // núcleo dejaba de arrancar en un clon limpio. Lo cazó la guarda del criterio duro de
  // §6u en la misma tanda, que es exactamente para lo que está.
  if (!anclaje || !Number.isFinite(anclaje.x) || !Number.isFinite(anclaje.y)) {
    throw new Error('levantar un mapa aquí necesita el punto de anclaje del mapa, y no lo adivina');
  }
  for (const pieza of DEL_NUCLEO_DEL_MAPA_NUEVO) {
    if (typeof nucleo?.[pieza] !== 'function') {
      throw new Error(`levantar un mapa aquí necesita ${pieza} del núcleo, y el bloque que llegó no la trae`);
    }
  }
  const respuesta = await ubicacion.pide();
  if (respuesta?.concedido !== true || !respuesta.posicion) {
    throw new Error('sin permiso de ubicación no se puede levantar un mapa aquí: el mundo se dibuja alrededor de donde estás');
  }

  const levantado = await levantamiento.levanta({
    lat: respuesta.posicion.lat,
    lon: respuesta.posicion.lon,
    semilla: estado.semilla,
    tramoM,
    tamano,
  });

  const prologo = nucleo.correPrologo({
    semilla: estado.semilla,
    mapaId: levantado.mapaId,
    mundo: levantado.registro.mundo,
    tramoM,
    partida: anclaje,
    primerMapa: false,
    arranque: estado.arranque,
    rumores: estado.rumores,
    nucleos: estado.nucleos,
  });
  // El área de la cola y no el estado entero: es lo que su firma pide, y pasarle el
  // estado protesta en vez de sembrar donde nadie lee.
  const sembradas = nucleo.siembraLaCola(estado.entregas, { mapaId: levantado.mapaId, entradas: prologo.entregas });

  return { levantado, prologo, sembradas };
}
