// La tipografía de un texto, **derivada de su registro** y nunca elegida por la
// pantalla.
//
// `game-design/lenguaje.md`: la excepción de los ajustes se nota hasta en la tipografía.
// Si cada pantalla eligiera su fuente a mano, la frontera dependería de que nadie se
// equivoque una vez; saliendo del registro, nadie puede meter voz de aplicación con la
// tipografía correcta y que pase desapercibido.
//
// Aquí solo se traduce el nombre de la tipografía a la familia del sistema: quién es
// serif y quién es sans lo decide `packages/nucleo/lenguaje/registro.js`, y esta capa no
// tiene voto.

import { TIPOGRAFIAS, tipografiaDe } from '@walkingadventure/nucleo/lenguaje/registro.js';

/** La familia de cada tipografía. Es lo único de plataforma que hay en todo esto. */
const FAMILIA = Object.freeze({
  [TIPOGRAFIAS.SERIF]: 'serif',
  [TIPOGRAFIAS.SANS]: 'sans-serif',
});

/** La familia que le toca a un registro. Un registro que no existe falla en el núcleo. */
export function familiaDe(registro) {
  return FAMILIA[tipografiaDe(registro)];
}

/** La familia de un texto ya compuesto, que trae su tipografía resuelta desde el núcleo. */
export function familiaDeTexto(texto) {
  return FAMILIA[texto.tipografia];
}
