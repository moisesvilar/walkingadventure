// La cola de entregas: dónde se guarda lo que el mundo le debe a la jugadora y
// todavía no le ha llegado. Dos tipos que no se comportan igual —la noticia
// sedimenta dentro del mismo paso, la oportunidad espera y se ofrece dos veces— y el
// segundo productor de paso del motor de SPEC-011, que es por donde entra todo.
//
// Es **estado de la partida y nunca del mundo**, por la misma razón que el contador
// de pasos y lo que se cuenta en cada núcleo: el documento congelado de una celda
// describe el mundo, y el mundo no cambia porque a alguien le deban un recado
// (SPEC-009). Y es **por mapa**, como el contador: una cola compartida haría que lo
// que el mundo produjo andando fuera te saliera al paso en casa.

import { congelaHondo } from '../core/congelar.js';
import { PROTAGONISTAS, exigeSigno, hechosFieles } from './deformacion.js';
import { validaEfectos } from './efectos.js';
import { sedimenta, versionQueLlego } from './nucleos.js';
import { exigeMapaId } from './pasos.js';
import { escenaDeEntrega } from './sucesos-prologo.js';

/**
 * El identificador del productor en el motor. De él cuelga su azar, así que
 * cambiarlo resiembra la cola entera de una partida en curso.
 */
export const ID_DEL_PRODUCTOR = 'entregas';

/**
 * Los dos tipos de entrega, y son exactamente dos: `quests.md` decisión 3 los
 * enumera y no hay un tercero. La **noticia** informa y sedimenta de inmediato; la
 * **oportunidad** espera a que se la ofrezcan.
 */
export const TIPOS_DE_ENTREGA = Object.freeze({ NOTICIA: 'noticia', OPORTUNIDAD: 'oportunidad' });

/** Los identificadores de los dos tipos, en orden estable. */
export const IDS_DE_ENTREGA = congelaHondo(Object.values(TIPOS_DE_ENTREGA).sort());

/**
 * Los tres estados por los que pasa una entrada. **Ninguno es un castigo**:
 * «sedimentada» es el final tranquilo de lo que no se atendió, y no hay ninguno que
 * signifique fallada.
 */
export const ESTADOS_DE_ENTRADA = Object.freeze({
  PENDIENTE: 'pendiente',
  ATENDIDA: 'atendida',
  SEDIMENTADA: 'sedimentada',
});

/** Los identificadores de los estados, en orden estable. */
export const IDS_DE_ESTADO = congelaHondo(Object.values(ESTADOS_DE_ENTRADA).sort());

/**
 * Por dónde se ofreció una oportunidad. La de **marcha** lleva sitio resuelto —es el
 * aviso del micro-encuentro—; la de **lista** es el recado que se aceptó y cuya
 * salida se cerró sin atenderlo, y no tiene sitio porque una lista no tiene sitio.
 *
 * Son dos registros declarados y no dos formas del mismo parámetro: quien registra
 * una oferta de marcha sin sitio falla nombrando el campo que falta.
 */
export const VIAS_DE_OFERTA = Object.freeze({ MARCHA: 'marcha', LISTA: 'lista' });

/**
 * Cuántas veces se ofrece una oportunidad antes de que sedimente. **Dos, y la
 * constante es única**: `quests.md` decisión 3 razona el número —una sola es frágil,
 * infinitas son un incordio— y todo lo que cuenta ofertas lo lee de aquí, para que
 * subirlo o bajarlo sea un cambio y no un descuido repartido por tres módulos.
 */
export const TOPE_DE_OFERTAS = 2;

/** El estado de la cola de una partida: un registro por mapa y nada más. */
export function estadoDeEntregas() {
  return { mapas: {} };
}

/**
 * El registro de un mapa dentro del estado, creándolo si es la primera vez. Un mapa
 * recién creado y sin prólogo corrido devuelve la cola vacía, que es una respuesta y
 * no una avería.
 */
export function entregasDeMapa(estado, mapaId) {
  const id = exigeMapaId(mapaId, 'la cola de entregas');
  if (!estado || typeof estado !== 'object' || !estado.mapas || typeof estado.mapas !== 'object') {
    throw new Error('el estado de la cola de entregas llega mal formado: se espera lo que devuelve estadoDeEntregas(), un objeto con "mapas"');
  }
  if (!Object.prototype.hasOwnProperty.call(estado.mapas, id)) estado.mapas[id] = { entradas: [] };
  return estado.mapas[id];
}

// --- La forma de una entrada -------------------------------------------------

function exigeClave(valor, campo, quien) {
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${quien}: falta "${campo}" y llegó ${JSON.stringify(valor) ?? String(valor)}; es una clave del catálogo, nunca una frase redactada`);
  }
  return valor;
}

function exigePaso(paso, quien) {
  if (!Number.isInteger(paso) || paso < 0) {
    throw new Error(`${quien}: el paso del mundo llega como ${JSON.stringify(paso) ?? String(paso)} y tiene que ser un entero no negativo`);
  }
  return paso;
}

/**
 * Construye la entrada de la cola a partir de lo que el mundo produjo, validando el
 * tipo contra el enumerado cerrado y la escena contra su ausencia.
 *
 * **Una oportunidad sin escena declarada no se encola**: suponerle una la haría
 * resolver lugar contra cualquier sitio, y el lugar diferido dejaría de significar
 * nada. La escena la declara quien produce, no este módulo.
 *
 * La entrada **no lleva lugar**: declara una escena, y el sitio se resuelve en
 * marcha contra el primero apto por el que se pase (`quests.md` §2).
 */
export function entradaDeEntrega({ tipo, asunto, clase = null, escena = null, origen = null, mapa, paso, nucleo = null, signo = null, hechos = null }) {
  const quien = `la entrada de la cola "${typeof asunto === 'string' ? asunto : String(asunto)}"`;
  if (!IDS_DE_ENTREGA.includes(tipo)) {
    throw new Error(`${quien} llega con el tipo ${JSON.stringify(tipo) ?? String(tipo)}, que no está en el enumerado: los dos válidos son ${IDS_DE_ENTREGA.join(', ')}`);
  }
  exigeClave(asunto, 'asunto', quien);
  exigeMapaId(mapa, 'la procedencia de una entrada de la cola');
  exigePaso(paso, quien);
  if (tipo === TIPOS_DE_ENTREGA.OPORTUNIDAD && (typeof escena !== 'string' || !escena)) {
    throw new Error(`${quien} es una oportunidad y no declara escena: sin ella no hay contra qué medir si un sitio es apto, y suponerle una sería resolver el lugar contra cualquiera`);
  }
  if (tipo === TIPOS_DE_ENTREGA.NOTICIA) {
    exigeClave(nucleo, 'nucleo', `${quien}, que es una noticia y sedimenta en un núcleo`);
    exigeSigno(signo, `el signo de la noticia "${asunto}"`);
  }
  return {
    id: `${tipo}:${asunto}@${origen ?? nucleo ?? 'sin-origen'}#${paso}`,
    tipo,
    asunto,
    clase: clase ?? null,
    escena: escena ?? null,
    origen: origen ?? nucleo ?? null,
    procedencia: { mapa, paso },
    estado: ESTADOS_DE_ENTRADA.PENDIENTE,
    sitio: null,
    aceptadaEn: null,
    apariciones: 0,
    ultimaLista: null,
    ofertas: [],
    // Los datos con los que una noticia sedimenta en su núcleo. Viven aparte porque
    // no son de la entrada: son de lo que se cuenta allí, y desaparecen del
    // documento en cuanto la noticia ha sedimentado.
    nucleo: nucleo ?? null,
    signo: signo ?? null,
    hechos: hechos ?? null,
  };
}

// La identidad tiene que ser única dentro del mapa: dos entradas con la misma se
// pisarían al ofrecerse. Se desempata con un sufijo declarado y no con un contador
// global, que dependería del orden de carga.
function identidadLibre(registro, base) {
  if (!registro.entradas.some((e) => e.id === base)) return base;
  for (let k = 2; k < 1000; k++) {
    const id = `${base}~${k}`;
    if (!registro.entradas.some((e) => e.id === id)) return id;
  }
  throw new Error(`la cola no puede dar identidad a "${base}": mil entradas con la misma procedencia es un productor en bucle, no un mundo productivo`);
}

/**
 * Encola lo que el mundo ha producido.
 *
 * Una **noticia** entra ya sedimentada y con su versión puesta en lo que se cuenta
 * en su núcleo: `quests.md` decisión 3 dice «sedimentan de inmediato … y siguen
 * consultables», así que no ocupa sitio en la cola ni un solo paso. Por eso el
 * estado de los núcleos es obligatorio para encolar una: sin él la noticia se
 * quedaría marcada como sedimentada sin haber sedimentado en ningún sitio.
 *
 * Una **oportunidad** entra pendiente y con cero ofertas registradas.
 */
export function encola(estado, { mapaId, produccion, nucleos = null }) {
  const id = exigeMapaId(mapaId, 'encolar una entrega');
  const registro = entregasDeMapa(estado, id);
  const entrada = entradaDeEntrega({ ...produccion, mapa: id });
  entrada.id = identidadLibre(registro, entrada.id);

  if (entrada.tipo === TIPOS_DE_ENTREGA.NOTICIA) {
    if (!nucleos || typeof nucleos !== 'object' || !nucleos.mapas) {
      throw new Error(
        `la noticia "${entrada.asunto}" se encola sin el estado de lo que se cuenta en los núcleos: sedimenta de inmediato, ` +
        'así que sin él quedaría marcada como sedimentada sin haber sedimentado en ninguna parte',
      );
    }
    const hechos = entrada.hechos ?? hechosFieles(
      { asunto: entrada.asunto, escala: { veces: 1 }, detalle: { con: null, lugar: entrada.nucleo, motivo: null } },
      { lugar: entrada.nucleo, protagonista: PROTAGONISTAS.VECINDARIO, quien: `la noticia "${entrada.asunto}"` },
    );
    sedimenta(nucleos, {
      mapaId: id,
      nucleo: entrada.nucleo,
      // Nivel cero: la noticia llega a su núcleo tal cual, sin saltos que la
      // tuerzan. La deformación es de la propagación y no de esta capa.
      loQueLlego: versionQueLlego({
        rumor: entrada.id,
        origen: entrada.nucleo,
        nivel: 0,
        signo: entrada.signo,
        hechos,
        oidoEn: entrada.procedencia.paso,
      }),
    });
    entrada.estado = ESTADOS_DE_ENTRADA.SEDIMENTADA;
  }

  registro.entradas.push(entrada);
  // Se devuelve la copia pública y no la entrada viva: una copia superficial
  // compartiría la lista de ofertas, y congelarla dejaría la entrada de la cola sin
  // poder registrar ninguna.
  return publica(entrada);
}

/**
 * Las entradas sembradas por el prólogo, encoladas por la misma puerta que las que
 * produce un paso.
 *
 * SPEC-013 las deja con la forma de un efecto `oportunidad` del catálogo cerrado y
 * **sin ningún campo propio del prólogo**, que era su decisión: una entrada
 * distinguible acabaría tratada distinto y el arranque volvería a parecer un guion.
 * La escena sale del mismo catálogo cerrado que declaró el asunto, no de una
 * suposición de aquí.
 */
export function siembraLaCola(estado, { mapaId, entradas, paso = 0 }) {
  const id = exigeMapaId(mapaId, 'sembrar la cola de entregas');
  if (!Array.isArray(entradas)) {
    throw new Error(`la siembra de la cola recibe ${JSON.stringify(entradas) ?? String(entradas)}: se espera la lista de entradas que dejó el prólogo, aunque sea vacía`);
  }
  return congelaHondo(entradas.map((e) => encola(estado, {
    mapaId: id,
    produccion: {
      tipo: e.tipo,
      asunto: e.asunto,
      clase: e.clase ?? null,
      escena: e.escena ?? escenaDeEntrega(e.asunto),
      origen: e.lugar ?? e.origen ?? null,
      paso,
    },
  })));
}

// --- Consultas ---------------------------------------------------------------

// El orden es **declarado**: primero el paso que la produjo y después su identidad.
// Nunca el de inserción ni el de recorrido de un Set o un Map, porque de este orden
// cuelga a quién se le ofrece el sitio de hoy.
function ordena(a, b) {
  if (a.procedencia.paso !== b.procedencia.paso) return a.procedencia.paso - b.procedencia.paso;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const publica = (e) => congelaHondo({
  id: e.id,
  tipo: e.tipo,
  asunto: e.asunto,
  clase: e.clase,
  escena: e.escena,
  origen: e.origen,
  procedencia: { ...e.procedencia },
  estado: e.estado,
  sitio: e.sitio,
  aceptadaEn: e.aceptadaEn,
  apariciones: e.apariciones,
  ofertas: e.ofertas.map((o) => ({ ...o })),
});

/** Lo pendiente de la cola: **solo oportunidades**, en orden estable. */
export function pendientes(estado, { mapaId }) {
  const registro = entregasDeMapa(estado, mapaId);
  return congelaHondo(
    registro.entradas
      .filter((e) => e.tipo === TIPOS_DE_ENTREGA.OPORTUNIDAD && e.estado === ESTADOS_DE_ENTRADA.PENDIENTE)
      .slice()
      .sort(ordena)
      .map(publica),
  );
}

/**
 * Las noticias que el mundo produjo en este mapa, todas sedimentadas y todas
 * consultables. **Ninguna caduca**: no hay aquí ninguna regla de tiempo, y un mes
 * sin abrir la app las devuelve enteras.
 */
export function noticias(estado, { mapaId }) {
  const registro = entregasDeMapa(estado, mapaId);
  return congelaHondo(registro.entradas.filter((e) => e.tipo === TIPOS_DE_ENTREGA.NOTICIA).slice().sort(ordena).map(publica));
}

/** Una entrada por su identidad, o un error que la nombra. */
export function entradaDe(estado, { mapaId, id }) {
  const viva = vivaDe(entregasDeMapa(estado, mapaId), id, mapaId);
  return publica(viva);
}

function vivaDe(registro, id, mapaId) {
  const viva = registro.entradas.find((e) => e.id === id);
  if (!viva) {
    throw new Error(`no hay ninguna entrada "${JSON.stringify(id) ?? String(id)}" en la cola del mapa ${mapaId}`);
  }
  return viva;
}

// --- El ciclo de las dos ofertas ---------------------------------------------

// La guarda que comparten las tres puertas por las que se toca una oportunidad. Un
// tipo que no espera y un estado que ya terminó se dicen en voz alta, cada uno con
// su nombre, en lugar de dejar pasar la operación a medias.
function exigeOportunidadViva(viva, que) {
  if (viva.tipo !== TIPOS_DE_ENTREGA.OPORTUNIDAD) {
    throw new Error(`la entrada "${viva.id}" es del tipo "${viva.tipo}" y no se puede ${que}: el ciclo de dos ofertas es solo de las oportunidades`);
  }
  if (viva.estado !== ESTADOS_DE_ENTRADA.PENDIENTE) {
    throw new Error(`la entrada "${viva.id}" está "${viva.estado}" y no se puede ${que}`);
  }
  return viva;
}

/**
 * Registra que una oportunidad se ha ofrecido en marcha, con su lugar ya resuelto.
 *
 * Es **la unidad que se cuenta hasta dos**, y por eso exige salida y sitio: una
 * oferta a medias haría indistinguibles «se ofreció y no la atendió» de «no llegó a
 * ofrecerse», que es justo lo que la segunda oferta existe para no confundir. El
 * paso queda dentro porque de él sale el cooldown, que es «uno por paso del mundo» y
 * no una cuenta de minutos ni de metros.
 */
export function registraOferta(estado, { mapaId, id, salida, sitio, paso }) {
  const registro = entregasDeMapa(estado, mapaId);
  const viva = exigeOportunidadViva(vivaDe(registro, id, mapaId), 'ofrecer');
  exigeClave(salida, 'salida', `la oferta de "${viva.id}"`);
  exigeClave(sitio, 'sitio', `la oferta de "${viva.id}"`);
  exigePaso(paso, `la oferta de "${viva.id}"`);
  if (viva.ofertas.length >= TOPE_DE_OFERTAS) {
    throw new Error(`la entrada "${viva.id}" ya tiene sus ${TOPE_DE_OFERTAS} ofertas y no se le puede ofrecer una tercera: a la tercera es un incordio`);
  }
  viva.ofertas.push({ salida, sitio, paso, via: VIAS_DE_OFERTA.MARCHA });
  viva.sitio = sitio;
  return publica(viva);
}

/**
 * Registra la oferta de un recado que se aceptó desde la lista y cuya salida se
 * cerró sin atenderlo. **No lleva sitio y no puede llevarlo**: una lista no tiene
 * sitio, así que la regla de «otro sitio» no le aplica y no se le inventa uno.
 */
export function registraOfertaDeLista(estado, { mapaId, id, salida, paso }) {
  const registro = entregasDeMapa(estado, mapaId);
  const viva = exigeOportunidadViva(vivaDe(registro, id, mapaId), 'ofrecer');
  exigeClave(salida, 'salida', `la oferta de lista de "${viva.id}"`);
  exigePaso(paso, `la oferta de lista de "${viva.id}"`);
  if (viva.ofertas.length >= TOPE_DE_OFERTAS) {
    throw new Error(`la entrada "${viva.id}" ya tiene sus ${TOPE_DE_OFERTAS} ofertas y no se le puede ofrecer una tercera: a la tercera es un incordio`);
  }
  viva.ofertas.push({ salida, sitio: null, paso, via: VIAS_DE_OFERTA.LISTA });
  return publica(viva);
}

/**
 * Si a esta entrada se le puede ofrecer algo en esta salida y en este sitio.
 *
 * Las tres condiciones son las de `quests.md` decisión 3, y ninguna es un umbral:
 * quedan ofertas, **no en la misma salida** y **no en el mismo sitio**. La segunda
 * oferta que solo podría caer donde cayó la primera no se ofrece, y la oportunidad
 * sigue pendiente con la que tenía.
 */
export function admiteOferta(entrada, { salida, sitio }) {
  if (entrada.tipo !== TIPOS_DE_ENTREGA.OPORTUNIDAD) return false;
  if (entrada.estado !== ESTADOS_DE_ENTRADA.PENDIENTE) return false;
  if (entrada.ofertas.length >= TOPE_DE_OFERTAS) return false;
  if (entrada.ofertas.some((o) => o.salida === salida)) return false;
  if (sitio !== null && entrada.ofertas.some((o) => o.sitio === sitio)) return false;
  return true;
}

/** Aceptar un recado de la lista: no consume oferta, solo declara que se cogió. */
export function aceptaRecado(estado, { mapaId, id, salida }) {
  const registro = entregasDeMapa(estado, mapaId);
  const viva = exigeOportunidadViva(vivaDe(registro, id, mapaId), 'aceptar');
  exigeClave(salida, 'salida', `la aceptación de "${viva.id}"`);
  viva.aceptadaEn = salida;
  return publica(viva);
}

/** Atender una entrada: sale de la cola y no vuelve a ofrecerse nunca. */
export function atiende(estado, { mapaId, id }) {
  const registro = entregasDeMapa(estado, mapaId);
  const viva = exigeOportunidadViva(vivaDe(registro, id, mapaId), 'atender');
  viva.estado = ESTADOS_DE_ENTRADA.ATENDIDA;
  viva.aceptadaEn = null;
  return publica(viva);
}

/**
 * Cierra una salida: los recados aceptados y no atendidos consumen su oferta, y lo
 * que llega al tope sedimenta.
 *
 * **Sedimentar no produce ningún efecto de paso, ni siquiera aditivo**: cambia el
 * estado de su propia entrada y nada más. Un efecto registrado es un dato que
 * alguien acaba contando, y contar lo que no se hizo es el reproche por la puerta de
 * atrás.
 *
 * Lo retenido por un beat en curso no llega aquí con oferta consumida, así que una
 * salida entera dentro de escenas encadenadas no sedimenta nada.
 */
export function cierraSalida(estado, { mapaId, salida, paso }) {
  const registro = entregasDeMapa(estado, mapaId);
  exigeClave(salida, 'salida', 'el cierre de una salida');
  exigePaso(paso, 'el cierre de una salida');

  for (const viva of registro.entradas.slice().sort(ordena)) {
    if (viva.tipo !== TIPOS_DE_ENTREGA.OPORTUNIDAD) continue;
    if (viva.estado !== ESTADOS_DE_ENTRADA.PENDIENTE) continue;
    if (viva.aceptadaEn !== salida) continue;
    viva.aceptadaEn = null;
    if (admiteOferta(viva, { salida, sitio: null })) {
      viva.ofertas.push({ salida, sitio: null, paso, via: VIAS_DE_OFERTA.LISTA });
    }
  }

  const sedimentadas = [];
  for (const viva of registro.entradas.slice().sort(ordena)) {
    if (viva.tipo !== TIPOS_DE_ENTREGA.OPORTUNIDAD) continue;
    if (viva.estado !== ESTADOS_DE_ENTRADA.PENDIENTE) continue;
    if (viva.ofertas.length < TOPE_DE_OFERTAS) continue;
    viva.estado = ESTADOS_DE_ENTRADA.SEDIMENTADA;
    sedimentadas.push(publica(viva));
  }
  return congelaHondo(sedimentadas);
}

/**
 * Si en este paso del mundo ya saltó un micro-encuentro en este mapa.
 *
 * El cooldown es **como mucho uno por paso del mundo** y se lee de las ofertas ya
 * registradas, no de un contador aparte: así una partida que no recibió ninguna
 * oportunidad y otra que las dejó sedimentar se diferencian solo en las entradas de
 * la cola, que es lo que hace comprobable que ignorar no deja rastro en ningún otro
 * sitio. En pasos y no en minutos porque el reloj real no entra en el núcleo.
 */
export function yaSaltoEnElPaso(estado, { mapaId, paso }) {
  const registro = entregasDeMapa(estado, mapaId);
  return registro.entradas.some((e) => e.ofertas.some((o) => o.via === VIAS_DE_OFERTA.MARCHA && o.paso === paso));
}

// --- El productor de paso ----------------------------------------------------

/**
 * Cuelga la cola del motor de pasos de SPEC-011 como **segundo productor**.
 *
 * @param {object} opciones
 *   `mapaId` el mapa cuya cola crece; `estado` la cola de la partida; `nucleos` lo
 *   que se cuenta en cada núcleo, donde sedimentan las noticias; `producciones` **lo
 *   que el mundo produce en un paso**, inyectado como `(n, azar) => [producción]`.
 *
 *   Sin fuente inyectada este productor **no produce nada y no falla**: es lo que
 *   hace estructural la prohibición de `quests.md` decisión 3 —«sin producción del
 *   mundo no hay encuentro, nunca relleno aleatorio»—, porque no existe ninguna vía
 *   por la que esta capa invente una entrada por su cuenta.
 */
export function creaColaDeEntregas({ mapaId, estado = estadoDeEntregas(), nucleos = null, producciones = null } = {}) {
  const id = exigeMapaId(mapaId, 'la cola de entregas');
  if (producciones !== null && typeof producciones !== 'function') {
    throw new Error(`la fuente de producciones del mundo llega como ${JSON.stringify(producciones) ?? String(producciones)}: se espera una función (n, azar) => lista, o nada`);
  }

  const produce = (n, azar) => {
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`la cola de entregas recibe el paso ${JSON.stringify(n) ?? String(n)}: los pasos son enteros no negativos`);
    }
    if (!producciones) return [];
    const producidas = producciones(n, azar) ?? [];
    if (!Array.isArray(producidas)) {
      throw new Error(`la fuente de producciones del mundo devolvió ${JSON.stringify(producidas) ?? String(producidas)} en el paso ${n}: se espera una lista, aunque sea vacía`);
    }
    if (!producidas.length) return [];

    // Se construyen y se validan **antes de tocar la cola**: un paso se aplica
    // entero o no se aplica, así que un efecto fuera del catálogo cerrado de
    // SPEC-011 deja la cola exactamente como estaba.
    const entradas = producidas.map((p) => entradaDeEntrega({ ...p, mapa: id, paso: n }));
    const efectos = entradas.map((e) => (e.tipo === TIPOS_DE_ENTREGA.NOTICIA
      ? { tipo: 'rumor', nucleo: e.nucleo, asunto: e.asunto, origen: e.origen }
      : { tipo: 'oportunidad', asunto: e.asunto, clase: e.clase, origen: e.origen }));
    const validados = validaEfectos(efectos, `la cola de entregas en el paso ${n} del mapa ${id}`);

    for (const p of producidas) encola(estado, { mapaId: id, produccion: { ...p, paso: n }, nucleos });
    return validados;
  };

  return {
    id: ID_DEL_PRODUCTOR,
    produce,
    /** Lo pendiente de este mapa, que es la guarda del micro-encuentro. */
    pendientes() {
      return pendientes(estado, { mapaId: id });
    },
    /** Las entradas que dejó el prólogo, por la misma puerta que las de un paso. */
    siembra(entradas, paso = 0) {
      return siembraLaCola(estado, { mapaId: id, entradas, paso });
    },
  };
}

// --- Serialización -----------------------------------------------------------

/**
 * La cola en forma serializable, con mapas y entradas en orden declarado.
 *
 * Los datos con los que una noticia sedimentó —su núcleo, su signo y sus hechos— no
 * viajan: ya están en lo que se cuenta en ese núcleo, y guardarlos dos veces es cómo
 * los dos sitios acaban diciendo cosas distintas.
 */
export function congelaEntregas(estado) {
  const mapas = {};
  for (const mapaId of Object.keys(estado?.mapas ?? {}).sort()) {
    const registro = estado.mapas[mapaId];
    mapas[mapaId] = {
      entradas: registro.entradas.slice().sort(ordena).map((e) => ({
        id: e.id,
        tipo: e.tipo,
        asunto: e.asunto,
        clase: e.clase ?? null,
        escena: e.escena ?? null,
        origen: e.origen ?? null,
        procedencia: { mapa: e.procedencia.mapa, paso: e.procedencia.paso },
        estado: e.estado,
        sitio: e.sitio ?? null,
        aceptadaEn: e.aceptadaEn ?? null,
        apariciones: e.apariciones,
        ultimaLista: e.ultimaLista ?? null,
        ofertas: e.ofertas.map((o) => ({ salida: o.salida, sitio: o.sitio ?? null, paso: o.paso, via: o.via })),
      })),
    };
  }
  return { mapas };
}

/** La cola de vuelta de su documento, con sus estados y sus ofertas intactos. */
export function levantaEntregas(doc) {
  const estado = estadoDeEntregas();
  for (const mapaId of Object.keys(doc?.mapas ?? {}).sort()) {
    const registro = entregasDeMapa(estado, mapaId);
    for (const e of doc.mapas[mapaId]?.entradas ?? []) {
      if (!IDS_DE_ENTREGA.includes(e.tipo)) {
        throw new Error(`la entrada "${e.id}" vuelve con el tipo ${JSON.stringify(e.tipo) ?? String(e.tipo)}: los dos válidos son ${IDS_DE_ENTREGA.join(', ')}`);
      }
      if (!IDS_DE_ESTADO.includes(e.estado)) {
        throw new Error(`la entrada "${e.id}" vuelve con el estado ${JSON.stringify(e.estado) ?? String(e.estado)}: los declarados son ${IDS_DE_ESTADO.join(', ')}`);
      }
      registro.entradas.push({
        id: e.id,
        tipo: e.tipo,
        asunto: e.asunto,
        clase: e.clase ?? null,
        escena: e.escena ?? null,
        origen: e.origen ?? null,
        procedencia: { mapa: e.procedencia.mapa, paso: e.procedencia.paso },
        estado: e.estado,
        sitio: e.sitio ?? null,
        aceptadaEn: e.aceptadaEn ?? null,
        apariciones: e.apariciones,
        ultimaLista: e.ultimaLista ?? null,
        ofertas: (e.ofertas ?? []).map((o) => ({ salida: o.salida, sitio: o.sitio ?? null, paso: o.paso, via: o.via })),
        nucleo: null,
        signo: null,
        hechos: null,
      });
    }
    registro.entradas.sort(ordena);
  }
  return estado;
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión: no
// hay ninguna consulta que devuelva cuántas oportunidades se dejaron pasar, ni
// cuántas sedimentaron, ni ningún texto destinado a mostrarse. Si el número no
// existe en la superficie pública, ninguna pantalla puede pintarlo por descuido.
