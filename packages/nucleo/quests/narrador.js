// El contrato con el LLM: **el árbitro es el código y el narrador es el modelo**.
//
// Aquí viven los dos puntos de invocación y ni uno más, el esquema cerrado con el que
// se lee la respuesta, el catálogo cerrado de motivos de descarte, la caída al fallback
// —que es el camino normal y no el de excepción— y la vestidura sobre lo ya casteado.
//
// La regla que lo ordena todo cabe en una línea de `game-design/quests.md` decisión 1:
// **si alguna regla bifurca por él, no lo escribe el modelo**. El modelo produce título,
// gancho, textos de escena, versiones de rumor, el envoltorio del zurrón y nombres
// propuestos; nunca lugares, disparadores, resultados, oro, niveles, signos, franjas ni
// geofences. Lo que llegue fuera del esquema **se descarta sin interpretarse**, y lo que
// llegue dentro pero no pase la validación cae al texto de la plantilla, que siempre
// existe.
//
// Y la tensión que parece una contradicción y no lo es: RNF-RED-001 pide degradación
// **silenciosa** y §6h de `pipeline/decisiones-orquestador.md` la prohíbe. Hablan de
// superficies distintas y aquí se resuelve así: **silencio hacia la jugadora,
// constancia en el dato**. Cada texto declara su origen, cada descarte deja su clave, y
// una fila que caiga entera al fallback es invisible jugando y un histograma en
// `node --test`.
//
// El núcleo **no llama a nadie**: la llamada al proxy llega inyectada, y sin ella todos
// los huecos caen al fallback sin intentar ninguna conexión, que es el estado normal en
// `node --test` y en una salida sin cobertura.

import { congelaHondo } from '../core/congelar.js';
import { creaFiltroDeAptitud, motivoDeAptitud, MOTIVOS_DE_APTITUD } from '../names/aptitud-de-texto.js';
import { anotaTopico, aperturaDeTexto, CATEGORIAS_DE_TOPICO, exigeCategoria, topicosParaElPrompt } from '../partida/topicos.js';
import { guardaTexto } from '../partida/diario.js';
import { huecosDePlantilla, TOPES_DE_TEXTO } from './catalogo.js';
import { construyePrompt, datosRealesDeMundo, REGLAS_DE_ESCRITURA, sobreDePeticion, TONO } from './prompt.js';

/**
 * Los dos puntos de invocación, y ni uno más (RF-QUEST-008).
 *
 * Uno al crear la aventura y otro al abrir la salida para el zurrón. El segundo es la
 * única excepción a «el LLM se invoca al crear la quest» y sigue cumpliendo el espíritu:
 * se llama **antes de andar, no mientras se anda**.
 */
export const PUNTOS_DE_INVOCACION = congelaHondo(['crear-aventura', 'abrir-salida']);

/** Los momentos de una salida, los de la fila 29. El narrador solo habla en el primero. */
export const MOMENTOS_DE_SALIDA = congelaHondo(['antes-de-salir', 'en-marcha', 'al-parar', 'telon']);

/**
 * El momento en el que no se llama, pase lo que pase.
 *
 * Va como comprobación y no como convención porque «nunca en marcha» es la mitad de
 * RF-QUEST-008, y sin el momento entre las entradas sería un criterio que se cumple
 * casi siempre — que es exactamente lo que §6o dice que no es un criterio.
 */
export const MOMENTO_PROHIBIDO = 'en-marcha';

/**
 * El catálogo cerrado de **campos inertes**: lo único que el modelo escribe.
 *
 * Seis y ninguno más. Que su intersección con los datos vivos esté vacía no se deja a
 * la buena fe: se comprueba al cargar este módulo, más abajo.
 */
export const CAMPOS_INERTES = congelaHondo(['titulo', 'gancho', 'escena', 'rumor', 'zurron', 'nombre']);

/**
 * Los **datos vivos** de `quests.md` decisión 1: lo que el código lee para decidir.
 *
 * Si llegan dentro de una respuesta se descartan por serlo, con un motivo propio y
 * distinto del campo simplemente desconocido: no es lo mismo que el modelo se invente un
 * campo que que intente escribir el oro.
 */
export const DATOS_VIVOS = congelaHondo([
  'lugar', 'lugares', 'disparador', 'disparadores', 'resultado', 'resultados',
  'oro', 'nivel', 'signo', 'franja', 'geofence', 'xp', 'reputacion', 'condicion',
  'beats', 'casting', 'presupuesto',
]);

/** El catálogo cerrado de motivos de descarte. Claves, nunca frases. */
export const MOTIVOS_DEL_NARRADOR = congelaHondo({
  /** No había llamada inyectada: el estado normal sin red y en `node --test`. */
  SIN_LLAMADA: 'sin-llamada',
  /** La llamada lanzó un error. */
  FALLO_DE_RED: 'fallo-de-red',
  /** El presupuesto de espera se agotó antes de que llegara nada. */
  ESPERA_AGOTADA: 'espera-agotada',
  /** Lo que llegó no es un documento legible: se rechaza entero. */
  RESPUESTA_ILEGIBLE: 'respuesta-ilegible',
  /** Un campo que el esquema cerrado no declara. Se descarta sin interpretarse. */
  CAMPO_DESCONOCIDO: 'campo-desconocido',
  /** Un campo que el código lee para decidir. Se descarta por serlo. */
  DATO_VIVO: 'dato-vivo',
  /** Llegó un hueco que nadie pidió. */
  HUECO_NO_PEDIDO: 'hueco-no-pedido',
  /** Faltaba un hueco de los pedidos. */
  HUECO_AUSENTE: 'hueco-ausente',
  /** El texto no pasó el filtro de aptitud. El motivo fino va en el detalle. */
  NO_APTO: 'no-apto',
});

/** Las claves válidas, en orden declarado. Es lo que enumera el histograma. */
export const CLAVES_DEL_NARRADOR = congelaHondo(Object.values(MOTIVOS_DEL_NARRADOR));

/** Compone un motivo del catálogo, validándolo. Una causa fuera de él falla nombrándola. */
export function motivoDelNarrador({ clave, detalle = null }) {
  if (!CLAVES_DEL_NARRADOR.includes(clave)) {
    throw new Error(
      `motivo del narrador desconocido ${JSON.stringify(clave) ?? String(clave)}: el catálogo cerrado es ${CLAVES_DEL_NARRADOR.join(', ')}. ` +
      'Una causa nueva se añade al catálogo, no se entrega con una clave genérica',
    );
  }
  return congelaHondo({ clave, detalle });
}

/** El envoltorio del zurrón: el único texto nuevo del resumen, con su fallback. */
export const FALLBACK_DEL_ZURRON = 'Mientras hacías tu vida, el mundo anduvo lo suyo. Esto es lo que se cuenta por los caminos.';

/** El tope del envoltorio del zurrón: el mismo que un gancho, que es lo que ocupa. */
export const TOPE_DEL_ZURRON = TOPES_DE_TEXTO.gancho;

/**
 * A qué categoría del registro de tópicos va lo adoptado de cada tipo de hueco.
 *
 * Se anota **la apertura del texto**, calculada mecánicamente: pedirle al modelo que
 * declare de qué habla sería dejarle escribir un dato por el que el código bifurca. La
 * categoría `oficios` no tiene tipo de hueco propio y se anota explícitamente por quien
 * pide un texto sobre un oficio — es la única de las cinco sin automatismo, y se dice
 * aquí en vez de dejarla muerta sin explicación.
 */
export const CATEGORIA_POR_TIPO = congelaHondo({
  titulo: 'aperturas',
  gancho: 'aperturas',
  escena: 'imagenes',
  rumor: 'giros',
  zurron: 'aperturas',
  nombre: 'objetos',
});

// El catálogo de campos inertes y la lista de datos vivos **no se cruzan**, y se
// comprueba al cargar el módulo: si algún día alguien mete «oro» entre lo inerte, tiene
// que fallar aquí y no en la partida de alguien.
for (const campo of CAMPOS_INERTES) {
  if (DATOS_VIVOS.includes(campo)) {
    throw new Error(`el campo "${campo}" está declarado a la vez como inerte y como dato vivo: la frontera del contrato con el modelo no admite un campo en los dos lados`);
  }
}
for (const tipo of CAMPOS_INERTES) exigeCategoria(CATEGORIA_POR_TIPO[tipo], `la categoría de tópico del tipo de hueco "${tipo}"`);

// --- Los huecos ----------------------------------------------------------------

// El separador de la clave: un carácter de control, por el mismo motivo que en el
// diario y en los puestos — no aparece en ningún nombre del mundo, así que dos claves
// no pueden colisionar porque un mapa se llame como se llame.
const SEPARADOR = String.fromCharCode(0);

/**
 * La clave con la que un texto vive en la partida.
 *
 * Sale **del mapa, del punto de invocación y de la identidad del elemento**, y de nada
 * más. No se deriva del prompt —como sí hace la clave de una ilustración— porque el
 * prompt lleva dentro el registro de tópicos, que cambia entre llamadas: derivar de él
 * daría una clave distinta para el mismo hueco y rompería «generación única».
 */
export function claveDeHueco({ mapa, punto, elemento }) {
  if (typeof mapa !== 'string' || !mapa) throw new Error(`la clave de un hueco necesita el mapa y llegó ${JSON.stringify(mapa) ?? String(mapa)}`);
  exigePunto(punto);
  if (typeof elemento !== 'string' || !elemento) throw new Error(`la clave de un hueco necesita la identidad del elemento y llegó ${JSON.stringify(elemento) ?? String(elemento)}`);
  return [mapa, punto, elemento].join(SEPARADOR);
}

/** Un punto de invocación de los dos, o un error que nombra el recibido y enumera los válidos. */
export function exigePunto(punto) {
  if (!PUNTOS_DE_INVOCACION.includes(punto)) {
    throw new Error(
      `el punto de invocación ${JSON.stringify(punto) ?? String(punto)} no existe: los dos declarados son ${PUNTOS_DE_INVOCACION.join(' y ')}. ` +
      'Son dos y no más, y el segundo es el único que ocurre fuera de la creación de la aventura',
    );
  }
  return punto;
}

/** Un tipo de hueco del catálogo cerrado, o un error que enumera los seis. */
export function exigeTipoDeHueco(tipo) {
  if (!CAMPOS_INERTES.includes(tipo)) {
    throw new Error(
      `el tipo de hueco ${JSON.stringify(tipo) ?? String(tipo)} no está en el catálogo cerrado de campos inertes: los seis son ${CAMPOS_INERTES.join(', ')}`,
    );
  }
  return tipo;
}

/** Valida un hueco pedido: clave, tipo del catálogo, tope y fallback. Falla nombrándolo. */
export function exigeHueco(hueco) {
  if (!hueco || typeof hueco !== 'object') throw new Error(`un hueco a redactar llega como ${JSON.stringify(hueco) ?? String(hueco)}`);
  if (typeof hueco.clave !== 'string' || !hueco.clave) throw new Error(`un hueco a redactar llega sin clave: ${JSON.stringify(hueco)}`);
  exigeTipoDeHueco(hueco.tipo);
  if (!Number.isInteger(hueco.tope) || hueco.tope <= 0) {
    throw new Error(`el hueco "${hueco.clave}" declara el tope ${JSON.stringify(hueco.tope)}: es el máximo de caracteres que cabe en su pantalla y es obligatorio`);
  }
  if (typeof hueco.fallback !== 'string' || !hueco.fallback.trim()) {
    throw new Error(
      `el hueco "${hueco.clave}" no trae texto de fallback: el fallback es el camino normal y no el de excepción, ` +
      'así que un hueco sin él no se pide antes de llamar a nadie',
    );
  }
  return hueco;
}

/** Los huecos de una aventura casteada, con sus topes y sus fallbacks de plantilla. */
export function huecosDeAventura(plantilla) {
  return huecosDePlantilla(plantilla).map((h) => ({ clave: h.clave, tipo: h.tipo, tope: h.tope, fallback: h.fallback }));
}

/** El hueco del envoltorio del zurrón. Es uno y es el único texto nuevo del resumen. */
export function huecoDelZurron({ clave = 'zurron' } = {}) {
  return { clave, tipo: 'zurron', tope: TOPE_DEL_ZURRON, fallback: FALLBACK_DEL_ZURRON };
}

// --- El esquema cerrado de la respuesta -----------------------------------------

/**
 * Los campos que el esquema declara. **Todo lo demás se descarta sin interpretarse.**
 *
 * `textos` y `nombres` son los diccionarios por clave de hueco; `texto` y `nombre` son
 * el atajo de una petición de un solo hueco, que es la forma con la que responde el
 * doble del proxy. Ninguno de los cuatro es un dato por el que ninguna regla bifurque.
 */
export const CAMPOS_DEL_ESQUEMA = congelaHondo(['textos', 'nombres', 'texto', 'nombre']);

/**
 * Lee una respuesta contra el esquema cerrado.
 *
 * Devuelve `{ propuestas, descartes }`: lo que se puede intentar adoptar, por clave, y
 * el diagnóstico de lo que se tiró y por qué. **No valida ningún texto**: eso es del
 * filtro, y mezclarlo aquí haría que «fuera del esquema» y «no apto» compartieran
 * motivo.
 */
export function leeRespuesta(respuesta, huecos) {
  const descartes = [];
  const propuestas = new Map();
  if (respuesta == null || typeof respuesta !== 'object' || Array.isArray(respuesta)) {
    return { propuestas, descartes: [{ clave: null, motivo: motivoDelNarrador({ clave: MOTIVOS_DEL_NARRADOR.RESPUESTA_ILEGIBLE, detalle: { llego: typeof respuesta } }) }] };
  }

  const pedidos = huecos.map((h) => h.clave);
  const unico = pedidos.length === 1 ? pedidos[0] : null;

  const anota = (clave, valor, familia) => {
    if (!pedidos.includes(clave)) {
      descartes.push({ clave, motivo: motivoDelNarrador({ clave: MOTIVOS_DEL_NARRADOR.HUECO_NO_PEDIDO, detalle: { familia } }) });
      return;
    }
    // Un hueco que llega dos veces se queda con el primero: el segundo no es más
    // reciente ni más válido, y elegir el último haría depender el resultado del orden
    // en que el modelo escribió su documento.
    if (!propuestas.has(clave)) propuestas.set(clave, valor);
  };

  // El orden de lectura es el declarado del esquema, no el del documento que llegó: dos
  // respuestas con los mismos campos en otro orden tienen que dar el mismo diagnóstico.
  for (const campo of Object.keys(respuesta).sort()) {
    if (!CAMPOS_DEL_ESQUEMA.includes(campo)) {
      const clave = DATOS_VIVOS.includes(campo) ? MOTIVOS_DEL_NARRADOR.DATO_VIVO : MOTIVOS_DEL_NARRADOR.CAMPO_DESCONOCIDO;
      // Y aquí termina la vida de ese campo: se anota su clave y su motivo, y **no se
      // lee su valor en ningún sitio**. Descartarlo sin interpretarlo es el criterio.
      descartes.push({ clave: campo, motivo: motivoDelNarrador({ clave, detalle: null }) });
      continue;
    }
    const valor = respuesta[campo];
    if (campo === 'texto' || campo === 'nombre') {
      if (unico == null) {
        descartes.push({ clave: campo, motivo: motivoDelNarrador({ clave: MOTIVOS_DEL_NARRADOR.HUECO_NO_PEDIDO, detalle: { atajo: campo, huecos: pedidos.length } }) });
        continue;
      }
      anota(unico, valor, campo);
      continue;
    }
    if (valor == null || typeof valor !== 'object' || Array.isArray(valor)) {
      descartes.push({ clave: campo, motivo: motivoDelNarrador({ clave: MOTIVOS_DEL_NARRADOR.CAMPO_DESCONOCIDO, detalle: { esperado: 'un diccionario por clave de hueco' } }) });
      continue;
    }
    for (const clave of Object.keys(valor).sort()) anota(clave, valor[clave], campo);
  }
  return { propuestas, descartes };
}

// --- La redacción ----------------------------------------------------------------

/**
 * El presupuesto de espera **no tiene valor por defecto**, y es deliberado.
 *
 * Decide la experiencia de la pantalla de preparación, que es de la fila 28, y un número
 * escondido en el núcleo es exactamente la clase de valor que nadie revisa. Su ausencia
 * hace fallar la llamada nombrando la dependencia que falta.
 */
function exigePresupuesto(presupuestoMs) {
  if (!Number.isFinite(presupuestoMs) || presupuestoMs <= 0) {
    throw new Error(
      `la redacción necesita el presupuesto de espera declarado y llegó ${JSON.stringify(presupuestoMs) ?? String(presupuestoMs)}: ` +
      'sin él se esperaría sin límite, y un valor por defecto escondido en el núcleo es un número que nadie revisa',
    );
  }
  return presupuestoMs;
}

function exigeMomento(momento) {
  if (!MOMENTOS_DE_SALIDA.includes(momento)) {
    throw new Error(
      `la redacción necesita el momento de la salida y llegó ${JSON.stringify(momento) ?? String(momento)}: los declarados son ${MOMENTOS_DE_SALIDA.join(', ')}. ` +
      'Sin él entre las entradas, «nunca en marcha» no sería una comprobación sino una convención',
    );
  }
  return momento;
}

/** La espera por defecto: un temporizador, que es lo único que el núcleo puede usar. */
function esperaPorDefecto(ms) {
  let id = null;
  const promesa = new Promise((resolve) => { id = setTimeout(() => resolve('espera'), ms); });
  return { promesa, cancela: () => { if (id != null) clearTimeout(id); } };
}

/**
 * Pide una redacción. Es **el único sitio** desde el que se llama al narrador.
 *
 * Falla —lanza— cuando lo que está mal es la construcción: un punto que no existe, el
 * momento ausente o en marcha, el presupuesto sin declarar, un tipo de hueco fuera del
 * catálogo o un hueco sin fallback. **No falla nunca** por lo que haga la red o el
 * modelo: eso cae al fallback con su motivo, en silencio hacia la jugadora.
 *
 * @returns `{ punto, llamo, textos, diagnostico, topicos }`. `textos` trae cada hueco
 *   con su texto y su **origen declarado**; `diagnostico`, los descartes con su clave;
 *   `topicos`, el registro actualizado con lo adoptado y solo con lo adoptado.
 */
export async function pideRedaccion({
  punto,
  momento,
  huecos = [],
  sobre = null,
  llamada = null,
  presupuestoMs,
  filtro,
  espera = esperaPorDefecto,
  semillaDeMundo = null,
  topicos = null,
  ya = null,
}) {
  exigePunto(punto);
  exigeMomento(momento);
  exigePresupuesto(presupuestoMs);
  if (!filtro || typeof filtro.valida !== 'function') {
    throw new Error('la redacción necesita el filtro de aptitud inyectado: todo texto generado pasa por él, sin excepción por tipo de hueco ni por punto de invocación');
  }
  if (momento === MOMENTO_PROHIBIDO) {
    throw new Error(
      `no se pide ninguna redacción en el momento "${MOMENTO_PROHIBIDO}": los textos se generan antes de andar, nunca mientras se anda (RF-QUEST-008). ` +
      `El punto recibido era "${punto}"`,
    );
  }
  const pedidos = (huecos ?? []).map(exigeHueco);

  const anotaTopicoDe = (hueco, texto) => {
    if (!topicos || !semillaDeMundo) return;
    const categoria = hueco.categoria ?? CATEGORIA_POR_TIPO[hueco.tipo];
    anotaTopico(topicos, { semillaDeMundo, categoria: exigeCategoria(categoria, `la categoría del hueco "${hueco.clave}"`), topico: aperturaDeTexto(texto) });
  };

  // El resultado se congela por partes y **el registro de tópicos no**: es estado vivo
  // de la partida, que sigue creciendo salida tras salida. Congelarlo aquí lo habría
  // dejado inservible desde la primera redacción, que es la clase de error que solo
  // aparece en la segunda llamada.
  const salida = (textos, descartes, llamo) => Object.freeze({
    punto,
    llamo,
    textos: congelaHondo(textos),
    diagnostico: congelaHondo({ descartes, histograma: histogramaDelNarrador(descartes) }),
    topicos,
  });

  // Lo ya redactado no se vuelve a pedir: generación única y cacheada. Si no queda
  // ninguno, no hay llamada — y una petición sin ningún hueco tampoco es un error.
  const guardados = [];
  const porRedactar = [];
  for (const hueco of pedidos) {
    const guardado = ya && typeof ya.get === 'function' ? ya.get(hueco.clave) : null;
    if (guardado) guardados.push({ clave: hueco.clave, tipo: hueco.tipo, texto: guardado.texto, origen: guardado.origen });
    else porRedactar.push(hueco);
  }
  if (porRedactar.length === 0) return salida(guardados, [], false);

  const alFallback = (motivo) => salida(
    [...guardados, ...porRedactar.map((h) => ({ clave: h.clave, tipo: h.tipo, texto: h.fallback, origen: 'plantilla' }))],
    porRedactar.map((h) => ({ clave: h.clave, motivo })),
    false,
  );

  // Sin llamada inyectada **no se intenta ninguna conexión**: es el estado normal en
  // `node --test` y en una salida sin cobertura, y RNF-RED-001 lo describe como
  // funcionamiento y no como error. Por eso cae al fallback en vez de fallar, al revés
  // que el presupuesto de espera, cuya ausencia no describe ningún estado legítimo.
  if (typeof llamada !== 'function') return alFallback(motivoDelNarrador({ clave: MOTIVOS_DEL_NARRADOR.SIN_LLAMADA }));

  let respuesta;
  const reloj = espera(presupuestoMs);
  try {
    respuesta = await Promise.race([Promise.resolve(llamada({ sobre, huecos: porRedactar.map((h) => ({ clave: h.clave, tipo: h.tipo, tope: h.tope })), presupuestoMs })), reloj.promesa]);
  } catch (e) {
    return alFallback(motivoDelNarrador({ clave: MOTIVOS_DEL_NARRADOR.FALLO_DE_RED, detalle: { mensaje: String(e?.message ?? e) } }));
  } finally {
    if (typeof reloj.cancela === 'function') reloj.cancela();
  }
  if (respuesta === 'espera') return alFallback(motivoDelNarrador({ clave: MOTIVOS_DEL_NARRADOR.ESPERA_AGOTADA, detalle: { presupuestoMs } }));

  const { propuestas, descartes } = leeRespuesta(respuesta, porRedactar);
  // Una respuesta ilegible se rechaza **entera** y todos sus huecos caen al fallback.
  if (descartes.some((d) => d.motivo.clave === MOTIVOS_DEL_NARRADOR.RESPUESTA_ILEGIBLE)) {
    return alFallback(descartes[0].motivo);
  }

  const textos = [...guardados];
  const fuera = [...descartes];
  for (const hueco of porRedactar) {
    if (!propuestas.has(hueco.clave)) {
      fuera.push({ clave: hueco.clave, motivo: motivoDelNarrador({ clave: MOTIVOS_DEL_NARRADOR.HUECO_AUSENTE }) });
      textos.push({ clave: hueco.clave, tipo: hueco.tipo, texto: hueco.fallback, origen: 'plantilla' });
      continue;
    }
    const propuesto = propuestas.get(hueco.clave);
    const veredicto = typeof propuesto === 'string'
      ? filtro.valida(propuesto, { tope: hueco.tope, esNombre: hueco.tipo === 'nombre' })
      : { apto: false, motivo: motivoDeAptitud({ clave: MOTIVOS_DE_APTITUD.TEXTO_VACIO, detalle: { llego: typeof propuesto } }) };
    if (!veredicto.apto) {
      fuera.push({ clave: hueco.clave, motivo: motivoDelNarrador({ clave: MOTIVOS_DEL_NARRADOR.NO_APTO, detalle: veredicto.motivo }) });
      textos.push({ clave: hueco.clave, tipo: hueco.tipo, texto: hueco.fallback, origen: 'plantilla' });
      continue;
    }
    textos.push({ clave: hueco.clave, tipo: hueco.tipo, texto: propuesto, origen: 'llm' });
    // **Solo se anota lo adoptado.** Anotar lo descartado enseñaría al registro a
    // evitar frases que nadie llegó a leer.
    anotaTopicoDe(hueco, propuesto);
  }
  return salida(textos, fuera, true);
}

/** El histograma de una lista de descartes, por clave y sin parsear ninguna frase. */
export function histogramaDelNarrador(descartes) {
  const cuenta = {};
  for (const clave of CLAVES_DEL_NARRADOR) cuenta[clave] = 0;
  for (const d of descartes ?? []) cuenta[d.motivo.clave] += 1;
  return cuenta;
}

// --- Los dos puntos, cada uno con su llamada ------------------------------------

/**
 * Compone el sobre y el prompt de una aventura casteada, y los criba.
 *
 * Lo que sí lleva: el locale, el tono, las reglas de lenguaje, los nombres de fantasía,
 * los tipos abstractos, la escena, el tamaño y —para un rumor— su signo y su nivel **como
 * restricción explícita**, nunca como pregunta.
 */
export function peticionDeAventura({ mundo, aventura, plantilla, locale, huecos, topicos = null, semillaDeMundo = null, extra = {} }) {
  const datosReales = datosRealesDeMundo(mundo);
  const sobre = sobreDePeticion({
    locale,
    tono: TONO,
    reglas: REGLAS_DE_ESCRITURA,
    punto: 'crear-aventura',
    // Vocabulario **del juego** y nunca de OSM: `taberna`, `paraje`, `calzada`.
    tipos: (aventura?.beats ?? []).map((b) => b.lugar?.tipo).filter(Boolean),
    nombres: (aventura?.beats ?? []).map((b) => b.lugar?.nombre).filter(Boolean),
    escena: (aventura?.beats ?? []).map((b) => b.escena?.tipo).filter(Boolean),
    disparador: (aventura?.beats ?? []).map((b) => b.disparador?.tipo).filter(Boolean),
    tamano: plantilla?.tamano ?? aventura?.tamano ?? null,
    huecos: (huecos ?? []).map((h) => ({ clave: h.clave, tipo: h.tipo, tope: h.tope })),
    ...(topicos && semillaDeMundo ? { topicos: topicosParaElPrompt(topicos, semillaDeMundo) } : {}),
    ...extra,
  }, { datosReales });
  return congelaHondo({ sobre, prompt: construyePrompt({ sobre, datosReales }), datosReales });
}

/**
 * Primer punto de invocación: **al crear la aventura**, y todos sus huecos en una sola
 * llamada.
 */
export async function redactaAventura({ mundo, aventura, plantilla, locale, momento, llamada = null, presupuestoMs, filtro = null, topicos = null, semillaDeMundo = null, ya = null, espera = esperaPorDefecto }) {
  const huecos = huecosDeAventura(plantilla);
  const elFiltro = filtro ?? creaFiltroDeAptitud({ locale, datosReales: datosRealesDeMundo(mundo) });
  const peticion = peticionDeAventura({ mundo, aventura, plantilla, locale, huecos, topicos, semillaDeMundo });
  return pideRedaccion({
    punto: 'crear-aventura',
    momento,
    huecos,
    sobre: peticion.sobre,
    llamada,
    presupuestoMs,
    filtro: elFiltro,
    espera,
    semillaDeMundo,
    topicos,
    ya,
  });
}

/**
 * Segundo punto de invocación: **al abrir la salida**, una sola llamada agrupada con el
 * envoltorio del zurrón y los textos de las entradas de la reserva.
 *
 * Sin reserva no se hace ninguna llamada y **no es un error**, que es lo que exige «el
 * zurrón solo aparece si hay reserva que vaciar». Con el modo de pasos de fondo apagado
 * tampoco: cada entrada trae entonces el texto de la plantilla que la generó, y el
 * resumen se lee igual.
 */
export async function redactaZurron({ mundo, locale, momento, reserva = [], modoDeFondo = true, llamada = null, presupuestoMs, filtro = null, topicos = null, semillaDeMundo = null, ya = null, espera = esperaPorDefecto }) {
  const entradas = modoDeFondo ? (reserva ?? []) : [];
  if (entradas.length === 0) {
    // Ni sobre, ni prompt, ni llamada: no hay nada que redactar y eso no es un error.
    return pideRedaccion({ punto: 'abrir-salida', momento, huecos: [], presupuestoMs, filtro: filtro ?? creaFiltroDeAptitud({ locale, datosReales: datosRealesDeMundo(mundo) }), espera });
  }
  const datosReales = datosRealesDeMundo(mundo);
  const elFiltro = filtro ?? creaFiltroDeAptitud({ locale, datosReales });
  const huecos = [
    huecoDelZurron(),
    ...entradas.map((e, i) => exigeHueco({ clave: `zurron:entrada:${i + 1}`, tipo: 'escena', tope: TOPES_DE_TEXTO.beat, fallback: e.fallback })),
  ];
  const sobre = sobreDePeticion({
    locale,
    tono: TONO,
    reglas: REGLAS_DE_ESCRITURA,
    punto: 'abrir-salida',
    hechos: entradas.map((e) => e.hechos ?? null),
    huecos: huecos.map((h) => ({ clave: h.clave, tipo: h.tipo, tope: h.tope })),
    ...(topicos && semillaDeMundo ? { topicos: topicosParaElPrompt(topicos, semillaDeMundo) } : {}),
  }, { datosReales });
  construyePrompt({ sobre, datosReales });
  return pideRedaccion({ punto: 'abrir-salida', momento, huecos, sobre, llamada, presupuestoMs, filtro: elFiltro, espera, semillaDeMundo, topicos, ya });
}

// --- La vestidura ------------------------------------------------------------------

/**
 * Viste una aventura casteada: **solo escribe referencias a textos**.
 *
 * Ni un campo más se toca. Es lo que hace que con narrador y sin él la estructura sea
 * idéntica —mismo casting, mismos beats, mismas cantidades, mismo lazo— y que los datos
 * por los que alguna regla bifurca no tengan nunca origen `llm`.
 *
 * Los textos se guardan **una sola vez** en el área de textos del estado, con su clave y
 * su origen, y la aventura los cita. Dos huecos que pidan el mismo texto lo citan por la
 * misma clave en vez de guardarlo dos veces.
 */
export function visteAventura({ aventura, redaccion, estado, mapa, punto = 'crear-aventura' }) {
  if (!aventura || typeof aventura !== 'object') throw new Error(`la vestidura necesita la aventura casteada y llegó ${JSON.stringify(aventura) ?? String(aventura)}`);
  exigePunto(punto);
  const textos = {};
  for (const t of redaccion?.textos ?? []) {
    const clave = claveDeHueco({ mapa, punto, elemento: t.clave });
    if (estado) guardaTexto(estado, { clave, texto: t.texto, origen: t.origen });
    textos[t.clave] = clave;
  }
  return { ...aventura, textos };
}

/**
 * El esqueleto de una aventura: todo lo que **no** es texto.
 *
 * Existe para poder afirmar la mitad que sostiene RNF-DET-002 sin comparar a ojo: dos
 * aventuras con narradores distintos, o una con y otra sin, tienen que dar el mismo
 * esqueleto byte a byte.
 */
export function esqueletoDeAventura(aventura) {
  const { titulo, gancho, textos, ...resto } = aventura ?? {};
  return congelaHondo({
    ...resto,
    beats: (aventura?.beats ?? []).map((b) => ({
      ...b,
      escena: { tipo: b.escena?.tipo ?? null, afinidadUsada: b.escena?.afinidadUsada ?? null },
      disparador: b.disparador?.viaAlternativa
        ? { ...b.disparador, viaAlternativa: { declarada: true } }
        : b.disparador,
    })),
  });
}

/** Las cinco categorías del registro, reexportadas para quien construya un prompt a mano. */
export { CATEGORIAS_DE_TOPICO };
