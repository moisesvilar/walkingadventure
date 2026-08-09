// El registro de voz de un texto —mundo o aplicación— **como dato del propio texto**,
// y la tipografía que se deriva de él.
//
// `game-design/lenguaje.md` afirma algo sobre **todos** los textos del juego: se habla
// como mundo, y los ajustes son la única excepción. Un requisito global que solo se
// comprueba abriendo pantallas no se puede poner rojo nunca —§6o—, y en esta máquina
// no hay simulador. Con el registro dentro del dato, «los ajustes son la única
// excepción» pasa a ser una consulta sobre el conjunto de textos, en `node --test`.
//
// La tipografía sale de aquí y **no de la pantalla**. Es la misma decisión que SPEC-021
// tomó con el estilo: si el color sale del objeto de estilo y no del componente, nadie
// puede pintar fuera de la paleta; si la fuente sale del registro y no del componente,
// nadie puede colar voz de aplicación con la tipografía correcta y que pase
// desapercibido.
//
// Vive en `lenguaje/` y no en `partida/` porque no es estado de nadie: es una
// propiedad del castellano de este juego, como el paquete de idioma. Y por eso no
// importa nada de `partida/` — el guion del arranque, que fue quien abrió la
// excepción de exportar texto desde el núcleo (SPEC-027), reexporta el enumerado de
// aquí en lugar de declarar el suyo.

import { congelaHondo } from '../core/congelar.js';

/**
 * Los dos registros. **Enumerado cerrado de dos valores**, y esa cerrazón es la pieza:
 * un tercero —«voz de sistema», «voz de tutorial»— sería la grieta por la que la
 * frontera deja de ser una frontera.
 */
export const REGISTROS = Object.freeze({ MUNDO: 'mundo', APLICACION: 'aplicacion' });

/** Los dos valores, en el orden en que se declaran. */
export const IDS_DE_REGISTRO = congelaHondo([REGISTROS.MUNDO, REGISTROS.APLICACION]);

/** Las dos tipografías. También cerradas, por lo mismo. */
export const TIPOGRAFIAS = Object.freeze({ SERIF: 'serif', SANS: 'sans' });

/**
 * De qué registro sale cada tipografía.
 *
 * Serif es la voz del mundo y sans la de la aplicación, y la correspondencia es total:
 * no hay ningún registro sin tipografía ni ninguna tipografía sin registro, que es lo
 * que impide que alguien elija la fuente por su cuenta «solo esta vez».
 */
export const TIPOGRAFIA_POR_REGISTRO = congelaHondo({
  [REGISTROS.MUNDO]: TIPOGRAFIAS.SERIF,
  [REGISTROS.APLICACION]: TIPOGRAFIAS.SANS,
});

/**
 * Los dos únicos sitios donde puede vivir un texto con voz de aplicación.
 *
 * `lenguaje.md`: el onboarding habla como aplicación hasta el botón de salir a andar, y
 * los ajustes son la excepción declarada. Ninguno más, y la lista cerrada es lo que
 * convierte «y en ninguna pantalla más» en una igualdad comprobable.
 */
export const SITIOS_DE_LA_VOZ_DE_APLICACION = congelaHondo(['onboarding', 'ajustes']);

/** Un registro declarado, o un error que nombra lo que llegó y los dos que hay. */
export function exigeRegistro(valor, quien = 'el registro de un texto') {
  if (!IDS_DE_REGISTRO.includes(valor)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(valor) ?? String(valor)}, que no está en el enumerado cerrado: ` +
      `los dos registros son ${IDS_DE_REGISTRO.join(' y ')}. Todo texto que el juego entrega para pintar declara el suyo`,
    );
  }
  return valor;
}

/**
 * La tipografía de un registro. **Es la única puerta**: ninguna pantalla elige fuente.
 */
export function tipografiaDe(registro, quien = 'la tipografía de un texto') {
  return TIPOGRAFIA_POR_REGISTRO[exigeRegistro(registro, quien)];
}

/** Si un sitio del juego admite voz de aplicación. Dos lo admiten; el resto, no. */
export function admiteVozDeAplicacion(sitio) {
  return SITIOS_DE_LA_VOZ_DE_APLICACION.includes(sitio);
}

/** Un identificador de sitio bien formado. Sin él no se sabe dónde se está colocando nada. */
export function exigeSitio(sitio, quien = 'la colocación de un texto') {
  if (typeof sitio !== 'string' || !sitio) {
    throw new Error(
      `${quien} necesita saber en qué sitio del juego se coloca y llegó ${JSON.stringify(sitio) ?? String(sitio)}: ` +
      `los que admiten voz de aplicación son ${SITIOS_DE_LA_VOZ_DE_APLICACION.join(' y ')}, y cualquier otro habla como mundo`,
    );
  }
  return sitio;
}

/**
 * Un texto con su registro declarado, normalizado, **con su tipografía ya derivada**.
 *
 * La tipografía se calcula aquí y viaja dentro del dato para que quien pinta no tenga
 * que resolverla: lo que no se resuelve en la pantalla no se puede resolver mal en una
 * pantalla y bien en las demás.
 */
export function textoConRegistro({ id, registro, texto, pantalla = null }) {
  if (typeof id !== 'string' || !id) {
    throw new Error(`un texto sin identidad no se puede colocar: llegó ${JSON.stringify(id) ?? String(id)}, y sin ella el error no podría nombrarlo`);
  }
  if (typeof texto !== 'string' || !texto) {
    throw new Error(`el texto "${id}" llega como ${JSON.stringify(texto) ?? String(texto)}: un texto que el juego entrega para pintar está escrito`);
  }
  const suyo = exigeRegistro(registro, `el registro del texto "${id}"`);
  return congelaHondo({ id, registro: suyo, texto, pantalla, tipografia: tipografiaDe(suyo) });
}

/** Un texto ya normalizado, exigido. Uno sin registro falla nombrándolo. */
export function exigeTextoConRegistro(texto, quien = 'un texto del juego') {
  if (!texto || typeof texto !== 'object' || typeof texto.texto !== 'string') {
    throw new Error(`${quien} llega como ${JSON.stringify(texto) ?? String(texto)}: se espera lo que devuelve textoConRegistro(...)`);
  }
  exigeRegistro(texto.registro, `el registro del texto "${texto.id ?? '(sin id)'}"`);
  return texto;
}

/**
 * Coloca textos en una pantalla y **falla si alguno habla como aplicación fuera de sus
 * dos sitios**, nombrando el texto y la pantalla.
 *
 * Es la comprobación entera de RF-LANG-002, y va aquí y no en una prueba porque una
 * regla que solo vigila la batería deja de vigilar en cuanto alguien añade una pantalla
 * sin acordarse de la batería.
 *
 * @param {Array|object} textos uno o varios `textoConRegistro`.
 * @param {object} opciones `sitio` dónde se coloca —`onboarding`, `ajustes` o cualquier
 *   sitio del mundo— y `pantalla` cuál en concreto, para que el error la nombre.
 */
export function coloca(textos, { sitio, pantalla = null }) {
  const donde = exigeSitio(sitio, 'la colocación de un texto');
  const dicha = pantalla ?? donde;
  const lista = (Array.isArray(textos) ? textos : [textos]).map((t) => exigeTextoConRegistro(t, `un texto de "${dicha}"`));
  if (!admiteVozDeAplicacion(donde)) {
    const intruso = lista.find((t) => t.registro === REGISTROS.APLICACION);
    if (intruso) {
      throw new Error(
        `el texto "${intruso.id}" habla como aplicación y se está colocando en "${dicha}", que es una pantalla del mundo: ` +
        `la voz de aplicación vive en ${SITIOS_DE_LA_VOZ_DE_APLICACION.join(' y ')} y en ninguna más (game-design/lenguaje.md). ` +
        'Dentro del juego, lo que solo se puede decir como aplicación es señal de rediseñar el momento, no de cambiar de voz',
      );
    }
  }
  return congelaHondo(lista.map((t) => ({ ...t, pantalla: t.pantalla ?? dicha })));
}

/** Los textos de un conjunto que hablan como aplicación, como datos. Es la consulta de RF-LANG-002. */
export function vozDeAplicacionEn(textos) {
  const lista = (Array.isArray(textos) ? textos : [textos]).map((t) => exigeTextoConRegistro(t));
  return congelaHondo(lista.filter((t) => t.registro === REGISTROS.APLICACION).map((t) => ({ id: t.id, pantalla: t.pantalla ?? null })));
}

// Y lo que este módulo **no** tiene, dicho en voz alta porque es la decisión: no hay
// un tercer registro, no hay manera de pedir una tipografía sin pasar por un registro,
// y no hay ninguna función que le ponga registro a un texto a posteriori. El registro
// lo declara quien escribe el texto, en el sitio donde lo escribe.
