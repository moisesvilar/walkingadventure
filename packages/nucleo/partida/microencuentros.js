// El micro-encuentro: la escena de un beat que salta en ruta para vaciar la cola de
// entregas. Aquí viven las cuatro reglas que lo acotan —cola no vacía, coste cero de
// desvío, nunca durante un beat y como mucho uno por paso del mundo— y la resolución
// del lugar diferido contra el primer sitio apto por el que se pasa.
//
// **No inventa nada.** Un micro-encuentro nace siempre de una entrada de la cola, y
// no existe ninguna vía por la que nazca sin ella: sin producción del mundo no hay
// encuentro (`quests.md` decisión 3). Y el coste cero es **pertenencia al trazado
// vigente**, nunca un umbral en metros: un umbral se sube en cuanto un mundo no dé
// encuentros y el coste deja de ser cero sin que nada se ponga rojo.

import { congelaHondo } from '../core/congelar.js';
import { PESO_MINIMO_DE_ESCENA } from '../world/escenas.js';
import {
  admiteOferta,
  atiende as atiendeEntrada,
  cierraSalida as cierraSalidaDeLaCola,
  entregasDeMapa,
  estadoDeEntregas,
  pendientes,
  registraOferta,
  yaSaltoEnElPaso,
} from './entregas.js';
import { exigeMapaId } from './pasos.js';

/**
 * Cuántos beats tiene un micro-encuentro: **uno**, literalmente el de `quests.md`
 * decisión 3 («micro-encuentros de 1 beat en ruta»).
 */
export const BEATS_DEL_MICROENCUENTRO = 1;

/**
 * La regla de no avisar durante un beat, escrita **en un solo sitio**.
 *
 * La consultan por igual el micro-encuentro y cualquier otro aviso que cuelgue de
 * esta capa: si estuviera escrita dos veces, el día que un aviso nuevo se colgara
 * aquí protegería la escena solo la mitad de las veces. El estado del beat llega
 * como dato de la capa de la escena —dos valores, hay escena abierta o no—: el
 * núcleo no lo deduce de la posición ni de ningún temporizador.
 */
export function retieneElAviso(beatEnCurso) {
  if (typeof beatEnCurso !== 'boolean') {
    throw new Error(
      `el estado del beat en curso llega como ${JSON.stringify(beatEnCurso) ?? String(beatEnCurso)}: es un dato de dos valores que entrega la capa de la escena, ` +
      'y deducirlo de la posición o del tiempo parado metería el reloj real donde no puede estar',
    );
  }
  return beatEnCurso;
}

/**
 * Los sitios del mundo congelado con sus afinidades de escena, indexados por nombre.
 *
 * Los **parajes** son los que declaran afinidades (SPEC-006); núcleos y servicios
 * entran igual porque el trazado puede pasar por ellos y hay que poder decir que
 * existen, pero sin afinidades declaradas ninguna escena los admite. Eso es una
 * declaración y no un silencio: un sitio sin escenas no resuelve un lugar diferido y
 * se dice por qué.
 */
export function sitiosDelMundo(mundo) {
  const indice = new Map();
  const anota = (sitio) => {
    if (typeof sitio.nombre !== 'string' || !sitio.nombre) {
      throw new Error(`un ${sitio.tipo} del mundo llega sin nombre, y el nombre es su identificador: sin él no se puede resolver un lugar diferido contra él`);
    }
    if (indice.has(sitio.nombre)) return;
    indice.set(sitio.nombre, congelaHondo(sitio));
  };
  for (const s of mundo?.settlements ?? []) {
    anota({ nombre: s.name, tipo: 'nucleo', anclaje: s.anchor ?? null, escenas: {} });
    for (const v of s.services ?? []) anota({ nombre: v.name, tipo: 'servicio', anclaje: v.real ?? null, escenas: {} });
  }
  for (const p of mundo?.parajes ?? []) {
    anota({ nombre: p.name, tipo: 'paraje', anclaje: p.real ?? null, escenas: p.scenes ?? {} });
  }
  return indice;
}

/**
 * Si un sitio admite la escena que la entrada declara, con el mismo peso mínimo con
 * el que el casting da una escena por cubierta. Si aquí fuera más laxo, el
 * micro-encuentro caería en sitios que el casting rechaza para lo mismo.
 */
export function admiteLaEscena(sitio, escena, pesoMinimo = PESO_MINIMO_DE_ESCENA) {
  if (typeof escena !== 'string' || !escena) {
    throw new Error(`la escena contra la que se mide un sitio llega como ${JSON.stringify(escena) ?? String(escena)}: sin ella no hay contra qué medir la aptitud`);
  }
  return (sitio?.escenas?.[escena] ?? 0) >= pesoMinimo;
}

/**
 * Cuelga los micro-encuentros de la cola de entregas de un mapa.
 *
 * @param {object} opciones
 *   `mundo` el mundo congelado, del que se leen los sitios y sus afinidades y al que
 *   no se le toca nada; `mapaId` el mapa; `estado` la cola de la partida.
 */
export function creaMicroEncuentros({ mundo, mapaId, estado = estadoDeEntregas(), pesoMinimo = PESO_MINIMO_DE_ESCENA } = {}) {
  const id = exigeMapaId(mapaId, 'los micro-encuentros');
  const sitios = sitiosDelMundo(mundo);

  const exigeSitio = (nombre, quien) => {
    if (typeof nombre !== 'string' || !nombre) {
      throw new Error(`${quien}: el sitio llega como ${JSON.stringify(nombre) ?? String(nombre)} y se espera el identificador de una localización del mundo, nunca una coordenada`);
    }
    const sitio = sitios.get(nombre);
    if (!sitio) {
      throw new Error(`${quien}: el sitio "${nombre}" no existe en el mapa ${id}, así que no se puede resolver un lugar contra él`);
    }
    return sitio;
  };

  /**
   * La jugadora atraviesa un sitio. Devuelve el micro-encuentro disponible o `null`.
   *
   * @param {object} paso
   *   `sitio` el que acaba de atravesar; `salida` la salida en curso; `paso` el paso
   *   del mundo, del que sale el cooldown; `trazado` **la lista de sitios del
   *   trazado vigente**, que es lo que hace del coste cero una pertenencia y no una
   *   distancia; `porLlegada` para la salida sin aventura aceptada, donde el lugar
   *   se resuelve por llegada real y no hay trazado; `beatEnCurso` el dato de la
   *   capa de la escena.
   *
   * Sin trazado y sin llegada declarada **falla nombrando lo que falta**, en lugar
   * de elegir un sitio cualquiera del mapa.
   */
  const atraviesa = ({ sitio, salida, paso, trazado = null, porLlegada = false, beatEnCurso = false }) => {
    const quien = 'resolver el lugar diferido de un micro-encuentro';
    if (typeof salida !== 'string' || !salida) {
      throw new Error(`${quien}: falta la salida en curso y llegó ${JSON.stringify(salida) ?? String(salida)}`);
    }
    if (!Number.isInteger(paso) || paso < 0) {
      throw new Error(`${quien}: el paso del mundo llega como ${JSON.stringify(paso) ?? String(paso)} y tiene que ser un entero no negativo`);
    }
    if (trazado !== null && !Array.isArray(trazado)) {
      throw new Error(
        `${quien}: el trazado vigente llega como ${JSON.stringify(trazado) ?? String(trazado)} y se espera la lista de sitios que se van a atravesar; ` +
        'un sitio suelto no es un trazado, y esta firma no admite las dos formas en el mismo parámetro',
      );
    }
    if (typeof porLlegada !== 'boolean') {
      throw new Error(`${quien}: la llegada declarada llega como ${JSON.stringify(porLlegada) ?? String(porLlegada)} y es un dato de dos valores`);
    }
    if (trazado === null && !porLlegada) {
      throw new Error(`${quien}: la salida no tiene trazado vigente ni llegada declarada, así que no hay contra qué resolverlo; elegir un sitio cualquiera del mapa no es una alternativa`);
    }
    const donde = exigeSitio(sitio, quien);

    // Manda el beat: la escena que se está viviendo no se interrumpe, y lo retenido
    // no consume oferta ni sedimenta nada. Va antes que cualquier otra guarda para
    // que ni siquiera se mire la cola durante una escena.
    if (retieneElAviso(beatEnCurso)) return null;

    // Coste cero de desvío, como pertenencia: un sitio que exige salirse del trazado
    // vigente no es candidato. Nunca hay metros de ida ni de vuelta porque nunca se
    // sale del lazo.
    if (trazado !== null && !trazado.includes(sitio)) return null;

    // Cola vacía, ni un encuentro. Y el cooldown: como mucho uno por paso del mundo.
    if (yaSaltoEnElPaso(estado, { mapaId: id, paso })) return null;
    const cola = pendientes(estado, { mapaId: id });
    if (!cola.length) return null;

    const elegida = cola.find((e) => admiteOferta(e, { salida, sitio }) && admiteLaEscena(donde, e.escena, pesoMinimo));
    if (!elegida) return null;

    registraOferta(estado, { mapaId: id, id: elegida.id, salida, sitio, paso });
    return congelaHondo({
      entrada: elegida.id,
      asunto: elegida.asunto,
      clase: elegida.clase,
      escena: elegida.escena,
      // El sitio resuelto, con nombre y anclaje: a un sitio se le nombra, nunca se
      // le da una coordenada.
      sitio: { nombre: donde.nombre, tipo: donde.tipo, anclaje: donde.anclaje },
      beats: BEATS_DEL_MICROENCUENTRO,
      // Ni franja ni tiempo límite: RF-QUEST-015, fallar por no llegar es casi
      // imposible, y un micro-encuentro no se puede fallar por no llegar.
      franja: null,
      limite: null,
      // No se contabiliza en el presupuesto de ninguna aventura: por eso atender uno
      // deja la cadena de beats, el tamaño y el trecho hasta el siguiente beat
      // exactamente como estaban.
      cuentaEnElPresupuesto: false,
      enElTrazado: trazado !== null,
    });
  };

  return {
    mapaId: id,
    atraviesa,

    /** Los sitios del trazado que podrían resolver el lugar de una entrada pendiente. */
    sitiosAptos({ trazado, escena }) {
      if (!Array.isArray(trazado)) {
        throw new Error(`los sitios aptos se buscan sobre la lista de sitios del trazado vigente y llegó ${JSON.stringify(trazado) ?? String(trazado)}`);
      }
      return congelaHondo(trazado.filter((s) => admiteLaEscena(sitios.get(s), escena, pesoMinimo)));
    },

    /** Atender el micro-encuentro: su entrada sale de la cola y no vuelve a ofrecerse. */
    atiende(entradaId) {
      return atiendeEntrada(estado, { mapaId: id, id: entradaId });
    },

    /** Cerrar la salida: los recados aceptados consumen oferta y lo que llega al tope sedimenta. */
    cierraSalida({ salida, paso }) {
      return cierraSalidaDeLaCola(estado, { mapaId: id, salida, paso });
    },

    /** La cola viva de este mapa, para quien tenga que leerla sin tocarla. */
    cola() {
      return congelaHondo(entregasDeMapa(estado, id).entradas.map((e) => e.id));
    },
  };
}
