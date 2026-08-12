// La cadena de migraciones del formato: el registro explícito de pasos, la
// comprobación de que no tiene huecos entre la versión mínima soportada y la actual,
// y la aplicación en orden.
//
// Existe con una condición que es la mitad de su diseño (`pipeline/decisiones-orquestador.md`
// §6o): **tiene que poder ponerse roja hoy**, con la versión de formato todavía en 1 y
// sin ninguna migración real que hacer. Por eso la cadena no es una lista escrita a
// mano dentro de una función sino un dato inyectable: una prueba registra un paso de
// prueba y ejercita el orden, la idempotencia y el fallo por salto ausente sin tocar el
// formato de verdad. Un criterio que se cumple siempre porque no hay nada que migrar no
// mide nada.
//
// Y una regla que es la razón de ser de todo esto: **una migración declara, no deduce**.
// Si un paso introduce un campo que antes no existía, el valor lo trae escrito el propio
// paso. Deducirlo con la lógica del juego haría que migrar el mismo fichero en dos
// versiones distintas diera resultados distintos, que es justo la propiedad que la
// migración existe para no romper.

import { congelaHondo } from '../core/congelar.js';
import { CLASES, VERSION_FORMATO, VERSION_GENERADOR, escribe, esquemaDe } from './formato.js';

/**
 * La versión más antigua que este juego sabe abrir migrando.
 *
 * Es 1 porque 1 es la primera que existió: SPEC-009 declaró el campo desde el primer
 * documento precisamente para que ninguno naciera sin poder migrarse nunca.
 */
export const VERSION_MINIMA_SOPORTADA = 1;

function exigeEntero(valor, quien) {
  if (!Number.isInteger(valor)) {
    throw new Error(`${quien}: se esperaba un entero y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  return valor;
}

/**
 * Un valor que un paso puede introducir: inerte y literal, nunca una función.
 *
 * Es donde se sostiene «no se deduce en el momento»: si por aquí pudiera pasar algo
 * ejecutable, el valor de un campo nuevo dependería de la versión del juego que
 * ejecutara la migración, y dos migraciones del mismo fichero dejarían de coincidir.
 */
function exigeLiteral(valor, ruta) {
  if (typeof valor === 'function') {
    throw new Error(`${ruta}: un paso de migración declara el valor que introduce y no lo calcula, y aquí ha llegado una función`);
  }
  if (valor === undefined) throw new Error(`${ruta}: vale undefined, que no es un valor declarado`);
  if (valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => exigeLiteral(v, `${ruta}[${i}]`));
    return valor;
  }
  for (const clave of Object.keys(valor)) exigeLiteral(valor[clave], `${ruta}.${clave}`);
  return valor;
}

/**
 * Un paso de la cadena: **de qué versión a cuál va**, **sobre qué clase de documento**, y
 * qué hace, dicho en tres operaciones declarativas y ninguna más.
 *
 * - `introduce`: rutas con el valor literal que hay que poner donde antes no había campo.
 * - `quita`: rutas que dejan de existir.
 * - `renombra`: rutas que cambian de sitio conservando su valor.
 *
 * Tres y no una función libre a propósito: con una función, «el paso declara lo que
 * introduce» dejaría de ser comprobable y volveríamos a poder deducir.
 *
 * **`clase` existe porque la versión de formato es una sola para las ocho clases de
 * documento y los campos no lo son.** Medido antes de escribir esto: un paso que introduce
 * `areas.aventuras.…` —un campo que solo tiene el estado de la partida— le mete un `areas`
 * a las ocho, índice de mapa y celda incluidos, y como `migra` valida el resultado contra
 * el esquema cerrado de su clase, **una copia antigua dejaría de poder abrirse entera**. Sin
 * `clase`, la primera migración de verdad del proyecto habría roto todo lo que no fuera el
 * estado. Un paso sin clase declarada sigue aplicándose a todas, que es lo que había y lo
 * que un paso de prueba necesita.
 *
 * La versión **se sube siempre**, aplique el paso o no: lo que la cadena promete es que
 * todo documento de la versión N llega a la N+1, y una clase que no cambia de forma no es
 * una clase que se quede atrás.
 */
export function paso({ de, a, clase = null, introduce = {}, quita = [], renombra = {}, porque = '' } = {}) {
  exigeEntero(de, 'un paso de migración declara de qué versión sale');
  exigeEntero(a, `el paso desde la versión ${de} declara a qué versión llega`);
  if (a !== de + 1) {
    throw new Error(`el paso ${de}→${a} salta más de una versión: la cadena se declara paso a paso para que un hueco se vea, y ${de}→${de + 1} es el único salto que este paso puede declarar`);
  }
  if (clase !== null && (typeof clase !== 'string' || !clase)) {
    throw new Error(`el paso ${de}→${a} declara la clase de documento a la que se aplica y llegó ${JSON.stringify(clase) ?? String(clase)}: o es una clase, o es nulo y se aplica a todas`);
  }
  for (const ruta of Object.keys(introduce)) exigeLiteral(introduce[ruta], `el paso ${de}→${a} introduce "${ruta}"`);
  if (!Array.isArray(quita)) throw new Error(`el paso ${de}→${a}: "quita" es la lista de rutas que dejan de existir`);
  return congelaHondo({ de, a, clase, introduce: { ...introduce }, quita: quita.slice(), renombra: { ...renombra }, porque });
}

/**
 * La cadena: los pasos ordenados por la versión de la que salen.
 *
 * Es un dato y no un módulo con estado: quien quiera ejercitar el mecanismo arma la
 * suya con un paso de prueba y no toca la de verdad.
 */
export function creaCadena(pasos = []) {
  const ordenados = pasos.slice().sort((p, q) => p.de - q.de);
  return congelaHondo({ pasos: ordenados });
}

/**
 * La cadena real del formato. **La primera migración de verdad del proyecto.**
 *
 * Estuvo vacía mientras la versión actual fue la mínima soportada, y eso era correcto: no
 * había ningún salto que cubrir. SPEC-049 abre el primero.
 *
 * **1→2 · con qué sitios marcados se casteó la aventura en curso.** Desde que la lista de hoy
 * respeta los descartes, el casting se rehace cuando los hay, así que la cadena de una
 * aventura ya aceptada tiene que recuperarse contra los sitios que estaban marcados **cuando
 * se aceptó** y no contra los de ahora. El campo no existía, y su valor **se declara aquí y no
 * se deduce**: la lista vacía, que es la que esas partidas tenían de verdad —antes de aquella
 * fila el casting no se rehacía nunca, así que toda aventura en curso se casteó contra ningún
 * sitio marcado—. No es un valor por defecto: es el valor que el documento tenía sin escribirlo.
 *
 * Va **declarado sobre la clase del estado**, y eso no es cosmético: la versión de formato es
 * una sola para las ocho clases de documento, y medido antes de escribir esto, un paso sin
 * clase le mete un `areas` al índice de mapa, a la celda, al registro y a las demás, y como
 * `migra` valida contra el esquema cerrado de cada clase, **una copia antigua dejaría de poder
 * abrirse entera**. Las otras siete suben de versión y no cambian de forma, que es la verdad.
 */
export const CADENA_DEL_FORMATO = creaCadena([
  paso({
    de: 1,
    a: 2,
    clase: CLASES.ESTADO,
    introduce: { 'areas.aventuras.descartesDelCasting': [] },
    porque: 'la aventura en curso declara contra qué sitios marcados se casteó, para que marcar uno a mitad de camino no le cambie la cadena (SPEC-049)',
  }),
]);

/**
 * Que la cadena cubra sin huecos desde una versión hasta otra, o un error que
 * **nombra el salto que falta**.
 *
 * Se puede poner roja hoy mismo: basta registrar una cadena con un hueco.
 */
export function compruebaCadena(cadena, { desde = VERSION_MINIMA_SOPORTADA, hasta = VERSION_FORMATO } = {}) {
  exigeEntero(desde, 'la comprobación de la cadena necesita la versión de partida');
  exigeEntero(hasta, 'la comprobación de la cadena necesita la versión de destino');
  if (hasta < desde) throw new Error(`la cadena se comprueba de la versión ${desde} a la ${hasta}, y ${hasta} es anterior a ${desde}`);
  const pasos = cadena?.pasos ?? [];
  const porOrigen = new Map();
  for (const p of pasos) {
    if (porOrigen.has(p.de)) {
      throw new Error(`la cadena declara dos pasos que salen de la versión ${p.de}: con dos, migrar dejaría de tener un solo resultado`);
    }
    porOrigen.set(p.de, p);
  }
  const cubiertos = [];
  for (let v = desde; v < hasta; v += 1) {
    const p = porOrigen.get(v);
    if (!p) throw new Error(`la cadena de migraciones tiene un hueco: falta el paso ${v}→${v + 1} para llegar de la versión ${desde} a la ${hasta}`);
    if (p.a !== v + 1) throw new Error(`el paso que sale de la versión ${v} dice llegar a la ${p.a}: la cadena quedaría con el hueco ${v + 1}→${p.a}`);
    cubiertos.push(p);
  }
  const sobran = pasos.filter((p) => p.de < desde || p.a > hasta);
  if (sobran.length) {
    throw new Error(`la cadena declara pasos fuera del tramo ${desde}→${hasta}: ${sobran.map((p) => `${p.de}→${p.a}`).join(', ')}`);
  }
  return congelaHondo({ desde, hasta, pasos: cubiertos, saltos: cubiertos.map((p) => `${p.de}→${p.a}`) });
}

// --- Aplicar ------------------------------------------------------------------

function partes(ruta) {
  return String(ruta).split('.').filter(Boolean);
}

function pon(doc, ruta, valor) {
  const camino = partes(ruta);
  let nodo = doc;
  for (let i = 0; i < camino.length - 1; i += 1) {
    const clave = camino[i];
    if (nodo[clave] === null || typeof nodo[clave] !== 'object') nodo[clave] = {};
    nodo = nodo[clave];
  }
  nodo[camino[camino.length - 1]] = valor;
}

function saca(doc, ruta) {
  const camino = partes(ruta);
  let nodo = doc;
  for (let i = 0; i < camino.length - 1; i += 1) {
    const clave = camino[i];
    if (nodo === null || typeof nodo !== 'object') return { habia: false, valor: undefined };
    nodo = nodo[clave];
  }
  if (nodo === null || typeof nodo !== 'object') return { habia: false, valor: undefined };
  const ultima = camino[camino.length - 1];
  const habia = Object.prototype.hasOwnProperty.call(nodo, ultima);
  const valor = nodo[ultima];
  if (habia) delete nodo[ultima];
  return { habia, valor };
}

/** Una copia honda por JSON: el documento de origen **no se toca**. */
function copia(doc) {
  return JSON.parse(JSON.stringify(doc));
}

function aplicaPaso(doc, p) {
  const salida = copia(doc);
  // La clase decide si el paso **toca campos**; la versión sube igual. Un paso de otra
  // clase que renombrara o introdujera aquí dejaría el documento fuera de su esquema.
  if (p.clase !== null && salida.clase !== p.clase) {
    salida.version = p.a;
    return salida;
  }
  for (const [de, a] of Object.entries(p.renombra)) {
    const sacado = saca(salida, de);
    if (!sacado.habia) {
      throw new Error(`el paso ${p.de}→${p.a} renombra "${de}" y el documento no lo trae: migrar no puede inventarse lo que no estaba`);
    }
    pon(salida, a, sacado.valor);
  }
  for (const ruta of p.quita) saca(salida, ruta);
  for (const [ruta, valor] of Object.entries(p.introduce)) pon(salida, ruta, copia({ v: valor }).v);
  salida.version = p.a;
  return salida;
}

/**
 * Migra un documento hasta la versión actual del formato.
 *
 * Tres respuestas cerradas, las mismas tres de `compruebaVersion` y por el mismo
 * motivo: ya está en la versión actual y **sale idéntico sin aplicar ningún paso**; es
 * de una versión mayor y no se abre, declarando las dos versiones; es de una menor y se
 * migra **solo si la cadena tiene el paso**. Un salto sin paso registrado falla
 * nombrándolo, nunca se interpreta con las reglas nuevas.
 *
 * El documento de origen no se toca: lo que sale es otro objeto, y por eso «la original
 * sigue en el fichero de origen sin tocar» es una propiedad y no una promesa.
 */
export function migra(doc, { cadena = CADENA_DEL_FORMATO, donde = 'el documento', hasta = VERSION_FORMATO } = {}) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error(`${donde} no es un documento que se pueda migrar: llegó ${JSON.stringify(doc) ?? String(doc)}`);
  }
  if (!Object.prototype.hasOwnProperty.call(doc, 'version')) {
    throw new Error(`${donde} no declara el campo "version": sin él no se sabe de qué versión hay que migrarlo`);
  }
  const desde = doc.version;
  exigeEntero(desde, `${donde} declara una versión de formato que no es un entero`);
  exigeEntero(hasta, 'la versión de destino de la migración');
  if (desde > hasta) {
    throw new Error(`${donde} está escrito en la versión de formato ${desde} y esta versión del juego entiende la ${hasta}: no se abre`);
  }
  if (desde === hasta) {
    return congelaHondo({ doc, migrado: false, desde, hasta, saltos: [], reglas: VERSION_GENERADOR });
  }
  if (desde < VERSION_MINIMA_SOPORTADA) {
    throw new Error(`${donde} está escrito en la versión de formato ${desde}, anterior a la mínima soportada (${VERSION_MINIMA_SOPORTADA}): no hay cadena que lo alcance`);
  }
  const tramo = compruebaCadena(cadena, { desde, hasta });
  let actual = doc;
  for (const p of tramo.pasos) actual = aplicaPaso(actual, p);
  // El resultado se valida contra el esquema cerrado actual: una migración que deja el
  // documento fuera del esquema es peor que no migrar, porque el fallo aparecería más
  // tarde y ya sin saber de dónde vino. Solo cuando el destino es la versión de verdad:
  // una migración de prueba llega a una versión que ningún esquema describe, y ese es
  // justo el punto de que se pueda ejercitar hoy.
  if (hasta === VERSION_FORMATO) {
    escribe(actual, esquemaDe(actual.clase), `${donde} migrado de la versión ${desde} a la ${hasta}`);
  }
  return congelaHondo({
    doc: actual,
    migrado: true,
    desde,
    hasta,
    saltos: tramo.saltos,
    reglas: VERSION_GENERADOR,
  });
}
