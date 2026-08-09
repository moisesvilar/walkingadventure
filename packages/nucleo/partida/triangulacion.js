// La primera coincidencia: qué es coincidir, los tres estados del marcador de una
// sola vez, la composición de la escena de A6P3 y la regla de que ocurre una vez.
//
// La escena es el mejor truco del juego puesto en escena en lugar de explicado
// (`quests.md` decisión 3): la primera vez que alguien cuenta una segunda versión de
// algo ya apuntado, las dos se enseñan juntas, en el sitio, **sin explicar nada y sin
// decir cuál es la buena**. De ahí salen las tres reglas que este módulo defiende:
//
// - **Coincidir es un dato, no una comparación de prosa**: dos entradas del mismo
//   suceso con fuentes distintas. La identidad de suceso viaja en cada entrada desde
//   SPEC-016 precisamente para que esto no sea nunca un parecido entre textos.
// - **Los textos de la escena son los de las dos entradas**, no una redacción nueva.
//   Este módulo no escribe ni una versión: las localiza y las proyecta.
// - **Ni una marca sobre ninguna de las dos.** El orden lo decide el presente —arriba
//   la que se acaba de oír, porque la escena ocurre en el sitio—, y ninguna lleva
//   nivel, etiqueta ni tipografía propia: la proyección de SPEC-016 no trae el nivel,
//   así que la pantalla no puede pintarlo aunque quiera.

import { congelaHondo } from '../core/congelar.js';
import { claveDeEntrada, entradasDeSuceso, proyeccion } from './diario.js';
import { exigeMapaId } from './pasos.js';

/**
 * Los tres estados del marcador de una sola vez, en el orden en que se recorren.
 *
 * Tres y no dos, y es la decisión de esta fila: la escena ocurre en la calle, con el
 * móvil en la mano. Con dos estados, cerrar la app entre detectar la coincidencia y
 * enseñar la escena tenía dos finales igual de malos —la vista por historias abierta
 * sin haber visto la escena, que regala el truco, o la escena perdida para siempre— y
 * los dos ocurrían sin que nada protestara. Con tres, **la escena se debe y se paga en
 * la siguiente llegada**, con las dos mismas versiones.
 */
export const ESTADOS_DEL_MARCADOR = Object.freeze({ NUNCA: 'nunca', PENDIENTE: 'pendiente', HECHO: 'hecho' });

/** Los tres identificadores, en el orden del recorrido y no alfabético. */
export const IDS_DE_ESTADO_DEL_MARCADOR = congelaHondo([
  ESTADOS_DEL_MARCADOR.NUNCA,
  ESTADOS_DEL_MARCADOR.PENDIENTE,
  ESTADOS_DEL_MARCADOR.HECHO,
]);

/** La única acción de la escena, la que la cierra. Una, y no hay manera de descartarla. */
export const ACCIONES_DE_LA_ESCENA = congelaHondo(['apuntarlo']);

/**
 * Lo que la escena **no** dice, como lista cerrada de palabras.
 *
 * «No explica que las noticias se deforman» y «no dice cuál es la buena» son las dos
 * mitades de la decisión de diseño, y comprobadas a ojo no se ponen rojas nunca
 * (`pipeline/decisiones-orquestador.md` §6o). Con la lista, se comprueban sobre todo
 * lo que este módulo produce. Si algún día un texto legítimo necesitara una de estas
 * palabras, se cambia la lista y se dice por qué — que es justo el debate que toca.
 */
export const PALABRAS_QUE_LA_ESCENA_NO_DICE = congelaHondo([
  'deform', 'exager', 'se tuerce', 'torcid', 'nivel', 'fiabilidad', 'fiable',
  'verdad', 'verdader', 'falso', 'mentira', 'correct', 'incorrect', 'exact',
  'la buena', 'la mala', 'rumor',
]);

/**
 * Los textos de la escena. **Ninguno lleva una cifra escrita a mano**: los dos que
 * hablan de tiempo y de sitio son fórmulas que se componen al pintar.
 *
 * Son de esta capa y no del narrador porque son marco y no relato: lo que se cuenta
 * son las dos versiones, que vienen del diario tal como se oyeron.
 */
export const TEXTOS = congelaHondo({
  antetitulo: (nucleo) => `En ${nucleo} se habla de`,
  aqui: 'Aquí, hoy',
  alla: (sitio, dias) => (dias === 0 ? `En ${sitio}, hoy` : dias === 1 ? `En ${sitio}, ayer` : `En ${sitio}, hace ${dias} días`),
  entreLasDos: '— esto ya lo habías oído —',
  remate: 'No así.',
  apuntarlo: 'Apuntarlo',
});

/** Las palabras prohibidas que un texto de la escena contiene, si contiene alguna. */
export function infraccionesDeLaEscena(texto) {
  if (typeof texto !== 'string') {
    throw new Error(`la revisión de la escena necesita un texto y llegó ${JSON.stringify(texto) ?? String(texto)}`);
  }
  const plano = texto.toLowerCase();
  return congelaHondo(PALABRAS_QUE_LA_ESCENA_NO_DICE.filter((p) => plano.includes(p)));
}

function exigeDiarioConMarcador(diario) {
  if (!diario || typeof diario !== 'object' || !Array.isArray(diario.entradas)) {
    throw new Error('el estado del diario llega mal formado: se espera lo que devuelve estadoDeDiario(), con "entradas", "triangulado" y "escena"');
  }
  return diario;
}

/**
 * En cuál de los tres estados está el marcador.
 *
 * Se **deriva** del par marcador-escena en lugar de guardarse aparte: un tercer campo
 * con el nombre del estado podría desincronizarse de los otros dos, que es la doble
 * verdad que SPEC-016 existe para no repetir.
 */
export function estadoDelMarcador(diario) {
  exigeDiarioConMarcador(diario);
  const escena = diario.escena ?? null;
  if (diario.triangulado !== true || escena === null) return ESTADOS_DEL_MARCADOR.NUNCA;
  return escena.vista === true ? ESTADOS_DEL_MARCADOR.HECHO : ESTADOS_DEL_MARCADOR.PENDIENTE;
}

/**
 * Si el diario se puede leer también por historias: **si y solo si el marcador está
 * en `hecho`**.
 *
 * En `pendiente` no, y no es un descuido: el escenario dice «un jugador que acaba de
 * triangular», y triangular es haber visto las dos versiones juntas, no que el código
 * lo haya notado.
 */
export function hayVistaPorHistorias(diario) {
  return estadoDelMarcador(diario) === ESTADOS_DEL_MARCADOR.HECHO;
}

/**
 * La primera coincidencia que traen unas entradas recién apuntadas, o `null`.
 *
 * **Coincidir es tener dos entradas del mismo suceso con fuentes distintas**: no que
 * dos textos se parezcan, no que dos versiones hablen del mismo pueblo y no que
 * tengan niveles distintos. Volver al mismo núcleo no coincide, porque SPEC-016 no
 * añade una segunda entrada; la versión de un testigo directo sí, porque la fuente es
 * otra y entra aparte.
 *
 * Los dos criterios de desempate están declarados y son estables: entre varias
 * entradas nuevas que coincidan gana **la primera en el orden en que se oyeron**, y
 * entre varias anteriores del mismo suceso, **la última que se había oído**, que es la
 * que quien juega tiene más fresca.
 */
export function coincidencia(diario, { mapaId, nuevas }) {
  exigeDiarioConMarcador(diario);
  const id = exigeMapaId(mapaId, 'buscar la primera coincidencia del diario');
  if (!Array.isArray(nuevas)) {
    throw new Error(`la búsqueda de coincidencia necesita las entradas recién apuntadas y llegó ${JSON.stringify(nuevas) ?? String(nuevas)}: una lista vacía es una respuesta`);
  }
  for (const nueva of nuevas) {
    if (nueva.mapa !== id) continue;
    const previas = entradasDeSuceso(diario, { mapaId: id, suceso: nueva.suceso }).filter((e) => e.id !== nueva.id);
    if (previas.length === 0) continue;
    return congelaHondo({ mapa: id, suceso: nueva.suceso, nueva, previa: previas[previas.length - 1] });
  }
  return null;
}

/**
 * Enciende el marcador y guarda qué dos versiones componen la escena.
 *
 * Solo desde `nunca`: encenderlo dos veces sería contar dos primeras veces, y desde
 * `hecho` sería reabrir una escena que ya se leyó. Las dos fallan nombrando el estado
 * en el que está, en vez de dejar pasar la segunda en silencio.
 */
export function anotaLaCoincidencia(diario, laCoincidencia) {
  const estaba = estadoDelMarcador(diario);
  if (estaba !== ESTADOS_DEL_MARCADOR.NUNCA) {
    throw new Error(`el marcador de la primera coincidencia ya está en "${estaba}" y solo se enciende desde "${ESTADOS_DEL_MARCADOR.NUNCA}": la escena ocurre una sola vez en toda la partida`);
  }
  if (!laCoincidencia || typeof laCoincidencia !== 'object') {
    throw new Error('encender el marcador necesita la coincidencia que lo justifica, la que devuelve coincidencia()');
  }
  const { mapa, suceso, nueva, previa } = laCoincidencia;
  if (nueva?.suceso !== suceso || previa?.suceso !== suceso) {
    throw new Error(`las dos versiones de la escena tienen que ser del mismo suceso y llegaron "${nueva?.suceso}" y "${previa?.suceso}": coincidir es tener dos versiones del mismo suceso`);
  }
  if (nueva.id === previa.id) {
    throw new Error(`las dos versiones de la escena del suceso "${suceso}" son la misma entrada: dos versiones son dos fuentes distintas`);
  }
  diario.triangulado = true;
  diario.escena = {
    mapa: exigeMapaId(mapa, 'la escena de la primera coincidencia'),
    suceso,
    nueva: { tipo: nueva.fuente.tipo, sitio: nueva.fuente.sitio, puesto: nueva.fuente.puesto ?? null },
    previa: { tipo: previa.fuente.tipo, sitio: previa.fuente.sitio, puesto: previa.fuente.puesto ?? null },
    vista: false,
  };
  return estadoDelMarcador(diario);
}

/** La escena que se debe, tal como está guardada, o `null` si no se debe ninguna. */
export function laEscenaQueSeDebe(diario) {
  if (estadoDelMarcador(diario) !== ESTADOS_DEL_MARCADOR.PENDIENTE) return null;
  return congelaHondo({ ...diario.escena });
}

/** La entrada de la escena por su fuente, o un error que nombra la que falta. */
function entradaDeLaEscena(diario, escena, cual) {
  const clave = claveDeEntrada({ mapa: escena.mapa, suceso: escena.suceso, fuente: escena[cual] });
  const entrada = diario.entradas.find((e) => e.id === clave);
  if (!entrada) {
    throw new Error(`la escena de la primera coincidencia del suceso "${escena.suceso}" no encuentra en el diario su versión ${cual} (${escena[cual].tipo} de ${escena[cual].sitio}): la escena se debe y sus dos versiones tienen que seguir apuntadas`);
  }
  return entrada;
}

/**
 * Compone la escena de A6P3, o `null` si no hay ninguna que enseñar.
 *
 * **Ocurre donde se oyó la segunda versión**, no donde se abre el diario: el sitio de
 * la escena sale de la entrada y no de quien llama, de modo que una escena que se
 * quedó a deber se enseña luego con el mismo sitio y las mismas dos versiones.
 *
 * Las dos versiones salen de la proyección de SPEC-016 —sin nivel, sin signo de
 * fidelidad y sin nada derivado de ellos—, con sus textos, que son los de las dos
 * entradas y no una redacción nueva.
 */
export function componeLaEscena(diario, { dia }) {
  const escena = laEscenaQueSeDebe(diario);
  if (!escena) return null;
  if (!Number.isInteger(dia) || dia < 0) {
    throw new Error(`componer la escena necesita el día de diario en el que se enseña y llegó ${JSON.stringify(dia) ?? String(dia)}: «hace cuántos días» se compone al pintar y nunca se guarda`);
  }
  const nueva = entradaDeLaEscena(diario, escena, 'nueva');
  const previa = entradaDeLaEscena(diario, escena, 'previa');
  const [proyectadaNueva, proyectadaPrevia] = proyeccion([nueva, previa]);
  const hace = Math.max(0, dia - previa.dia);

  return congelaHondo({
    // El momento del bucle donde ocurre: al parar, en la llegada a un núcleo, y nunca
    // al abrir el diario en casa. Va en el dato para que se pueda afirmar sin pantalla.
    momento: 'al-parar',
    sitio: nueva.lugar,
    suceso: escena.suceso,
    antetitulo: TEXTOS.antetitulo(nueva.lugar),
    // Arriba la que se acaba de oír, porque la escena ocurre en el sitio y el sitio es
    // el presente; poner arriba la antigua leería como una corrección, que es
    // exactamente lo que el diario no hace nunca.
    versiones: [
      { ...proyectadaNueva, cuando: TEXTOS.aqui, hace: 0, aqui: true },
      { ...proyectadaPrevia, cuando: TEXTOS.alla(previa.lugar, hace), hace, aqui: false },
    ],
    entreLasDos: TEXTOS.entreLasDos,
    remate: TEXTOS.remate,
    // Una sola acción, la que la cierra. Ni gesto de descarte, ni botón de atrás: el
    // valor entero de la escena está en que se lea, y ocurre una vez en toda la partida.
    acciones: ACCIONES_DE_LA_ESCENA.map((id) => ({ id, texto: TEXTOS.apuntarlo })),
    sePuedeSaltar: false,
    sePuedeDescartar: false,
  });
}

/**
 * Cierra la escena: `pendiente` → `hecho`, y con ella se abre la vista por historias.
 *
 * Es la única transición que existe hacia `hecho`, y **no hay ninguna que vuelva**:
 * este módulo no exporta nada que devuelva el marcador a `pendiente` ni a `nunca`.
 */
export function cierraLaEscena(diario) {
  const estaba = estadoDelMarcador(diario);
  if (estaba !== ESTADOS_DEL_MARCADOR.PENDIENTE) {
    throw new Error(`no hay ninguna escena de primera coincidencia esperando: el marcador está en "${estaba}" y solo se cierra desde "${ESTADOS_DEL_MARCADOR.PENDIENTE}"`);
  }
  diario.escena = { ...diario.escena, vista: true };
  return estadoDelMarcador(diario);
}
