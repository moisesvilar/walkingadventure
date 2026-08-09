// El visor del anclaje y la ficha de texto: **qué se enseña al llegar a un sitio**, y
// el vocabulario que ningún texto de esta capa puede decir.
//
// Lo que hace difícil esta capa no es el arrastre —eso es gesto y vive en `app/`—: es
// que hay **tres presentaciones y una sola regla que elige entre ellas**, y esa regla
// tiene que ser determinista y comprobable sin dispositivo. Con ilustración y con foto,
// el visor entero; con ilustración y sin foto, el visor **abre igual** y el arrastre
// descubre la cartela sobre fondo liso; sin ilustración, la ficha. Por eso la elección,
// la composición de las dos cartelas y la de la ficha son funciones puras del paquete:
// entran el sitio del mundo congelado, el inventario de recursos, la respuesta del
// lector y el registro de sitios pisados, y sale una descripción de qué enseñar.
//
// Dos decisiones que van escritas aquí porque el orden en que se hacen las cosas es lo
// que las sostiene:
//
// - **La presentación se resuelve contra el registro de sitios pisados anterior a la
//   llegada, y la anotación se escribe después.** Anotar antes haría que la primera
//   visita se resolviera como segunda y que el visor no se abriera nunca solo, que es
//   degradación silenciosa de las de §6h. Por eso `alLlegar` es una operación y no dos
//   llamadas que haya que acordarse de ordenar.
// - **«Sin anunciar que falte nada» es una lista cerrada de palabras**, y no una
//   intención. Se comprueba sobre todo lo que esta capa produce, y se puede poner rojo.
//
// Y una frontera: aquí no se pide nada a la red, no se lee ningún fichero y no se lee
// el reloj. El lector de recursos binarios entra **inyectado**, que es lo que permite
// afirmar los tres casos de presentación sin un solo fichero de imagen.

import { congelaHondo } from '../core/congelar.js';
import { CATALOGO_ADMISION } from '../world/anclajes.js';
import { PARAJE_INFO } from '../world/parajes.js';
import { ESTADOS, claveDeElemento, escenaDominante } from './recursos.js';
import { MODOS } from './secuencia.js';

// --- El vocabulario prohibido -----------------------------------------------------

/**
 * La lista **cerrada** de palabras que ningún texto de esta capa puede contener.
 *
 * Es lo que convierte «sin anunciar que falte nada» en algo comprobable en lugar de en
 * una intención. Anunciar la ausencia solo serviría para señalar algo que quien juega no
 * puede arreglar, así que la ausencia no se representa: se sustituye.
 *
 * Si algún día un texto legítimo necesitara una de estas palabras, **se cambia la lista
 * y se dice por qué**, que es justo el debate que esto obliga a tener.
 */
export const VOCABULARIO_PROHIBIDO = congelaHondo([
  'error',
  'fallo',
  'no disponible',
  'sin conexión',
  'sin cobertura',
  'reintentar',
  'cargar',
  'descargar',
  'imagen no',
  'foto no',
  'falta',
  'pendiente',
]);

/**
 * Sin tildes y en minúsculas, que es como se comparan las palabras de la lista.
 *
 * Se normaliza a los dos lados —el texto y la palabra— para que «Sin Conexión» y «sin
 * conexion» sean la misma infracción: una lista que solo cazara la forma exacta se
 * esquivaría sin querer con una mayúscula.
 */
function llano(texto) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Con límites de palabra y no por subcadena: «descargar» lleva «cargar» dentro y son
// dos infracciones distintas, pero «encargar» no es ninguna de las dos y marcarla
// obligaría a reescribir textos legítimos para contentar a la comprobación.
const LIMITE = '[a-z0-9]';

function expresionDe(palabra) {
  const escapada = llano(palabra).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<!${LIMITE})${escapada}(?!${LIMITE})`, 'g');
}

const EXPRESIONES = VOCABULARIO_PROHIBIDO.map((palabra) => ({ palabra, expresion: expresionDe(palabra) }));

/**
 * Las palabras del vocabulario prohibido que aparecen en un texto, en el orden de la
 * lista. Lista vacía es la respuesta normal.
 */
export function infraccionesDeVocabulario(texto) {
  if (typeof texto !== 'string') {
    throw new Error(`la comprobación del vocabulario prohibido recibe un texto y llegó ${JSON.stringify(texto) ?? String(texto)}`);
  }
  const plano = llano(texto);
  const out = [];
  for (const { palabra, expresion } of EXPRESIONES) {
    expresion.lastIndex = 0;
    if (expresion.test(plano)) out.push(palabra);
  }
  return out;
}

/** El texto, o un error que nombra **el texto y la palabra**: el criterio se puede poner rojo. */
export function exigeSinVocabularioProhibido(texto, quien = 'un texto de esta capa') {
  const infracciones = infraccionesDeVocabulario(texto);
  if (infracciones.length) {
    throw new Error(
      `${quien} dice "${infracciones[0]}", que está en el vocabulario prohibido de esta capa: aquí no se anuncia nunca que falte nada, ` +
      `porque señalar algo que quien juega no puede arreglar no le sirve de nada — el texto era "${texto}"`,
    );
  }
  return texto;
}

/** Criba todos los textos de una descripción compuesta, hoja a hoja y por su ruta. */
export function revisaLosTextos(valor, ruta = 'la descripción') {
  if (typeof valor === 'string') {
    exigeSinVocabularioProhibido(valor, ruta);
    return true;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => revisaLosTextos(v, `${ruta}[${i}]`));
    return true;
  }
  if (valor && typeof valor === 'object') {
    for (const clave of Object.keys(valor).sort()) revisaLosTextos(valor[clave], `${ruta}.${clave}`);
    return true;
  }
  return true;
}

// --- Los textos fijos de la capa ---------------------------------------------------

/**
 * Todo lo que esta capa escribe y no sale del mundo. Voz de mundo y ninguna pedagogía:
 * el tirador en el borde ya enseña que hay algo debajo y la línea de la cartela lo dice.
 */
export const TEXTOS = congelaHondo({
  invitacion: 'Arrastra para ver qué hay de verdad.',
  enRealidad: 'Y en realidad',
  fichaEnRealidad: 'En realidad:',
  dePaso: 'No has venido a nada. Simplemente pasabas.',
  volverAMirar: 'Volver a mirar',
  noPega: 'Este sitio no pega',
  seguir: 'Seguir andando',
});

/** Cómo se nombra cada rol en la primera línea de la cartela y de la ficha. */
export const ROTULOS_DE_ROL = congelaHondo({ nucleo: 'Núcleo', servicio: 'Servicio', paraje: 'Paraje' });

/**
 * La línea de remate del lado real, por tipo de fantasía.
 *
 * Sale de la plantilla y **nunca del LLM en marcha**: `seguridad-privacidad.md` §1 dice
 * que el nombre real no entra en ninguna llamada, así que un texto que juegue con el
 * nombre real solo se puede escribir aquí dentro. Y el chiste va siempre **a costa del
 * desajuste y nunca del sitio**, que es gente real con un negocio real.
 */
export const REMATES = congelaHondo({
  ruina: 'De ruina tiene el nombre. Lo demás lo pone quien pasa.',
  piedra: 'La piedra es la misma. El resto se lo hemos puesto nosotros.',
  ermita: 'El nombre viene de más lejos que el sitio.',
  fuente: 'El agua es de verdad. Lo demás, ya veremos.',
  atalaya: 'Se vigila igual desde aquí, aunque no lo llamen así.',
  cruce: 'Dos caminos se cruzan. Con eso basta para inventarse lo demás.',
  puente: 'Cruza igual de bien con un nombre que con otro.',
  monasterio: 'Del recogimiento no queda tanto. Del nombre, todo.',
});

/** El remate de lo que no es un paraje, que es lo mismo que dice el juego entero. */
export const REMATE_DE_REPUESTO = 'El nombre es nuestro. El sitio estaba aquí antes.';

/**
 * El párrafo de la escena, uno por escena del vocabulario.
 *
 * La ficha cuenta tres cosas —nombre de fantasía, qué es en realidad y la escena— y sin
 * este catálogo la tercera no existiría. Se comprueba al cargar el módulo contra las
 * escenas que declara `PARAJE_INFO`: una escena nueva sin línea pone el módulo rojo en
 * lugar de dejar la ficha con un hueco.
 */
export const ESCENAS = congelaHondo({
  guarida: 'Aquí se guarece lo que prefiere que no lo vean.',
  emboscada: 'El camino se estrecha justo aquí, y quien espera lo sabe.',
  misterio: 'Nadie termina de explicar qué pasa aquí, y cada cual tiene su versión.',
  refugio: 'Sirve para pararse, y quien pasa se para.',
  ritual: 'Se viene aquí en ciertas fechas, y se viene en silencio.',
  'revelación': 'Desde aquí se ve lo que desde abajo no se ve.',
  encuentro: 'Aquí se cruza gente que no se buscaba.',
  vigilancia: 'De aquí no se le escapa a nadie quien sube por el camino.',
  peaje: 'Por aquí hay que pasar, y alguien lo sabe antes que tú.',
  duelo: 'Aquí se arreglan las cosas que no se arreglan hablando.',
  saber: 'Aquí se guarda lo que otros escribieron y casi nadie lee.',
});

/**
 * El artículo con el que se dice un anclaje real que no tiene nombre en OSM.
 *
 * El catálogo de admisión es cerrado, así que este también lo es, y se comprueban uno
 * contra otro al cargar el módulo: un `kind` nuevo sin artículo pone el módulo rojo el
 * día que se añada, en vez de dejar la línea de «qué es en realidad» coja.
 */
export const ARTICULO_DE_ANCLAJE = congelaHondo({
  'centro comercial': 'el',
  castillo: 'el',
  monasterio: 'el',
  ruinas: 'las',
  'piedra antigua': 'la',
  parque: 'el',
  monumento: 'el',
  faro: 'el',
  iglesia: 'la',
  mirador: 'el',
  crucero: 'el',
  torre: 'la',
  manantial: 'el',
  biblioteca: 'la',
  fuente: 'la',
  restaurante: 'el',
  'cafetería': 'la',
  'heladería': 'la',
  'comida rápida': 'la',
});

/** Lo que es en realidad un paraje que sale del callejero y no de un anclaje. */
export const DEL_CALLEJERO = congelaHondo({ cruce: 'el cruce de caminos', puente: 'el puente' });

/**
 * Lo que el visor **no añade**, declarado para que su ausencia se pueda poner roja igual
 * que la de un botón. El visor es una capa y no un paso: se cierra con la flecha o
 * tocando fuera, y las dos salidas son la misma.
 */
export const LO_QUE_EL_VISOR_NO_ANADE = congelaHondo([
  'boton-de-aceptar',
  'confirmacion-al-cerrar',
  'indicador-de-pagina',
  'tercera-lamina',
  'tutorial-del-arrastre',
]);

/** Lo que la ficha **no ofrece**, por la misma razón: una acción de más es un anuncio. */
export const LO_QUE_LA_FICHA_NO_OFRECE = congelaHondo([
  'volver-a-mirar-deshabilitado',
  'reintentar',
  'descargar',
  'conectarse',
]);

// Se criban al cargar el módulo y no cuando a alguien se le ocurra llamar: una criba
// que hay que acordarse de invocar es otra pieza que, al no estar, no protesta.
revisaLosTextos(TEXTOS, 'un texto fijo de la capa');
revisaLosTextos(ROTULOS_DE_ROL, 'un rótulo de rol');
revisaLosTextos(REMATES, 'un remate del lado real');
revisaLosTextos(REMATE_DE_REPUESTO, 'el remate de repuesto');
revisaLosTextos(ESCENAS, 'un párrafo de escena');
revisaLosTextos(DEL_CALLEJERO, 'lo que es en realidad un paraje del callejero');

for (const tipo of Object.keys(PARAJE_INFO).sort()) {
  if (!REMATES[tipo]) {
    throw new Error(`el tipo de paraje "${tipo}" no tiene línea de remate en el lado real: el catálogo de tipos y el de remates son el mismo catálogo visto dos veces`);
  }
  for (const escena of Object.keys(PARAJE_INFO[tipo].scenes).sort()) {
    if (!ESCENAS[escena]) {
      throw new Error(`la escena "${escena}" del tipo "${tipo}" no tiene párrafo en la ficha: una escena sin texto dejaría la ficha con un hueco, que es lo que el fallback digno no admite`);
    }
  }
}
for (const entrada of CATALOGO_ADMISION) {
  if (!ARTICULO_DE_ANCLAJE[entrada.kind]) {
    throw new Error(`el anclaje de tipo "${entrada.kind}" (${entrada.etiqueta}) no declara artículo: sin él la línea de «qué es en realidad» de un anclaje sin nombre no se puede escribir`);
  }
}

// --- Las tres presentaciones -------------------------------------------------------

/** Las tres presentaciones, y no hay una cuarta. */
export const PRESENTACIONES = Object.freeze({
  VISOR: 'visor',
  VISOR_SIN_FOTO: 'visor-sin-foto',
  FICHA: 'ficha',
});

/** Las tres, en orden declarado. */
export const IDS_DE_PRESENTACION = congelaHondo([
  PRESENTACIONES.VISOR,
  PRESENTACIONES.VISOR_SIN_FOTO,
  PRESENTACIONES.FICHA,
]);

/** El valor del estado del momento cuando el visor queda disponible y no se abre solo. */
export const ESTADO_A_UN_TOQUE = 'visor-a-un-toque';

/** El vocabulario cerrado de `llegada-estado`: las tres presentaciones y la segunda vez. */
export const ESTADOS_DE_LLEGADA = congelaHondo([...IDS_DE_PRESENTACION, ESTADO_A_UN_TOQUE]);

/** Los dos lados del visor. No hay terceras láminas: es una revelación, no una galería. */
export const LADOS = Object.freeze({ FICCION: 'ficcion', REAL: 'real' });

/** Los dos, en orden de recorrido. */
export const IDS_DE_LADO = congelaHondo([LADOS.FICCION, LADOS.REAL]);

/**
 * El recorrido del tirador, de 0 (ficción) a 1 (real), con su punto de cruce.
 *
 * El cruce va **a la mitad**: el gesto tiene que sentirse ganado pero nunca costoso, y
 * un cruce cerca del final obligaría a un arrastre casi completo. Y soltar exactamente
 * en el cruce cae al lado real, porque devolverlo a la ficción se lee como un rechazo.
 */
export const TIRADOR = congelaHondo({ min: 0, max: 1, inicio: 0, cruce: 0.5 });

/** El punto de cruce, suelto, que es el número que más se cita. */
export const PUNTO_DE_CRUCE = TIRADOR.cruce;

/** Una posición del tirador dentro del rango declarado, o un error que nombra lo recibido. */
export function exigePosicionDeTirador(t, quien = 'la posición del tirador del visor') {
  if (typeof t !== 'number' || !Number.isFinite(t) || t < TIRADOR.min || t > TIRADOR.max) {
    throw new Error(`${quien} llega como ${JSON.stringify(t) ?? String(t)} y el recorrido declarado va de ${TIRADOR.min} a ${TIRADOR.max}`);
  }
  return t;
}

/** Qué lado está puesto en una posición del tirador. El cruce ya cuenta como real. */
export function ladoEnPosicion(t) {
  return exigePosicionDeTirador(t) >= TIRADOR.cruce ? LADOS.REAL : LADOS.FICCION;
}

/**
 * Dónde queda el tirador al soltarlo: dos posiciones estables y ninguna intermedia.
 *
 * Es un slider de dos posiciones y no un carrusel: soltar antes del cruce devuelve a la
 * ficción y la cartela no ha cambiado; soltar en el cruce o después lo lleva al real.
 */
export function alSoltar(t) {
  const lado = ladoEnPosicion(t);
  return congelaHondo({ lado, posicion: lado === LADOS.REAL ? TIRADOR.max : TIRADOR.min });
}

/** La cartela que está puesta en una posición del tirador. Nunca las dos a la vez. */
export function cartelaEnPosicion(visor, t) {
  if (!visor || !visor.cartelas) {
    throw new Error(`la cartela se pide sobre un visor ya compuesto y llegó ${JSON.stringify(visor) ?? String(visor)}`);
  }
  return ladoEnPosicion(t) === LADOS.REAL ? visor.cartelas.real : visor.cartelas.ficcion;
}

// --- El sitio, tal como esta capa lo mira -------------------------------------------

function exigeNombreDeFantasia(sitio) {
  const nombre = sitio?.nombre ?? sitio?.name ?? null;
  if (typeof nombre !== 'string' || !nombre.trim()) {
    const rol = sitio?.rol ?? 'sitio';
    const tipo = sitio?.tipo ?? 'sin tipo';
    throw new Error(
      `el ${rol} de tipo "${tipo}" no tiene nombre de fantasía, así que no se le puede componer ni cartela ni ficha: ` +
      'una cartela vacía enseñaría el hueco en lugar de decir que el nombre no llegó',
    );
  }
  return nombre;
}

/**
 * El sitio del mundo congelado tal como lo mira esta capa: rol, tipo del vocabulario del
 * juego, rótulo, escena dominante y la ficha del lado real.
 *
 * Núcleos, servicios y parajes, que son los tres a los que se llega. El nombre es el
 * identificador, como en el resto de la partida.
 */
export function sitiosDelMundo(mundo) {
  if (!mundo || typeof mundo !== 'object') {
    throw new Error(`los sitios de una llegada salen del mundo congelado y llegó ${JSON.stringify(mundo) ?? String(mundo)}`);
  }
  const indice = new Map();
  const anota = (sitio) => {
    const nombre = exigeNombreDeFantasia(sitio);
    if (!indice.has(nombre)) indice.set(nombre, congelaHondo(sitio));
  };
  for (const s of mundo.settlements ?? []) {
    anota({ rol: 'nucleo', nombre: s.name, tipo: s.type, label: null, escena: null, real: s.anchor ?? null, origen: s.anchor ? 'anclaje' : 'geometria' });
    for (const v of s.services ?? []) {
      anota({ rol: 'servicio', nombre: v.name, tipo: v.kind, label: v.label ?? null, escena: null, real: v.real ?? null, origen: 'anclaje' });
    }
  }
  for (const p of mundo.parajes ?? []) {
    anota({ rol: 'paraje', nombre: p.name, tipo: p.type, label: p.label ?? null, escena: escenaDominante(p.scenes), real: p.real ?? null, origen: p.origin ?? (p.real ? 'anclaje' : 'grafo') });
  }
  return indice;
}

/** El sitio de un mundo por su nombre, o un error que nombra el sitio y el mapa. */
export function sitioDelMundo(mundo, nombre) {
  const sitio = sitiosDelMundo(mundo).get(nombre);
  if (!sitio) {
    throw new Error(`"${nombre}" no es ningún sitio de este mundo, así que no tiene ni visor ni ficha: a un sitio se le nombra, y el nombre es el identificador`);
  }
  return sitio;
}

/** La clave con la que vive la ilustración de un sitio en la capa de recursos. */
export function claveDeIlustracionDeSitio(sitio) {
  return claveDeElemento(sitio?.tipo, exigeNombreDeFantasia(sitio));
}

/** La clave con la que vive la foto del lado real de un sitio, o `null` si no hay sitio de Places. */
export function claveDeFotoDeSitio(sitio) {
  const placeId = sitio?.real?.placeId ?? null;
  return placeId ? `places:${placeId}` : null;
}

/**
 * El referente del lado real: cómo se llama de verdad y con qué palabras se dice.
 *
 * Tres orígenes y ninguno más. Un anclaje con nombre en OSM se dice por su nombre; uno
 * sin nombre **se dice por su etiqueta** y nunca queda vacío ni dice que se desconoce; y
 * un paraje que sale del callejero —un cruce, un puente— se dice por lo que es. `null`
 * es una respuesta y significa que no hay nada real que descubrir: un núcleo colocado
 * por geometría no tiene lado real, y eso no es un olvido (§6p).
 */
export function referenteReal(sitio) {
  const real = sitio?.real ?? null;
  if (real) {
    const nombre = typeof real.name === 'string' && real.name.trim() ? real.name.trim() : null;
    if (nombre) return congelaHondo({ nombre, deQue: nombre, porEtiqueta: false });
    const kind = real.kind ?? null;
    const articulo = kind ? ARTICULO_DE_ANCLAJE[kind] : null;
    if (!articulo) {
      throw new Error(
        `el anclaje real de "${sitio.nombre}" declara el tipo ${JSON.stringify(kind) ?? String(kind)}, que no está en el catálogo de admisión: ` +
        'sin él no hay manera de decir qué es en realidad, y dejar la línea vacía es exactamente lo que el fallback digno no admite',
      );
    }
    const dicho = `${articulo} ${kind}`;
    return congelaHondo({ nombre: dicho, deQue: dicho, porEtiqueta: true });
  }
  const delCallejero = DEL_CALLEJERO[sitio?.tipo] ?? null;
  if (delCallejero) return congelaHondo({ nombre: delCallejero, deQue: delCallejero, porEtiqueta: true });
  return null;
}

/** La primera línea de la cartela y de la ficha: «Paraje · vigilancia». */
export function rotuloDeTipo(sitio) {
  const rol = ROTULOS_DE_ROL[sitio?.rol];
  if (!rol) {
    throw new Error(`el sitio "${sitio?.nombre}" declara el rol ${JSON.stringify(sitio?.rol) ?? String(sitio?.rol)}, que no es ninguno de los declarados: ${Object.keys(ROTULOS_DE_ROL).join(', ')}`);
  }
  const matiz = sitio.escena ?? sitio.label ?? sitio.tipo ?? null;
  return matiz ? `${rol} · ${String(matiz).toLowerCase()}` : rol;
}

// --- La frontera de inyección -------------------------------------------------------

function exigeLector(lector) {
  const falta = !lector || typeof lector.tiene !== 'function' || typeof lector.lee !== 'function';
  if (falta) {
    throw new Error(
      'el lector de recursos binarios no está cableado y la presentación no se resuelve sin él: sin mirar el almacén, un recurso perdido y uno que ' +
      'nunca se tuvo son indistinguibles, y el visor abriría con un lado en blanco. Se monta con { tiene(referencia), lee(referencia) }',
    );
  }
  return lector;
}

function exigePisados(pisados) {
  if (!pisados || typeof pisados.yaVisitado !== 'function') {
    throw new Error(
      'el registro de sitios pisados no está cableado y la presentación no se resuelve sin él: sin él toda llegada sería la primera y el visor se ' +
      'abriría solo cada vez. Se monta con { yaVisitado(sitio), anota(sitio) }',
    );
  }
  return pisados;
}

function exigeRecursos(recursos) {
  if (!recursos || typeof recursos !== 'object' || !Array.isArray(recursos.ilustraciones) || !Array.isArray(recursos.fotos)) {
    throw new Error(
      `el inventario de recursos del mundo congelado llega como ${JSON.stringify(recursos) ?? String(recursos)}: un mundo sin ningún recurso se declara ` +
      'con { ilustraciones: [], fotos: [], textos: [] }, que es el modo sin cobertura y es una respuesta — caer a una lista vacía por defecto haría ' +
      'que nadie cableara el inventario y nadie se enterara',
    );
  }
  return recursos;
}

/**
 * La referencia binaria de un recurso declarado, o `null` si no está declarado residente.
 *
 * **Falla nombrando el sitio y el recurso** cuando el documento promete un binario que el
 * almacén no tiene: perderlo y no haberlo tenido nunca no pueden dar la misma pantalla,
 * porque entonces un mundo roto se ve igual que un mundo sin cobertura.
 */
function referenciaResidente(declaracion, lector, quien) {
  if (!declaracion || declaracion.estado !== ESTADOS.RESIDENTE) return null;
  const referencia = declaracion.recurso ?? null;
  if (referencia == null || lector.tiene(referencia) !== true) {
    throw new Error(
      `${quien} está declarada residente y su recurso ${JSON.stringify(referencia) ?? String(referencia)} no está en el almacén: se ha perdido, que no es ` +
      'lo mismo que no haberlo tenido nunca, y abrir el visor con un lado en blanco haría las dos cosas indistinguibles',
    );
  }
  return referencia;
}

function binarioDe(lector, referencia, quien) {
  const binario = lector.lee(referencia);
  if (binario == null) {
    throw new Error(`${quien} está en el almacén con la referencia ${JSON.stringify(referencia)} y el lector no la entrega: un lado del visor sin imagen es un lado en blanco`);
  }
  return binario;
}

// --- La regla que elige entre las tres ----------------------------------------------

/**
 * Qué enseña la llegada a un sitio. **Función pura**: entran el sitio del mundo
 * congelado, el inventario de recursos, el lector y el registro de sitios pisados, y
 * sale una de las tres presentaciones y nunca ninguna otra ni ninguna vacía.
 *
 * La regla entera, en tres líneas: sin ilustración, la ficha, tenga o no tenga foto;
 * con ilustración y con foto, el visor con sus dos lados; con ilustración y sin foto, el
 * visor **igual**, con el lado real sobre fondo liso. Se pierde la foto, no el momento.
 *
 * Y un cuarto caso que no es una cuarta presentación: un sitio del que no hay **nada
 * real que descubrir** —un núcleo colocado por geometría, sin anclaje— cae a la ficha,
 * porque un visor cuyo lado real no dice nada es un visor sin revelación.
 *
 * @returns `{ sitio, presentacion, modo, estado, abreSola, ilustracion, foto }`, congelado.
 *   `modo` es el de la secuencia: **encadenado** lo trae llegar, **a un toque** está
 *   disponible y no se abre solo, que es la segunda visita.
 */
export function resuelvePresentacion({ sitio, recursos, lector, pisados }) {
  const nombre = exigeNombreDeFantasia(sitio);
  exigeRecursos(recursos);
  exigeLector(lector);
  exigePisados(pisados);

  const claveIlustracion = claveDeIlustracionDeSitio(sitio);
  const ilustracion = referenciaResidente(
    recursos.ilustraciones.find((i) => i.elemento === claveIlustracion) ?? null,
    lector,
    `la ilustración de "${nombre}"`,
  );

  const claveFoto = claveDeFotoDeSitio(sitio);
  const foto = claveFoto
    ? referenciaResidente(recursos.fotos.find((f) => f.anclaje === claveFoto) ?? null, lector, `la foto de "${nombre}"`)
    : null;

  const referente = referenteReal(sitio);
  const hayVisor = ilustracion !== null && referente !== null;
  const presentacion = !hayVisor
    ? PRESENTACIONES.FICHA
    : foto !== null
      ? PRESENTACIONES.VISOR
      : PRESENTACIONES.VISOR_SIN_FOTO;

  // La ficha no ofrece volver a mirar nada, así que su modo es siempre el de llegar: una
  // acción deshabilitada es el anuncio más ruidoso que hay.
  const modo = presentacion === PRESENTACIONES.FICHA || pisados.yaVisitado(nombre) !== true
    ? MODOS.ENCADENADO
    : MODOS.A_UN_TOQUE;

  return congelaHondo({
    sitio: nombre,
    presentacion,
    modo,
    estado: modo === MODOS.A_UN_TOQUE ? ESTADO_A_UN_TOQUE : presentacion,
    // El visor de la primera visita se abre solo; el de la segunda espera un dedo.
    abreSola: presentacion !== PRESENTACIONES.FICHA && modo === MODOS.ENCADENADO,
    ilustracion,
    foto,
  });
}

// --- Las dos cartelas y la ficha ------------------------------------------------------

/** La cartela del lado de la ficción: el tipo, el nombre inventado y la invitación. */
export function cartelaDeFiccion(sitio) {
  return congelaHondo({
    lado: LADOS.FICCION,
    tipo: rotuloDeTipo(sitio),
    nombre: exigeNombreDeFantasia(sitio),
    invitacion: TEXTOS.invitacion,
  });
}

/**
 * La cartela del lado real: el encabezado, el nombre real y el remate.
 *
 * La línea de invitación no está, y su ausencia es la pieza: ya se arrastró.
 */
export function cartelaReal(sitio) {
  const referente = referenteReal(sitio);
  if (!referente) {
    throw new Error(
      `"${sitio?.nombre}" no tiene ni anclaje real ni origen en el callejero, así que no hay lado real que descubrir y no se le puede componer la cartela real: ` +
      'un sitio así se resuelve como ficha, no como visor con un lado que no dice nada',
    );
  }
  return congelaHondo({
    lado: LADOS.REAL,
    encabezado: TEXTOS.enRealidad,
    nombre: referente.nombre,
    remate: REMATES[sitio.tipo] ?? REMATE_DE_REPUESTO,
  });
}

/**
 * El visor entero: los dos lados, las dos cartelas y el recorrido del tirador.
 *
 * Sin foto **abre igual**: `real.foto` es `null`, `real.fondoLiso` es `true` y la cartela
 * lleva las mismas tres líneas. La ausencia no se representa, se sustituye — un hueco de
 * imagen o un icono de imagen rota serían exactamente el anuncio que está prohibido.
 */
export function componeVisor({ sitio, recursos, lector, pisados }) {
  const presentacion = resuelvePresentacion({ sitio, recursos, lector, pisados });
  if (presentacion.presentacion === PRESENTACIONES.FICHA) {
    throw new Error(`"${presentacion.sitio}" se resuelve como ficha de texto y no tiene visor: componer uno abriría una capa con el lado de la ficción vacío`);
  }
  const visor = congelaHondo({
    sitio: presentacion.sitio,
    presentacion: presentacion.presentacion,
    modo: presentacion.modo,
    estado: presentacion.estado,
    abreSola: presentacion.abreSola,
    ficcion: { imagen: binarioDe(lector, presentacion.ilustracion, `la ilustración de "${presentacion.sitio}"`) },
    real: presentacion.foto
      ? { foto: binarioDe(lector, presentacion.foto, `la foto de "${presentacion.sitio}"`), fondoLiso: false }
      : { foto: null, fondoLiso: true },
    cartelas: { ficcion: cartelaDeFiccion(sitio), real: cartelaReal(sitio) },
    tirador: TIRADOR,
    // Con el nombre del sitio y no un icono de lupa: «Volver a mirar O Torreón Esquecido»
    // es del mundo y una lupa es de la aplicación, y este momento no admite ese registro.
    volverAMirar: `${TEXTOS.volverAMirar} ${presentacion.sitio}`,
  });
  revisaLosTextos(visor.cartelas, `una cartela del visor de "${visor.sitio}"`);
  exigeSinVocabularioProhibido(visor.volverAMirar, `la acción de volver a mirar "${visor.sitio}"`);
  return visor;
}

/**
 * La ficha de texto: nombre de fantasía, qué es en realidad y la escena.
 *
 * **No es un estado vacío del visor: es una pantalla del juego**, y por eso lleva las
 * mismas tres líneas tenga el sitio foto o no la tenga, y ni una palabra sobre lo que no
 * hay. El tipo de fantasía y lo que el sitio es en realidad pueden no tener nada que ver
 * —una ruina puede ser un chiringuito— y eso no es un fallo: está desacoplado a propósito.
 */
export function componeFicha({ sitio }) {
  const nombre = exigeNombreDeFantasia(sitio);
  const referente = referenteReal(sitio);
  if (!referente) {
    throw new Error(
      `"${nombre}" no tiene ni anclaje real ni origen en el callejero, así que su ficha no puede decir qué es en realidad: ` +
      'un núcleo colocado por geometría no tiene lado real, y su llegada es lo que allí se cuenta y no una ficha',
    );
  }
  const ficha = congelaHondo({
    sitio: nombre,
    tipo: rotuloDeTipo(sitio),
    nombre,
    enRealidad: `${TEXTOS.fichaEnRealidad} ${referente.deQue}.`,
    escena: sitio.escena ? ESCENAS[sitio.escena] : null,
    visita: TEXTOS.dePaso,
    // El descarte del anclaje es de la fila 35; de ella aquí solo sale el sitio donde se toca.
    descartar: TEXTOS.noPega,
    seguir: TEXTOS.seguir,
  });
  revisaLosTextos(ficha, `la ficha de "${nombre}"`);
  return ficha;
}

// --- Lo que esta capa anota, y lo que no ----------------------------------------------

/** Lo que el apunte de haber mirado un sitio **no lleva**, declarado para poder afirmarlo. */
export const LO_QUE_EL_APUNTE_NO_LLEVA = congelaHondo(['x', 'y', 'lat', 'lon', 'coordenada', 'trazado', 'distancia']);

/**
 * El apunte que deja mirar un sitio: **su identificador y el momento**, y ni una coordenada.
 *
 * Lo que esta capa no hace es cobrarlo: el entintado del mapa llega de golpe al telón, y
 * aquí no vibra nada, no se dibuja nada y no se felicita nada. El momento llega inyectado
 * —el día de la partida y el paso del mundo—, que dentro del núcleo leer el reloj está
 * prohibido.
 */
export function apunteDeLoMirado({ sitio, dia, paso }) {
  const nombre = typeof sitio === 'string' ? sitio : exigeNombreDeFantasia(sitio);
  if (!Number.isInteger(dia) || !Number.isInteger(paso)) {
    throw new Error(
      `el apunte de haber mirado "${nombre}" llega con dia=${JSON.stringify(dia) ?? String(dia)} y paso=${JSON.stringify(paso) ?? String(paso)}: ` +
      'el momento entra inyectado porque el núcleo no lee el reloj del sistema',
    );
  }
  return congelaHondo({ sitio: nombre, dia, paso });
}

// --- La capa --------------------------------------------------------------------------

/**
 * Monta la capa del visor sobre un mundo congelado.
 *
 * @param {object} piezas
 *   `mundo` el mundo congelado del mapa activo; `recursos` su inventario de recursos, tal
 *   como llega en el documento; `lector` el de recursos binarios, inyectado; `visitados`
 *   el registro de sitios pisados de SPEC-016, que **no se vacía al echar el telón**.
 */
export function creaVisor({ mundo, recursos, lector, visitados }) {
  const sitios = sitiosDelMundo(mundo);
  exigeRecursos(recursos);
  exigeLector(lector);
  exigePisados(visitados);

  const sitioDe = (nombre) => {
    const sitio = sitios.get(nombre);
    if (!sitio) {
      throw new Error(`"${nombre}" no es ningún sitio de este mundo, así que no tiene ni visor ni ficha: a un sitio se le nombra, y el nombre es el identificador`);
    }
    return sitio;
  };

  return {
    /** Los sitios del mundo, por su nombre. */
    sitio: sitioDe,

    /** Qué enseña la llegada a un sitio, **sin anotar nada**. */
    presentacionDe(nombre) {
      return resuelvePresentacion({ sitio: sitioDe(nombre), recursos, lector, pisados: visitados });
    },

    /**
     * La llegada a un sitio: **se resuelve contra el registro anterior y se anota después**.
     *
     * Es una sola operación y no dos llamadas que haya que acordarse de ordenar, y esa es
     * toda su razón de existir: anotar antes de resolver haría que la primera visita se
     * resolviera como segunda y el visor no se abriría nunca solo.
     */
    alLlegar(nombre) {
      if (typeof visitados.anota !== 'function') {
        throw new Error(`el registro de sitios pisados no sabe anotar, así que la llegada a "${nombre}" no se puede registrar. Se monta con { yaVisitado(sitio), anota(sitio) }`);
      }
      const presentacion = this.presentacionDe(nombre);
      visitados.anota(presentacion.sitio);
      return presentacion;
    },

    /** El visor de un sitio, con sus dos lados y sus dos cartelas. */
    visorDe(nombre) {
      return componeVisor({ sitio: sitioDe(nombre), recursos, lector, pisados: visitados });
    },

    /** La ficha de texto de un sitio. */
    fichaDe(nombre) {
      return componeFicha({ sitio: sitioDe(nombre) });
    },

    /**
     * Todos los textos que esta capa produce sobre este mundo, para poder buscar en ellos
     * el vocabulario prohibido **sobre todos** y no sobre una muestra.
     */
    textos() {
      const out = [];
      const recoge = (valor) => {
        if (typeof valor === 'string') out.push(valor);
        else if (Array.isArray(valor)) valor.forEach(recoge);
        else if (valor && typeof valor === 'object') for (const clave of Object.keys(valor).sort()) recoge(valor[clave]);
      };
      for (const nombre of [...sitios.keys()].sort()) {
        const sitio = sitios.get(nombre);
        const presentacion = resuelvePresentacion({ sitio, recursos, lector, pisados: visitados });
        if (presentacion.presentacion === PRESENTACIONES.FICHA) {
          if (referenteReal(sitio)) recoge(componeFicha({ sitio }));
          continue;
        }
        const visor = componeVisor({ sitio, recursos, lector, pisados: visitados });
        recoge(visor.cartelas);
        recoge(visor.volverAMirar);
      }
      return congelaHondo(out);
    },
  };
}
