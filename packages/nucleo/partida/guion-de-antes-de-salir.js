// El guion de las cinco pantallas del momento «antes de salir»: cada pieza con su
// pantalla, su texto y, cuando no lo tiene, de dónde sale el suyo.
//
// Es la misma excepción declarada que `guion-de-arranque.js` y por el mismo motivo: sin
// simulador (`pipeline/decisiones-orquestador.md` §4), un criterio de contenido que solo se
// pueda leer en pantalla no se pone rojo nunca (§6o). Con el guion como dato, «ningún texto
// lleva una cifra de distancia», «hablan como mundo», «un día con una sola no se disculpa»
// y «sin cobertura la pantalla dice lo mismo» se comprueban en `node --test`.
//
// Aquí manda **la voz del mundo**: el arranque hablaba como aplicación y su última frase
// fue el botón de A1P7. De ahí que ninguna pieza mencione la aplicación, la red ni los
// permisos, con una sola excepción declarada —la frase de contrato de A2P5— que promete la
// ausencia de red en lugar de reportar un fallo.

import { congelaHondo } from '../core/congelar.js';
import { reglaDeFormula } from '../names/lenguaje.js';
import { REGISTROS, cifrasDeTexto } from './guion-de-arranque.js';

/**
 * Las pantallas del momento, en el orden de `docs/flujo.md`.
 *
 * A2P2 entra con SPEC-042, que es su dueña: hasta entonces el zurrón no existía y su guion
 * habría sido texto sin pantalla. Entra aquí y no en su propio módulo porque lo que la
 * revisión de este fichero compra —ni una cifra, voz del mundo, ninguna disculpa— es
 * literalmente lo que sus criterios afirman.
 */
export const PANTALLAS = congelaHondo(['a2p1', 'a2p2', 'a2p3', 'a2p4', 'a2p5']);

/**
 * La medida de cada tamaño **en palabra del mundo y con su equivalencia orientativa**.
 *
 * Vive en el núcleo y no en la app —donde estuvo mientras solo la usaba A1P7— porque es lo
 * que el criterio «cada aventura declara su tamaño con una palabra» afirma, y afirmarlo
 * pide leerlo sin dispositivo. La hora es lo único de las mecánicas que conviene decir en
 * voz alta; la distancia no se dice nunca.
 */
export const MEDIDA_DE_TAMANO = congelaHondo({
  paseo: 'Un paseo · una hora',
  aventura: 'Una aventura · unas dos horas',
  jornada: 'Una jornada · una tarde entera',
  'un-momento': 'Un momento',
});

/**
 * Lo que ninguna de las cinco pantallas dice, porque aquí habla el mundo.
 *
 * La lista es de palabras y no de conceptos a propósito: comprobar que la palabra no
 * aparece es barato y es exactamente el criterio. `móvil` no está, y es deliberado: «puedes
 * meter el móvil en el bolsillo» habla del cacharro que llevas encima, no de la aplicación.
 */
export const PALABRAS_QUE_NO_SE_DICEN = congelaHondo([
  'aplicación', 'app', 'red', 'wifi', 'conexión', 'cobertura', 'permiso', 'permisos',
  'servidor', 'descarga', 'error', 'fallo', 'sin conexión', 'accesibilidad', 'filtro',
]);

/**
 * Las piezas que dicen una de esas palabras **con permiso y por escrito**.
 *
 * Hoy hay una: la frase de contrato de A2P5, que es de `bucle-jugable.md` («la frase más
 * importante de la pantalla») y que promete que a partir de ahí no hace falta cobertura. No
 * anuncia una falta de red: anuncia que deja de importar. Si mañana aparece otra, hay que
 * escribirla aquí y se ve en el diff.
 */
export const EXCEPCIONES_DE_VOZ = congelaHondo(['a2p5/contrato']);

/**
 * Cómo suena disculparse, para que no suene.
 *
 * `bucle-jugable.md` §3: «un día con una sola no es un día roto». La forma más fácil de
 * romperlo sería una línea que lo lamentase, así que ninguna pieza puede llevarla y la
 * composición de la lista no añade ninguna cuando hay una sola entrada.
 */
export const PALABRAS_DE_DISCULPA = congelaHondo([
  'lo siento', 'perdona', 'perdón', 'disculpa', 'sentimos', 'lamentamos', 'lamentablemente',
  'por desgracia', 'desafortunadamente', 'me temo', 'solo hay', 'únicamente', 'poca cosa',
]);

/** El hueco que una pieza deja para que lo rellene el mundo. */
const HUECO_DEL_SITIO = '{sitio}';

/**
 * El guion, en el orden en que se lee cada pantalla.
 *
 * `de` marca una pieza que **no trae texto** porque su contenido lo pone otra capa, y dice
 * cuál. `salvo` deja fuera una familia de la revisión de cifras, siempre con su motivo al
 * lado: aquí todas las excepciones son la hora orientativa que `bucle-jugable.md` §3 pide
 * literalmente al lado de la palabra del mundo.
 */
export const GUION = congelaHondo([
  // --- A2P1 · La portada --------------------------------------------------------
  { pantalla: 'a2p1', id: 'encabezado', registro: REGISTROS.MUNDO, texto: 'Tu mapa' },
  {
    pantalla: 'a2p1',
    id: 'dia',
    registro: REGISTROS.MUNDO,
    texto: null,
    // El día es una cifra y por eso no vive en ningún texto: llega del calendario y la
    // pantalla lo pone al lado del encabezado. Así la revisión de cifras sigue siendo
    // total sobre el guion, sin excepción que mantener.
    de: 'el calendario de la partida',
  },
  { pantalla: 'a2p1', id: 'titulo-del-mundo', registro: REGISTROS.MUNDO, texto: null, de: 'el mundo generado, que trae su título' },
  { pantalla: 'a2p1', id: 'miniatura', registro: REGISTROS.MUNDO, texto: null, de: 'la lámina en miniatura y sus tintas' },
  { pantalla: 'a2p1', id: 'identidad', registro: REGISTROS.MUNDO, texto: null, de: 'el personaje: su nombre y su oficio, y ninguna cifra' },
  { pantalla: 'a2p1', id: 'a-medias-titulo', registro: REGISTROS.MUNDO, texto: 'Lo dejaste a medias' },
  { pantalla: 'a2p1', id: 'a-medias-aventura', registro: REGISTROS.MUNDO, texto: null, de: 'la aventura aceptada en la salida abierta' },
  { pantalla: 'a2p1', id: 'a-medias-donde', registro: REGISTROS.MUNDO, texto: null, de: 'el registro de la salida abierta, que guarda el sitio con el nombre del mundo' },
  { pantalla: 'a2p1', id: 'a-medias-seguir', registro: REGISTROS.MUNDO, texto: 'Seguir con ella' },
  { pantalla: 'a2p1', id: 'a-medias-dejarlo', registro: REGISTROS.MUNDO, texto: 'Dejarlo aquí' },
  { pantalla: 'a2p1', id: 'ver-que-se-cuenta', registro: REGISTROS.MUNDO, texto: 'Ver qué se cuenta hoy' },
  { pantalla: 'a2p1', id: 'salir-sin-mas', registro: REGISTROS.MUNDO, texto: 'Salir a andar sin más' },
  { pantalla: 'a2p1', id: 'puerta-diario', registro: REGISTROS.MUNDO, texto: 'El diario' },
  { pantalla: 'a2p1', id: 'puerta-repisa', registro: REGISTROS.MUNDO, texto: 'La repisa' },
  { pantalla: 'a2p1', id: 'puerta-ajustes', registro: REGISTROS.MUNDO, texto: 'Ajustes' },

  // --- A2P2 · El zurrón ---------------------------------------------------------
  //
  // Un contenedor con marco propio y entradas prestadas (`quests.md` decisión 3): lo único
  // que se escribe nuevo es el envoltorio, y cada entrada trae el texto de la plantilla que
  // la generó. De ahí que aquí solo haya rótulo, sitio, cierre y acción: lo demás llega.
  { pantalla: 'a2p2', id: 'rotulo', registro: REGISTROS.MUNDO, texto: 'Mientras no estabas' },
  { pantalla: 'a2p2', id: 'envoltorio', registro: REGISTROS.MUNDO, texto: null, de: 'el narrador, en la única llamada agrupada al abrir la salida, con su texto de plantilla de repuesto' },
  { pantalla: 'a2p2', id: 'entradas', registro: REGISTROS.MUNDO, texto: null, de: 'la reserva de pasos de fondo: una entrada por paso que produjo algo, con su sitio y su texto' },
  { pantalla: 'a2p2', id: 'sitio', registro: REGISTROS.MUNDO, texto: `En ${HUECO_DEL_SITIO}`, huecos: ['sitio'] },
  // La línea de cierre **no cuenta cuántas cosas han pasado ni invita a no perderse la
  // próxima**: dice que lo contado sigue donde está, que es lo que hace que el zurrón no
  // consuma lo que cuenta.
  { pantalla: 'a2p2', id: 'cierre', registro: REGISTROS.MUNDO, texto: 'Todo eso sigue por ahí, esperando a que pases.' },
  { pantalla: 'a2p2', id: 'seguir', registro: REGISTROS.MUNDO, texto: 'Seguir' },

  // --- A2P3 · Lo que hay hoy ----------------------------------------------------
  { pantalla: 'a2p3', id: 'titulo', registro: REGISTROS.MUNDO, texto: 'Lo que se cuenta hoy' },
  { pantalla: 'a2p3', id: 'subtitulo', registro: REGISTROS.MUNDO, texto: 'Por aquí hay quien necesita algo' },
  { pantalla: 'a2p3', id: 'entradas', registro: REGISTROS.MUNDO, texto: null, de: 'el reparto casteado y filtrado por oficio, y la cola de entregas' },
  {
    pantalla: 'a2p3',
    id: 'medida-paseo',
    registro: REGISTROS.MUNDO,
    texto: MEDIDA_DE_TAMANO.paseo,
    salvo: ['tiempo'],
    porque: 'la palabra del mundo va con su equivalencia orientativa en tiempo, que es literalmente lo que pide bucle-jugable.md §3; lo que no se dice nunca es la distancia',
  },
  {
    pantalla: 'a2p3',
    id: 'medida-aventura',
    registro: REGISTROS.MUNDO,
    texto: MEDIDA_DE_TAMANO.aventura,
    salvo: ['tiempo'],
    porque: 'la misma equivalencia orientativa: una palabra y una hora, nunca un número de metros',
  },
  {
    pantalla: 'a2p3',
    id: 'medida-jornada',
    registro: REGISTROS.MUNDO,
    texto: MEDIDA_DE_TAMANO.jornada,
    salvo: ['tiempo'],
    porque: 'la misma equivalencia orientativa, dicha en tarde entera y no en horas contadas',
  },
  { pantalla: 'a2p3', id: 'medida-un-momento', registro: REGISTROS.MUNDO, texto: MEDIDA_DE_TAMANO['un-momento'] },
  { pantalla: 'a2p3', id: 'andar-sin-nada', registro: REGISTROS.MUNDO, texto: 'Y puedes salir a andar sin coger ninguna. El mundo se mueve igual.' },
  { pantalla: 'a2p3', id: 'sin-reparto', registro: REGISTROS.MUNDO, texto: 'Por aquí cerca no hay hoy gran cosa que contar.' },
  {
    pantalla: 'a2p3',
    id: 'estiron',
    registro: REGISTROS.MUNDO,
    // `bucle-jugable.md` §7 llama a esto «alejarse un tramo más», y el texto **no dice
    // tramo**: el tramo es la unidad del ajuste y el ajuste no se comenta nunca
    // (`accesibilidad.md` §1). Lo que crece un tramo es el alcance, y eso es mecánica; lo que
    // se lee es una invitación a andar un poco más.
    texto: 'Alejarse un poco más',
  },

  // --- A2P4 · La ficha ----------------------------------------------------------
  { pantalla: 'a2p4', id: 'lazo', registro: REGISTROS.MUNDO, texto: null, de: 'el lazo trazado sobre el grafo, con sus paradas numeradas' },
  { pantalla: 'a2p4', id: 'primera-parada', registro: REGISTROS.MUNDO, texto: null, de: 'el nombre del primer beat, que es el único que se rotula' },
  { pantalla: 'a2p4', id: 'titulo', registro: REGISTROS.MUNDO, texto: null, de: 'la plantilla del catálogo, o el narrador si lo hubo' },
  { pantalla: 'a2p4', id: 'gancho', registro: REGISTROS.MUNDO, texto: null, de: 'el narrador, con el texto de plantilla de repuesto' },
  { pantalla: 'a2p4', id: 'vuelves', registro: REGISTROS.MUNDO, texto: 'vuelves donde empiezas' },
  { pantalla: 'a2p4', id: 'empiezas', registro: REGISTROS.MUNDO, texto: `Empiezas en ${HUECO_DEL_SITIO}. El resto te lo irán diciendo.`, huecos: ['sitio'] },
  { pantalla: 'a2p4', id: 'aceptar', registro: REGISTROS.MUNDO, texto: 'Me la quedo' },
  { pantalla: 'a2p4', id: 'otra-cosa', registro: REGISTROS.MUNDO, texto: 'Otra cosa' },

  // --- A2P5 · La preparación ----------------------------------------------------
  //
  // La pantalla es de SPEC-025 y aquí no se rediseña: lo que esta fila fija es que dice
  // exactamente esto con red y sin ella.
  { pantalla: 'a2p5', id: 'titulo', registro: REGISTROS.MUNDO, texto: 'Preparando la salida' },
  { pantalla: 'a2p5', id: 'coletilla', registro: REGISTROS.MUNDO, texto: 'Un momento, que hay que escribirlo…' },
  { pantalla: 'a2p5', id: 'linea-papeles', registro: REGISTROS.MUNDO, texto: 'Repartiendo los papeles' },
  { pantalla: 'a2p5', id: 'linea-textos', registro: REGISTROS.MUNDO, texto: 'Escribiendo lo que se dirá' },
  { pantalla: 'a2p5', id: 'linea-lugares', registro: REGISTROS.MUNDO, texto: 'Dibujando los sitios' },
  {
    pantalla: 'a2p5',
    id: 'contrato',
    registro: REGISTROS.MUNDO,
    texto: 'A partir de aquí no hace falta cobertura. Puedes meter el móvil en el bolsillo.',
    porque: 'es el contrato del juego dicho en una línea, y promete que la red deja de importar en lugar de avisar de que falta',
  },
  { pantalla: 'a2p5', id: 'listo', registro: REGISTROS.MUNDO, texto: 'Listo. Vamos.' },
]);

/** Las tres líneas de la preparación, en orden. Son las de SPEC-025 y no se renombran. */
export const LINEAS_DE_LA_PREPARACION = congelaHondo(['linea-papeles', 'linea-textos', 'linea-lugares']);

// --- Consulta ------------------------------------------------------------------

/** Las piezas de una pantalla, en orden. Una pantalla sin piezas falla nombrándola. */
export function guionDePantalla(pantalla) {
  const piezas = GUION.filter((p) => p.pantalla === pantalla);
  if (!piezas.length) {
    throw new Error(`el guion de antes de salir no tiene ninguna pieza para "${pantalla}": las que declara son ${PANTALLAS.join(', ')}`);
  }
  return piezas;
}

/** El texto de una pieza, o un error que la nombra. Una pieza de fuera no tiene texto y se dice. */
export function textoDelGuion(pantalla, id) {
  const piezas = guionDePantalla(pantalla);
  const pieza = piezas.find((p) => p.id === id);
  if (!pieza) {
    throw new Error(`el guion de antes de salir no declara la pieza "${id}" de "${pantalla}": las suyas son ${piezas.map((p) => p.id).join(', ')}`);
  }
  if (pieza.texto === null) {
    throw new Error(`la pieza "${pantalla}/${id}" del guion no trae texto propio: su contenido sale de ${pieza.de}`);
  }
  return pieza.texto;
}

/** El texto de la pieza con su hueco relleno. Sin hueco declarado, falla en vez de dejarlo puesto. */
export function textoConSitio(pantalla, id, sitio) {
  const texto = textoDelGuion(pantalla, id);
  if (!texto.includes(HUECO_DEL_SITIO)) {
    throw new Error(`la pieza "${pantalla}/${id}" no deja ningún hueco de sitio que rellenar`);
  }
  if (typeof sitio !== 'string' || !sitio) {
    throw new Error(`la pieza "${pantalla}/${id}" se rellena con el nombre de un sitio del mundo y llegó ${JSON.stringify(sitio) ?? String(sitio)}`);
  }
  return texto.replace(HUECO_DEL_SITIO, sitio);
}

/** La medida de un tamaño en palabra del mundo, o un error que nombra las declaradas. */
export function medidaDe(tamano) {
  const medida = MEDIDA_DE_TAMANO[tamano];
  if (!medida) {
    throw new Error(`el tamaño de salida "${tamano}" no tiene palabra con la que decirse: las declaradas son ${Object.keys(MEDIDA_DE_TAMANO).join(', ')}`);
  }
  return medida;
}

/** Las piezas con texto propio. Es lo que se revisa: las de fuera se revisan donde viven. */
export function textosDeAntesDeSalir() {
  return GUION.filter((p) => typeof p.texto === 'string');
}

/**
 * Las dos familias del filtro de aptitud que **sí** se le exigen a este guion.
 *
 * El filtro de SPEC-018 vigila texto generado, y por eso rechaza cosas que aquí están puestas
 * a mano y a propósito: la palabra «Ajustes», que es el nombre de una puerta; la hora
 * orientativa que `bucle-jugable.md` §3 pide al lado de la palabra del mundo; el tramo, que es
 * la unidad personal con la que se dice el estirón; y la frase de contrato de A2P5. Ninguna es
 * un descuido y todas están declaradas arriba.
 *
 * Lo que sí se exige entero, porque es una propiedad del castellano y no del registro, son
 * estas dos: **ni masculino genérico evitable ni morfología inventada**.
 */
export const FAMILIAS_DE_APTITUD_EXIGIDAS = congelaHondo(['masculinoGenerico', 'morfologiaInventada']);

/**
 * Revisa el guion contra un filtro de aptitud inyectado y devuelve lo que incumple.
 *
 * El filtro llega de fuera porque vive en `names/` y depende del idioma y de los datos reales
 * del mundo, que aquí no se conocen: quien revise pasa el suyo.
 */
export function revisaAptitud(filtro, { familias = FAMILIAS_DE_APTITUD_EXIGIDAS } = {}) {
  if (!filtro || typeof filtro.valida !== 'function') {
    throw new Error('la revisión de aptitud del guion necesita el filtro inyectado: filtro.valida(texto, opciones) → veredicto');
  }
  const problemas = [];
  for (const pieza of textosDeAntesDeSalir()) {
    const veredicto = filtro.valida(pieza.texto, { tope: pieza.texto.length + 1 });
    if (veredicto.apto) continue;
    if (!familias.includes(veredicto.motivo?.familia)) continue;
    problemas.push({ clave: `${pieza.pantalla}/${pieza.id}`, que: `${veredicto.motivo.clave}: "${veredicto.motivo.fragmento}"` });
  }
  return problemas;
}

const REGLAS_DE_VOZ = congelaHondo(PALABRAS_QUE_NO_SE_DICEN.map(reglaDeFormula));
const REGLAS_DE_DISCULPA = congelaHondo(PALABRAS_DE_DISCULPA.map(reglaDeFormula));

/** Las palabras de fuera del mundo que dice un texto, como datos. */
export function vozDeTexto(texto) {
  return REGLAS_DE_VOZ.filter((r) => r.re.test(String(texto))).map((r) => r.formula);
}

/** Las maneras de disculparse que aparecen en un texto, como datos. */
export function disculpasDeTexto(texto) {
  return REGLAS_DE_DISCULPA.filter((r) => r.re.test(String(texto))).map((r) => r.formula);
}

/**
 * Revisa el guion entero y devuelve lo que incumple, como datos.
 *
 * Se llama al cargarse el módulo, igual que el catálogo de plantillas y el guion del
 * arranque: un texto con una cifra de distancia dentro tiene que fallar aquí y no en la
 * pantalla de alguien.
 */
export function revisaGuionDeAntesDeSalir() {
  const problemas = [];
  const vistos = new Set();

  for (const pieza of GUION) {
    const clave = `${pieza.pantalla}/${pieza.id}`;
    if (vistos.has(clave)) problemas.push({ clave, que: 'pieza repetida' });
    vistos.add(clave);

    if (!PANTALLAS.includes(pieza.pantalla)) problemas.push({ clave, que: 'es de una pantalla que este guion no declara' });
    if (pieza.registro !== REGISTROS.MUNDO) {
      problemas.push({ clave, que: 'habla como aplicación, y en este momento manda la voz del mundo' });
    }
    if (pieza.texto === null) {
      if (typeof pieza.de !== 'string' || !pieza.de) problemas.push({ clave, que: 'no trae texto y no dice de dónde sale el suyo' });
      continue;
    }
    if (pieza.salvo && typeof pieza.porque !== 'string') {
      problemas.push({ clave, que: 'se salta una familia de la revisión de cifras sin decir por qué' });
    }
    for (const cifra of cifrasDeTexto(pieza.texto, { salvo: pieza.salvo ?? [] })) {
      problemas.push({ clave, que: `lleva una cifra (${cifra.familia}): "${cifra.fragmento}"` });
    }
    const esExcepcion = EXCEPCIONES_DE_VOZ.includes(clave);
    const fuera = vozDeTexto(pieza.texto);
    if (fuera.length && !esExcepcion) {
      problemas.push({ clave, que: `menciona lo que ninguna de estas pantallas menciona: "${fuera.join('", "')}"` });
    }
    if (esExcepcion && !fuera.length) {
      problemas.push({ clave, que: 'está declarada como excepción de voz y no la necesita' });
    }
    if (esExcepcion && typeof pieza.porque !== 'string') {
      problemas.push({ clave, que: 'es excepción de voz y no dice por qué' });
    }
    const disculpas = disculpasDeTexto(pieza.texto);
    if (disculpas.length) problemas.push({ clave, que: `se disculpa: "${disculpas.join('", "')}"` });
  }

  // Ninguna de las cuatro pantallas se queda sin texto, y la que falte se nombra.
  for (const pantalla of PANTALLAS) {
    if (!GUION.some((p) => p.pantalla === pantalla)) problemas.push({ clave: pantalla, que: 'es una pantalla del momento sin ninguna pieza de guion' });
  }

  // Y las tres líneas de la preparación existen: sin ellas A2P5 se quedaría en blanco
  // exactamente igual con red y sin ella, que es la peor manera de cumplir el criterio.
  for (const id of LINEAS_DE_LA_PREPARACION) {
    if (!GUION.some((p) => p.pantalla === 'a2p5' && p.id === id)) {
      problemas.push({ clave: `a2p5/${id}`, que: 'es una de las tres líneas de la preparación y no tiene texto' });
    }
  }

  return problemas;
}

{
  const problemas = revisaGuionDeAntesDeSalir();
  if (problemas.length) {
    throw new Error(
      `el guion de antes de salir no pasa su propia revisión:\n${problemas.map((p) => `  · ${p.clave}: ${p.que}`).join('\n')}`,
    );
  }
}
