// La relación con una cara concreta: la escalera de cuatro escalones, los actos
// que la mueven, la cicatriz y la reparación.
//
// Es **el único mecanismo del proyecto que puede ir hacia abajo**, y conviene que
// se vea: el rango no baja, los objetos no se pierden, el mapa no se borra y un
// paso solo añade. Aquí vive la consecuencia de un acto feo, y es el único sitio
// donde un efecto tiene signo negativo (`game-design/npcs.md` §4).
//
// Dos límites que no se negocian y que salen de documentos que mandan:
//
//   1. **La relación cambia el trato, nunca el catálogo.** Una cara rota sigue
//      casteando; si no lo hiciera, el casting empezaría a fallar por gente por la
//      puerta de atrás y RF-NPC-002 se caería.
//   2. **No baja por el tiempo.** Ningún paso del mundo mueve una relación, y por
//      eso este módulo **no se registra como productor de paso**: no exporta
//      `produce`, no importa el motor y no cuelga de él. La ausencia del registro
//      es la prueba estructural de que `quests.md` decisión 4 sigue en pie.
//
// Y lo que aquí **no** se decide: qué actos son feos y cuáles reparan. Eso llega
// declarado por la plantilla (fila 17, RF-QUEST-009) y es el pendiente 2 de
// `npcs.md`; inventar la taxonomía aquí sería inventar producto sobre un pendiente
// abierto.

import { congelaHondo } from '../core/congelar.js';
import { exigeMapaId } from './pasos.js';
import { caraDeClave, claveDeCara, exigeCara } from './puestos.js';

/**
 * La escalera: **enumerada, cerrada y ordinal**, de peor a mejor.
 *
 * Cuatro escalones son los mínimos para tener partida, dos caídas y un escalón alto
 * que la cicatriz pueda cerrar. No es un número con signo porque el design system
 * prohíbe cualquier medidor: lo que sale de aquí es un escalón, nunca una cantidad.
 */
export const ESCALONES = congelaHondo(['rota', 'tirante', 'cordial', 'cercana']);

/** Donde nace toda cara: el trato de quien no te debe nada ni te ha cogido manía. */
export const ESCALON_DE_PARTIDA = 'cordial';

/**
 * El techo de una relación que llegó a romperse. **Permanente**: la reparación
 * devuelve «a poder sentarse», nunca al punto de partida (`npcs.md` §4). Sin techo,
 * reparar borraría el acto; con el techo en `tirante`, la relación quedaría
 * inservible, que en un reparto de nueve es la pérdida desproporcionada que el
 * documento descarta.
 */
export const TECHO_CON_CICATRIZ = 'cordial';

/** El escalón desde el que una relación queda marcada para siempre. */
export const ESCALON_QUE_DEJA_CICATRIZ = 'rota';

/**
 * Los dos signos que un acto declarado puede traer. **Enumerado cerrado**: un acto
 * sin signo o con uno de fuera falla nombrando lo que llegó, en vez de no mover
 * nada en silencio.
 */
export const SIGNOS_DE_ACTO = Object.freeze({ FEO: 'feo', REPARADOR: 'reparador' });

/** Los dos valores admitidos, en orden estable. */
export const IDS_DE_SIGNO_DE_ACTO = congelaHondo(Object.values(SIGNOS_DE_ACTO).sort());

/**
 * Los mecanismos de esta entrega que pueden **bajar**. Es una lista de uno, y va
 * declarada para poder enumerarla: que la relación por cara sea el único es un dato
 * de diseño y no una casualidad.
 */
export const MECANISMOS_QUE_BAJAN = congelaHondo(['relacion-por-cara']);

// El catálogo se comprueba a sí mismo al cargarse, como el de efectos: si alguien
// mete un escalón más, o mueve el de partida, el error sale aquí y no tres capas
// más allá cuando una relación no se pueda reparar.
if (!ESCALONES.includes(ESCALON_DE_PARTIDA) || !ESCALONES.includes(TECHO_CON_CICATRIZ)) {
  throw new Error('la escalera de relación no contiene su escalón de partida o su techo con cicatriz: los dos tienen que estar en el enumerado');
}
if (ESCALONES.indexOf(TECHO_CON_CICATRIZ) >= ESCALONES.length - 1) {
  throw new Error('el techo con cicatriz es el escalón más alto: entonces la cicatriz no quitaría nada y «no al punto de partida» dejaría de cumplirse');
}

const indiceDe = (escalon) => ESCALONES.indexOf(escalon);

/** El escalón, o un error que nombra lo que llegó. */
export function exigeEscalon(escalon, quien = 'el escalón de la relación') {
  if (!ESCALONES.includes(escalon)) {
    throw new Error(`${quien} llega como ${JSON.stringify(escalon) ?? String(escalon)}: la escalera es cerrada y sus cuatro escalones son ${ESCALONES.join(' < ')}`);
  }
  return escalon;
}

/** El signo de un acto, o un error que nombra el valor recibido. */
export function exigeSignoDeActo(signo, quien = 'el signo del acto') {
  if (!IDS_DE_SIGNO_DE_ACTO.includes(signo)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(signo) ?? String(signo)}, que no está en el enumerado cerrado: los dos valores son ${IDS_DE_SIGNO_DE_ACTO.join(', ')}. ` +
      'Lo declara la plantilla del desenlace y nunca se deduce de un texto',
    );
  }
  return signo;
}

/**
 * Las relaciones de una partida: un registro por mapa y nada más. **No viajan entre
 * mapas** —ni las relaciones ni las cicatrices—, por lo mismo que el rango: las
 * caras cuelgan de sitios de un mapa concreto y dos mapas no comparten sitios.
 */
export function estadoDeRelaciones() {
  return { mapas: {} };
}

/** El registro de un mapa dentro del estado, creándolo si es la primera vez. */
export function relacionesDeMapa(estado, mapaId) {
  const id = exigeMapaId(mapaId, 'las relaciones con las caras');
  if (!estado || typeof estado !== 'object' || !estado.mapas || typeof estado.mapas !== 'object') {
    throw new Error('el estado de relaciones llega mal formado: se espera lo que devuelve estadoDeRelaciones(), un objeto con "mapas"');
  }
  if (!Object.prototype.hasOwnProperty.call(estado.mapas, id)) estado.mapas[id] = {};
  return estado.mapas[id];
}

/**
 * Cómo está el trato con una cara.
 *
 * Una cara de la que no consta nada está en el escalón de partida y sin cicatriz:
 * no es un vacío que haya que rellenar al despertarla, es lo que significa que
 * nadie se ha hecho nada todavía. Y **no sale ningún número**: solo el escalón y si
 * hay cicatriz.
 */
export function relacionCon(estado, { mapaId, cara }) {
  const registro = relacionesDeMapa(estado, mapaId);
  const clave = claveDeCara(exigeCara(cara, 'la cara cuya relación se consulta'));
  const guardada = registro[clave];
  return congelaHondo({
    escalon: guardada?.escalon ?? ESCALON_DE_PARTIDA,
    cicatriz: guardada?.cicatriz === true,
  });
}

/**
 * A qué escalón llevaría un acto, **sin tocar nada**.
 *
 * Un acto feo baja uno y nunca por debajo de `rota`; uno reparador sube uno y nunca
 * por encima del techo, que es `cercana` mientras no haya cicatriz y `cordial` en
 * cuanto la hay. Los dos topes se quedan quietos en lugar de fallar: una relación ya
 * rota que recibe otro acto feo sigue rota, que es lo que el diseño pide.
 */
export function planDeActo(estado, { mapaId, cara, signo }) {
  const antes = relacionCon(estado, { mapaId, cara });
  const elSigno = exigeSignoDeActo(signo, `el signo del acto hacia la cara "${exigeCara(cara).puesto}" de "${exigeCara(cara).sitio}"`);
  const cicatriz = antes.cicatriz || antes.escalon === ESCALON_QUE_DEJA_CICATRIZ;
  const techo = cicatriz ? indiceDe(TECHO_CON_CICATRIZ) : ESCALONES.length - 1;
  const paso = elSigno === SIGNOS_DE_ACTO.FEO ? -1 : 1;
  const i = Math.max(0, Math.min(techo, indiceDe(antes.escalon) + paso));
  const escalon = ESCALONES[i];
  return congelaHondo({
    clave: claveDeCara(exigeCara(cara)),
    antes,
    // La cicatriz se enciende al **llegar** a rota, no al salir de ahí: si se
    // encendiera al reparar, una relación rota que nunca se repara no la tendría.
    despues: { escalon, cicatriz: cicatriz || escalon === ESCALON_QUE_DEJA_CICATRIZ },
  });
}

/** Aplica un acto declarado hacia una cara y devuelve cómo queda el trato. */
export function aplicaActo(estado, { mapaId, cara, signo }) {
  const registro = relacionesDeMapa(estado, mapaId);
  const plan = planDeActo(estado, { mapaId, cara, signo });
  registro[plan.clave] = { escalon: plan.despues.escalon, cicatriz: plan.despues.cicatriz };
  return congelaHondo({ ...plan.despues });
}

/** Las relaciones en forma serializable, con mapas y caras en **orden declarado**. */
export function congelaRelaciones(estado) {
  const mapas = {};
  for (const mapaId of Object.keys(estado?.mapas ?? {}).sort()) {
    const registro = estado.mapas[mapaId];
    const caras = [];
    for (const clave of Object.keys(registro).sort()) {
      const { sitio, puesto } = caraDeClave(clave);
      caras.push({ sitio, puesto, escalon: registro[clave].escalon, cicatriz: registro[clave].cicatriz === true });
    }
    mapas[mapaId] = { caras };
  }
  return { mapas };
}

/** Las relaciones de vuelta de su documento, con su escalón y su cicatriz intactos. */
export function levantaRelaciones(doc) {
  const estado = estadoDeRelaciones();
  for (const mapaId of Object.keys(doc?.mapas ?? {}).sort()) {
    const registro = relacionesDeMapa(estado, mapaId);
    for (const guardada of doc.mapas[mapaId]?.caras ?? []) {
      const clave = claveDeCara(exigeCara(guardada, `una relación guardada del mapa ${mapaId}`));
      registro[clave] = {
        escalon: exigeEscalon(guardada.escalon, `el escalón guardado de la cara "${guardada.puesto}" de "${guardada.sitio}"`),
        cicatriz: guardada.cicatriz === true,
      };
    }
  }
  return estado;
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión: no
// hay ninguna función que devuelva el estado de todas las relaciones de un mapa a la
// vez, ni ninguna que acepte un número de pasos. El panel del estado del mundo se
// evita mejor no exportando el dato que confiando en que nadie lo pinte, y el paso
// del tiempo no puede mover una relación si no hay por dónde metérselo.
