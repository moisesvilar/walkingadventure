// El recado suelto: la entrada de la cola que comparte la lista de hoy con las
// aventuras, para que un día sin aventura del oficio propio no sea un día vacío
// (`personaje.md` §3, RF-QUEST-016).
//
// Dos decisiones lo gobiernan y las dos son de diseño. **No se filtra por oficio**:
// filtrarlo lo dejaría vacío exactamente los días que existe para salvar. Y **ocupa
// un sitio del tope de tres, nunca añade un cuarto**: el tope es de
// `bucle-jugable.md` §3 —«tres se comparan de un vistazo»— y la composición final de
// la pantalla es de otra fila; lo que se declara aquí es que ocupa sitio.

import { congelaHondo } from '../core/congelar.js';
import { entregasDeMapa, estadoDeEntregas, pendientes } from './entregas.js';
import { exigeMapaId } from './pasos.js';

/**
 * La medida del recado: **una palabra, nunca una cifra**. Vive aquí y no en el
 * enumerado de tamaños de salida de SPEC-004 porque un recado no es una aventura y
 * no tiene presupuesto de beats; meterlo allí obligaría a inventarle un rango de
 * beats que después alguien comprobaría.
 */
export const MEDIDA_DEL_RECADO = 'un-momento';

/**
 * Cuántas entradas caben en la lista de hoy. `bucle-jugable.md` §3: tres, porque
 * tres se comparan de un vistazo.
 */
export const TOPE_DE_LA_LISTA = 3;

function exigeDia(dia) {
  if (!Number.isInteger(dia) || dia < 0) {
    throw new Error(
      `el recado suelto se pide para un día del calendario de la partida y llegó ${JSON.stringify(dia) ?? String(dia)}: ` +
      'tiene que ser un entero no negativo, y nunca una marca del reloj real',
    );
  }
  return dia;
}

/**
 * El recado suelto de un día: **exactamente uno, o nada**.
 *
 * Rota entre las pendientes —la que menos veces ha aparecido, y el orden estable de
 * la cola rompe el empate—, porque repetir la misma tarjeta tres días seguidos es la
 * forma más rápida de que deje de leerse. Pedirlo dos veces el mismo día devuelve el
 * mismo, que es lo que hace que componer la lista sea idempotente.
 *
 * **Aparecer en la lista no consume oferta.** Quien aparece y no se elige vuelve
 * pendiente con las ofertas que tenía: en la lista te has enterado y has dicho que
 * no, y quemar ahí una de las dos ofertas dejaría a la entrada sin ninguna oferta
 * real en marcha.
 *
 * La cola sin ninguna oportunidad pendiente devuelve `null`, que es una respuesta y
 * no un error.
 */
export function recadoSuelto({ estado = estadoDeEntregas(), mapaId, dia } = {}) {
  const id = exigeMapaId(mapaId, 'el recado suelto de la lista de hoy');
  exigeDia(dia);
  const registro = entregasDeMapa(estado, id);
  const cola = pendientes(estado, { mapaId: id });
  if (!cola.length) return null;

  const yaDeHoy = cola.find((e) => registro.entradas.find((v) => v.id === e.id)?.ultimaLista === dia);
  const elegida = yaDeHoy ?? cola.reduce((mejor, e) => (e.apariciones < mejor.apariciones ? e : mejor), cola[0]);

  const viva = registro.entradas.find((v) => v.id === elegida.id);
  if (!yaDeHoy) {
    // Una aparición no es una oferta y se cuenta aparte: lo único que decide es a
    // quién le toca el sitio mañana.
    viva.apariciones += 1;
    viva.ultimaLista = dia;
  }

  return congelaHondo({
    entrada: viva.id,
    asunto: viva.asunto,
    clase: viva.clase,
    escena: viva.escena,
    medida: MEDIDA_DEL_RECADO,
    // Declara que ocupa un sitio del tope, y quien compone la lista lo respeta. Ni
    // tiempo aproximado ni distancia: el design system prohíbe la cifra de esfuerzo,
    // y lo que no sale de aquí no se puede pintar por descuido.
    ocupaSitioDeLaLista: true,
    // La referencia a su texto de plantilla, nunca una cadena redactada aquí: la
    // redacción es del contrato con el narrador.
    texto: { referencia: viva.asunto },
  });
}

/**
 * La lista de hoy: las aventuras que castearon y, si hay, el recado suelto, sin
 * pasar nunca del tope de tres.
 *
 * El recado **ocupa sitio y no lo añade**: con tres aventuras y un recado salen tres
 * entradas, no cuatro. Lo que se pinta de cada una es de la pantalla; lo que se
 * decide aquí es cuántas hay y cuál cae fuera.
 */
export function listaDeHoy({ aventuras = [], recado = null, tope = TOPE_DE_LA_LISTA } = {}) {
  if (!Array.isArray(aventuras)) {
    throw new Error(`la lista de hoy se compone sobre la lista de aventuras casteadas y llegó ${JSON.stringify(aventuras) ?? String(aventuras)}`);
  }
  if (!Number.isInteger(tope) || tope <= 0) {
    throw new Error(`el tope de la lista de hoy llega como ${JSON.stringify(tope) ?? String(tope)}: se espera un entero positivo`);
  }
  const sitiosParaAventuras = recado ? Math.max(0, tope - 1) : tope;
  const entradas = aventuras.slice(0, sitiosParaAventuras);
  if (recado) entradas.push(recado);
  return congelaHondo({ tope, entradas });
}
