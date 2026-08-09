// El registro de tópicos: la versión barata de un crítico anti-cliché, y no cuesta
// ninguna llamada extra porque viaja dentro del prompt que ya se manda.
//
// Cinco categorías cerradas —aperturas, imágenes, giros, oficios y objetos—, una
// ventana de unas veinte entradas por categoría porque **lo reciente es lo que canta**
// (`game-design/quests.md` pendiente 4), y una lista negra de tics genéricos que llega
// **precargada**: un registro recién creado ya sabe qué no quiere oír, en vez de tener
// que aprenderlo a costa de las primeras aventuras de alguien.
//
// Va dentro del prompt **como restricción negativa y nunca como ejemplo a imitar**, y
// solo se anota **lo adoptado**: anotar lo descartado enseñaría al registro a evitar
// frases que nadie llegó a leer.
//
// Y una aclaración que es la que lo salva de RNF-DET-002: su contenido depende de lo
// que devuelva el modelo, así que **no es reproducible**. No pasa nada, porque es
// **estado inerte** —ninguna regla bifurca por él fuera de la construcción del
// prompt— y la estructura de una aventura no cambia con lo que contenga. Es la misma
// frontera que el resto de la fila, aplicada a sí misma.
//
// Es **por semilla de mundo y no global**: dos mundos distintos pueden repetir una
// imagen sin que suene a nada, porque nadie los lee seguidos.

import { congelaHondo } from '../core/congelar.js';

/** Las cinco categorías, en orden declarado. El catálogo es cerrado. */
export const CATEGORIAS_DE_TOPICO = congelaHondo(['aperturas', 'imagenes', 'giros', 'oficios', 'objetos']);

/**
 * Cuántas entradas caben por categoría.
 *
 * Sin ventana el prompt crece sin techo y acaba pesando más que el encargo. Veinte es
 * el orden de magnitud que fija `quests.md` pendiente 4, y el criterio que lo justifica
 * es que lo que canta es lo reciente: lo que se leyó hace treinta aventuras ya no suena
 * a repetido.
 */
export const TAMANO_DE_VENTANA = 20;

/**
 * La lista negra de tics genéricos, precargada.
 *
 * Es cosa distinta de las listas del filtro de aptitud y por eso viaja aparte: una es
 * aptitud —lo que no puede llegar a pantalla— y esta es repetición —lo que ya se ha
 * leído demasiado—. Un tic no hace fallar nada; solo entra en el prompt como algo que
 * no se quiere volver a leer.
 */
export const TICS_PRECARGADOS = congelaHondo({
  aperturas: [
    'en un mundo', 'hace mucho tiempo', 'todo empezó', 'nadie sabe', 'dicen que',
    'cuenta la leyenda', 'érase una vez', 'desde tiempos', 'no es la primera vez',
  ],
  imagenes: [
    'un escalofrío recorre', 'el silencio es ensordecedor', 'el aire huele a peligro',
    'una sombra se mueve', 'el tiempo parece detenerse', 'un brillo en los ojos',
    'el corazón late con fuerza',
  ],
  giros: [
    'nada es lo que parece', 'la verdad es otra', 'todo era una trampa',
    'el culpable era el que menos esperabas', 'siempre estuvo ahí',
  ],
  oficios: ['sabio anciano', 'herrero taciturno', 'mercader avaricioso', 'posadera cotilla'],
  objetos: ['amuleto ancestral', 'mapa antiguo', 'llave oxidada', 'pergamino olvidado'],
});

/** Una categoría del catálogo cerrado, o un error que la nombra y enumera las válidas. */
export function exigeCategoria(categoria, quien = 'la categoría del tópico') {
  if (!CATEGORIAS_DE_TOPICO.includes(categoria)) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(categoria) ?? String(categoria)}, que no está en el catálogo cerrado: ` +
      `las cinco son ${CATEGORIAS_DE_TOPICO.join(', ')}`,
    );
  }
  return categoria;
}

/** El área de tópicos del estado: un registro por semilla de mundo, y ninguno global. */
export function estadoDeTopicos() {
  return { mundos: {} };
}

/** Un registro recién creado: las cinco categorías, con la lista negra ya dentro. */
export function registroInicialDeTopicos() {
  const registro = {};
  for (const categoria of CATEGORIAS_DE_TOPICO) registro[categoria] = [...TICS_PRECARGADOS[categoria]];
  return registro;
}

/**
 * El registro de un mundo, creándolo precargado si es la primera vez.
 *
 * La identidad es **la semilla del mundo** y no la de la partida: `quests.md` decisión
 * 1 lo pide así, y tiene sentido de lectura —lo que canta es repetirse dentro del mismo
 * mapa, que es lo que una jugadora recorre seguido.
 */
export function registroDeMundo(estado, semillaDeMundo) {
  if (!estado || typeof estado !== 'object' || !estado.mundos || typeof estado.mundos !== 'object') {
    throw new Error('el área de tópicos llega mal formada: se espera lo que devuelve estadoDeTopicos(), un objeto con "mundos"');
  }
  if (typeof semillaDeMundo !== 'string' || !semillaDeMundo) {
    throw new Error(
      `el registro de tópicos es por semilla de mundo y llegó ${JSON.stringify(semillaDeMundo) ?? String(semillaDeMundo)}: ` +
      'un registro global mezclaría mapas que nadie lee seguidos',
    );
  }
  if (!estado.mundos[semillaDeMundo]) estado.mundos[semillaDeMundo] = registroInicialDeTopicos();
  return estado.mundos[semillaDeMundo];
}

/**
 * Anota un tópico en su categoría.
 *
 * El orden dentro de la ventana es **el de anotación**, declarado y no dependiente de
 * ninguna estructura con orden de inserción; llena la ventana, sale el más antiguo y el
 * tamaño se conserva. Anotar dos veces lo mismo lo **mueve al final** en lugar de
 * duplicarlo: repetirlo dentro de la ventana no lo hace más reciente que él mismo.
 *
 * @returns si el tópico entró (falso si llegó vacío).
 */
export function anotaTopico(estado, { semillaDeMundo, categoria, topico }) {
  const registro = registroDeMundo(estado, semillaDeMundo);
  exigeCategoria(categoria, 'la categoría del tópico que se anota');
  if (typeof topico !== 'string' || !topico.trim()) return false;
  const limpio = topico.trim();
  const ventana = registro[categoria].filter((t) => t !== limpio);
  ventana.push(limpio);
  registro[categoria] = ventana.slice(Math.max(0, ventana.length - TAMANO_DE_VENTANA));
  return true;
}

/**
 * La fórmula con la que abre un texto: sus primeras palabras, normalizadas.
 *
 * Es el tópico que se anota de cualquier texto adoptado, y se calcula **mecánicamente**
 * a propósito: pedirle al modelo que declare de qué habla sería dejarle escribir un
 * dato por el que el código bifurca, que es justo lo que esta fila prohíbe. Es la misma
 * fórmula con la que el catálogo comprueba que dos plantillas no abren igual.
 */
export function aperturaDeTexto(texto, palabras = 3) {
  return String(texto ?? '')
    .toLowerCase()
    .replace(/[«»"'¡!¿?.,;:—-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, palabras)
    .join(' ');
}

/**
 * Los tópicos de un registro, listos para viajar dentro del prompt.
 *
 * Cabe **entero**: una categoría exactamente en el tamaño de la ventana no se recorta a
 * mitad de una entrada, porque la ventana ya es el recorte y hacerlo dos veces sería
 * cortar por donde nadie ha decidido.
 */
export function topicosParaElPrompt(estado, semillaDeMundo) {
  const registro = registroDeMundo(estado, semillaDeMundo);
  const out = {};
  for (const categoria of CATEGORIAS_DE_TOPICO) out[categoria] = [...registro[categoria]];
  return congelaHondo(out);
}

/** Cuántas entradas tiene cada categoría. Es lo que mira quien comprueba la ventana. */
export function tamanosDeVentana(estado, semillaDeMundo) {
  const registro = registroDeMundo(estado, semillaDeMundo);
  const out = {};
  for (const categoria of CATEGORIAS_DE_TOPICO) out[categoria] = registro[categoria].length;
  return congelaHondo(out);
}

// --- Serialización -------------------------------------------------------------

/** El registro en forma canónica: los mundos por semilla ordenada, cada categoría en su orden de anotación. */
export function congelaTopicos(estado) {
  const mundos = {};
  for (const semilla of Object.keys(estado?.mundos ?? {}).sort()) {
    const registro = estado.mundos[semilla];
    const doc = {};
    // Las categorías van en el orden **declarado** del catálogo, no en el que se
    // escribió el objeto: el documento tiene que ser el mismo byte a byte.
    for (const categoria of CATEGORIAS_DE_TOPICO) doc[categoria] = [...(registro[categoria] ?? [])];
    mundos[semilla] = doc;
  }
  return { mundos };
}

/** El registro de vuelta de su documento, con las ventanas intactas. */
export function levantaTopicos(doc) {
  const estado = estadoDeTopicos();
  for (const semilla of Object.keys(doc?.mundos ?? {}).sort()) {
    const guardado = doc.mundos[semilla] ?? {};
    const registro = registroInicialDeTopicos();
    for (const categoria of CATEGORIAS_DE_TOPICO) {
      const entradas = guardado[categoria] ?? [];
      if (!Array.isArray(entradas)) {
        throw new Error(`la categoría "${categoria}" del registro de tópicos del mundo "${semilla}" vuelve como ${JSON.stringify(entradas)}: se espera una lista`);
      }
      registro[categoria] = entradas.slice(Math.max(0, entradas.length - TAMANO_DE_VENTANA)).map(String);
    }
    estado.mundos[semilla] = registro;
  }
  return estado;
}
