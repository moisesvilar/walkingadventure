// La composición de lo que hay hoy (A2P3) y la de la ficha de una aventura (A2P4), como
// datos del núcleo.
//
// Igual que la portada: **qué bloques hay y qué dicen**, sobre un vocabulario cerrado, para
// que «se ofrecen tres como mucho», «con una sola nadie se disculpa», «el estirón se ofrece y
// nunca se impone» y «ningún texto lleva una distancia» se afirmen en `node --test` y no
// mirando una pantalla (`pipeline/decisiones-orquestador.md` §6o).
//
// Tres cosas que esta capa **no** decide, y que se consumen tal cual:
//
// - el tope de tres y que el recado ocupe sitio en lugar de añadir un cuarto, que son de
//   SPEC-019 y viven en `recados.js`;
// - la falta de reparto y el estirón de un tramo, que son de SPEC-008 y viven en
//   `aventuras.js` — aquí un dato se convierte en oferta, y nada más;
// - el casting y el catálogo, que llegan hechos.
//
// Y una que sí decide, porque es de esta pantalla: **la lista nunca vuelve vacía**. O trae
// entradas, o trae la falta de reparto con su motivo. Una lista vacía que parece una lista es
// la degradación silenciosa de §6h con otro nombre.

import { congelaHondo } from '../core/congelar.js';
import { aventurasCerradas } from './aventura-en-curso.js';
import { MOTIVOS_DE_FALTA, TRAMOS_DEL_ESTIRON, repartoDeAventuras } from './aventuras.js';
import { diaDe } from './calendario.js';
import { SIN_DESCARTES } from './descartes.js';
import { aceptaRecado, entradaDe } from './entregas.js';
import { medidaDe, textoConSitio, textoDelGuion } from './guion-de-antes-de-salir.js';
import { MEDIDA_DEL_RECADO, TOPE_DE_LA_LISTA, listaDeHoy, recadoSuelto } from './recados.js';
import { aceptaAventuraEnLaSalida, salidaAbierta } from './salida-abierta.js';
import { CATALOGO } from '../quests/catalogo.js';
import { plantillasDeOficio } from '../quests/oficios.js';

/**
 * Los bloques de A2P3. **Lista cerrada**: o la lista, o la falta de reparto; y siempre la
 * línea de andar sin coger nada, que es lo que impide que la oferta del estirón sea la única
 * salida.
 */
export const BLOQUES_DE_LO_QUE_HAY_HOY = congelaHondo(['lista', 'sin-reparto', 'andar-sin-nada']);

/** Los bloques de la ficha, A2P4. Cerrada por lo mismo: aquí no hay sitio para una distancia. */
export const BLOQUES_DE_LA_FICHA = congelaHondo(['lazo', 'titulo', 'gancho', 'pie', 'empiezas', 'acciones']);

/** Lo que ninguna de las dos pantallas tiene, nombrado para que la ausencia se pueda poner roja. */
export const BLOQUES_QUE_NO_EXISTEN = congelaHondo([
  'paginacion',
  'ver-mas',
  'ordenacion',
  'distancia',
  'barra-de-progreso',
]);

/** Las dos clases de entrada que comparten lista. Cerrada: una tercera sería otra pantalla. */
export const CLASES_DE_ENTRADA = Object.freeze({ AVENTURA: 'aventura', RECADO: 'recado' });

/** Las dos acciones de la ficha. «Otra cosa» vuelve a la lista sin aceptar nada. */
export const ACCIONES_DE_LA_FICHA = congelaHondo(['ficha-aceptar', 'ficha-otra-cosa']);

function plantillaDe(id, catalogo) {
  const encontrada = catalogo.find((p) => p.id === id);
  if (!encontrada) {
    throw new Error(`el reparto ofrece la plantilla "${id}" y el catálogo no la tiene: la lista se compone desde el catálogo y no desde el casting`);
  }
  return encontrada;
}

/** Una tarjeta de aventura: lo que A2P3 pinta de cada una, y ni un metro más. */
function tarjetaDeAventura(aventura, catalogo) {
  const plantilla = plantillaDe(aventura.plantilla, catalogo);
  return {
    id: plantilla.id,
    clase: CLASES_DE_ENTRADA.AVENTURA,
    titulo: plantilla.titulo,
    gancho: plantilla.gancho,
    tamano: plantilla.tamano,
    // La palabra del mundo con su hora orientativa. Ninguna distancia, ni aquí ni al pie.
    medida: medidaDe(plantilla.tamano),
    lazo: aventura.lazo,
    beats: aventura.beats,
  };
}

/** La tarjeta del recado suelto. Mide «un momento» y ocupa un sitio del tope de tres. */
function tarjetaDeRecado(recado) {
  return {
    id: recado.entrada,
    clase: CLASES_DE_ENTRADA.RECADO,
    // El título y el gancho de un recado salen de su texto de plantilla, que es de SPEC-019:
    // escribirlos aquí sería una segunda redacción del mismo encargo.
    titulo: null,
    gancho: null,
    de: 'el texto de plantilla de la entrada de la cola',
    tamano: MEDIDA_DEL_RECADO,
    medida: medidaDe(MEDIDA_DEL_RECADO),
    texto: recado.texto,
    asunto: recado.asunto,
    escena: recado.escena,
  };
}

/**
 * La falta de reparto convertida en pantalla: la frase en voz de mundo y, si todavía no se
 * estiró, la oferta de alejarse un tramo.
 *
 * **El estirón sustituye a la lista y no se añade debajo** (`bucle-jugable.md` §7): si hubiera
 * lista y además oferta, el estirón sería un extra y no lo que es, la respuesta honesta a que
 * hoy no hay nada por aquí.
 *
 * **Y no se encadena solo.** Aceptado uno, una segunda falta se declara sin ofrecer otro: el
 * alcance de más es de un tramo, y encadenarlos sería el juego decidiendo cuánto andas.
 */
function sinReparto({ motivo, alcanceEnTramos, tramosDeMas }) {
  const yaEstirado = tramosDeMas > 0;
  return congelaHondo({
    hayLista: false,
    bloques: ['sin-reparto', 'andar-sin-nada'],
    motivo,
    alcanceEnTramos,
    entradas: [],
    tope: TOPE_DE_LA_LISTA,
    sinReparto: {
      // Habla como mundo: ni una cifra, ni la palabra filtro, ni la palabra accesibilidad.
      texto: textoDelGuion('a2p3', 'sin-reparto'),
      motivo,
    },
    estiron: yaEstirado
      ? null
      : {
        id: 'estiron',
        texto: textoDelGuion('a2p3', 'estiron'),
        tramosMas: TRAMOS_DEL_ESTIRON,
        alcanceEnTramos: alcanceEnTramos + TRAMOS_DEL_ESTIRON,
        aceptado: false,
        // Se ofrece, nunca se impone: quien no lo acepta se queda como estaba y sigue
        // pudiendo salir a andar sin coger nada.
        impuesto: false,
      },
    tramosDeMas,
    yaEstirado,
    andarSinNada: textoDelGuion('a2p3', 'andar-sin-nada'),
  });
}

/**
 * Compone lo que hay hoy.
 *
 * @param {object} opciones
 *   `mundo` el mapa levantado con su casting y su grafo; `oficio` el de quien juega, que filtra
 *   el catálogo; `tramo` el tramo personal; `criterios` los caminos que se evitan; `tamano` el
 *   de salida que se pide; `entregas` el estado de la cola; `mapaId` el mapa; `calendario` el de
 *   la partida, inyectado; `tramosDeMas` cuánto se ha estirado ya el alcance; `aventuras` el
 *   registro de aventuras de la partida, que es **la memoria de la lista**: lo ya cerrado no
 *   se vuelve a ofrecer.
 * @returns o la lista con hasta tres entradas y su línea de andar sin nada, o la falta de
 *   reparto con su motivo y su oferta. **Nunca una lista vacía.**
 */
export function componeLoQueHayHoy({
  mundo,
  oficio,
  tramo,
  criterios = [],
  tamano = 'aventura',
  entregas = null,
  mapaId,
  calendario,
  tramosDeMas = 0,
  descartes = SIN_DESCARTES,
  catalogo = CATALOGO,
  tope = TOPE_DE_LA_LISTA,
  aventuras = null,
}) {
  const dia = diaDe(calendario, 'la lista de hoy');

  // El recado se resuelve antes que el reparto porque decide si un día sin ninguna aventura
  // es un día vacío: con recado hay lista, aunque no castee nada.
  const recado = entregas && mapaId ? recadoSuelto({ estado: entregas, mapaId, dia }) : null;

  // Los sitios marcados entran por aquí y por ningún otro sitio de esta pantalla: la
  // alarma de estirón **no es una pantalla nueva**, es una causa más para que aparezca la
  // que ya existe, y su texto no menciona los descartes ni insinúa nada sobre quien juega.
  const reparto = repartoDeAventuras({ mundo, criterios, tramo, tamano, tramosDeMas, descartes });
  if (!reparto.hayReparto && !recado) {
    return sinReparto({ motivo: reparto.motivo, alcanceEnTramos: reparto.estiron.alcanceEnTramos - TRAMOS_DEL_ESTIRON, tramosDeMas });
  }

  // El oficio filtra **lo que se ofrece**, nunca lo que existe: el mundo es el mismo para dos
  // personas con oficios distintos, y lo que cambia es esta lista. Hay plantillas que con este
  // personaje no aparecen nunca, y eso es la afinidad de SPEC-017 haciendo su trabajo.
  const suyas = new Set(plantillasDeOficio(oficio, catalogo).map((p) => p.id));

  // La memoria de la lista. Sin ella los mismos tres títulos volvían el día 1 y el día 6, y
  // una aventura ya vivida ofrecida otra vez es la promesa de un mundo que no se entera de
  // nada. Cuenta lo cerrado **de cualquier manera**: terminarla y que se resolviera sin ti
  // son dos finales, y ninguno de los dos se repite. Se mira por mapa cuando lo hay, porque
  // lo cerrado en un mapa no dice nada de otro.
  const cerradas = aventuras ? aventurasCerradas(aventuras) : [];
  const vividas = new Set(cerradas.filter((c) => !mapaId || c.mapa === mapaId).map((c) => c.plantilla));

  const candidatas = reparto.hayReparto
    ? reparto.aventuras.filter((a) => a.cabe && suyas.has(a.plantilla) && !vividas.has(a.plantilla))
    : [];

  if (!candidatas.length && !recado) {
    return sinReparto({ motivo: MOTIVOS_DE_FALTA.MUNDO, alcanceEnTramos: reparto.alcanceEnTramos, tramosDeMas });
  }

  const compuesta = listaDeHoy({
    aventuras: candidatas.map((a) => tarjetaDeAventura(a, catalogo)),
    recado: recado ? tarjetaDeRecado(recado) : null,
    tope,
  });

  return congelaHondo({
    hayLista: true,
    // Los mismos dos bloques con una entrada que con tres: la lista corta no estrena ninguna
    // línea, y por eso no hay ningún sitio donde escribir una disculpa.
    bloques: ['lista', 'andar-sin-nada'],
    titulo: textoDelGuion('a2p3', 'titulo'),
    subtitulo: textoDelGuion('a2p3', 'subtitulo'),
    tope: compuesta.tope,
    entradas: compuesta.entradas,
    andarSinNada: textoDelGuion('a2p3', 'andar-sin-nada'),
    alcanceEnTramos: reparto.hayReparto ? reparto.alcanceEnTramos : null,
    tramosDeMas,
    dia,
  });
}

/**
 * Aceptar la oferta del estirón: se compone otra lista con **un tramo más de alcance**, y esa
 * segunda lista se ofrece igual que la primera.
 *
 * El mundo no se toca: el estirón alarga hasta dónde te mandan y nunca resiembra qué existe.
 */
export function aceptaElEstironDeHoy(peticion) {
  return componeLoQueHayHoy({ ...peticion, tramosDeMas: (peticion.tramosDeMas ?? 0) + TRAMOS_DEL_ESTIRON });
}

function lazoCerrado(lazo) {
  if (!lazo?.trazado) return false;
  const recorrido = lazo.recorrido ?? [];
  if (recorrido.length < 2) return false;
  const primero = recorrido[0];
  const ultimo = recorrido[recorrido.length - 1];
  return primero.x === ultimo.x && primero.y === ultimo.y;
}

/**
 * La ficha de una aventura de la lista.
 *
 * **Enseña la forma del lazo entera y nombra solo la primera parada**: así se juzga la
 * caminata —dónde cae, cuánto rodea, que vuelve— sin destripar la historia (`quests.md` §3).
 * El lazo va completo desde el principio y no se revela conforme se anda, porque esta pantalla
 * existe para decidir.
 *
 * Con un lazo que no cierra **falla**: SPEC-010 garantiza que todo lazo casteado cierra, y una
 * ficha que dijera «vuelves donde empiezas» sobre un lazo abierto estaría mintiendo.
 */
export function componeFicha({ entrada, gancho = null }) {
  if (!entrada || typeof entrada !== 'object') {
    throw new Error('la ficha se compone sobre una entrada de la lista de hoy y no llegó ninguna');
  }
  if (entrada.clase !== CLASES_DE_ENTRADA.AVENTURA) {
    throw new Error(`la entrada "${entrada.id}" es de clase "${entrada.clase}" y solo las aventuras tienen ficha: un recado se coge desde la lista`);
  }
  if (!lazoCerrado(entrada.lazo)) {
    throw new Error(
      `el lazo de la aventura "${entrada.id}" no cierra, así que no hay ficha que componer: ` +
      'la ficha dice «vuelves donde empiezas», y decirlo sobre un lazo abierto sería mentir',
    );
  }
  const beats = entrada.beats ?? [];
  if (!beats.length) {
    throw new Error(`la aventura "${entrada.id}" llega sin beats: sin ellos no hay paradas que dibujar ni primera que nombrar`);
  }
  const primera = beats[0].lugar?.nombre ?? null;
  if (!primera) {
    throw new Error(`la primera parada de "${entrada.id}" no tiene nombre, y es la única que la ficha rotula`);
  }

  return congelaHondo({
    bloques: [...BLOQUES_DE_LA_FICHA],
    id: entrada.id,
    titulo: entrada.titulo,
    // El lazo entero, con sus paradas numeradas y **solo la primera con nombre**.
    lazo: {
      recorrido: entrada.lazo.recorrido,
      cerrado: true,
      paradas: beats.map((b, i) => ({ n: i + 1, nombre: i === 0 ? b.lugar?.nombre ?? null : null })),
    },
    primeraParada: primera,
    // El del narrador si lo hubo, el de plantilla si no, y **la pantalla es la misma en los dos
    // casos**: quien pinta no puede distinguirlos, y por eso el origen viaja al lado y no dentro.
    gancho: {
      texto: gancho?.texto ?? entrada.gancho,
      origen: gancho?.origen ?? 'plantilla',
    },
    // La medida, el tiempo aproximado y «vuelves donde empiezas». Ninguna distancia.
    pie: `${entrada.medida} · ${textoDelGuion('a2p4', 'vuelves')}`,
    empiezas: textoConSitio('a2p4', 'empiezas', primera),
    acciones: [
      { id: 'ficha-aceptar', texto: textoDelGuion('a2p4', 'aceptar'), nivel: 'primero' },
      { id: 'ficha-otra-cosa', texto: textoDelGuion('a2p4', 'otra-cosa'), nivel: 'segundo' },
    ],
  });
}

/**
 * Aceptar una entrada de la lista: la aventura queda cogida y se pasa a la preparación.
 *
 * Tres cosas fallan nombrando lo que las provoca, en lugar de aceptar otra cosa en su lugar:
 * una entrada que ya no está en la lista compuesta, un recado ya aceptado en otra salida, y una
 * segunda aventura sobre una salida que ya tiene la suya.
 */
export function aceptaLaEntrada({ lista, id, salidas, entregas = null, mapaId = null, salida = null }) {
  const entradas = lista?.entradas ?? [];
  const entrada = entradas.find((e) => e.id === id);
  if (!entrada) {
    throw new Error(
      `la entrada "${id}" ya no está en la lista de hoy, que hoy trae ${entradas.length ? entradas.map((e) => `"${e.id}"`).join(', ') : 'ninguna'}: ` +
      'no se acepta una aventura distinta en su lugar',
    );
  }

  if (entrada.clase === CLASES_DE_ENTRADA.RECADO) {
    if (!entregas || !mapaId) {
      throw new Error(`el recado "${id}" se acepta contra la cola de entregas de su mapa, y no llegó ninguna`);
    }
    const viva = entradaDe(entregas, { mapaId, id });
    if (viva.aceptadaEn) {
      throw new Error(`el recado "${id}" ya se aceptó en la salida "${viva.aceptadaEn}": un recado se coge una vez`);
    }
  }

  const abierta = salidas ? salidaAbierta(salidas) : null;
  if (!abierta) {
    throw new Error(`no hay ninguna salida abierta en la que aceptar "${id}": la salida se abre antes de coger nada`);
  }
  // El orden importa: la salida se marca primero, así que si ya tenía aventura la cola de
  // entregas no se queda con un recado aceptado en una salida que no lo cogió.
  aceptaAventuraEnLaSalida(salidas, { aventura: entrada.id });
  if (entrada.clase === CLASES_DE_ENTRADA.RECADO) {
    aceptaRecado(entregas, { mapaId, id, salida: salida ?? abierta.salida });
  }

  return congelaHondo({
    aceptada: entrada.id,
    clase: entrada.clase,
    salida: salida ?? abierta.salida,
    // Lo siguiente es la preparación, y no hay ninguna otra puerta desde aquí.
    siguiente: 'preparacion',
  });
}
