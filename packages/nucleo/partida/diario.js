// El diario: la entrada, su clave, la regla de no sobrescribir, la consulta por
// días y por suceso, y la proyección que consumen las pantallas.
//
// Tiene una propiedad rara que hay que defender de la tentación de arreglarla:
// **registra lo oído, no lo cierto**. Si a alguien le contaron que fueron tres
// campanas y en realidad fue una, aquí quedan tres campanas, con el sitio donde se
// lo contaron y el momento en que se lo contaron. Oír después la versión buena **no
// corrige la entrada anterior**: se añade otra, y ninguna se marca como correcta. De
// ahí sale sin tutorial el mejor truco del juego —triangular comparando tu propio
// diario— y por eso el **nivel de deformación viaja en el dato y no llega a pantalla
// en ningún sitio** (`quests.md` decisión 3, RF-DIARIO-001).
//
// El lugar es siempre el identificador de un sitio del mundo congelado y el momento
// es siempre día de diario más paso del mundo: ni una coordenada, ni un reloj.

import { congelaHondo } from '../core/congelar.js';
import { exigeNivel, exigeSigno } from './deformacion.js';
import { campos, dic, escribe, lista, uno } from './formato.js';
import { ESQUEMA_HECHOS_DE_RUMOR } from './hechos.js';
import { exigeMapaId } from './pasos.js';
import { exigeCara } from './puestos.js';

/**
 * Las dos clases de entrada.
 *
 * «Lo propio» existe en el contenedor desde aquí y **la escribe la fila 36**:
 * RF-DIARIO-005 pide que lo propio vaya en primera persona y lo oído aparte con
 * distinta autoridad, y admitirlo ya evita que el telón tenga que renegociar el
 * formato. Esta spec solo especifica «lo oído».
 */
export const CLASES_DE_ENTRADA = Object.freeze({ OIDO: 'lo-oido', PROPIO: 'lo-propio' });

/** Los identificadores de clase, en orden estable. */
export const IDS_DE_CLASE_DE_ENTRADA = congelaHondo(Object.values(CLASES_DE_ENTRADA).slice().sort());

/** Las dos familias de fuente: el pueblo que lo cuenta, o la cara que lo cuenta. */
export const FUENTES = Object.freeze({ NUCLEO: 'nucleo', CARA: 'cara' });

/** Los identificadores de fuente, en orden estable. */
export const IDS_DE_FUENTE = congelaHondo(Object.values(FUENTES).slice().sort());

// El separador de la clave, por lo mismo que en `puestos.js`: un carácter de
// control no aparece en ningún nombre del mundo, así que dos entradas no pueden
// colisionar porque un pueblo se llame como se llame.
const SEPARADOR = String.fromCharCode(0);

/**
 * El estado del diario de una partida.
 *
 * `triangulado` es el **marcador de una sola vez** que SPEC-016 reservó y que
 * SPEC-037 enciende, y `escena` es lo que hace que el marcador tenga **tres estados
 * y no dos**: `nunca` (marcador apagado y sin escena), `pendiente` (encendido, con
 * las dos versiones que la componen guardadas y sin enseñar) y `hecho` (enseñada y
 * cerrada). Quién lee y quién escribe esos tres estados es de `triangulacion.js`;
 * aquí solo viven el hueco y su forma.
 *
 * El estado intermedio existe porque la escena ocurre en la calle: con dos estados,
 * cerrar la app entre detectarla y enseñarla o regalaba la vista por historias sin
 * la escena o perdía la escena para siempre, y las dos cosas en silencio.
 *
 * La escena guarda **la identidad de sus dos versiones y no una copia de ellas**: el
 * mapa, el suceso y las dos fuentes bastan para recomponer las dos entradas por su
 * clave, y copiarlas sería tener dos veces el mismo dato pudiendo desincronizarse.
 */
export function estadoDeDiario() {
  return { entradas: [], triangulado: false, escena: null };
}

/** El área de textos del estado: cada texto una sola vez, por su clave. */
export function estadoDeTextos() {
  return { textos: {} };
}

// --- La entrada -------------------------------------------------------------

/** Una referencia a fuente bien formada: el núcleo que lo contó, o la cara que lo contó. */
export function exigeFuente(fuente, quien = 'la fuente de una entrada del diario') {
  if (!fuente || typeof fuente !== 'object') {
    throw new Error(`${quien} llega como ${JSON.stringify(fuente) ?? String(fuente)}: se espera { tipo: "nucleo" | "cara", sitio, puesto }`);
  }
  if (!IDS_DE_FUENTE.includes(fuente.tipo)) {
    throw new Error(`${quien} declara el tipo ${JSON.stringify(fuente.tipo) ?? String(fuente.tipo)}, que no está en el enumerado cerrado (${IDS_DE_FUENTE.join(', ')})`);
  }
  if (fuente.tipo === FUENTES.CARA) {
    const cara = exigeCara({ sitio: fuente.sitio, puesto: fuente.puesto }, quien);
    return congelaHondo({ tipo: FUENTES.CARA, sitio: cara.sitio, puesto: cara.puesto });
  }
  if (typeof fuente.sitio !== 'string' || !fuente.sitio) {
    throw new Error(`${quien} no dice qué núcleo lo contó: llegó ${JSON.stringify(fuente.sitio) ?? String(fuente.sitio)}`);
  }
  return congelaHondo({ tipo: FUENTES.NUCLEO, sitio: fuente.sitio, puesto: null });
}

/**
 * La clave de una entrada: **suceso + fuente**.
 *
 * Es lo que hace que volver al mismo sitio no duplique nada —cada núcleo oye una
 * sola versión y no cambia (SPEC-012)— y, a la vez, que la versión de un testigo
 * directo entre como entrada aparte en lugar de pisar la del pueblo, que es lo que
 * el escenario de «Vilanova» exige. Con la clave en el suceso a secas, oír la
 * versión fiel machacaría la torcida y no habría nada que triangular.
 */
export function claveDeEntrada({ mapa, suceso, fuente }) {
  const f = exigeFuente(fuente);
  return [mapa, suceso, f.tipo, f.sitio, f.puesto ?? ''].join(SEPARADOR);
}

/**
 * Una entrada del diario, normalizada y comprobada.
 *
 * El **nivel y el signo se guardan** porque el código los necesita para agrupar,
 * auditar y reconstruir; lo que no se hace es proyectarlos (ver `proyeccion`). Un
 * nivel fuera del rango de cero a tres falla nombrando el valor recibido, y lo hace
 * aquí —al apuntar— y no al leer.
 */
export function entradaDeDiario({
  mapa,
  clase = CLASES_DE_ENTRADA.OIDO,
  suceso,
  fuente,
  lugar,
  dia,
  paso,
  hechos,
  nivel,
  signo,
  plantilla = null,
  origen = null,
  texto = null,
}) {
  const id = exigeMapaId(mapa, 'una entrada del diario');
  if (!IDS_DE_CLASE_DE_ENTRADA.includes(clase)) {
    throw new Error(`una entrada del diario llega con la clase ${JSON.stringify(clase) ?? String(clase)}, que no está en el enumerado cerrado (${IDS_DE_CLASE_DE_ENTRADA.join(', ')})`);
  }
  if (typeof suceso !== 'string' || !suceso) {
    throw new Error(
      `una entrada del diario llega sin identidad de suceso (${JSON.stringify(suceso) ?? String(suceso)}): ` +
      'es lo que permite agrupar dos versiones de lo mismo sin comparar ni un texto, que es todo lo que la fila 37 necesita de aquí',
    );
  }
  const laFuente = exigeFuente(fuente, `la fuente de la entrada del suceso "${suceso}"`);
  if (typeof lugar !== 'string' || !lugar) {
    throw new Error(
      `la entrada del suceso "${suceso}" no dice dónde se oyó: llegó ${JSON.stringify(lugar) ?? String(lugar)}. ` +
      'El lugar es el identificador de un sitio del mundo congelado y nunca una coordenada',
    );
  }
  if (!Number.isInteger(dia) || dia < 0 || !Number.isInteger(paso) || paso < 0) {
    throw new Error(
      `la entrada del suceso "${suceso}" no dice cuándo se oyó: llegaron dia=${JSON.stringify(dia) ?? String(dia)} y paso=${JSON.stringify(paso) ?? String(paso)}. ` +
      'El momento es el día de diario y el paso del mundo, y nunca una marca del reloj real',
    );
  }
  return congelaHondo({
    id: claveDeEntrada({ mapa: id, suceso, fuente: laFuente }),
    mapa: id,
    clase,
    suceso,
    fuente: laFuente,
    lugar,
    dia,
    paso,
    hechos,
    nivel: exigeNivel(nivel, `el nivel de la entrada del suceso "${suceso}"`),
    signo: exigeSigno(signo, `el signo de la entrada del suceso "${suceso}"`),
    plantilla,
    origen,
    // La referencia al texto que la cuenta, **por clave y nunca copiado**: el texto
    // vive una sola vez en el área de textos del estado. Nulo significa que todavía
    // no hay redacción y la entrada cae al texto de la plantilla, que es para lo que
    // lleva de qué plantilla salió; el dato ya está completo sin él.
    texto,
  });
}

/**
 * El esquema cerrado de una entrada. Se exporta porque es también su medida.
 *
 * **La clave no se escribe**: sale de concatenar el mapa, el suceso y la fuente, que
 * ya están en la entrada, y guardarla era repetir setenta bytes por entrada de algo
 * que se deriva. `levantaDiario` la recompone.
 */
const ESQUEMA_FUENTE = campos({ tipo: 'texto', sitio: 'texto', puesto: 'texto?' });

export const ESQUEMA_ENTRADA = campos({
  mapa: 'texto',
  clase: 'texto',
  suceso: 'texto',
  fuente: ESQUEMA_FUENTE,
  lugar: 'texto',
  dia: 'entero',
  paso: 'entero',
  hechos: ESQUEMA_HECHOS_DE_RUMOR,
  nivel: 'entero',
  signo: 'texto',
  plantilla: 'texto?',
  origen: 'texto?',
  texto: 'texto?',
});

// La escena que se debe: qué dos versiones la componen y si ya se enseñó. Nulo
// mientras el marcador está en `nunca`, que es la única combinación además de las
// dos legítimas —encendido con escena sin enseñar, y encendido con escena enseñada.
const ESQUEMA_ESCENA = campos({
  mapa: 'texto',
  suceso: 'texto',
  nueva: ESQUEMA_FUENTE,
  previa: ESQUEMA_FUENTE,
  vista: 'booleano',
});

/** El área del diario dentro del estado. */
export const ESQUEMA_DIARIO = campos({
  entradas: lista(ESQUEMA_ENTRADA),
  triangulado: 'booleano',
  escena: uno([ESQUEMA_ESCENA, 'nulo']),
});

/** El área de textos del estado: cada texto una vez, por su clave. */
export const ESQUEMA_TEXTOS = campos({ textos: dic(campos({ clave: 'texto', texto: 'texto', origen: 'texto' })) });

/** La entrada tal como se escribe, sin la clave derivada ni el texto que la cuenta. */
function documentoDeEntrada(e) {
  return {
    mapa: e.mapa,
    clase: e.clase,
    suceso: e.suceso,
    fuente: { tipo: e.fuente.tipo, sitio: e.fuente.sitio, puesto: e.fuente.puesto ?? null },
    lugar: e.lugar,
    dia: e.dia,
    paso: e.paso,
    hechos: e.hechos,
    nivel: e.nivel,
    signo: e.signo,
    plantilla: e.plantilla ?? null,
    origen: e.origen ?? null,
    texto: e.texto ?? null,
  };
}

/** Cuánto ocupa una entrada en su forma canónica. El presupuesto son 500 bytes. */
export function bytesDeEntrada(entrada) {
  return escribe(documentoDeEntrada(entrada), ESQUEMA_ENTRADA, `la entrada "${entrada?.id ?? '(sin clave)'}"`).length;
}

// --- Apuntar, que solo añade -------------------------------------------------

// El único orden que existe es **cuándo se oyó**. No hay orden por nivel ni por
// fidelidad, y no es un olvido: `quests.md` decisión 3 dice que ordenar de más fiel
// a más torcida sería enseñar el nivel por la puerta de atrás. La clave desempata
// para que dos entradas del mismo paso tengan un orden declarado.
const porMomento = (a, b) => (a.dia !== b.dia ? a.dia - b.dia : a.paso !== b.paso ? a.paso - b.paso : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function exigeDiario(estado) {
  if (!estado || typeof estado !== 'object' || !Array.isArray(estado.entradas)) {
    throw new Error('el estado del diario llega mal formado: se espera lo que devuelve estadoDeDiario(), un objeto con "entradas" y "triangulado"');
  }
  return estado;
}

/**
 * Cómo quedaría el diario al apuntar una entrada, **sin tocar nada**.
 *
 * Existe para que el cierre de una salida se aplique entero o no se aplique: quien
 * llama calcula todo primero y escribe después.
 */
export function planDeApunte(estado, entrada) {
  exigeDiario(estado);
  const suya = entradaDeDiario(entrada);
  const ya = estado.entradas.find((e) => e.id === suya.id);
  // Ya apuntada por esta misma fuente: **no se añade una segunda y no se reescribe
  // la primera**. Volver al mismo pueblo no aporta nada nuevo porque su versión no
  // cambia (SPEC-012), y reescribirla sería empezar a corregir el diario.
  if (ya) return { nueva: false, entrada: ya, entradas: estado.entradas.slice() };
  return { nueva: true, entrada: suya, entradas: [...estado.entradas, suya].sort(porMomento) };
}

/**
 * Apunta una entrada. **No sobrescribe nunca**: oír una versión mejor de algo ya
 * apuntado añade otra entrada, y las dos quedan, con su lugar y su momento intactos.
 * Ninguna se marca como correcta, porque el diario no sabe cuál lo es.
 */
export function apunta(estado, entrada) {
  const plan = planDeApunte(estado, entrada);
  estado.entradas = plan.entradas;
  return plan.entrada;
}

/** El hecho que una entrada deja en el registro, para que lo oído se pueda reconstruir. */
export function hechoDeEntrada(entrada) {
  return {
    tipo: 'version-oida',
    mapa: entrada.mapa,
    dia: entrada.dia,
    paso: entrada.paso,
    carga: {
      suceso: entrada.suceso,
      fuenteTipo: entrada.fuente.tipo,
      fuenteSitio: entrada.fuente.sitio,
      fuentePuesto: entrada.fuente.puesto ?? null,
      lugar: entrada.lugar,
      nivel: entrada.nivel,
      signo: entrada.signo,
      plantilla: entrada.plantilla ?? null,
      origen: entrada.origen ?? null,
      texto: entrada.texto ?? null,
      hechos: entrada.hechos,
    },
  };
}

/** La entrada que reconstruye un hecho `version-oida`. Es la inversa exacta. */
export function entradaDeHecho(h) {
  return entradaDeDiario({
    mapa: h.mapa,
    clase: CLASES_DE_ENTRADA.OIDO,
    suceso: h.carga.suceso,
    fuente: { tipo: h.carga.fuenteTipo, sitio: h.carga.fuenteSitio, puesto: h.carga.fuentePuesto },
    lugar: h.carga.lugar,
    dia: h.dia,
    paso: h.paso,
    hechos: h.carga.hechos,
    nivel: h.carga.nivel,
    signo: h.carga.signo,
    plantilla: h.carga.plantilla,
    origen: h.carga.origen,
    texto: h.carga.texto,
  });
}

// --- Las dos puertas por las que entra lo oído -------------------------------

/**
 * Apunta lo que se cuenta en un núcleo al llegar a él.
 *
 * **Copia lo que sedimentó, no lo que ocurrió**: aquí no se propaga, no se deforma y
 * no se recalcula ningún nivel. Un núcleo donde no se cuenta nada no apunta nada y
 * no falla — no haber nada que contar es una respuesta.
 *
 * Devuelve las entradas nuevas y los hechos que hay que anexar al registro, y no
 * escribe ni uno: quien cierra la salida anexa el registro **antes** de escribir el
 * estado, y esa frontera es de `reconstruccion.js`.
 */
export function apuntaLoQueSeCuenta({ diario, versiones, mapaId, nucleo, dia, paso }) {
  exigeDiario(diario);
  const id = exigeMapaId(mapaId, 'apuntar en el diario lo que se cuenta en un núcleo');
  if (typeof nucleo !== 'string' || !nucleo) {
    throw new Error(`apuntar lo que se cuenta necesita el identificador del núcleo y llegó ${JSON.stringify(nucleo) ?? String(nucleo)}`);
  }
  const nuevas = [];
  // Se construyen todas primero y se escriben después: un nivel fuera de rango en la
  // tercera versión no puede dejar dos apuntadas y una perdida.
  const planes = (versiones ?? []).map((v) => planDeApunte(diario, {
    mapa: id,
    clase: CLASES_DE_ENTRADA.OIDO,
    suceso: v.rumor,
    fuente: { tipo: FUENTES.NUCLEO, sitio: nucleo },
    lugar: nucleo,
    dia,
    paso,
    hechos: v.hechos,
    nivel: v.nivel,
    signo: v.signo,
    plantilla: v.plantilla ?? null,
    origen: v.origen ?? null,
    texto: v.texto ?? null,
  }));
  for (const plan of planes) {
    if (!plan.nueva) continue;
    apunta(diario, plan.entrada);
    nuevas.push(plan.entrada);
  }
  return congelaHondo({ entradas: nuevas, hechos: nuevas.map(hechoDeEntrada) });
}

/**
 * Apunta lo que cuenta un testigo directo.
 *
 * Entra como **una entrada más**, con su lugar y su momento, y **no se marca como
 * correcta ni corrige la del pueblo**: es nivel 0 por construcción (SPEC-014) y con
 * la fuente en la clave convive con la versión torcida en lugar de pisarla. Que las
 * dos quepan es literalmente lo que hace posible triangular.
 */
export function apuntaLoQueCuentaUnTestigo({ diario, cara, hechos, mapaId, dia, paso, nivel = 0 }) {
  exigeDiario(diario);
  const id = exigeMapaId(mapaId, 'apuntar en el diario lo que cuenta un testigo');
  const quien = exigeCara(cara, 'la cara que cuenta lo que vivió');
  const planes = (hechos ?? []).map((h) => planDeApunte(diario, {
    mapa: id,
    clase: CLASES_DE_ENTRADA.OIDO,
    suceso: h.id,
    fuente: { tipo: FUENTES.CARA, sitio: quien.sitio, puesto: quien.puesto },
    // El lugar es el sitio donde está la cara, que es donde se oyó. Nunca dónde
    // ocurrió: el diario apunta dónde te lo contaron.
    lugar: quien.sitio,
    dia,
    paso,
    hechos: h.hechos,
    nivel: h.nivel ?? nivel,
    signo: h.signo,
    plantilla: h.plantilla ?? null,
    origen: h.origen ?? null,
    texto: null,
  }));
  const nuevas = [];
  for (const plan of planes) {
    if (!plan.nueva) continue;
    apunta(diario, plan.entrada);
    nuevas.push(plan.entrada);
  }
  return congelaHondo({ entradas: nuevas, hechos: nuevas.map(hechoDeEntrada) });
}

// --- Leer --------------------------------------------------------------------

/** El diario de un mapa, por días. Un diario sin ninguna entrada da una lista vacía. */
export function entradasDe(estado, { mapaId = null } = {}) {
  exigeDiario(estado);
  const suyas = mapaId === null ? estado.entradas : estado.entradas.filter((e) => e.mapa === mapaId);
  return congelaHondo(suyas.slice().sort(porMomento));
}

/** Las entradas de un suceso, en el orden en que se oyeron y en ningún otro. */
export function entradasDeSuceso(estado, { mapaId = null, suceso }) {
  return congelaHondo(entradasDe(estado, { mapaId }).filter((e) => e.suceso === suceso));
}

/**
 * Los sucesos de los que ya hay más de una versión apuntada.
 *
 * **Se responde por identidad de suceso, sin leer ningún texto.** Eso es todo lo que
 * la fila 37 necesita de aquí: detectar que dos entradas hablan de lo mismo es una
 * consulta sobre datos, no una comparación de prosa.
 */
export function sucesosConVariasVersiones(estado, { mapaId = null } = {}) {
  const cuenta = new Map();
  for (const e of entradasDe(estado, { mapaId })) cuenta.set(e.suceso, (cuenta.get(e.suceso) ?? 0) + 1);
  return congelaHondo([...cuenta.keys()].filter((s) => cuenta.get(s) > 1).sort());
}

/** Si un suceso tiene ya dos versiones apuntadas. */
export function tieneVariasVersiones(estado, { mapaId = null, suceso }) {
  return entradasDeSuceso(estado, { mapaId, suceso }).length > 1;
}

/**
 * La proyección de lectura que consumen las pantallas del diario: **sin el nivel**.
 *
 * Ni el nivel, ni un porcentaje, ni una etiqueta de fiabilidad, ni un orden por
 * fidelidad: no hay con qué enseñarlo. El design system lo dice con todas las letras
 * y sostener «el nivel no sale nunca a pantalla» es mucho más barato si el dato no
 * llega hasta allí que si llega y se confía en que nadie lo pinte — el mismo
 * argumento con el que SPEC-012 no se lo entrega a quien pinta.
 *
 * El signo sí viaja: es si el acto fue bueno o feo, no cuánto se ha torcido el
 * cuento, y las pantallas lo necesitan para hablar con el tono que toca.
 */
export function proyeccion(entradas) {
  const lista = Array.isArray(entradas) ? entradas : [entradas];
  return congelaHondo(lista.map((e) => ({
    id: e.id,
    mapa: e.mapa,
    clase: e.clase,
    suceso: e.suceso,
    fuente: { tipo: e.fuente.tipo, sitio: e.fuente.sitio, puesto: e.fuente.puesto },
    lugar: e.lugar,
    dia: e.dia,
    paso: e.paso,
    signo: e.signo,
    hechos: e.hechos,
    plantilla: e.plantilla,
    texto: e.texto,
  })));
}

/** El diario de un mapa proyectado por días, que es la vista con la que empieza la partida. */
export function proyeccionPorDias(estado, { mapaId = null } = {}) {
  return proyeccion(entradasDe(estado, { mapaId }));
}

/** Las versiones de un suceso proyectadas, en el orden en que se oyeron. */
export function proyeccionDeSuceso(estado, { mapaId = null, suceso }) {
  return proyeccion(entradasDeSuceso(estado, { mapaId, suceso }));
}

// --- Los textos, que viven una sola vez --------------------------------------

/** Los orígenes declarados de un texto de juego, los mismos que dentro del documento de celda. */
export const ORIGENES_DE_TEXTO = congelaHondo(['llm', 'plantilla']);

/**
 * Guarda un texto del narrador **por su clave y una sola vez**.
 *
 * Es el mismo trato que SPEC-009 le da dentro del documento de celda; copiarlo en
 * cada entrada que lo cuenta multiplicaría por entradas lo único de la partida que
 * pesa de verdad. Guardarlo dos veces con la misma clave deja el primero.
 */
export function guardaTexto(estado, { clave, texto, origen }) {
  if (!estado || typeof estado !== 'object' || !estado.textos || typeof estado.textos !== 'object') {
    throw new Error('el área de textos llega mal formada: se espera lo que devuelve estadoDeTextos(), un objeto con "textos"');
  }
  if (typeof clave !== 'string' || !clave) {
    throw new Error(`un texto del narrador se guarda por su clave y llegó ${JSON.stringify(clave) ?? String(clave)}`);
  }
  if (typeof texto !== 'string') {
    throw new Error(`el texto "${clave}" llega como ${JSON.stringify(texto) ?? String(texto)} y se espera una cadena`);
  }
  if (!ORIGENES_DE_TEXTO.includes(origen)) {
    throw new Error(`el texto "${clave}" declara el origen ${JSON.stringify(origen) ?? String(origen)}, que no está en el enumerado cerrado (${ORIGENES_DE_TEXTO.join(', ')})`);
  }
  if (Object.prototype.hasOwnProperty.call(estado.textos, clave)) return estado.textos[clave];
  estado.textos[clave] = congelaHondo({ clave, texto, origen });
  return estado.textos[clave];
}

/** El texto que cuenta una entrada, o `null` si todavía no hay redacción. */
export function textoDe(estado, entrada) {
  if (!entrada?.texto) return null;
  return estado?.textos?.[entrada.texto] ?? null;
}

// --- Serialización ------------------------------------------------------------

/** La escena que se debe, en su forma canónica, o `null` si el marcador nunca se encendió. */
function documentoDeEscena(escena) {
  if (escena == null) return null;
  const fuente = (f, cual) => {
    const suya = exigeFuente(f, `la ${cual} de la escena de la primera coincidencia`);
    return { tipo: suya.tipo, sitio: suya.sitio, puesto: suya.puesto ?? null };
  };
  return {
    mapa: exigeMapaId(escena.mapa, 'la escena de la primera coincidencia'),
    suceso: escena.suceso,
    nueva: fuente(escena.nueva, 'versión que se acaba de oír'),
    previa: fuente(escena.previa, 'versión que ya estaba apuntada'),
    vista: escena.vista === true,
  };
}

/**
 * El diario en forma serializable, con las entradas en el orden en que se oyeron.
 *
 * El marcador y su escena viajan juntos **y coherentes**: encendido sin escena sería
 * una escena que se debe y no se puede componer, y apagado con escena sería una
 * escena que nadie debe. Las dos se rechazan aquí, al escribir, y no al leer.
 */
export function congelaDiario(estado) {
  exigeDiario(estado);
  const escena = documentoDeEscena(estado.escena ?? null);
  const triangulado = estado.triangulado === true;
  exigeMarcadorCoherente(triangulado, escena, 'al escribir el diario');
  return {
    entradas: estado.entradas.slice().sort(porMomento).map(documentoDeEntrada),
    triangulado,
    escena,
  };
}

// Encendido implica escena, y escena implica encendido. Sin esta comprobación, un
// documento a medias reabriría en silencio la puerta que los tres estados cierran:
// la vista por historias disponible sin haber visto la escena, o la escena perdida.
function exigeMarcadorCoherente(triangulado, escena, donde) {
  if (triangulado && escena === null) {
    throw new Error(`${donde}: el marcador de la primera coincidencia está encendido y no hay escena guardada, así que la escena que se debe no se podría componer`);
  }
  if (!triangulado && escena !== null) {
    throw new Error(`${donde}: hay una escena de primera coincidencia guardada con el marcador apagado, y una escena que nadie debe no existe`);
  }
}

/** El diario de vuelta de su documento, con el nivel, el signo y el marcador intactos. */
export function levantaDiario(doc) {
  const estado = estadoDeDiario();
  estado.entradas = (doc?.entradas ?? []).map((e) => entradaDeDiario(e)).sort(porMomento);
  estado.triangulado = doc?.triangulado === true;
  estado.escena = documentoDeEscena(doc?.escena ?? null);
  exigeMarcadorCoherente(estado.triangulado, estado.escena, 'al levantar el diario');
  return estado;
}

/** Los textos en forma serializable, con las claves en orden declarado. */
export function congelaTextos(estado) {
  const textos = {};
  for (const clave of Object.keys(estado?.textos ?? {}).sort()) {
    const t = estado.textos[clave];
    textos[clave] = { clave: t.clave, texto: t.texto, origen: t.origen };
  }
  return { textos };
}

/** Los textos de vuelta de su documento. */
export function levantaTextos(doc) {
  const estado = estadoDeTextos();
  for (const clave of Object.keys(doc?.textos ?? {}).sort()) guardaTexto(estado, doc.textos[clave]);
  return estado;
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión:
//
//   · No hay ninguna función que corrija, sustituya ni marque como correcta una
//     entrada. No es que estén prohibidas: es que no hay dónde escribirlas, porque
//     el diario no sabe cuál de dos versiones es la buena y decirlo sería el
//     tutorial que `quests.md` decisión 3 se niega a dar.
//   · No hay ningún orden por nivel ni por fidelidad en la superficie pública.
//   · La proyección no lleva el nivel, y por eso ninguna pantalla puede pintarlo.
