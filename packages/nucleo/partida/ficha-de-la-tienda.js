// La ficha de la tienda: el texto que se lee **antes de instalar**, montado desde las
// constantes que lo mandan y nunca escrito a mano.
//
// Existe por una razón concreta: `accesibilidad.md` §4 obliga a declarar el suelo por
// debajo del cual no hay juego, «claro y antes de instalar, sin dramatismo», y
// `tramo.js` ya lleva esa declaración con su destino escrito al lado
// (`ficha-de-la-tienda`). Lo que faltaba era el artefacto que la consume: sin él, el
// día que el suelo cambie la ficha seguiría diciendo el viejo.
//
// Su destino es de **fuera del juego**, y de ahí las dos cosas raras de este módulo.
// Aquí sí se puede nombrar el número, y dentro del arranque no aparece ni una vez. Y
// el texto no se exporta como constantes sino que se monta al pedirlo: la guarda del
// paquete barre toda la prosa exportada buscando la que se muestra **dentro** del
// juego, y esta es justo la que no lo es. Montarla en vez de exportarla es lo que deja
// esa guarda simple en lugar de llenarla de excepciones por nombre.

import { congelaHondo } from '../core/congelar.js';
import { DECLARACION_DEL_SUELO } from './tramo.js';

/** A dónde va esta ficha. El mismo destino que declara la constante del suelo, y se cruzan. */
export const DESTINO = 'ficha-de-la-tienda';

/**
 * La ficha completa, montada.
 *
 * El último párrafo es **la declaración del suelo tal cual la exporta el núcleo**: no
 * se reescribe, no se resume y no se parafrasea, para que cambiar el suelo en un sitio
 * lo cambie en el único sitio donde se enseña.
 *
 * `suelo` viaja aparte de su texto porque quien publique la ficha en otro idioma o en
 * otra tienda necesita el número, no la frase: sacarlo del texto con una expresión
 * regular es exactamente cómo una ficha acaba diciendo un número que ya no es.
 */
export function fichaDeLaTienda() {
  return congelaHondo({
    destino: DESTINO,
    nombre: 'Walking Adventure',
    reclamo: 'Un juego de rol que se juega caminando por tu barrio.',
    parrafos: [
      'Tu calle es una calzada, el bar de abajo es una taberna y el parque de siempre es un paraje con nombre. '
      + 'El mapa se genera una vez desde donde tú estás, con los sitios reales que hay a tu alrededor, y a partir de ahí es tuyo.',
      'Las aventuras te mandan a sitios que existen. La historia se escribe según andas: '
      + 'lo que haces se cuenta, se deforma de pueblo en pueblo y vuelve cambiado.',
      'No hay cuentas, no hay anuncios y no hay nada que comprar. '
      + 'Tu ubicación no se guarda ni se comparte con nadie: sale del móvil una vez, para generar el mapa, y ya está.',
      DECLARACION_DEL_SUELO.texto,
    ],
    suelo: DECLARACION_DEL_SUELO.suelo,
    declaracionDelSuelo: DECLARACION_DEL_SUELO.texto,
  });
}

/**
 * Comprueba la ficha: que declara el suelo y que lo declara con el texto del núcleo.
 *
 * Se llama al cargarse el módulo, como el catálogo de puestos y el de anclas de
 * oficio: una ficha que no declara el suelo es justo la que este artefacto existe para
 * que no se pueda escribir.
 */
export function compruebaFicha(ficha = fichaDeLaTienda()) {
  if (!ficha.parrafos.includes(DECLARACION_DEL_SUELO.texto)) {
    throw new Error('la ficha de la tienda no incluye la declaración del suelo, que es la razón por la que este artefacto existe');
  }
  if (DECLARACION_DEL_SUELO.destino !== DESTINO) {
    throw new Error(`la declaración del suelo dice ir a "${DECLARACION_DEL_SUELO.destino}" y esta ficha es "${DESTINO}": el destino se declara en tramo.js y aquí solo se consume`);
  }
  if (!new RegExp(String(DECLARACION_DEL_SUELO.suelo)).test(ficha.declaracionDelSuelo)) {
    throw new Error('la declaración de la ficha no dice el número que el núcleo declara: la ficha se monta desde la constante y no se escribe a mano');
  }
  return ficha;
}

compruebaFicha();
