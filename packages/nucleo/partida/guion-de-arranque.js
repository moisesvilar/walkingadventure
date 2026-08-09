// El guion de textos de las siete pantallas del arranque: cada pieza con su pantalla,
// su registro —aplicación o mundo— y su texto.
//
// **Es una excepción declarada** a la costumbre de que el núcleo no exporte texto de
// juego, y el motivo es de verificabilidad: en la máquina donde se implementa esto no
// hay simulador, así que un criterio de contenido que solo se pueda leer en pantalla
// no se pone rojo nunca (`pipeline/decisiones-orquestador.md` §6o). Con el guion como
// dato, «el onboarding habla como aplicación», «no se pregunta la edad», «ningún
// texto lleva cifras» y «el suelo no se dice dentro» se comprueban leyendo una
// estructura en Node. `tramo.js` ya había abierto la excepción con
// `DECLARACION_DEL_SUELO`, y aquí se acota a los textos del arranque.
//
// Lo que no está aquí y no es un olvido: las seis fases de A1P5, que las declara el
// levantamiento (SPEC-026) y aquí solo se referencian; el título del mundo y las
// tarjetas de aventura de A1P6 y A1P7, que salen generados. Van declaradas como
// piezas de fuera, con su procedencia escrita, para que «ninguna pantalla se queda sin
// texto» no se cumpla por vacío.

import { congelaHondo } from '../core/congelar.js';
import { reglaDeFormula } from '../names/lenguaje.js';
import { DECLARACION_DEL_SUELO } from './tramo.js';
import { IDS_DE_RESPUESTA } from './tramo.js';

/** Los dos registros de `game-design/lenguaje.md`. La frontera entre ellos es el botón de A1P7. */
export const REGISTROS = Object.freeze({ APLICACION: 'aplicacion', MUNDO: 'mundo' });

/**
 * Dónde acaba la voz de la aplicación: el botón «Salir a andar» de A1P7 es el último
 * texto que dice «nosotros». A partir de ahí solo habla el mundo.
 */
export const FRONTERA_DE_REGISTRO = congelaHondo({ paso: 'la-primera-aventura', pieza: 'salir' });

/**
 * Las piezas del guion que hablan como mundo dentro de la voz de aplicación.
 *
 * Se enumeran porque son **excepciones declaradas y no un deslizamiento**: si mañana
 * aparece otra, hay que escribirla aquí y se ve en el diff.
 */
export const EXCEPCIONES_DE_REGISTRO = congelaHondo([
  'la-generacion/fases',
  'la-generacion/prologo',
  'tu-mapa/titulo-del-mundo',
  'tu-mapa/trato',
  'la-primera-aventura/titulo',
  'la-primera-aventura/subtitulo',
  'la-primera-aventura/tarjetas',
]);

/**
 * El guion, en el orden en que se lee cada pantalla.
 *
 * `de` marca una pieza que **no trae texto** porque su contenido lo pone otra capa, y
 * dice cuál. `salvo` deja fuera una familia de la revisión de cifras, siempre con su
 * motivo escrito al lado: hoy hay una sola excepción y es la pregunta del tramo, que
 * `accesibilidad.md` §1 formula literalmente en media hora.
 */
export const GUION = congelaHondo([
  // --- A1P1 · Quién eres -------------------------------------------------------
  { paso: 'quien-eres', id: 'seccion-personaje', registro: REGISTROS.APLICACION, texto: 'Tu personaje' },
  { paso: 'quien-eres', id: 'pregunta', registro: REGISTROS.APLICACION, texto: '¿Quién vas a ser ahí dentro?' },
  {
    paso: 'quien-eres',
    id: 'de-quien-es-el-nombre',
    registro: REGISTROS.APLICACION,
    texto: 'Dinos el nombre de tu personaje. Puede coincidir con el tuyo, aunque inventarse otro tiene más gracia.',
  },
  { paso: 'quien-eres', id: 'resortear', registro: REGISTROS.APLICACION, texto: '↻ otro' },
  { paso: 'quien-eres', id: 'genero-femenino', registro: REGISTROS.APLICACION, texto: 'se dirigen a ti en femenino' },
  { paso: 'quien-eres', id: 'genero-masculino', registro: REGISTROS.APLICACION, texto: 'en masculino' },
  { paso: 'quien-eres', id: 'seccion-oficio', registro: REGISTROS.APLICACION, texto: 'A qué te dedicas' },
  {
    paso: 'quien-eres',
    id: 'implicacion-del-oficio',
    registro: REGISTROS.APLICACION,
    texto: 'Marca qué aventuras te va a ofrecer el mundo, y esto no se cambia luego.',
  },
  {
    paso: 'quien-eres',
    id: 'nombre-demasiado-largo',
    registro: REGISTROS.APLICACION,
    texto: 'Ese nombre no cabe. Prueba con uno más corto.',
  },
  {
    paso: 'quien-eres',
    id: 'nombre-que-no-vale',
    registro: REGISTROS.APLICACION,
    // No repite el nombre rechazado, y es deliberado: repetirlo lo enseñaría otra vez
    // justo cuando lo que se está diciendo es que no se puede enseñar.
    texto: 'Ese nombre no nos vale aquí. Prueba con otro.',
  },
  { paso: 'quien-eres', id: 'seguir', registro: REGISTROS.APLICACION, texto: 'Seguir' },

  // --- A1P2 · Tu tramo ---------------------------------------------------------
  { paso: 'tu-tramo', id: 'seccion', registro: REGISTROS.APLICACION, texto: 'Tu nivel de dificultad' },
  {
    paso: 'tu-tramo',
    id: 'pregunta',
    registro: REGISTROS.APLICACION,
    texto: 'En media hora andando, ¿tú dónde llegas?',
    // La única excepción del guion, y viene del diseño: `accesibilidad.md` §1 formula
    // la pregunta así, «en lenguaje de sitios y no de distancias», y la media hora es
    // la definición del tramo, no una cifra de esfuerzo que se le pida a nadie.
    salvo: ['tiempo'],
    // La palabra que nombra la decisión no se escribe aquí, ni siquiera en un campo
    // que nadie enseña: el núcleo no la dice en ninguno de sus textos, y el motivo
    // está en el comentario de arriba.
    porque: 'el tramo es «lo que andas en media hora» por definición, y así lo formula la decisión que lo declara unidad personal',
  },
  { paso: 'tu-tramo', id: 'respuesta-vuelta-de-la-esquina', registro: REGISTROS.APLICACION, texto: 'A la vuelta de la esquina' },
  { paso: 'tu-tramo', id: 'respuesta-par-de-manzanas', registro: REGISTROS.APLICACION, texto: 'A un par de manzanas' },
  { paso: 'tu-tramo', id: 'respuesta-otro-barrio', registro: REGISTROS.APLICACION, texto: 'Al otro barrio' },
  { paso: 'tu-tramo', id: 'respuesta-pueblo-de-al-lado', registro: REGISTROS.APLICACION, texto: 'Al pueblo de al lado' },
  {
    paso: 'tu-tramo',
    id: 'se-ajusta-solo',
    registro: REGISTROS.APLICACION,
    texto: 'No te preocupes por acertar: se ajusta solo a medida que camines.',
  },
  { paso: 'tu-tramo', id: 'seguir', registro: REGISTROS.APLICACION, texto: 'Seguir' },

  // --- A1P3 · El permiso -------------------------------------------------------
  { paso: 'el-permiso', id: 'seccion', registro: REGISTROS.APLICACION, texto: 'Tu mapa' },
  { paso: 'el-permiso', id: 'titulo', registro: REGISTROS.APLICACION, texto: 'Permiso de ubicación' },
  {
    paso: 'el-permiso',
    id: 'razon',
    registro: REGISTROS.APLICACION,
    texto: 'Necesitamos tu ubicación para generar el mapa del juego y para saber cuánto caminas. '
      + 'Nunca, nunca, nunca la guardamos en ningún sitio, y tampoco la compartimos con nadie.',
  },
  { paso: 'el-permiso', id: 'alcance', registro: REGISTROS.APLICACION, texto: 'Ubicación · mientras usas la app' },
  {
    paso: 'el-permiso',
    id: 'alcance-nota',
    registro: REGISTROS.APLICACION,
    texto: 'Nunca en segundo plano. Si la app no está abierta, el juego no puede seguirte.',
  },
  { paso: 'el-permiso', id: 'permitir', registro: REGISTROS.APLICACION, texto: 'Permitir' },
  { paso: 'el-permiso', id: 'a-mano', registro: REGISTROS.APLICACION, texto: 'Prefiero elegir el punto a mano' },

  // --- A1P4 · Dónde se levanta -------------------------------------------------
  { paso: 'donde-se-levanta', id: 'titulo', registro: REGISTROS.APLICACION, texto: 'Dónde generar el mapa del juego' },
  {
    paso: 'donde-se-levanta',
    id: 'arrastra',
    registro: REGISTROS.APLICACION,
    texto: 'Puedes arrastrar la marca a otro sitio. El círculo es hasta dónde llega el mundo por ahora.',
  },
  {
    paso: 'donde-se-levanta',
    id: 'circulo',
    registro: REGISTROS.APLICACION,
    texto: 'El tamaño sale de la dificultad que elegiste: te da para una tarde larga.',
  },
  {
    paso: 'donde-se-levanta',
    id: 'irreversible',
    registro: REGISTROS.APLICACION,
    // Se dice **antes** de pulsar y no en un diálogo de confirmación: un «¿estás
    // seguro?» es la aplicación desconfiando, y aquí lo que hay que hacer es informar.
    texto: 'El mapa se genera aquí y se queda aquí. Es lo único del juego que no se deshace.',
  },
  { paso: 'donde-se-levanta', id: 'generar', registro: REGISTROS.APLICACION, texto: 'Generar aquí' },
  {
    paso: 'donde-se-levanta',
    id: 'no-se-pudo',
    registro: REGISTROS.APLICACION,
    // Ni la red, ni un servidor, ni un código: nada de eso lo puede arreglar quien lo
    // lee, así que decirlo solo sirve para asustar.
    texto: 'No hemos podido generar el mapa. Vuelve a intentarlo cuando quieras.',
  },
  {
    paso: 'donde-se-levanta',
    id: 'celda-no-jugable',
    registro: REGISTROS.APLICACION,
    texto: 'Por aquí no hay bastante de donde tirar para montar un mundo. Mueve la marca y prueba desde otro sitio.',
  },

  // --- A1P5 · La generación ----------------------------------------------------
  { paso: 'la-generacion', id: 'titulo', registro: REGISTROS.APLICACION, texto: 'Generando el mundo del juego' },
  {
    paso: 'la-generacion',
    id: 'espera',
    registro: REGISTROS.APLICACION,
    texto: 'Esto puede tardar un poco, pero solo ocurre una vez…',
  },
  {
    paso: 'la-generacion',
    id: 'fases',
    registro: REGISTROS.MUNDO,
    texto: null,
    de: 'las seis fases del levantamiento (SPEC-026, app/mapa/fases.js)',
  },
  {
    paso: 'la-generacion',
    id: 'prologo',
    registro: REGISTROS.MUNDO,
    // Anuncia el prólogo **sin explicarlo**: decir qué es lo convertiría en una
    // mecánica que hay que entender, y lo que tiene que hacer es dar ganas de ir.
    texto: '…y mientras tanto, ahí fuera ya pasan cosas que nadie te ha contado.',
  },

  // --- A1P6 · Tu mapa, el día uno ----------------------------------------------
  { paso: 'tu-mapa', id: 'seccion', registro: REGISTROS.APLICACION, texto: 'Tu mapa' },
  {
    paso: 'tu-mapa',
    id: 'titulo-del-mundo',
    registro: REGISTROS.MUNDO,
    texto: null,
    de: 'el título del mundo generado (worldTitle del paquete de idioma)',
  },
  {
    paso: 'tu-mapa',
    id: 'trato',
    registro: REGISTROS.MUNDO,
    // Tres frases y ninguna más: que los sitios son reales, que ahí ocurre la
    // historia, y que se escribe según andas. Sin ese párrafo, un mapa bonito es solo
    // un mapa bonito; con una frase más, es un tutorial.
    texto: 'Cada sitio de este mapa existe de verdad, con otro nombre y otra vida. '
      + 'Ahí es donde va a pasar todo. Y lo que pase se irá escribiendo según andes.',
  },
  { paso: 'tu-mapa', id: 'seguir', registro: REGISTROS.APLICACION, texto: 'Seguir' },

  // --- A1P7 · La primera aventura ----------------------------------------------
  { paso: 'la-primera-aventura', id: 'titulo', registro: REGISTROS.MUNDO, texto: 'Lo que se cuenta hoy' },
  { paso: 'la-primera-aventura', id: 'subtitulo', registro: REGISTROS.MUNDO, texto: 'Por aquí hay quien necesita algo' },
  {
    paso: 'la-primera-aventura',
    id: 'tarjetas',
    registro: REGISTROS.MUNDO,
    texto: null,
    de: 'las aventuras casteadas del reparto, con su medida en palabra del mundo (SPEC-013 y SPEC-017)',
  },
  {
    paso: 'la-primera-aventura',
    id: 'regla-del-reloj',
    registro: REGISTROS.APLICACION,
    texto: 'Lo que cuenta es lo que andas, no el reloj. Si hoy te da para un rato corto, lo dejas y ya está: '
      + 'el mundo se queda quieto hasta que vuelvas.',
  },
  {
    paso: 'la-primera-aventura',
    id: 'andar-sin-nada',
    registro: REGISTROS.APLICACION,
    texto: 'Y puedes salir a andar sin coger ninguna. El mundo se mueve igual.',
  },
  { paso: 'la-primera-aventura', id: 'salir', registro: REGISTROS.APLICACION, texto: 'Salir a andar' },
]);

// --- Lo que ningún texto del arranque puede llevar ------------------------------
//
// No se reutiliza la familia `cifras` del paquete de idioma entera, y conviene decir
// por qué: aquella prohíbe también los numerales y las horas, porque está pensada para
// el texto del mundo, y el arranque **tiene** que poder decir «en media hora andando»
// —es la definición del tramo—. Así que la revisión se parte en familias y la
// excepción se declara pieza a pieza, en vez de aflojar la lista para todos.

const DISTANCIA = [
  'metro', 'metros', 'kilómetro', 'kilómetros', 'legua', 'leguas', 'milla', 'millas',
  'paso', 'pasos', 'zancada', 'zancadas',
];

// «segundo» en singular se queda fuera y no es un descuido: en castellano es también
// un ordinal, y la pantalla del permiso **tiene** que poder decir «nunca en segundo
// plano», que es la mitad de lo que esa pantalla existe para prometer. El plural sí
// entra, porque ahí ya solo puede ser una duración.
const TIEMPO = ['segundos', 'minuto', 'minutos', 'hora', 'horas'];

const PROGRESO = ['ritmo', 'porcentaje', 'por ciento', 'progreso', 'caloría', 'calorías', 'velocidad'];

/** Las familias de la revisión de cifras del arranque, en el orden en que se comprueban. */
export const FAMILIAS_DE_CIFRA = congelaHondo(['digitos', 'distancia', 'tiempo', 'progreso']);

const REGLAS_DE_CIFRA = congelaHondo({
  digitos: [Object.freeze({ formula: 'cifra en dígitos', re: /\d/ })],
  distancia: DISTANCIA.map(reglaDeFormula),
  tiempo: TIEMPO.map(reglaDeFormula),
  progreso: PROGRESO.map(reglaDeFormula),
});

/**
 * Lo que el arranque no pregunta, nombrado para que la ausencia se pueda poner roja.
 *
 * `seguridad-privacidad.md` §4: sin verificación de edad, sin modo infantil y sin
 * preguntar nada. Comprobar que la palabra no aparece es barato y es exactamente el
 * criterio.
 */
export const PREGUNTAS_QUE_EL_ARRANQUE_NO_HACE = congelaHondo([
  'edad', 'años', 'cumpleaños', 'nacimiento', 'naciste', 'mayor de', 'menor de',
]);

// --- Consulta ---------------------------------------------------------------------

/** Las piezas de un paso, en el orden en que se leen. Un paso sin piezas falla nombrándolo. */
export function guionDePaso(paso) {
  const piezas = GUION.filter((p) => p.paso === paso);
  if (!piezas.length) {
    const pasos = [...new Set(GUION.map((p) => p.paso))];
    throw new Error(`el guion del arranque no tiene ninguna pieza para la pantalla "${paso}": las que declara son ${pasos.join(', ')}`);
  }
  return piezas;
}

/** El texto de una pieza, o un error que la nombra. Una pieza de fuera no tiene texto y se dice. */
export function textoDelGuion(paso, id) {
  const pieza = guionDePaso(paso).find((p) => p.id === id);
  if (!pieza) {
    throw new Error(`el guion del arranque no declara la pieza "${id}" de la pantalla "${paso}": las suyas son ${guionDePaso(paso).map((p) => p.id).join(', ')}`);
  }
  if (pieza.texto === null) {
    throw new Error(`la pieza "${paso}/${id}" del guion no trae texto propio: su contenido sale de ${pieza.de}`);
  }
  return pieza.texto;
}

/** Las piezas con texto propio. Es lo que se revisa: las de fuera se revisan donde viven. */
export function textosDelArranque() {
  return GUION.filter((p) => typeof p.texto === 'string');
}

/** Las infracciones de cifra de un texto, como datos: familia, fórmula y fragmento. */
export function cifrasDeTexto(texto, { salvo = [] } = {}) {
  const fuera = new Set(salvo);
  const out = [];
  for (const familia of FAMILIAS_DE_CIFRA) {
    if (fuera.has(familia)) continue;
    for (const regla of REGLAS_DE_CIFRA[familia]) {
      const casa = String(texto).match(regla.re);
      if (casa) out.push(Object.freeze({ familia, formula: regla.formula, fragmento: casa[0] }));
    }
  }
  return out;
}

/**
 * Revisa el guion entero y devuelve lo que incumple, como datos.
 *
 * Se llama al cargarse el módulo, igual que el catálogo de plantillas y el de
 * puestos: un texto con una cifra dentro tiene que fallar aquí y no en la pantalla de
 * alguien.
 */
export function revisaGuion({ pasos = null } = {}) {
  const problemas = [];
  const vistos = new Set();

  for (const pieza of GUION) {
    const clave = `${pieza.paso}/${pieza.id}`;
    if (vistos.has(clave)) problemas.push({ clave, que: 'pieza repetida' });
    vistos.add(clave);

    const esExcepcion = EXCEPCIONES_DE_REGISTRO.includes(clave);
    if (pieza.registro === REGISTROS.MUNDO && !esExcepcion) {
      problemas.push({ clave, que: 'habla como mundo sin estar declarada como excepción' });
    }
    if (pieza.registro === REGISTROS.APLICACION && esExcepcion) {
      problemas.push({ clave, que: 'está declarada como excepción y habla como aplicación' });
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
    const minusculas = pieza.texto.toLowerCase();
    for (const palabra of PREGUNTAS_QUE_EL_ARRANQUE_NO_HACE) {
      if (minusculas.includes(palabra)) problemas.push({ clave, que: `pregunta por la edad: "${palabra}"` });
    }
    // El suelo se dice antes de instalar y nunca dentro: ninguna frase de la
    // declaración de la tienda puede aparecer en una pantalla del arranque.
    for (const frase of DECLARACION_DEL_SUELO.texto.split('. ')) {
      const fragmento = frase.trim();
      if (fragmento.length > 20 && minusculas.includes(fragmento.toLowerCase())) {
        problemas.push({ clave, que: 'dice el suelo dentro del juego, y el suelo se dice en la ficha de la tienda' });
      }
    }
  }

  // Ninguna pantalla se queda sin texto, y la que falte se nombra.
  for (const paso of pasos ?? [...new Set(GUION.map((p) => p.paso))]) {
    if (!GUION.some((p) => p.paso === paso)) problemas.push({ clave: paso, que: 'es una pantalla del arranque sin ninguna pieza de guion' });
  }

  // Y cada respuesta de tramo tiene la suya: sin ella A1P2 pintaría una opción en
  // blanco, que es peor que no pintarla.
  for (const id of IDS_DE_RESPUESTA) {
    if (!GUION.some((p) => p.paso === 'tu-tramo' && p.id === `respuesta-${id}`)) {
      problemas.push({ clave: `tu-tramo/respuesta-${id}`, que: 'la respuesta de tramo no tiene texto en el guion' });
    }
  }

  return problemas;
}

/** El texto de una respuesta de tramo por su identificador de SPEC-004. */
export function textoDeRespuestaDeTramo(id) {
  return textoDelGuion('tu-tramo', `respuesta-${id}`);
}

// El guion se revisa a sí mismo al cargarse. Es la misma cautela que el catálogo de
// plantillas: un texto con una cifra dentro no puede llegar a un dispositivo.
{
  const problemas = revisaGuion();
  if (problemas.length) {
    throw new Error(
      `el guion del arranque no pasa su propia revisión:\n${problemas.map((p) => `  · ${p.clave}: ${p.que}`).join('\n')}`,
    );
  }
}
