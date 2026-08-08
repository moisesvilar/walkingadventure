// La bolsa: **una cifra que se gasta, y nada más**.
//
// El oro sí se enseña como número (`progresion.md` §1, 6-ago-2026) y no choca con la
// prohibición de cifras de `bucle-jugable.md` §3: aquella era sobre distancias y
// tiempos, que son lo que convierte esto en una app de deporte. El oro es una moneda
// que se gasta en cosas concretas, y sin verlo no se puede decidir en qué.
//
// Dos invariantes, y las dos son estructura y no vigilancia:
//
//   1. **Nunca por debajo de cero.** No hay ninguna operación que deje la bolsa en
//      negativo: una compra que no se puede pagar se rechaza antes de tocar nada.
//   2. **Ningún acumulado histórico.** La bolsa expone el **saldo** y nada más. Un
//      saldo que sube y baja según lo que compras no es un marcador de progreso; un
//      total monótono sí lo sería (pendiente 3 de `progresion.md`), y el modo de que
//      nadie lo pinte por descuido es que el núcleo no lo entregue.
//
// La bolsa es **una por partida y viaja entre mapas**: el oro es lo que se lleva
// encima y el rango es lo que un sitio piensa de ti. Y esta capa **no se registra
// como productor de paso**: el oro se gana al cerrar una salida y se gasta en una
// compra, y ninguna de las dos cosas ocurre en un paso del mundo. Esa ausencia es la
// prueba estructural de que un paso sigue sin quitar nada.

import { congelaHondo } from '../core/congelar.js';
import { guarda, objetoPersistente, planDeGuardado } from './objetos.js';
import { declaraCandidato, planDeCandidato } from './motes.js';

/** La bolsa de una partida. Empieza a cero, y cero no es un error: es lo que hay. */
export function estadoDeOro() {
  return { saldo: 0 };
}

function laBolsa(estado) {
  if (!estado || typeof estado !== 'object' || !Number.isInteger(estado.saldo) || estado.saldo < 0) {
    throw new Error(
      `la bolsa llega mal formada: se espera lo que devuelve estadoDeOro(), con un saldo entero no negativo, y llegó ${JSON.stringify(estado) ?? String(estado)}`,
    );
  }
  return estado;
}

/** El saldo actual. Lo único que se puede preguntar de la bolsa. */
export function saldoDe(estado) {
  return laBolsa(estado).saldo;
}

/** Una cantidad de oro bien formada, o un error que **nombra el valor recibido**. */
export function exigeCantidadDeOro(valor, quien = 'la cantidad de oro') {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`${quien} llega como ${JSON.stringify(valor) ?? String(valor)}: el oro se cuenta en enteros no negativos`);
  }
  return valor;
}

/** Cómo quedaría la bolsa al ingresar, **sin tocar nada**. */
export function planDeIngreso(estado, { oro, quien = 'el oro que declara el desenlace' }) {
  const bolsa = laBolsa(estado);
  const cantidad = exigeCantidadDeOro(oro, quien);
  return { saldo: bolsa.saldo + cantidad, cantidad };
}

/** Ingresa lo que un desenlace declara. Un desenlace que no declara oro no llega aquí. */
export function ingresa(estado, { oro, quien }) {
  const plan = planDeIngreso(estado, { oro, quien });
  estado.saldo = plan.saldo;
  return plan.saldo;
}

/**
 * Cómo quedaría la bolsa al cobrar, **sin tocar nada**.
 *
 * Un precio mayor que el saldo se rechaza **nombrando lo que falta** y no entrega
 * nada. Por aquí es por donde la bolsa no puede quedar en negativo: no hay otra
 * puerta que reste.
 */
export function planDeCobro(estado, { precio, quien = 'la compra' }) {
  const bolsa = laBolsa(estado);
  const cantidad = exigeCantidadDeOro(precio, `el precio de ${quien}`);
  if (cantidad > bolsa.saldo) {
    throw new Error(`${quien} cuesta ${cantidad} y en la bolsa hay ${bolsa.saldo}: faltan ${cantidad - bolsa.saldo} de oro, así que no se cobra nada y no se entrega nada`);
  }
  return { saldo: bolsa.saldo - cantidad, cantidad };
}

/** Cobra un precio ya validado. El precio cero se resuelve entero y no cobra nada. */
export function cobra(estado, { precio, quien }) {
  const plan = planDeCobro(estado, { precio, quien });
  estado.saldo = plan.saldo;
  return plan.saldo;
}

// --- El cierre de una salida ------------------------------------------------

/**
 * Lo que un desenlace deja en la partida: **el oro, los objetos persistentes y el
 * mote candidato**, los tres declarados por la plantilla o por el suceso y ninguno
 * deducido de un texto.
 *
 * Vive aquí, y no en un sexto módulo, porque el ingreso declarado por el desenlace
 * es de esta ruta y porque la invariante que gobierna las tres entregas es la de la
 * bolsa: **se aplica entero o no se aplica**. Todo se valida y se calcula primero, y
 * solo cuando no queda nada que pueda fallar se escribe; si algo no encaja a mitad,
 * ni la bolsa ni la repisa ni los motes han cambiado. Es la misma forma que
 * `creaCapaDeNpcs().cierraSalida` de SPEC-014.
 *
 * @param {object} opciones
 *   `oro`, `objetos` y `motes` los tres estados de partida; `mapaId` el mapa activo
 *   —los motes son suyos, la bolsa y la repisa no—; `desenlace` lo que SPEC-010
 *   entrega al terminar una aventura, con lo que la plantilla declare; `rumor` la
 *   identidad del rumor que acaba de nacer, o `null` si no ha nacido ninguno; `dia`
 *   el día del calendario de la partida —entero no negativo, el mismo que cuenta el
 *   diario—, que **llega como argumento** porque el núcleo no lee el reloj.
 */
export function cierraSalidaDeProgresion({ oro, objetos, motes, mapaId, desenlace, rumor = null, dia = null }) {
  if (!desenlace || typeof desenlace !== 'object') {
    throw new Error(`el cierre de una salida necesita el desenlace y llegó ${JSON.stringify(desenlace) ?? String(desenlace)}`);
  }
  const quien = `el desenlace "${desenlace.id ?? desenlace.plantilla?.id ?? desenlace.plantilla ?? '(sin id)'}"`;
  const plantilla = desenlace.plantilla?.id ?? desenlace.plantilla ?? null;

  // 1 · El oro. Un desenlace que no lo declara no mueve la bolsa; uno que lo declara
  // con un valor negativo o no entero falla nombrando el valor.
  const planOro = desenlace.oro === undefined || desenlace.oro === null
    ? null
    : planDeIngreso(oro, { oro: desenlace.oro, quien: `el oro que declara ${quien}` });

  // 2 · Los objetos persistentes. **Cualquier desenlace y cualquier hallazgo puede
  // declararlos**; lo que la aventura mueve y muere con ella no se declara y no
  // entra. Uno sin clase falla nombrando el objeto en lugar de pasar por recuerdo.
  const declarados = desenlace.objetos ?? [];
  if (!Array.isArray(declarados)) {
    throw new Error(`${quien} declara sus objetos persistentes como ${JSON.stringify(declarados)}: se espera una lista, aunque esté vacía`);
  }
  // Se planifican en cadena sobre una repisa de trabajo, para que dos objetos del
  // mismo desenlace no se pisen y para que el último pueda fallar sin haber escrito
  // el primero.
  const trabajo = { objetos: (objetos?.objetos ?? []).slice() };
  const planesDeObjeto = declarados.map((o) => {
    const suyo = objetoPersistente({
      id: o?.id,
      clase: o?.clase,
      procedencia: o?.procedencia ?? { desenlace: desenlace.id ?? null, plantilla, lugar: desenlace.lugar?.id ?? null },
      dia: o?.dia ?? dia,
    });
    const plan = planDeGuardado(trabajo, suyo);
    trabajo.objetos = plan.objetos;
    return plan;
  });

  // 3 · El mote candidato, que **nace del rumor**: sin rumor no hay de qué colgarlo,
  // y callarlo sería perder una declaración sin que nadie se enterara.
  const candidato = desenlace.mote ?? null;
  let planDelMote = null;
  if (candidato != null) {
    if (typeof rumor !== 'string' || !rumor) {
      throw new Error(
        `${quien} declara el mote candidato ${JSON.stringify(candidato)} y no ha nacido ningún rumor del que colgarlo: ` +
        'el mote nace del rumor (`personaje.md` §2), así que un desenlace no notable no puede pegar ninguno',
      );
    }
    planDelMote = planDeCandidato(motes, { mapaId, rumor, candidato });
  }

  // Y solo entonces la escritura, que ya no puede fallar.
  if (planOro) ingresa(oro, { oro: desenlace.oro, quien: `el oro que declara ${quien}` });
  const guardados = planesDeObjeto.map((plan) => guarda(objetos, plan.objeto));
  if (planDelMote) declaraCandidato(motes, { mapaId, rumor, candidato });

  return congelaHondo({
    saldo: saldoDe(oro),
    oro: planOro ? planOro.cantidad : 0,
    objetos: guardados.map((o) => ({ id: o.id, clase: o.clase, dia: o.dia })),
    mote: planDelMote ? { rumor, candidato } : null,
  });
}

// --- Serialización ----------------------------------------------------------

/** La bolsa en forma serializable: el saldo, y nada más. */
export function congelaOro(estado) {
  return { saldo: saldoDe(estado) };
}

/** La bolsa de vuelta de su documento. Un saldo negativo o no entero falla al levantarla. */
export function levantaOro(doc) {
  const estado = estadoDeOro();
  estado.saldo = exigeCantidadDeOro(doc?.saldo ?? 0, 'el saldo guardado de la bolsa');
  return estado;
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión: no
// hay consulta del oro ganado a lo largo de la partida, ni del gastado, ni ningún
// histórico; no hay tope; y no hay ninguna función que reciba un número de pasos.
// Un total monótono sería el marcador de progreso que la decisión 1 de
// `progresion.md` evita, y se evita mejor no exportándolo que tapándolo.
