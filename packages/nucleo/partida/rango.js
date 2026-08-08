// El rango social de un núcleo: tres escalones con nombre, sin un solo número, y
// **derivados de lo que ese sitio ha oído** en lugar de guardados.
//
// De ahí sale la propiedad que esta fila afirma en voz alta y que es lo más fácil
// de romper: **aquí no baja nada, y no porque un guardián lo vigile**. El rango es
// una función no decreciente de un recuento que solo crece —SPEC-012 fija que lo
// sedimentado no caduca, no se olvida y no se degrada—, así que «ningún rango ha
// bajado» se sostiene sin ningún estado que pueda desincronizarse del registro.
//
// Y por eso el rango **no se guarda**: se recalcula de lo oído cada vez que se
// pregunta. Lo que sí es estado de partida son la bolsa y los objetos, que no se
// derivan de nada.
//
// Es capa sobre el mundo ya congelado: no importa `buildWorld` ni ninguna fase de
// la generación, y **no se registra como productor de paso** —un rango no sube ni
// baja porque el mundo avance—.

import { congelaHondo } from '../core/congelar.js';
import { loQueSeCuentaEn } from './nucleos.js';
import { exigeMapaId } from './pasos.js';

/**
 * La escalera: **enumerada, cerrada y ordinal**, de menos a más conocida.
 *
 * Las claves **no llevan género** y **no salen nunca a pantalla**. El género
 * gramatical de la jugadora es dato vivo (`personaje.md` §1) y el rango se dice con
 * una frase que redacta la capa que pinta sobre el tono; una clave marcada
 * arrastraría el género a un sitio donde no pinta nada. Es la misma decisión que
 * SPEC-014 tomó con las claves de puesto.
 *
 * Los nombres del diseño —forastera · conocida · alguien de aquí
 * (`progresion.md` §1)— son lo que se cuenta, no lo que se guarda.
 */
export const ESCALONES_DE_RANGO = congelaHondo(['forasteria', 'nombradia', 'pertenencia']);

/** Donde nace todo núcleo, y donde nace un mapa entero: nadie te conoce todavía. */
export const ESCALON_DE_PARTIDA = 'forasteria';

/**
 * La tabla de umbrales, en un único sitio para que cambiarlos sea cambiar una tabla.
 *
 * `desde` es **cuántos rumores distintos han llegado a ese núcleo**, ignorando su
 * nivel y su signo: el rango mide *cuánto te conocen*, no *cuánto te aprecian* ni
 * *cómo de fiel llegó* (`progresion.md` pendiente 1). Un rumor en nivel 3 y de signo
 * feo cuenta exactamente igual que uno fiel y bueno.
 *
 * Uno y tres son **ritmo de juego, no estadística**: con el umbral en uno, el primer
 * desenlace notable ya cambia el trato donde ocurrió y donde la noticia alcance, que
 * es lo que hace que el hito de `arranque.md` §3 sea el primer escalón de esta misma
 * escalera; con el techo en tres, «alguien de aquí» significa que suenas por varias
 * cosas y no por una. El umbral **se alcanza, no se supera**.
 */
export const UMBRALES_DE_RANGO = congelaHondo([
  { escalon: 'forasteria', desde: 0 },
  { escalon: 'nombradia', desde: 1 },
  { escalon: 'pertenencia', desde: 3 },
]);

/**
 * El tono que lleva cada escalón: **una clave de un enumerado cerrado, una por
 * escalón, y nunca un texto redactado**. Es la restricción con la que la capa que
 * escribe (fila 18) decide cómo te hablan; las palabras no salen de aquí.
 */
export const TONOS_DE_RANGO = congelaHondo({
  forasteria: 'de-fuera',
  nombradia: 'de-oidas',
  pertenencia: 'de-casa',
});

/** Los tonos declarados, en orden estable. */
export const IDS_DE_TONO = congelaHondo(Object.values(TONOS_DE_RANGO).slice().sort());

/**
 * Los mecanismos de esta entrega que pueden **bajar**. Es una lista vacía y va
 * declarada para poder enumerarla: el único del proyecto sigue siendo la relación
 * por cara de SPEC-014, y que esta fila no añada un segundo es dato de diseño y no
 * una casualidad (`relacion.js`, `MECANISMOS_QUE_BAJAN`).
 */
export const MECANISMOS_DE_PROGRESION_QUE_BAJAN = congelaHondo([]);

// El catálogo se comprueba a sí mismo al cargarse, como el de efectos y el de la
// relación. Lo que se comprueba aquí **es la propiedad**: que la tabla empieza en
// cero, que sube en sentido estricto y que nombra exactamente los escalones del
// enumerado y en su orden. Con eso, `escalonPara` es una función escalonada **no
// decreciente** de su argumento, y como el argumento solo crece, el rango no puede
// bajar. Si alguien mete un umbral desordenado, el error sale aquí y no tres capas
// más allá cuando un pueblo empiece a olvidarse de quién eres.
if (UMBRALES_DE_RANGO.length !== ESCALONES_DE_RANGO.length) {
  throw new Error('la tabla de umbrales del rango no tiene una entrada por escalón: sin eso no se puede saber qué hace falta para subir');
}
UMBRALES_DE_RANGO.forEach((u, i) => {
  if (u.escalon !== ESCALONES_DE_RANGO[i]) {
    throw new Error(`el umbral ${i + 1} del rango nombra el escalón "${u.escalon}" y el enumerado ordinal dice "${ESCALONES_DE_RANGO[i]}": la tabla y la escalera tienen que ir en el mismo orden`);
  }
  if (!Number.isInteger(u.desde) || u.desde < 0) {
    throw new Error(`el umbral del escalón "${u.escalon}" llega como ${JSON.stringify(u.desde)}: se cuenta en rumores llegados, que son enteros no negativos`);
  }
  if (i === 0 && u.desde !== 0) {
    throw new Error('el escalón de partida del rango no arranca en cero: entonces habría núcleos sin ningún escalón');
  }
  if (i > 0 && u.desde <= UMBRALES_DE_RANGO[i - 1].desde) {
    throw new Error(`el umbral del escalón "${u.escalon}" no es mayor que el del anterior: la escalera dejaría de ser no decreciente y el rango podría bajar`);
  }
});
if (UMBRALES_DE_RANGO[0].escalon !== ESCALON_DE_PARTIDA) {
  throw new Error('el escalón de partida del rango no es el primero de la escalera');
}
for (const escalon of ESCALONES_DE_RANGO) {
  if (!Object.prototype.hasOwnProperty.call(TONOS_DE_RANGO, escalon)) {
    throw new Error(`el escalón "${escalon}" no declara tono: sin él la capa que escribe no sabría con qué voz hablar y acabaría inventándose una`);
  }
}

/** El escalón, o un error que **nombra el valor recibido**. */
export function exigeEscalonDeRango(escalon, quien = 'el escalón de rango') {
  if (!ESCALONES_DE_RANGO.includes(escalon)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(escalon) ?? String(escalon)}: la escalera es cerrada y sus tres escalones son ${ESCALONES_DE_RANGO.join(' < ')}`,
    );
  }
  return escalon;
}

/** El tono de un escalón. Uno de fuera del enumerado falla nombrando lo que llegó. */
export function tonoDe(escalon) {
  return TONOS_DE_RANGO[exigeEscalonDeRango(escalon, 'el escalón del que se pide el trato')];
}

/**
 * El escalón que corresponde a un recuento de rumores llegados.
 *
 * **Es toda la mecánica**: una función escalonada no decreciente, sin memoria y sin
 * estado. Dos llamadas con el mismo recuento dan lo mismo, y un recuento mayor nunca
 * da un escalón menor. Ahí es donde vive «el rango no baja».
 */
export function escalonPara(cuantos) {
  if (!Number.isInteger(cuantos) || cuantos < 0) {
    throw new Error(`el recuento de lo que ha llegado a un núcleo llega como ${JSON.stringify(cuantos) ?? String(cuantos)}: son rumores distintos, enteros no negativos`);
  }
  let escalon = ESCALON_DE_PARTIDA;
  for (const umbral of UMBRALES_DE_RANGO) {
    if (cuantos >= umbral.desde) escalon = umbral.escalon;
  }
  return escalon;
}

/**
 * La vista del mapa activo que esta capa necesita: sus núcleos y la pregunta de si
 * uno le pertenece. La cumple `arbolDeCalzadas(mundo)` tal cual.
 *
 * **Se exige y no se supone**: sin ella, preguntar por un núcleo que no existe
 * devolvería el escalón de partida en lugar de fallar, que es la degradación
 * silenciosa que este proyecto ya ha pagado cuatro veces.
 */
export function exigeMapaDeNucleos(mapa, quien = 'el rango de un núcleo') {
  if (!mapa || typeof mapa.tiene !== 'function' || !Array.isArray(mapa.nucleos)) {
    throw new Error(
      `${quien} necesita el mapa activo ya leído (arbolDeCalzadas(mundo)), con sus núcleos y su "tiene": ` +
      `llegó ${JSON.stringify(mapa) ?? String(mapa)}, y sin él un núcleo inventado pasaría por forastero`,
    );
  }
  return mapa;
}

/**
 * Cuántos rumores distintos han llegado a un núcleo. **No sale de esta capa**: es la
 * entrada del cálculo y no un dato que nadie pueda pintar, por el mismo argumento
 * con el que SPEC-011 no expone el contador de pasos.
 */
function cuantosHanLlegado(nucleos, { mapaId, nucleo }) {
  const versiones = loQueSeCuentaEn(nucleos, { mapaId, nucleo });
  // Lo sedimentado ya trae una versión por rumor (SPEC-012 no vuelve a oír lo mismo
  // por otra rama), pero se cuenta por identidad a propósito: si algún día entrara
  // una segunda versión del mismo rumor, contarla dos veces subiría el rango sin que
  // llegara nada nuevo.
  const vistos = [];
  for (const v of versiones) if (!vistos.includes(v.rumor)) vistos.push(v.rumor);
  return vistos.length;
}

/**
 * El rango que se tiene en un núcleo: **un escalón y su tono, y ninguna cifra**.
 *
 * Ni el recuento de lo que ha llegado, ni un porcentaje, ni cuánto falta para el
 * escalón siguiente: no hay con qué pintar un medidor, que es lo que el design
 * system pide y lo que hace barato sostenerlo.
 *
 * Un núcleo que no existe en el mapa activo falla nombrando el núcleo y el mapa, en
 * lugar de contestar «forastera» a una pregunta que no tiene sentido.
 */
export function rangoEn(nucleos, { mapaId, nucleo, mapa }) {
  const id = exigeMapaId(mapaId, 'el rango de un núcleo');
  const activo = exigeMapaDeNucleos(mapa);
  if (typeof nucleo !== 'string' || !nucleo) {
    throw new Error(`el rango se pide de un núcleo y llegó ${JSON.stringify(nucleo) ?? String(nucleo)}`);
  }
  if (!activo.tiene(nucleo)) {
    throw new Error(
      `el núcleo "${nucleo}" no existe en el mapa activo ${id}: el rango es de los pueblos de este mapa y no viaja, ` +
      'así que no hay ninguno parecido al que responder',
    );
  }
  const escalon = escalonPara(cuantosHanLlegado(nucleos, { mapaId: id, nucleo }));
  return congelaHondo({ escalon, tono: TONOS_DE_RANGO[escalon] });
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión:
//
//   · No hay ninguna función que devuelva el rango de todos los núcleos de un mapa a
//     la vez. «Una pantalla que enumerase tus tres escalones en cada pueblo sería la
//     barra que este apartado se niega a tener, solo que escrita con palabras»
//     (`progresion.md` §1). Se pregunta núcleo a núcleo, como en SPEC-012.
//   · No hay ninguna operación que baje un rango, ni que lo fije, ni que lo guarde.
//     No es que estén prohibidas: es que no hay dónde escribirlas, porque el rango no
//     es estado.
//   · No sale ni una cifra: ni el recuento, ni la distancia al escalón siguiente.
