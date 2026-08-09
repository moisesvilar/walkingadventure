// El catálogo de avisos y su emisión: qué tipos hay, por qué **dos capas** viaja cada
// uno, qué texto se le admite y qué se anota cuando una capa no sale.
//
// `game-design/accesibilidad.md` §3 lo dice entero y con su regla de mantenimiento
// —«cada vez que se añada una forma nueva de avisar hay que volver aquí»—. Aquí esa
// regla se cumple sola porque el catálogo es dato: un tipo nuevo sin capas declaradas
// no pasa `declaraAviso`, y el par que no mezcla bolsillo y pantalla falla nombrando
// el aviso. Comprobado a ojo sería un invariante que se rompe sin querer, que es
// exactamente como el documento lo describe.
//
// Tres cosas que esta capa **no** hace, y son las tres deliberadas:
//
// - **No decide cuándo hay algo que avisar.** Eso es de la cola de entregas y de los
//   rumores; aquí llega el hecho de que hay un aviso y se decide cómo sale.
// - **No pinta.** La capa `marca` no dibuja nada: dice que hay marca, y la lámina la
//   pone. Ni un color ni una posición salen de aquí.
// - **No mira el reloj.** La retención por beat es un dato de dos valores que entrega
//   la capa de la escena (`microencuentros.js`), y nada de lo de abajo lee tiempo.

import { congelaHondo } from '../core/congelar.js';
import { infraccionesDeTexto } from '../names/lenguaje.js';
import { IDS_DE_ENTREGA, TIPOS_DE_ENTREGA } from './entregas.js';
import { retieneElAviso } from './microencuentros.js';

/**
 * Las capas de **bolsillo**: las que se notan sin mirar.
 *
 * Háptico y sonido están las dos aunque hoy solo se use el háptico, y no es un hueco:
 * el documento razona sobre ellas juntas —«fallan a la vez para la misma persona»— y
 * la regla del par se escribe contra esta lista, no contra un canal concreto.
 */
export const CAPAS_DE_BOLSILLO = congelaHondo(['haptico', 'sonido']);

/** Las capas de **pantalla**: las que se ven al mirar, o las que hacen mirar. */
export const CAPAS_DE_PANTALLA = congelaHondo(['marca', 'notificacion']);

/** Todas las capas declaradas, en orden estable. Lo que no esté aquí no es una capa. */
export const CAPAS = congelaHondo([...CAPAS_DE_BOLSILLO, ...CAPAS_DE_PANTALLA]);

/**
 * Los tipos de aviso, que son **los mismos dos de la cola de entregas** y se leen de
 * allí en lugar de reescribirse: `quests.md` decisión 3 enumera noticia y oportunidad
 * y no hay un tercero, y dos enumerados con el mismo contenido se desincronizan.
 */
export const TIPOS_DE_AVISO = TIPOS_DE_ENTREGA;

/** Los identificadores de tipo, en orden estable. */
export const IDS_DE_AVISO = IDS_DE_ENTREGA;

/**
 * Por qué no salió una capa. **Claves de catálogo cerrado y nunca una frase**: lo que
 * se cuenta se agrega, y esto se va a contar —«el error caro es creer que un aviso
 * llegó» (`accesibilidad.md` §3)—.
 */
export const MOTIVOS_DE_CAPA_CAIDA = Object.freeze({
  /** Quien juega denegó el permiso. Es un **estado**, no una avería, y el aviso sigue. */
  PERMISO_DENEGADO: 'permiso-denegado',
  /** El canal está cableado y no respondió al emitir. */
  CANAL_SIN_RESPUESTA: 'canal-sin-respuesta',
});

/** Las claves de motivo, en orden estable. */
export const IDS_DE_CAPA_CAIDA = congelaHondo(Object.values(MOTIVOS_DE_CAPA_CAIDA).slice().sort());

/**
 * El catálogo. Cada tipo declara sus capas y si enciende la pantalla, y las dos cosas
 * son dato porque las dos son criterio.
 *
 * El reparto sale de `accesibilidad.md` §3 y respeta la reserva de `quests.md`
 * decisión 3: **la noticia no usa el canal de notificación** —ni siquiera silenciosa,
 * que aparecería igual en el centro de notificaciones y devaluaría la reserva por la
 * puerta de atrás— y la oportunidad es el único aviso del juego que enciende la
 * pantalla.
 */
export const CATALOGO_DE_AVISOS = congelaHondo([
  {
    tipo: TIPOS_DE_AVISO.NOTICIA,
    capas: ['haptico', 'marca'],
    enciendeLaPantalla: false,
    // Los dos se retienen, y no solo la oportunidad: `quests.md` decisión 3 dice «si
    // estás dentro de una escena, el mundo espera» sin distinguir, y un háptico a
    // mitad de escena es igual de intruso que una notificación.
    seRetienePorBeat: true,
  },
  {
    tipo: TIPOS_DE_AVISO.OPORTUNIDAD,
    capas: ['notificacion', 'haptico'],
    enciendeLaPantalla: true,
    seRetienePorBeat: true,
  },
]);

/**
 * Lo que ningún aviso lleva, nombrado para que la ausencia se pueda poner roja.
 *
 * No es documentación: es la otra mitad del vocabulario. Un aviso con acción de
 * aceptar sería el rediseño que este momento existe para no tener.
 */
export const LO_QUE_UN_AVISO_NO_LLEVA = congelaHondo([
  'accion-de-aceptar',
  'accion-de-rechazar',
  'accion-de-descartar',
  'llamada-a-tocar',
]);

/** Cuánto mide «una línea». Se declara para poder fallar contra ella, nunca para recortar. */
export const TOPE_DE_LINEA = 120;

/**
 * Las llamadas a tocar, que un aviso no lleva nunca. La prueba de `accesibilidad.md`
 * §3 —«si tocando se aprende algo que hacía falta, el aviso está mal escrito»— no se
 * puede automatizar entera; esto es su mitad automatizable.
 */
const LLAMADAS_A_TOCAR = congelaHondo([
  /toca\s+(?:para|aqu[ií])/i,
  /pulsa\s+(?:para|aqu[ií])/i,
  /(?:saber|leer|ver)\s+m[áa]s/i,
  /m[áa]s\s+informaci[óo]n/i,
  /toca\s+la\s+notificaci[óo]n/i,
]);

function exigeTexto(valor, quien) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new Error(`${quien} llega como ${JSON.stringify(valor) ?? String(valor)} y hace falta escrito`);
  }
  return valor;
}

/**
 * La entrada del catálogo de un tipo. **Falla nombrando los que sí valen** en lugar de
 * devolver nada: un tipo que no está en el enumerado no puede emitirse, y salir en
 * silencio sería un aviso que nadie recibe y nadie echa de menos.
 */
export function avisoDelCatalogo(tipo) {
  const entrada = CATALOGO_DE_AVISOS.find((a) => a.tipo === tipo);
  if (!entrada) {
    throw new Error(
      `"${tipo}" no es un tipo de aviso: los que hay son ${IDS_DE_AVISO.join(', ')}. ` +
      'Un tipo nuevo se declara en el catálogo con sus dos capas antes de poder emitirse',
    );
  }
  return entrada;
}

/**
 * Valida un aviso declarado: tipo conocido, capas conocidas y **el par que mezcla
 * bolsillo y pantalla**.
 *
 * Dos capas de bolsillo no valen y el error lo dice con las palabras del documento:
 * háptico y sonido fallan a la vez para la misma persona, así que duplicar así no es
 * duplicar. Es la comprobación que recorre el catálogo entero, incluidos los avisos
 * que se añadan después.
 */
export function declaraAviso({ tipo, capas, enciendeLaPantalla = false }) {
  if (!IDS_DE_AVISO.includes(tipo)) {
    throw new Error(`el aviso llega con el tipo ${JSON.stringify(tipo) ?? String(tipo)}, que no está en el enumerado: los que valen son ${IDS_DE_AVISO.join(', ')}`);
  }
  if (!Array.isArray(capas) || !capas.length) {
    throw new Error(`el aviso "${tipo}" no declara capas y llegó ${JSON.stringify(capas) ?? String(capas)}: un aviso sin capas declaradas no viaja por ninguna`);
  }
  for (const capa of capas) {
    if (!CAPAS.includes(capa)) {
      throw new Error(`el aviso "${tipo}" declara la capa "${capa}", que no existe: las declaradas son ${CAPAS.join(', ')}`);
    }
  }
  const bolsillo = capas.filter((c) => CAPAS_DE_BOLSILLO.includes(c));
  const pantalla = capas.filter((c) => CAPAS_DE_PANTALLA.includes(c));
  if (!bolsillo.length || !pantalla.length) {
    throw new Error(
      `el aviso "${tipo}" viaja por ${capas.join(' y ')}, y el par tiene que mezclar una capa de bolsillo (${CAPAS_DE_BOLSILLO.join(', ')}) ` +
      `con una de pantalla (${CAPAS_DE_PANTALLA.join(', ')}): háptico y sonido fallan a la vez para la misma persona, así que duplicar así no es duplicar`,
    );
  }
  if (typeof enciendeLaPantalla !== 'boolean') {
    throw new Error(`el aviso "${tipo}" declara "enciendeLaPantalla" como ${JSON.stringify(enciendeLaPantalla) ?? String(enciendeLaPantalla)} y es un dato de dos valores`);
  }
  return congelaHondo({ tipo, capas: [...capas], bolsillo, pantalla, enciendeLaPantalla });
}

/**
 * Revisa el catálogo entero de una vez. Es la regla de mantenimiento convertida en
 * llamada: recorre lo que hay, incluido lo que se añada mañana.
 */
export function revisaElCatalogoDeAvisos(catalogo = CATALOGO_DE_AVISOS) {
  return congelaHondo(catalogo.map((a) => declaraAviso(a)));
}

/**
 * Valida el texto de un aviso: **una línea, nombra el sitio y sin llamada a tocar**.
 *
 * Los tres fallan nombrando el aviso y **ninguno recorta**: un texto que no cabe se
 * reescribe, porque recortarlo produce exactamente el «toca para saber más» que
 * `accesibilidad.md` §3 prohíbe, solo que sin decirlo.
 *
 * @param {string} texto lo que se va a leer de un vistazo.
 * @param {object} opciones
 *   `sitios` los nombres del mundo, contra los que se comprueba que el aviso dice
 *   dónde —«completo incluye dónde»—; `aviso` cómo se nombra en el error; `locale`
 *   con qué reglas se criba la cifra.
 */
export function validaTextoDeAviso(texto, { sitios, aviso = 'el aviso', locale = 'es' } = {}) {
  exigeTexto(texto, `el texto de ${aviso}`);
  if (!Array.isArray(sitios) || !sitios.length) {
    throw new Error(
      `no se puede validar el texto de ${aviso} sin la lista de sitios del mundo, y llegó ${JSON.stringify(sitios) ?? String(sitios)}: ` +
      '«completo incluye dónde» se comprueba contra los nombres que hay, nunca contra un umbral de parecido',
    );
  }
  if (/[\n\r]/.test(texto)) {
    throw new Error(`el texto de ${aviso} lleva un salto de línea y el aviso va entero en una línea: "${texto}"`);
  }
  if (texto.length > TOPE_DE_LINEA) {
    throw new Error(
      `el texto de ${aviso} no cabe en una línea (${texto.length} caracteres contra un tope de ${TOPE_DE_LINEA}) y no se recorta para que quepa: ` +
      'un aviso recortado es un «toca para saber más» sin decirlo. Se reescribe',
    );
  }
  for (const llamada of LLAMADAS_A_TOCAR) {
    const casa = texto.match(llamada);
    if (casa) {
      throw new Error(`el texto de ${aviso} dice "${casa[0]}", y ningún aviso llama a tocar: es exactamente el gesto que hace mirar el móvil andando`);
    }
  }
  const nombrado = sitios.find((s) => typeof s === 'string' && s && texto.includes(s));
  if (!nombrado) {
    throw new Error(
      `el texto de ${aviso} no nombra ningún sitio del mundo: «completo incluye dónde». ` +
      'Un aviso que dice «aquí al lado» obliga a tocar para poder atenderlo, que es la misma prohibición con otro disfraz',
    );
  }
  const cifras = infraccionesDeTexto(texto, { locale }).filter((i) => i.familia === 'cifras');
  if (cifras.length) {
    throw new Error(`el texto de ${aviso} lleva una cifra ("${cifras[0].fragmento}") y ninguna pantalla del juego las lleva`);
  }
  return congelaHondo({ texto, sitio: nombrado, enUnaLinea: true });
}

// --- la frontera de los canales ----------------------------------------------
//
// Los dos se exigen al construir y su ausencia es avería, no estado. La distinción es
// la de `pipeline/decisiones-orquestador.md` §6h llevada a esta fila, y aquí importa
// más que en ninguna: sin ella «el aviso salió» y «no había por dónde sacarlo» son
// indistinguibles, que es la única cosa que este subsistema no puede permitirse.

/** El vibrador cableado, o un error que nombra la pieza que falta. */
export function exigeVibrador(vibrador) {
  if (!vibrador || typeof vibrador.vibra !== 'function') {
    throw new Error(
      'el vibrador no está cableado y hace falta para emitir la capa de bolsillo de todo aviso: sin él los avisos saldrían por una sola capa y en silencio, ' +
      'que es peor que no avisar. Se monta con { vibra() }',
    );
  }
  return vibrador;
}

/**
 * El notificador cableado, o un error que nombra la pieza que falta.
 *
 * **Denegado no es ausente.** Un notificador montado con el permiso denegado es un
 * estado previsto y sigue adelante declarándolo; no tener notificador es una avería y
 * falla aquí. Confundirlos convertiría una pieza sin cablear en una decisión de quien
 * juega.
 */
export function exigeNotificador(notificador) {
  if (!notificador || typeof notificador.notifica !== 'function' || typeof notificador.permisoConcedido !== 'function') {
    throw new Error(
      'el notificador no está cableado y hace falta para la capa de pantalla de las oportunidades: un permiso denegado es un estado que se declara, ' +
      'y no tener notificador es una avería. Se monta con { notifica(texto), permisoConcedido() }',
    );
  }
  return notificador;
}

// Emite una capa y devuelve qué pasó. Nunca lanza: una capa que no sale se anota, y lo
// que se anota es lo que permite medir cuánto se pierde.
function sacaPorLaCapa(capa, { texto, vibrador, notificador }) {
  if (capa === 'marca') {
    // La marca no tiene canal: es del mapa, y el mapa está siempre. Se declara igual
    // para que el par se lea entero en el dato.
    return { capa, salio: true, motivo: null };
  }
  if (CAPAS_DE_BOLSILLO.includes(capa)) {
    if (capa === 'sonido') return { capa, salio: false, motivo: MOTIVOS_DE_CAPA_CAIDA.CANAL_SIN_RESPUESTA };
    try {
      vibrador.vibra({ texto });
      return { capa, salio: true, motivo: null };
    } catch {
      return { capa, salio: false, motivo: MOTIVOS_DE_CAPA_CAIDA.CANAL_SIN_RESPUESTA };
    }
  }
  // notificacion
  if (!notificador.permisoConcedido()) {
    return { capa, salio: false, motivo: MOTIVOS_DE_CAPA_CAIDA.PERMISO_DENEGADO };
  }
  try {
    notificador.notifica({ texto });
    return { capa, salio: true, motivo: null };
  } catch {
    return { capa, salio: false, motivo: MOTIVOS_DE_CAPA_CAIDA.CANAL_SIN_RESPUESTA };
  }
}

/**
 * Levanta el emisor de avisos de una salida.
 *
 * Lo que devuelve es un emisor con memoria de lo retenido: **nada se pierde por
 * llegar durante un beat**, y lo retenido sale en el mismo orden en que llegó cuando
 * la escena termina. Ese orden es lo que hace que el mismo recorrido dos veces dé la
 * misma secuencia de avisos, sin que ninguna parte lea el reloj ni el azar.
 *
 * @param {object} piezas
 *   `vibrador` y `notificador`, los dos inyectados y los dos obligatorios; `sitios`
 *   los nombres del mundo contra los que se valida que el texto diga dónde.
 */
export function creaEmisorDeAvisos({ vibrador, notificador, sitios, locale = 'es' }) {
  exigeVibrador(vibrador);
  exigeNotificador(notificador);
  if (!Array.isArray(sitios) || !sitios.length) {
    throw new Error(
      `el emisor de avisos se monta con los nombres de los sitios del mundo y llegó ${JSON.stringify(sitios) ?? String(sitios)}: ` +
      'sin ellos no se puede comprobar que un aviso diga dónde, y un aviso que no lo dice obliga a tocar',
    );
  }

  const retenidos = [];
  const emitidos = [];

  const saca = (peticion) => {
    const declarado = declaraAviso(avisoDelCatalogo(peticion.tipo));
    const capas = declarado.capas.map((capa) => sacaPorLaCapa(capa, { texto: peticion.texto, vibrador, notificador }));
    const salieron = capas.filter((c) => c.salio).map((c) => c.capa);
    const faltaron = capas.filter((c) => !c.salio).map((c) => ({ capa: c.capa, motivo: c.motivo }));
    const emitido = congelaHondo({
      tipo: declarado.tipo,
      texto: peticion.texto,
      sitio: peticion.sitio,
      // El par declarado, lo que salió y **lo que faltó con su motivo**. La tercera es
      // la que importa: un aviso que llegó y uno que se creyó llegado son cosas
      // distintas, y el error caro es no poder distinguirlas después.
      capas: { declaradas: declarado.capas, salieron, faltaron },
      // Una notificación denegada no pierde la oportunidad: se emite por lo que queda.
      // Lo que no se hace es promoverla a otro canal, que inventaría un par que
      // `accesibilidad.md` §3 no autoriza.
      emitido: salieron.length > 0,
      enciendeLaPantalla: declarado.enciendeLaPantalla && salieron.includes('notificacion'),
      retenido: false,
      // **Ninguna acción, y tocar no acepta nada**: se acepta yendo. Van declaradas y
      // vacías para que meter un botón de aceptar tenga que escribirse aquí.
      acciones: [],
      seAceptaYendo: true,
      alTocar: 'abre-el-mapa-con-la-marca',
    });
    emitidos.push(emitido);
    return emitido;
  };

  return {
    /**
     * Emite un aviso, o lo retiene si hay un beat en curso.
     *
     * @param {object} aviso
     *   `tipo` del enumerado; `texto` el que se lee de un vistazo; `sitio` el que
     *   nombra; `beatEnCurso` el dato de dos valores de la capa de la escena.
     */
    emite({ tipo, texto, sitio = null, beatEnCurso = false }) {
      const declarado = declaraAviso(avisoDelCatalogo(tipo));
      const validado = validaTextoDeAviso(texto, { sitios, aviso: `el aviso de tipo "${tipo}"`, locale });
      const donde = sitio ?? validado.sitio;
      // Manda el beat, y manda para los dos tipos. Va antes que tocar ningún canal:
      // durante una escena no se llama ni al vibrador.
      if (declarado.seRetienePorBeat !== false && retieneElAviso(beatEnCurso)) {
        const guardado = congelaHondo({ tipo, texto, sitio: donde, retenido: true, emitido: false, capas: { declaradas: declarado.capas, salieron: [], faltaron: [] } });
        retenidos.push({ tipo, texto, sitio: donde });
        return guardado;
      }
      return saca({ tipo, texto, sitio: donde });
    },

    /**
     * La escena ha terminado: sale lo retenido, en el orden en que llegó.
     *
     * `quests.md` decisión 3: el mundo espera, y esperar no es perder.
     */
    terminaElBeat() {
      const pendientes = retenidos.splice(0, retenidos.length);
      return congelaHondo(pendientes.map((p) => saca(p)));
    },

    /** Lo que está esperando a que termine la escena. */
    retenidos() {
      return congelaHondo(retenidos.map((r) => ({ ...r })));
    },

    /** Todo lo que salió, en orden. Es lo que se compara entre dos recorridos iguales. */
    emitidos() {
      return congelaHondo(emitidos.slice());
    },

    /** El último aviso emitido, con su tipo y sus capas, o `null`. */
    ultimo() {
      return emitidos.length ? emitidos[emitidos.length - 1] : null;
    },
  };
}
