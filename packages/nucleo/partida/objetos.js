// Los objetos que quedan: **llaves que abren otra puerta al mismo beat, nunca un
// requisito**, y recuerdos que solo están y cuentan de dónde vinieron.
//
// La regla es toda la regla (`progresion.md` §4): el objeto no abre una rama nueva,
// abre **una salida distinta a un beat que ya existe**. Mismos beats, mismo lazo,
// otra forma de atravesarlo. Con eso el casting sigue siendo testeable, «con LLM y
// sin LLM, misma estructura» queda intacto, y quien no tenga nada resuelve igual por
// otro lado.
//
// Un objeto es **un flag con procedencia**: se tiene o no se tiene. No se apila, no
// pesa, no ocupa hueco y no se puede tirar — búscalo, no está. Y **la llave no se
// gasta al usarse**, porque su valor de diseño es abrir conversaciones que no se
// habrían abierto, y una llave de un solo uso no crea arcos largos: los cierra.
//
// La repisa es **una por partida y viaja entre mapas**: los objetos son de la
// jugadora y no del sitio, al revés que el rango, que es de los pueblos.

import { congelaHondo } from '../core/congelar.js';

/**
 * Las dos clases, en **enumerado cerrado**, y la clase **la declara quien entrega el
 * objeto**. Sin la clase declarada, la repisa y el sistema de llaves serían la misma
 * lista y RF-PROG-007 no se podría afirmar; y suponer «recuerdo» convertiría en
 * adorno una llave que alguien escribió para abrir algo.
 */
export const CLASES_DE_OBJETO = congelaHondo(['llave', 'recuerdo']);

/** La única clase que puede abrir la vía `con_objeto` de un beat. */
export const CLASE_QUE_ABRE = 'llave';

/** Las dos maneras de atravesar un beat `con_objeto`. Las dos llevan al mismo sitio. */
export const VIAS_DEL_BEAT = congelaHondo(['objeto', 'alternativa']);

/** La repisa de una partida: una lista y nada más. Ni huecos, ni peso, ni tope. */
export function estadoDeObjetos() {
  return { objetos: [] };
}

/** La clase de un objeto, o un error que nombra el objeto y lo que llegó. */
export function exigeClaseDeObjeto(clase, quien = 'la clase del objeto') {
  if (!CLASES_DE_OBJETO.includes(clase)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(clase) ?? String(clase)}, que no está en el enumerado cerrado: las dos clases son ` +
      `${CLASES_DE_OBJETO.join(' y ')}. La declara quien lo entrega, y suponer que es un recuerdo dejaría muda una llave`,
    );
  }
  return clase;
}

/**
 * Un objeto persistente bien formado: su identidad, su clase, su procedencia y **el
 * día en que se obtuvo**.
 *
 * El día **llega como argumento** y no se lee dentro del núcleo: es la misma regla
 * que prohíbe leer el reloj del sistema en la generación, aplicada a un dato que sí
 * es del calendario. Sin él, RF-PROG-007 —«cada objeto dice de quién viene y de qué
 * día»— no se podría cumplir, así que su ausencia es un error y no un hueco.
 */
export function objetoPersistente({ id, clase, procedencia = null, dia }) {
  if (typeof id !== 'string' || !id) {
    throw new Error(`un objeto sin identidad no se puede guardar: llegó ${JSON.stringify(id) ?? String(id)}, y sin ella no se sabe qué puerta abre`);
  }
  const laClase = exigeClaseDeObjeto(clase, `la clase del objeto "${id}"`);
  if (typeof dia !== 'string' || !dia) {
    throw new Error(
      `el objeto "${id}" no dice de qué día es: llegó ${JSON.stringify(dia) ?? String(dia)}. El día entra como argumento de quien cierra ` +
      'la salida porque el núcleo no puede leer el reloj, y la repisa lo enseña',
    );
  }
  return congelaHondo({ id, clase: laClase, procedencia, dia });
}

/** Si se tiene un objeto. Es todo lo que el juego pregunta de una llave. */
export function tieneObjeto(estado, id) {
  return laRepisa(estado).some((o) => o.id === id);
}

function laRepisa(estado) {
  if (!estado || typeof estado !== 'object' || !Array.isArray(estado.objetos)) {
    throw new Error('el estado de los objetos llega mal formado: se espera lo que devuelve estadoDeObjetos(), un objeto con "objetos"');
  }
  return estado.objetos;
}

// El orden de la repisa es **declarado** —por día y, dentro del día, por identidad—
// y nunca el de llegada: dos partidas que obtuvieran lo mismo en otro orden tienen
// que enseñar la misma repisa.
const porDiaYNombre = (a, b) => (a.dia !== b.dia ? (a.dia < b.dia ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Cómo quedaría la repisa al guardar un objeto, **sin tocar nada**. Existe para que
 * el cierre de una salida se aplique entero o no se aplique.
 *
 * Un objeto que ya se tiene **no se apila y no se reescribe**: se sigue teniendo una
 * sola vez, con la procedencia y el día de la primera vez, que es de cuando viene.
 */
export function planDeGuardado(estado, objeto) {
  const repisa = laRepisa(estado);
  // Se vuelve a normalizar siempre, venga de donde venga: es lo que hace que un
  // objeto sin clase declarada falle aquí y no al enseñar la repisa.
  const suyo = objetoPersistente(objeto ?? {});
  const ya = repisa.find((o) => o.id === suyo.id);
  if (ya) return { objetos: repisa.slice(), objeto: ya, nuevo: false };
  return { objetos: [...repisa, suyo].sort(porDiaYNombre), objeto: suyo, nuevo: true };
}

/** Guarda un objeto en la repisa. Guardarlo dos veces deja una sola entrada. */
export function guarda(estado, objeto) {
  const plan = planDeGuardado(estado, objeto);
  estado.objetos = plan.objetos;
  return plan.objeto;
}

/**
 * Los objetos que se tienen, en orden declarado, cada uno con su clase, su
 * procedencia y su día. Una partida sin ninguno devuelve la lista vacía, que no es
 * un error: no tener nada es una respuesta.
 */
export function objetosDe(estado) {
  return congelaHondo(laRepisa(estado).slice().sort(porDiaYNombre));
}

/**
 * La vista de solo lectura que recibe el casting: **responde a una única pregunta
 * —si un objeto se tiene o no— y no puede escribir nada**.
 *
 * Es la frontera de inyección entera de esta spec (`progresion.md`, «que
 * `castTemplate` reciba también el estado de la partida, sin que eso cambie los
 * beats»): una vista mínima es lo que permite afirmar que con objetos y sin ninguno
 * sale el mismo reparto, porque no hay por dónde meter nada más.
 */
export function vistaDeTenencia(estado) {
  const repisa = laRepisa(estado);
  return congelaHondo({ tiene: (id) => repisa.some((o) => o.id === id) });
}

/** La tenencia de quien no lleva nada: la que usa el casting cuando no se le inyecta otra. */
export const SIN_OBJETOS = congelaHondo({ tiene: () => false });

/** La vista de tenencia, exigida. Una mal formada falla nombrando lo que llegó. */
export function exigeTenencia(tenencia, quien = 'la resolución de un beat con objeto') {
  if (!tenencia || typeof tenencia.tiene !== 'function') {
    throw new Error(
      `${quien} necesita la vista de tenencia de la partida (vistaDeTenencia(estado)) o SIN_OBJETOS: ` +
      `llegó ${JSON.stringify(tenencia) ?? String(tenencia)}`,
    );
  }
  return tenencia;
}

/**
 * Los beats de una aventura que quedarían **cerrados** por no llevar la llave: los
 * que disparan `con_objeto` sin declarar otra manera de resolverse.
 *
 * Es la lista vacía **por construcción** —`validaPlantilla` ya no ofrece una
 * plantilla así— y existe para poder medirlo sobre el catálogo entero en lugar de
 * confiar en que nadie escriba el primero.
 */
export function beatsSinSalida(beats) {
  const lista = Array.isArray(beats) ? beats : [];
  return congelaHondo(lista.filter((b) => {
    if (b?.disparador?.tipo !== 'con_objeto') return false;
    const via = b.disparador.viaAlternativa;
    return !via || typeof via !== 'object';
  }).map((b) => ({ n: b.n ?? null, rol: b.rol ?? null, objeto: b.disparador.objeto ?? null })));
}

/**
 * Por qué vía se atraviesa un beat: **la del objeto si se tiene, y la alternativa si
 * no**. Las dos resuelven el beat y empujan al mismo siguiente; lo único que cambia
 * es cómo se pasa.
 *
 * Un beat `con_objeto` cuya plantilla no declara vía alternativa falla nombrando el
 * beat y el objeto, en lugar de exigir la llave: exigirla sería convertir en
 * requisito lo que el diseño define como llave.
 */
export function resuelveBifurcacion({ beat, tenencia = SIN_OBJETOS }) {
  const suya = exigeTenencia(tenencia);
  const disparador = beat?.disparador;
  if (disparador?.tipo !== 'con_objeto') {
    return congelaHondo({ conObjeto: false, via: null, objeto: null, siguienteBeat: beat?.resultado?.siguienteBeat ?? null });
  }
  const objeto = disparador.objeto ?? null;
  if (!disparador.viaAlternativa || typeof disparador.viaAlternativa !== 'object') {
    throw new Error(
      `el beat ${beat.n ?? '(sin número)'} dispara con el objeto ${JSON.stringify(objeto)} y no declara otra manera de resolverse sin él: ` +
      'un objeto es una llave y no un requisito, así que el beat quedaría cerrado para quien no lo lleve',
    );
  }
  const conLlave = objeto != null && suya.tiene(objeto);
  return congelaHondo({
    conObjeto: true,
    via: conLlave ? 'objeto' : 'alternativa',
    objeto,
    // Las dos vías empujan al mismo beat: eso es lo que hace que el objeto sea otra
    // puerta al mismo sitio y no una rama.
    siguienteBeat: beat?.resultado?.siguienteBeat ?? null,
    texto: conLlave ? beat?.escena?.texto ?? null : disparador.viaAlternativa.texto ?? null,
  });
}

// --- Serialización ----------------------------------------------------------

/** La repisa en forma serializable, en orden declarado. Es estado guardado: no se deriva de nada. */
export function congelaObjetos(estado) {
  return {
    objetos: laRepisa(estado).slice().sort(porDiaYNombre).map((o) => ({
      id: o.id,
      clase: o.clase,
      procedencia: o.procedencia ?? null,
      dia: o.dia,
    })),
  };
}

/** La repisa de vuelta de su documento, con la misma clase, la misma procedencia y el mismo día. */
export function levantaObjetos(doc) {
  const estado = estadoDeObjetos();
  estado.objetos = (doc?.objetos ?? [])
    .map((o) => objetoPersistente({ id: o.id, clase: o.clase, procedencia: o.procedencia ?? null, dia: o.dia }))
    .sort(porDiaYNombre);
  return estado;
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión: no
// hay peso, no hay huecos, no hay tope y **no hay manera de tirar un objeto ni de
// gastarlo**. La llave que se usa se sigue teniendo, y eso no es una regla que haya
// que vigilar: es que no existe la operación que la quitaría.
