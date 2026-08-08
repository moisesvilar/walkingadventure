// Lo que el oro compra: **saber y favores, nunca metros**.
//
// El rango y el oro no son dos sistemas: son el mismo visto de dos lados
// (`progresion.md` §3). El rango es crédito social y el oro lo suple cuando no lo
// hay, y lo que el rango cambia es **el trato y el precio, nunca el catálogo** — a
// todo el mundo se le ofrece lo mismo, y lo que varía es el tono con que se lo dicen
// y lo que cuesta, **incluido el precio cero** de quien ya es de aquí.
//
// Tres reglas duras, y las tres son estructura:
//
//   1. **El oro nunca compra distancia.** No se puede pagar por no andar, y el caso
//      peligroso no es el catálogo sino el favor: un recado que resuelve un beat es
//      pagar por no andar con otro nombre. Un favor que toque un beat, un tramo, el
//      grafo o el filtro se rechaza nombrando el favor.
//   2. **Lo que compras es la versión que a ese informante le llegó**, con su
//      deformación encima. Pagar no da la verdad: da otro nodo del árbol de rumores,
//      y puede salir peor que ir andando. Al testigo de SPEC-014 no se le paga y
//      cuenta la fiel; al informante se le paga y cuenta lo que oyó.
//   3. **Nada manda a gastar en el negocio real del anclaje, y el oro ficticio no
//      toca dinero de verdad en ninguna dirección.** Con menores delante eso no es
//      una decisión de economía.
//
// Y una frontera: aquí está el **mecanismo**; el contenido —qué ítems hay y cuánto
// vale cada uno— lo declara el catálogo de la fila 17 y llega inyectado.

import { congelaHondo } from '../core/congelar.js';
import { loQueSeCuentaEn, paraLaCapaQuePinta } from './nucleos.js';
import { cobra, planDeCobro, saldoDe } from './oro.js';
import { exigeMapaId } from './pasos.js';
import { rangoEn, exigeEscalonDeRango, tonoDe } from './rango.js';

/**
 * Los dos tipos de ítem, en **enumerado cerrado**: los que nombra `progresion.md`
 * §2 y ningún otro. Un catálogo abierto haría que «nada de lo que se ofrece reduce
 * la distancia» dejara de ser verificable el día que alguien añadiera un tipo.
 */
export const TIPOS_DE_ITEM = congelaHondo(['saber', 'favor']);

/**
 * El catálogo cerrado de lo que una compra puede **hacer**, con el tipo de ítem al
 * que pertenece cada efecto. Es la segunda red: un efecto de fuera falla nombrando
 * el tipo, en lugar de aplicarse.
 */
export const EFECTOS_DE_COMPRA = congelaHondo({
  'version-que-oyo': { tipo: 'saber' },
  'recado-llevado': { tipo: 'favor' },
  'algo-guardado': { tipo: 'favor' },
});

/** Los efectos declarados, en orden estable. */
export const IDS_DE_EFECTO_DE_COMPRA = congelaHondo(Object.keys(EFECTOS_DE_COMPRA).sort());

/**
 * El factor de precio por escalón: 1, ½ **redondeado hacia arriba** y 0.
 *
 * El redondeo hacia arriba no es un detalle: es lo que garantiza que **el único
 * precio cero es el del escalón más alto**, y con él «lo que a una forastera le
 * cobran, a alguien de aquí se lo sueltan de balde» queda afirmado sin depender de
 * que ningún ítem tenga precio base 1.
 */
export const FACTOR_POR_ESCALON = congelaHondo({ forasteria: 1, nombradia: 0.5, pertenencia: 0 });

/**
 * Los verbos con los que una compra **acortaría el camino**, y los campos con los
 * que tocaría el dinero de verdad o el negocio real del anclaje.
 *
 * Es la red que convierte las dos reglas duras en estructura. Un ítem que declare
 * cualquiera de estos campos se rechaza nombrando el ítem: el catálogo entero se
 * puede revisar de una pasada, y el día que alguien escriba un recado que resuelve
 * un beat, se pone rojo aquí y no en una partida.
 */
export const CAMPOS_QUE_ACORTAN = congelaHondo([
  'beat', 'beats', 'siguienteBeat', 'resuelve', 'salta', 'omite', 'retira', 'acorta', 'sustituye',
  'tramo', 'tramoM', 'metros', 'distancia', 'grafo', 'viario', 'criterios', 'lazo', 'recorrido', 'alcance', 'teletransporte',
]);

/** Los campos con los que un ítem tocaría dinero real o el negocio del anclaje. */
export const CAMPOS_DEL_MUNDO_REAL = congelaHondo([
  'anclaje', 'real', 'osmId', 'placeId', 'negocio', 'dinero', 'dineroReal', 'euros', 'compraReal', 'precioReal', 'tienda',
]);

/** El tipo de un ítem, o un error que nombra el valor recibido. */
export function exigeTipoDeItem(tipo, quien = 'el tipo del ítem') {
  if (!TIPOS_DE_ITEM.includes(tipo)) {
    throw new Error(`${quien} llega como ${JSON.stringify(tipo) ?? String(tipo)}: el catálogo es cerrado y sus dos tipos son ${TIPOS_DE_ITEM.join(' y ')}`);
  }
  return tipo;
}

/** El efecto de una compra, o un error que **nombra el tipo** en lugar de aplicarlo. */
export function exigeEfectoDeCompra(efecto, quien = 'el efecto de la compra') {
  if (typeof efecto !== 'string' || !Object.prototype.hasOwnProperty.call(EFECTOS_DE_COMPRA, efecto)) {
    throw new Error(
      `${quien} declara el efecto ${JSON.stringify(efecto) ?? String(efecto)}, que no está en el catálogo cerrado: ` +
      `los declarados son ${IDS_DE_EFECTO_DE_COMPRA.join(', ')}`,
    );
  }
  return efecto;
}

/**
 * Un ítem bien formado del catálogo de un informante.
 *
 * **El precio base lo declara el ítem** y su ausencia es un error, no un cero: un
 * precio por defecto convertiría un catálogo incompleto en un catálogo gratis sin
 * que ninguna prueba lo viera. Es la misma frontera que rige el oro del desenlace.
 */
export function exigeItem(item, quien = 'un ítem del catálogo') {
  const id = item?.id;
  if (typeof id !== 'string' || !id) {
    throw new Error(`${quien} llega sin identidad: ${JSON.stringify(item) ?? String(item)}`);
  }
  const tipo = exigeTipoDeItem(item.tipo, `el tipo del ítem "${id}"`);
  const efecto = exigeEfectoDeCompra(item.efecto, `el ítem "${id}"`);
  if (EFECTOS_DE_COMPRA[efecto].tipo !== tipo) {
    throw new Error(`el ítem "${id}" es de tipo "${tipo}" y declara el efecto "${efecto}", que es de "${EFECTOS_DE_COMPRA[efecto].tipo}"`);
  }
  if (!Number.isInteger(item.precioBase) || item.precioBase < 0) {
    throw new Error(
      `el ítem "${id}" no declara precio base (llegó ${JSON.stringify(item.precioBase) ?? String(item.precioBase)}): ` +
      'lo declara el ítem y nunca esta capa, y suponerle uno haría gratis un catálogo incompleto sin que nadie lo viera',
    );
  }
  for (const campo of CAMPOS_QUE_ACORTAN) {
    if (Object.prototype.hasOwnProperty.call(item, campo)) {
      throw new Error(
        `el ítem "${id}" declara "${campo}": el oro nunca compra distancia, así que ni el saber ni un favor pueden tocar un beat, ` +
        'un tramo, el grafo ni el filtro de caminos. Un recado que resuelve un beat es pagar por no andar con otro nombre',
      );
    }
  }
  for (const campo of CAMPOS_DEL_MUNDO_REAL) {
    if (Object.prototype.hasOwnProperty.call(item, campo)) {
      throw new Error(
        `el ítem "${id}" declara "${campo}": el oro ficticio no toca dinero real en ninguna dirección y el juego nunca manda a gastar ` +
        'en el negocio real al que está anclado el sitio',
      );
    }
  }
  if (tipo === 'saber' && (typeof item.rumor !== 'string' || !item.rumor)) {
    throw new Error(`el ítem de saber "${id}" no dice de qué rumor es lo que vende: lo que se compra es la versión que ese informante oyó, y sin identidad no hay ninguna`);
  }
  return congelaHondo({ id, tipo, efecto, precioBase: item.precioBase, rumor: item.rumor ?? null });
}

/**
 * El catálogo entero de un informante, validado. **No depende del rango**: es el
 * mismo objeto para todo el mundo, y esa es la mitad de la decisión.
 */
export function catalogoDelInformante(items) {
  const lista = Array.isArray(items) ? items : [];
  const vistos = [];
  return congelaHondo(lista.map((item) => {
    const suyo = exigeItem(item);
    if (vistos.includes(suyo.id)) throw new Error(`el catálogo repite el ítem "${suyo.id}": dos ítems con la misma identidad se pisarían al comprar`);
    vistos.push(suyo.id);
    return suyo;
  }));
}

/**
 * Los ítems del catálogo que **acortarían el camino**. Es la lista vacía por
 * construcción —`exigeItem` ya los rechaza— y existe para poder revisar el catálogo
 * entero de una pasada en lugar de confiar en que nadie escriba el primero.
 */
export function loQueAcortaElCamino(items) {
  const lista = Array.isArray(items) ? items : [];
  return congelaHondo(lista.filter((item) => (
    CAMPOS_QUE_ACORTAN.some((c) => Object.prototype.hasOwnProperty.call(item ?? {}, c)) ||
    CAMPOS_DEL_MUNDO_REAL.some((c) => Object.prototype.hasOwnProperty.call(item ?? {}, c))
  )).map((item) => item.id ?? null));
}

/**
 * El precio de un ítem en un escalón: `precioBase × factor(escalón)`, con el medio
 * redondeado hacia arriba.
 *
 * Un ítem sin precio base declarado falla nombrando el ítem, en lugar de valer cero.
 */
export function precioDe(item, escalon) {
  const suyo = exigeItem(item, 'el ítem cuyo precio se pide');
  const paso = exigeEscalonDeRango(escalon, `el escalón con el que se pone precio al ítem "${suyo.id}"`);
  const factor = FACTOR_POR_ESCALON[paso];
  if (factor === 0) return 0;
  return Math.ceil(suyo.precioBase * factor);
}

/** El informante, exigido: de qué mapa es y de qué núcleo. Una cara de SPEC-014 detrás. */
function exigeInformante(informante, mapaId, quien = 'la compra') {
  const id = exigeMapaId(mapaId, quien);
  if (!informante || typeof informante.nucleo !== 'string' || !informante.nucleo) {
    throw new Error(`${quien} necesita el informante con el núcleo del que es: llegó ${JSON.stringify(informante) ?? String(informante)}`);
  }
  if (informante.mapaId != null && informante.mapaId !== id) {
    throw new Error(
      `el informante de "${informante.nucleo}" es del mapa ${informante.mapaId} y el mapa activo es el ${id}: ` +
      'las caras no viajan entre mapas y lo que sabe se oyó en el suyo',
    );
  }
  return informante;
}

/**
 * Lo que un informante ofrece: **exactamente lo mismo para todo el mundo**, con el
 * precio y el tono que le pone el rango que se tiene en su núcleo.
 *
 * Dos jugadoras en escalones distintos reciben la misma lista de ítems y distintos
 * precios y tonos. Lo que el rango cambia es el trato y el precio, nunca el catálogo.
 */
export function ofrece({ nucleos, mapaId, mapa, informante, catalogo }) {
  const id = exigeMapaId(mapaId, 'lo que ofrece un informante');
  const suyo = exigeInformante(informante, id, 'lo que ofrece un informante');
  const items = catalogoDelInformante(catalogo);
  const { escalon } = rangoEn(nucleos, { mapaId: id, nucleo: suyo.nucleo, mapa });
  return congelaHondo({
    nucleo: suyo.nucleo,
    tono: tonoDe(escalon),
    // El catálogo va aparte de los precios a propósito: comparar dos ofertas y ver
    // que `catalogo` es idéntico y `precios` no, es el criterio entero.
    catalogo: items.map((i) => ({ id: i.id, tipo: i.tipo, efecto: i.efecto })),
    precios: items.map((i) => ({ id: i.id, precio: precioDe(i, escalon) })),
  });
}

/**
 * Lo que una compra entregaría y lo que costaría, **sin tocar nada**.
 *
 * Un ítem que no está en el catálogo falla nombrando el ítem; un precio mayor que la
 * bolsa se rechaza nombrando lo que falta; y un informante que no ha oído nada del
 * rumor que vende **no tiene nada que vender, y eso no es un error**: no se cobra y
 * no se entrega.
 */
export function planDeCompra({ oro, nucleos, mapaId, mapa, informante, catalogo, item }) {
  const id = exigeMapaId(mapaId, 'la compra a un informante');
  const suyo = exigeInformante(informante, id, 'la compra a un informante');
  const items = catalogoDelInformante(catalogo);
  const elegido = items.find((i) => i.id === item);
  if (!elegido) {
    throw new Error(
      `el ítem "${item}" no está en el catálogo de lo que ofrece el informante de "${suyo.nucleo}": ` +
      `los declarados son ${items.map((i) => i.id).join(', ') || '(ninguno)'}`,
    );
  }
  const { escalon } = rangoEn(nucleos, { mapaId: id, nucleo: suyo.nucleo, mapa });
  const precio = precioDe(elegido, escalon);

  if (elegido.tipo === 'saber') {
    const versiones = loQueSeCuentaEn(nucleos, { mapaId: id, nucleo: suyo.nucleo });
    const version = versiones.find((v) => v.rumor === elegido.rumor);
    if (!version) {
      // No ha oído nada de eso. Es una respuesta y no un fallo, y sobre todo no se
      // cobra: cobrar por nada sería vender la ausencia.
      return congelaHondo({ item: elegido.id, tipo: elegido.tipo, precio, hayQueVender: false, cobro: null, entrega: null });
    }
    return congelaHondo({
      item: elegido.id,
      tipo: elegido.tipo,
      precio,
      hayQueVender: true,
      cobro: planDeCobro(oro, { precio, quien: `lo que el informante de "${suyo.nucleo}" sabe del rumor "${elegido.rumor}"` }),
      // **La versión que a él le llegó, y nunca la fiel**, y sin el nivel de
      // deformación: `paraLaCapaQuePinta` lo quita, que es como el design system
      // sostiene «el nivel no sale nunca a pantalla» sin confiar en nadie.
      //
      // Se llama `loQueOyo` y no «versión» a propósito: en `partida/` esa palabra ya
      // es la del formato de los documentos, y dos cosas distintas con el mismo
      // nombre en la misma área es como se confunden.
      entrega: { efecto: elegido.efecto, loQueOyo: paraLaCapaQuePinta(version)[0] },
    });
  }

  return congelaHondo({
    item: elegido.id,
    tipo: elegido.tipo,
    precio,
    hayQueVender: true,
    cobro: planDeCobro(oro, { precio, quien: `el favor "${elegido.id}" del informante de "${suyo.nucleo}"` }),
    // Un favor entrega **la constancia de que se hizo**, y ni un beat, ni un metro,
    // ni un tramo: lo que puede llevar dentro está acotado por `exigeItem`.
    entrega: { efecto: elegido.efecto },
  });
}

/**
 * Compra. Se calcula entero primero y se escribe después: **si algo falla a mitad,
 * ni la bolsa ha cambiado ni se ha entregado nada**.
 *
 * El precio cero se resuelve entero y no cobra nada, que es el corazón del asunto:
 * ahí es donde enganchan el rango y el oro.
 */
export function compra({ oro, nucleos, mapaId, mapa, informante, catalogo, item }) {
  const plan = planDeCompra({ oro, nucleos, mapaId, mapa, informante, catalogo, item });
  if (!plan.hayQueVender) {
    return congelaHondo({ ...plan, pagado: 0, saldo: saldoDe(oro) });
  }
  cobra(oro, { precio: plan.precio, quien: `la compra del ítem "${plan.item}"` });
  return congelaHondo({ ...plan, pagado: plan.precio, saldo: saldoDe(oro) });
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión: lo
// que devuelve una compra **no lleva el nivel de deformación**, no hay ninguna
// función que entregue la versión fiel a cambio de oro —esa es del testigo, y es
// gratis— y no hay ningún ítem que cambie qué se ofrece: el rango pone precio y
// tono, y el catálogo es el mismo para todo el mundo.
