// Cómo se pinta el mapa, **guardado con la partida**: el estilo elegido y el escalón de
// tamaño de letra.
//
// Las dos son preferencias de pintado y no datos del mundo —lo dice `render/estilos.js`
// al resolver un identificador desconocido—, y una preferencia que no se guarda en
// ninguna parte no es una preferencia: se elige, repinta lo que ya hay y desaparece al
// cerrar. Hasta aquí entraban **inyectadas** en el contexto de la fila de los ajustes,
// que es exactamente la forma de fallo de §6h: la pieza no protesta porque nunca se le
// pidió nada, y el criterio «un nombre, un género y un estilo cambiados vuelven al
// serializar y cargar» no se podía poner verde ni rojo, porque no había dónde mirar.
//
// El área es de **la fila 21 del checklist**, que es la dueña del catálogo de estilos y
// de la escala de texto, y por eso aquí no se declara ni un estilo ni un escalón: se
// consumen los suyos tal cual. Lo que esta capa aporta es el sitio donde vive lo elegido
// y su ida y vuelta.
//
// Y **el mundo no entra aquí**: cambiar el estilo no toca ninguna semilla, ningún
// documento congelado y ningún índice de nombres, que es lo que sostiene «cambiar el
// estilo de pintado no resiembra nada». Se sostiene por construcción — en este módulo no
// hay ni una llamada que reciba una semilla ni que escriba en un mundo.

import { congelaHondo } from '../core/congelar.js';
import { IDS_DE_TAMANO_DE_TEXTO, TAMANO_DE_TEXTO_DE_ORIGEN, exigeTamanoDeTexto } from '../quests/escena.js';
import { ESTILOS, ESTILO_POR_DEFECTO } from '../render/estilos.js';

/** Cómo se pinta una partida recién creada: el estilo por defecto y el escalón de origen. */
export function estadoDePintado() {
  return { estilo: ESTILO_POR_DEFECTO, tamanoDeTexto: TAMANO_DE_TEXTO_DE_ORIGEN };
}

/** El estilo elegido. Una partida sin nada elegido pinta con el de por defecto. */
export function estiloDe(estado) {
  const id = estado?.estilo;
  return typeof id === 'string' && id ? id : ESTILO_POR_DEFECTO;
}

/** El escalón de tamaño de letra elegido. */
export function tamanoDeTextoDe(estado) {
  const id = estado?.tamanoDeTexto;
  return typeof id === 'string' && id ? id : TAMANO_DE_TEXTO_DE_ORIGEN;
}

/**
 * Elige un estilo. **Solo uno del catálogo**, y uno de fuera falla nombrándolo: guardar
 * un identificador que nadie puede resolver es cómo se llega a una partida que abre
 * enseñando «Reino» junto a un estilo que no es Reino.
 *
 * El catálogo se inyecta —`creaCatalogo` de SPEC-021 admite estilos añadidos— y por
 * defecto es el de los cinco.
 */
export function eligeEstilo(estado, id, catalogo = ESTILOS) {
  if (!catalogo.some((estilo) => estilo.id === id)) {
    throw new Error(
      `el estilo ${JSON.stringify(id) ?? String(id)} no está en el catálogo de SPEC-021: los que hay son ` +
      `${catalogo.map((e) => e.id).join(', ')}. Se guarda uno que se pueda resolver, o ninguno`,
    );
  }
  estado.estilo = id;
  return estado;
}

/** Elige un escalón de tamaño de letra. La escala es la de la escena y no se redefine. */
export function eligeTamanoDeTexto(estado, id) {
  estado.tamanoDeTexto = exigeTamanoDeTexto(id, 'el tamaño de letra guardado con la partida');
  return estado;
}

/** Cómo se pinta, en forma serializable. */
export function congelaPintado(estado) {
  return { estilo: estiloDe(estado), tamanoDeTexto: tamanoDeTextoDe(estado) };
}

/**
 * Cómo se pinta, de vuelta de su documento.
 *
 * Un estilo guardado que ya no está en el catálogo **vuelve tal cual y no se sustituye
 * aquí**: quien lo consume decide. La fila de los ajustes falla nombrándolo, porque
 * enseñar el de por defecto sería caer sin decirlo; el pintado del mapa cae a Reino y lo
 * declara, porque una partida que no abre por el nombre de un estilo es un precio
 * desproporcionado. Sustituirlo al levantarlo dejaría a las dos sin la información.
 *
 * Lo que falta vuelve **en su valor de origen**, igual que un ajuste que todavía no
 * existía cuando se guardó la partida.
 */
export function levantaPintado(doc) {
  const estado = estadoDePintado();
  if (!doc) return estado;
  if (typeof doc.estilo === 'string' && doc.estilo) estado.estilo = doc.estilo;
  if (IDS_DE_TAMANO_DE_TEXTO.includes(doc.tamanoDeTexto)) estado.tamanoDeTexto = doc.tamanoDeTexto;
  return estado;
}

/** Los dos campos del área, en el orden en que se escriben. Lista cerrada. */
export const CAMPOS_DE_PINTADO = congelaHondo(['estilo', 'tamanoDeTexto']);

// Y lo que este módulo **no** tiene: ningún color, ningún grosor, ninguna tipografía y
// ningún factor. Todo eso vive en el catálogo de estilos y en la escala de la escena, que
// son de su dueña; aquí solo se guarda cuál se eligió.
