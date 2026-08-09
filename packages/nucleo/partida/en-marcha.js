// La composición del momento en marcha (A3P2, A3P3, A3P5 y A3P6) como **dato del
// núcleo**: qué elementos hay, qué dice el zócalo, qué marcas se ponen y —sobre todo—
// **la lista de tocables, que por contrato sale vacía**.
//
// Casi todo lo que este momento especifica son ausencias: ni un control tocable, ni una
// cifra de esfuerzo, ni un botón de aceptar, ni un reproche por irse por otro lado, ni
// un recálculo. Una ausencia solo se puede poner roja contra una enumeración de lo que
// sí hay (`pipeline/decisiones-orquestador.md` §6o), y sin simulador comprobarla
// mirando es un criterio que se cumple siempre y no mide nada. Con la composición como
// dato, «ni un control» y «ninguna cifra» son igualdades en `node --test`, y añadir un
// botón obliga a ampliar el vocabulario, que es donde se quiere que salte.
//
// Tres cosas que esta capa **no** hace:
//
// - **No pinta.** Ni un color, ni un grosor, ni una posición: eso es de `app/` con la
//   lámina de SPEC-026 y los rótulos de SPEC-022.
// - **No lleva la cuenta del trazado.** No hay aquí ninguna función que compare lo
//   andado con la ruta ni ninguna que recalcule una durante la salida, y el estado de
//   la salida no tiene campo donde guardarlo (`bucle-jugable.md` §9). Es la mitad de
//   esta fila que se entrega no escribiéndola.
// - **No mira el reloj ni el azar.** La posición llega ya clasificada del seguidor, el
//   beat en curso llega como dato de dos valores, y no hay ninguna semilla que sembrar.

import { congelaHondo } from '../core/congelar.js';
import { MOTIVOS_POR_CRITERIO, MOTIVO_DE_SUPOSICION } from '../world/aptitud.js';
import { SUPOSICIONES } from '../world/grafo.js';
import { infraccionesDeTexto } from '../names/lenguaje.js';
import { CLASIFICACIONES, validaLlegadaPorGeofence } from './ritmo.js';
import { salidaAbierta } from './salida-abierta.js';
import { sitiosDelMundo } from './microencuentros.js';
import { vozDeTexto } from './guion-de-antes-de-salir.js';

/**
 * Los elementos que el momento puede tener. **Lista cerrada y en el orden en que se
 * leen**, de la lámina al zócalo.
 *
 * Es el sitio donde se comprueba que no hay nada más. Los tres de A3P7 —cifras,
 * progreso, racha— no están y no pueden estar sin ampliar esta lista.
 */
export const ELEMENTOS_DEL_MOMENTO = congelaHondo([
  'lamina',
  'marca-posicion',
  'marcas-de-aviso',
  'guia',
  'zocalo',
]);

/**
 * Lo que el momento no tiene, nombrado para que la ausencia se pueda poner roja.
 *
 * La primera mitad son los controles que `bucle-jugable.md` momento 2 prohíbe —«no es
 * que estén escondidos o desactivados: no existen»—; la segunda es A3P7 entera, que
 * está dibujada a propósito para no hacerse y cuya única entrega aquí es que ninguno de
 * sus elementos exista en ningún sitio.
 */
export const ELEMENTOS_QUE_NO_EXISTEN = congelaHondo([
  'barra-de-pestanas',
  'cabecera',
  'pie',
  'control-de-zoom',
  'boton-de-centrar',
  'leyenda',
  'boton-de-aceptar',
  'boton-de-descartar',
  'boton-de-pausar',
  'kilometros',
  'ritmo',
  'pasos',
  'calorias',
  'tiempo',
  'porcentaje-de-aventura',
  'racha',
  'logros',
  'cuenta-de-dias',
]);

/**
 * Los tocables del momento: **ninguno, y eso es el contrato**.
 *
 * Lo único que se puede tocar mientras se anda vive en la pantalla de bloqueo y es del
 * sistema —el rótulo persistente de la fila 30 y la notificación de oportunidad—,
 * precisamente por ser del sistema y tener que estar ahí de todos modos.
 */
export const TOCABLES_DEL_MOMENTO = congelaHondo([]);

/**
 * Los gestos que sí se conservan. **Un gesto no es un control**: no hay nada que tocar,
 * nada que pulsar por error y nada que se pueda aceptar con ellos.
 *
 * Se conservan porque quitarlos sería una excepción respecto a SPEC-026 que habría que
 * explicar dentro del juego, y porque el encuadre alrededor de la marca puede quedarse
 * corto en un mapa grande. Aquí ni siquiera hacen falta.
 */
export const GESTOS_DEL_MOMENTO = congelaHondo(['acercar', 'arrastrar']);

/** El norte, siempre arriba. Es un mapa dibujado y no un navegador: la cámara no rota. */
export const ORIENTACION = 'norte-arriba';

/**
 * Las cuatro clases de zócalo. Cerrada: una quinta sería otro contenido que leer
 * andando, y el momento se diseñó para que leer sea un vistazo.
 */
export const CLASES_DE_ZOCALO = congelaHondo(['guia', 'noticia', 'desvio', 'camino-evitado']);

/**
 * **El zócalo tiene un solo contenido a la vez**, y este es el orden que decide cuál.
 *
 * No se apilan: dos zócalos son dos cosas que leer andando. El orden sale de qué caduca
 * antes —el camino evitado y el desvío ocurren en un punto concreto del camino, la
 * noticia sedimenta y la guía está siempre—, y **lo que se desplaza no se pierde**: la
 * noticia sigue sedimentada en su núcleo y el desvío sigue ahí para otro día.
 */
export const PRIORIDAD_DE_ZOCALO = congelaHondo(['camino-evitado', 'desvio', 'noticia', 'guia']);

/** Las tres puertas por las que se abre la app. Ninguna tiene comportamiento propio. */
export const PUERTAS_DE_ENTRADA = congelaHondo(['icono', 'aviso', 'rotulo-del-sistema']);

/** Lo que se enseña al abrir. Dos destinos y los decide el estado, nunca la puerta. */
export const DESTINOS_DE_ABRIR = Object.freeze({ MAPA: 'mapa', ESCENA: 'escena' });

/**
 * De qué depende validar una llegada: **del geofence del sitio, y de nada más**.
 *
 * Se declara para poder afirmarlo: `bucle-jugable.md` §9 dice que la ruta dibujada es
 * una sugerencia y no un contrato, así que pasar cerca de un beat camino del
 * supermercado valida igual. Es un regalo, no una anomalía.
 */
export const DE_QUE_DEPENDE_LA_LLEGADA = congelaHondo(['geofence-del-sitio']);

/**
 * Los campos del estado de una salida en marcha. **Cerrada**, y es la lista contra la
 * que se comprueba la de abajo.
 */
export const CAMPOS_DEL_ESTADO_EN_MARCHA = congelaHondo(['salida', 'mapa', 'aventura', 'sitio']);

/**
 * Lo que el estado de una salida **no** tiene, y por eso no hay reproche posible.
 *
 * `bucle-jugable.md` §9: el juego no lleva la cuenta del trazado. En código eso
 * significa que no existe la cuenta que habría que llevar para reprochar, y el criterio
 * se escribe sobre el esquema y no sobre una pantalla: es la única forma de que «no hay
 * reproche» siga siendo cierto el día que alguien añada un panel.
 */
export const CAMPOS_QUE_EL_ESTADO_NO_TIENE = congelaHondo([
  'recorrido',
  'desviacion',
  'adherencia',
  'trazadoAndado',
  'historicoDePosiciones',
]);

/**
 * Las dos capacidades que esta fila entrega **no escribiéndolas**, nombradas para que
 * su ausencia se pueda poner roja igual que la de un botón.
 */
export const CAPACIDADES_QUE_NO_EXISTEN = congelaHondo([
  'comparar-lo-andado-con-el-trazado',
  'recalcular-la-ruta-en-marcha',
]);

// --- los textos del momento ---------------------------------------------------
//
// Los compone el núcleo, y por eso «ninguna cifra de esfuerzo» se comprueba pasándolos
// por el mismo cribado de cifras del filtro de aptitud en vez de mirando una captura.
// Ninguno lleva número, ninguno dice «accesibilidad» ni «filtro», y ninguno da una
// indicación de giro ni de metros.

/** El antetítulo de cada clase de zócalo: la línea pequeña. */
export const ANTETITULOS = congelaHondo({
  guia: 'Vas por',
  // En la noticia la línea pequeña va **debajo** de la grande (A3P3). Dónde se pone es
  // pintado; qué dice es esto.
  noticia: 'Lo sabrás al llegar',
  'camino-evitado': 'Por qué das esta vuelta',
  'camino-evitado-atravesado': 'Por dónde pasa el camino',
});

/**
 * La razón de un camino difícil, en lenguaje del mundo y **sin ninguna cifra**.
 *
 * Una por criterio de `world/aptitud.js`, para que un criterio nuevo no se quede sin
 * frase y salga una declaración a medias. El dibujo de A3P6 dice «son ochenta
 * escalones» y aquí no hay número: manda `game-design/lenguaje.md` —ningún texto lleva
 * una cifra dentro— y el criterio de esta fila, que busca cifras «ni siquiera dentro de
 * una frase». La razón sigue siendo concreta sin contarla.
 */
export const RAZONES_DE_CAMINO = congelaHondo({
  [MOTIVOS_POR_CRITERIO.escalones]: 'son todo escalones',
  [MOTIVOS_POR_CRITERIO.firme]: 'el firme es tierra suelta',
  [MOTIVOS_POR_CRITERIO.bordillos]: 'se sube por un bordillo alto',
  [MOTIVOS_POR_CRITERIO.paso]: 'no hay paso franco',
});

function exigeTexto(valor, quien) {
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${quien} llega como ${JSON.stringify(valor) ?? String(valor)} y el momento en marcha lo necesita escrito`);
  }
  return valor;
}

/**
 * Pasa un texto del momento por el cribado: **ni una cifra, y ni una palabra de
 * aplicación**. Falla nombrando el texto en lugar de dejarlo llegar a una pantalla.
 */
export function revisaTextoDelMomento(texto, quien, { locale = 'es' } = {}) {
  exigeTexto(texto, quien);
  const cifras = infraccionesDeTexto(texto, { locale }).filter((i) => i.familia === 'cifras');
  if (cifras.length) {
    throw new Error(`${quien} lleva una cifra ("${cifras[0].fragmento}"): en marcha no se enseña ninguna, ni siquiera dentro de una frase — "${texto}"`);
  }
  const voz = vozDeTexto(texto);
  if (voz.length) {
    throw new Error(`${quien} dice "${voz[0]}", que es voz de aplicación y no del mundo: aquí solo habla el mundo — "${texto}"`);
  }
  return texto;
}

/** Todos los textos de una composición, para poder cribarlos de una vez. */
export function textosDelMomento(momento) {
  const out = [];
  const zocalo = momento?.zocalo;
  if (zocalo) {
    if (zocalo.antetitulo) out.push(zocalo.antetitulo);
    if (zocalo.texto) out.push(zocalo.texto);
  }
  for (const marca of momento?.marcasDeAviso ?? []) if (marca.texto) out.push(marca.texto);
  return congelaHondo(out);
}

// --- la guía ------------------------------------------------------------------

/**
 * La guía: **la calzada por la que se va y el sitio hacia el que se va**, y nada más.
 *
 * `quests.md` decisión 2: el guiado usa el lenguaje del mundo, las rutas nombradas son
 * la infraestructura de navegación. Ni un giro, ni un metro, ni una cuenta atrás. Y no
 * se reescribe hasta cambiar de calzada: una guía que se actualiza sola es un mapa que
 * cambia y una razón para mirar (`bucle-jugable.md` §1).
 */
export function componeGuia({ calzada, destino, locale = 'es' }) {
  exigeTexto(calzada, 'la calzada por la que se va');
  exigeTexto(destino, 'el sitio hacia el que se va');
  const texto = `${calzada}, hacia ${destino}`;
  revisaTextoDelMomento(ANTETITULOS.guia, 'el antetítulo de la guía', { locale });
  revisaTextoDelMomento(texto, 'la guía', { locale });
  return congelaHondo({
    clase: 'guia',
    antetitulo: ANTETITULOS.guia,
    texto,
    calzada,
    destino,
    // Lo que la guía no da, declarado: es la mitad del criterio.
    giro: null,
    metros: null,
  });
}

// --- la noticia ---------------------------------------------------------------

/**
 * El zócalo de una noticia: **dice que hay algo y dónde**, y el contenido se oye
 * llegando (`quests.md` decisión 3). No es un adelanto y no hay nada que atender.
 */
export function componeNoticia({ sitio, locale = 'es' }) {
  exigeTexto(sitio, 'el sitio donde la noticia sedimentó');
  const texto = `En ${sitio} hay algo que contar`;
  revisaTextoDelMomento(texto, 'el zócalo de la noticia', { locale });
  return congelaHondo({
    clase: 'noticia',
    antetitulo: ANTETITULOS.noticia,
    texto,
    sitio,
  });
}

// --- el desvío ----------------------------------------------------------------

/**
 * La oferta del desvío: **el ramal por su nombre, el paraje por el suyo y una frase**.
 *
 * Sin nombre de ramal **falla nombrando el ramal** y no se ofrece un desvío anónimo: es
 * la deuda que `accesibilidad.md` §2 dejó y que SPEC-007 cerró, y un desvío que no se
 * puede nombrar no se puede ni ofrecer ni discutir.
 *
 * **No lleva acción.** Se acepta girando: poner un botón convertiría una decisión del
 * cuerpo en una decisión de menú, que es justo lo que se quitó de antes de salir
 * (`bucle-jugable.md` §3). Y el coste se dice con el dibujo del ramal y con la frase,
 * nunca con metros ni con minutos.
 */
export function ofreceDesvio({ ramal, paraje, locale = 'es' }) {
  if (typeof ramal !== 'string' || !ramal) {
    throw new Error(
      `el ramal del desvío llega como ${JSON.stringify(ramal) ?? String(ramal)} y sin nombre no hay oferta: ` +
      'un desvío anónimo no se puede nombrar al ofrecerlo, y ofrecerlo a medias es peor que no ofrecerlo (`accesibilidad.md` §2)',
    );
  }
  exigeTexto(paraje, 'el paraje al que lleva el desvío');
  const antetitulo = `${ramal} se aparta aquí`;
  const texto = `Se ve el tejado de ${paraje}. Queda cerca, pero de camino no está.`;
  revisaTextoDelMomento(antetitulo, 'el antetítulo de la oferta del desvío', { locale });
  revisaTextoDelMomento(texto, 'la oferta del desvío', { locale });
  return congelaHondo({
    clase: 'desvio',
    antetitulo,
    texto,
    ramal,
    paraje,
    // Las tres ausencias que hacen que esto sea un desvío y no un menú.
    acciones: [],
    coste: { conElDibujo: true, conLaFrase: true, enMetros: null, enMinutos: null },
    // Está **fuera del lazo** y cuesta piernas, que es lo que lo separa de un
    // micro-encuentro: aquel está en el camino y cuesta cero.
    fueraDelLazo: true,
  });
}

/**
 * No girar. **No pasa nada**: ni consecuencia, ni texto que lo mencione, y el paraje
 * sigue ahí para otro día —volver al mismo sitio es además cómo se sube al nivel «lo
 * conoces bien» (`bucle-jugable.md` §1, §5)—.
 *
 * Existe como función para poder afirmar la nada: sin ella, «no girar no cambia nada»
 * se comprobaría no encontrando código, que es lo que no se puede poner rojo.
 */
export function noGirar(oferta) {
  if (!oferta || oferta.clase !== 'desvio') {
    throw new Error('no girar se dice sobre una oferta de desvío, y llegó otra cosa');
  }
  return congelaHondo({
    consecuencia: null,
    textos: [],
    sigueDisponible: true,
    // Nada que registrar: no se anota que no se giró, porque anotarlo sería el primer
    // paso de un reproche.
    seAnota: false,
  });
}

// --- el camino evitado ---------------------------------------------------------

/**
 * Si un tramo se puede dar por transitable. **Lo cosido y lo inventado, nunca**:
 * `coserHuecos` une trozos sueltos del callejero con aristas que no existen en OSM y
 * `buildRoutes` traza rectas por donde no hay camino. Son suposiciones nuestras, no
 * calles (`accesibilidad.md` §2).
 */
export function daPorTransitable(tramo) {
  const suposicion = tramo?.suposicion ?? SUPOSICIONES.NINGUNA;
  return suposicion === SUPOSICIONES.NINGUNA;
}

/**
 * La declaración de un camino difícil: **nombre propio y razón concreta**, en lenguaje
 * del mundo. Ni la palabra «accesibilidad», ni iconos, ni etiquetas: nada que convierta
 * esto en un modo (`accesibilidad.md` §2 y su encuadre).
 *
 * Se declaran igual **el evitado y el atravesado a la fuerza**, y lo que cambia es la
 * frase: se avisa, no se oculta. El filtro evita y no borra, así que el camino sigue
 * existiendo y dibujado en el mapa.
 *
 * @param {object} declaracion lo que `filtro.js` deja en `declaraciones.caminos`:
 *   `nombre`, `motivo` en clave y `evitado`.
 */
export function declaraCaminoEvitado({ nombre, motivo, evitado = true, suposicion = SUPOSICIONES.NINGUNA, locale = 'es' } = {}) {
  if (motivo === MOTIVO_DE_SUPOSICION || !daPorTransitable({ suposicion })) {
    throw new Error(
      `el tramo "${nombre ?? 'sin nombre'}" es una suposición nuestra (${suposicion ?? MOTIVO_DE_SUPOSICION}) y no se declara como camino evitado: ` +
      'lo que nos inventamos nosotros no se da por transitable ni por intransitable, se dice que no lo sabemos',
    );
  }
  if (typeof nombre !== 'string' || !nombre) {
    throw new Error(
      `un camino difícil llega sin nombre propio (${JSON.stringify(nombre) ?? String(nombre)}) y hay que poder nombrarlo al declararlo: ` +
      'una declaración anónima no se puede ofrecer ni discutir (`accesibilidad.md` §2)',
    );
  }
  const razon = RAZONES_DE_CAMINO[motivo];
  if (!razon) {
    throw new Error(
      `el motivo "${motivo}" no tiene razón con la que decirse en lenguaje del mundo: las declaradas son ` +
      `${Object.keys(RAZONES_DE_CAMINO).join(', ')} (las claves de ${Object.values(MOTIVOS_POR_CRITERIO).join(', ')})`,
    );
  }
  const antetitulo = evitado ? ANTETITULOS['camino-evitado'] : ANTETITULOS['camino-evitado-atravesado'];
  const texto = evitado
    ? `${nombre}: ${razon}. El camino da la vuelta.`
    : `${nombre}: ${razon}, y no hay otro camino por aquí.`;
  revisaTextoDelMomento(antetitulo, 'el antetítulo de la declaración del camino evitado', { locale });
  revisaTextoDelMomento(texto, 'la declaración del camino evitado', { locale });
  return congelaHondo({
    clase: 'camino-evitado',
    antetitulo,
    texto,
    nombre,
    motivo,
    evitado,
    // El filtro evita, no borra: el camino sigue en el mapa, dibujado y rotulado.
    sigueDibujado: true,
    // Ni iconos ni etiquetas: se declaran vacíos para que añadir uno se vea.
    iconos: [],
    etiquetas: [],
  });
}

// --- el zócalo ------------------------------------------------------------------

/**
 * El zócalo del momento: **uno solo**, elegido por prioridad declarada.
 *
 * Devuelve `null` cuando no hay nada que decir, que es la salida sin aventura aceptada:
 * el mapa se ve igual, con su marca de posición y sin guía.
 */
export function eligeZocalo({ caminoEvitado = null, desvio = null, noticia = null, guia = null } = {}) {
  const porClase = { 'camino-evitado': caminoEvitado, desvio, noticia, guia };
  for (const clase of PRIORIDAD_DE_ZOCALO) {
    const candidato = porClase[clase];
    if (!candidato) continue;
    if (candidato.clase !== clase) {
      throw new Error(`el zócalo llega declarado como "${candidato.clase}" en el hueco de "${clase}": la clase es del vocabulario cerrado ${CLASES_DE_ZOCALO.join(', ')}`);
    }
    return candidato;
  }
  return null;
}

// --- la frontera del seguidor ----------------------------------------------------

/**
 * El seguidor de posición cableado, o un error que nombra la pieza que falta.
 *
 * Entrega posiciones **ya clasificadas** (andando · parada · vehículo · ambiguo), como
 * `partida/ritmo.js` exige desde SPEC-004: la detección de vehículo es de otra fila y
 * moverla aquí la partiría en dos. Lo que el núcleo recibe es la clasificación y el
 * sitio, nunca una traza cruda que hubiera que guardar.
 */
export function exigeSeguidor(seguidor) {
  if (!seguidor || typeof seguidor.posicion !== 'function') {
    throw new Error(
      'el seguidor de posición no está cableado y el momento en marcha no se construye sin él: enseñar un mapa con la marca quieta sería ' +
      'la pieza que, al no estar, no protesta. Se monta con { posicion() → { clasificacion, x, y, sitio } }',
    );
  }
  return seguidor;
}

// La posición que entrega el seguidor, validada. `null` no es un error: es el seguidor
// que deja de responder, y entonces el mapa se queda como estaba.
function leePosicion(seguidor) {
  const leida = seguidor.posicion();
  if (leida == null) return null;
  if (!CLASIFICACIONES.includes(leida.clasificacion)) {
    throw new Error(
      `el seguidor entrega la clasificación ${JSON.stringify(leida.clasificacion) ?? String(leida.clasificacion)}, que no es ninguna de las declaradas ` +
      `(${CLASIFICACIONES.join(', ')}): la traza llega clasificada desde SPEC-004 y el núcleo no la calcula`,
    );
  }
  if (!Number.isFinite(leida.x) || !Number.isFinite(leida.y)) {
    throw new Error(`el seguidor entrega una posición sin punto en el que pintar la marca: llegó ${JSON.stringify(leida) ?? String(leida)}`);
  }
  return { clasificacion: leida.clasificacion, x: leida.x, y: leida.y, sitio: leida.sitio ?? null };
}

// --- la puerta de entrada ---------------------------------------------------------

/**
 * Qué enseña abrir la app. **Una sola función**, para que el aviso, el rótulo y el
 * icono no puedan divergir: andando el mapa, parada dentro de un geofence la escena.
 *
 * La puerta viaja al lado y no decide nada. Es lo que hace cierto que «quien decide qué
 * hay es el estado y no la puerta» (`bucle-jugable.md` momento 2), y por eso tocar un
 * aviso trae la marca puesta y **no acepta nada**: se acepta yendo.
 */
export function queEnsenaAbrirLaApp({ clasificacion, enGeofence = false, puerta = 'icono', marca = null } = {}) {
  if (!CLASIFICACIONES.includes(clasificacion)) {
    throw new Error(`abrir la app se resuelve sobre una posición clasificada y llegó ${JSON.stringify(clasificacion) ?? String(clasificacion)}: las declaradas son ${CLASIFICACIONES.join(', ')}`);
  }
  if (!PUERTAS_DE_ENTRADA.includes(puerta)) {
    throw new Error(`"${puerta}" no es una puerta de entrada: las tres son ${PUERTAS_DE_ENTRADA.join(', ')}`);
  }
  if (typeof enGeofence !== 'boolean') {
    throw new Error(`estar dentro de un geofence es un dato de dos valores y llegó ${JSON.stringify(enGeofence) ?? String(enGeofence)}`);
  }
  const parada = clasificacion === 'parada';
  return congelaHondo({
    destino: parada && enGeofence ? DESTINOS_DE_ABRIR.ESCENA : DESTINOS_DE_ABRIR.MAPA,
    // La marca del encuentro, si se entró tocando un aviso. **Y nada más ha cambiado.**
    marca: marca ?? null,
    puerta,
    // Las tres cosas que abrir no hace nunca, declaradas: tocar ubica, jamás acepta.
    acepta: false,
    abreEscena: false,
    abreVisor: false,
  });
}

// --- los sitios rotulados ----------------------------------------------------------

/**
 * Los sitios a los que la aventura manda, **rotulados aunque no se hayan pisado**.
 *
 * `bucle-jugable.md` §1: «un sitio al que te mandan tiene nombre aunque no hayas ido»,
 * porque te lo contaron al encargarte la aventura. Se rotulan por estar en el lazo
 * aceptado y no por un nivel de conocimiento que esta fila calcule: los cuatro niveles
 * y su entintado son de la fila 36, y calcularlos aquí duplicaría la regla.
 *
 * @param {object} opciones
 *   `mundo` el congelado, del que salen los sitios que existen; `trazado` el lazo
 *   aceptado con **su lista de sitios**.
 */
export function sitiosRotulados({ mundo, trazado = null }) {
  if (trazado == null) return congelaHondo([]);
  if (!Array.isArray(trazado.sitios)) {
    throw new Error(
      `el trazado llega sin la lista de sitios (${JSON.stringify(trazado.sitios) ?? String(trazado.sitios)}) y sin ella no se sabe a qué manda la aventura: ` +
      'la pertenencia es por lista y nunca por un umbral de distancia, que se sube en cuanto un mundo no dé sitios y deja de significar nada',
    );
  }
  const delMundo = sitiosDelMundo(mundo);
  return congelaHondo(trazado.sitios.map((nombre) => {
    const sitio = delMundo.get(nombre);
    if (!sitio) {
      throw new Error(`el trazado manda a "${nombre}" y ese sitio no existe en el mundo: un rótulo sobre un sitio que no está sería un nombre inventado`);
    }
    return { nombre, tipo: sitio.tipo, encargado: true, pisado: false };
  }));
}

// --- la composición ------------------------------------------------------------------

/**
 * Compone el momento en marcha.
 *
 * @param {object} opciones
 *   `seguidor` y `vibrador`, **los dos inyectados y obligatorios**: su ausencia es
 *   avería y no estado, y falla nombrando la pieza que falta en lugar de enseñar un
 *   mapa con la marca quieta o emitir avisos de una sola capa en silencio. `salidas` el
 *   registro de la salida abierta; `mundo` el congelado; `trazado` el lazo aceptado con
 *   su lista de sitios, o `null`; `guia` la calzada y el destino; `marcasDeAviso` las
 *   que hay puestas; `noticia`, `desvio` y `caminoEvitado` los otros tres contenidos de
 *   zócalo; `estilo` de dónde sale el rojo de la marca de posición.
 * @returns `{ elementos, tocables, gestos, orientacion, lamina, marcaPosicion,
 *   marcasDeAviso, guia, zocalo, rotulados }`, congelado. `tocables` sale vacía por
 *   contrato y `elementos` es la enumeración sobre la que se afirma todo lo demás.
 */
export function componeEnMarcha({
  seguidor,
  vibrador,
  salidas = null,
  mundo,
  trazado = null,
  guia = null,
  marcasDeAviso = [],
  noticia = null,
  desvio = null,
  caminoEvitado = null,
  acentoDelMapa = '#c62828',
  locale = 'es',
}) {
  exigeSeguidor(seguidor);
  if (!vibrador || typeof vibrador.vibra !== 'function') {
    throw new Error(
      'el vibrador no está cableado y el momento en marcha no se construye sin él: sin capa de bolsillo los avisos saldrían por una sola capa y en silencio, ' +
      'que es lo que `accesibilidad.md` §3 existe para impedir',
    );
  }
  if (!mundo || typeof mundo !== 'object') {
    throw new Error('el momento en marcha se compone sobre el mundo congelado y no llegó ninguno');
  }

  const abierta = salidas ? salidaAbierta(salidas) : null;
  const posicion = leePosicion(seguidor);
  const rotulados = sitiosRotulados({ mundo, trazado });

  const marcas = congelaHondo((marcasDeAviso ?? []).map((marca) => {
    exigeTexto(marca?.sitio, 'el sitio de una marca de aviso');
    if (marca.texto) revisaTextoDelMomento(marca.texto, `el texto de la marca de aviso sobre "${marca.sitio}"`, { locale });
    return { sitio: marca.sitio, tipo: marca.tipo ?? null, texto: marca.texto ?? null };
  }));

  const zocalo = eligeZocalo({ caminoEvitado, desvio, noticia, guia });

  const elementos = ['lamina', 'marca-posicion'];
  if (marcas.length) elementos.push('marcas-de-aviso');
  if (guia) elementos.push('guia');
  if (zocalo) elementos.push('zocalo');
  for (const id of elementos) {
    if (!ELEMENTOS_DEL_MOMENTO.includes(id)) {
      throw new Error(
        `"${id}" no es un elemento del momento en marcha: los que hay son ${ELEMENTOS_DEL_MOMENTO.join(', ')}. ` +
        `Y estos no existen a propósito: ${ELEMENTOS_QUE_NO_EXISTEN.join(', ')}`,
      );
    }
  }

  const compuesto = congelaHondo({
    pantalla: 'en-marcha',
    elementos,
    // Vacía, y es el criterio más importante del momento.
    tocables: [...TOCABLES_DEL_MOMENTO],
    gestos: [...GESTOS_DEL_MOMENTO],
    orientacion: ORIENTACION,
    // La lámina a sangre, con el norte arriba y sin rotación. El pintado es de SPEC-026.
    lamina: { aSangre: true, rota: false, orientacion: ORIENTACION },
    // La marca de posición: **roja, del propio mapa, y no un punto de sistema**. Estás
    // dentro del mundo, no encima de él. Sin posición legible se queda donde estaba y
    // ninguna pantalla lo cuenta como avería del mundo.
    marcaPosicion: {
      delMapa: true,
      deSistema: false,
      color: acentoDelMapa,
      punto: posicion ? { x: posicion.x, y: posicion.y } : null,
      clasificacion: posicion ? posicion.clasificacion : null,
      seguidorResponde: posicion !== null,
    },
    marcasDeAviso: marcas,
    guia: guia ?? null,
    zocalo,
    rotulados,
    aventura: abierta ? abierta.aventura : null,
    // El mapa no cambia durante la salida: lo único que se mueve es la marca y las
    // marcas de los avisos (`bucle-jugable.md` §1). Así mirar no aporta nada nuevo.
    cambiaDuranteLaSalida: false,
  });

  // El cribado de cifras sobre lo que este momento compone, hecho aquí y no en la
  // pantalla de alguien: un texto con un número dentro tiene que fallar donde nace.
  for (const texto of textosDelMomento(compuesto)) revisaTextoDelMomento(texto, 'un texto del momento en marcha', { locale });

  return compuesto;
}

/**
 * Los campos que el estado de una salida en marcha tiene de verdad, para poder afirmar
 * cuáles **no** tiene. Es donde se comprueba que no existe la cuenta que habría que
 * llevar para reprochar.
 */
export function camposDelEstadoEnMarcha(salidas) {
  const abierta = salidas ? salidaAbierta(salidas) : null;
  if (!abierta) return congelaHondo([]);
  return congelaHondo(Object.keys(abierta).slice().sort());
}

/**
 * Ir por otra calle. **El juego no se entera y nada lo menciona**: sin cuenta del
 * trazado no hay desviación que detectar, y no hay recálculo porque no hay nada que
 * recalcular (`bucle-jugable.md` §9).
 *
 * Existe por lo mismo que `noGirar`: para poder afirmar la nada.
 */
export function irsePorOtroLado() {
  return congelaHondo({
    seEntera: false,
    textos: [],
    recalcula: false,
    marcaQueParpadea: false,
    // Lo que sí sigue funcionando, y es todo lo que hace falta: la llegada se valida por
    // el geofence del sitio y jamás por ir por el trazado.
    validaPor: [...DE_QUE_DEPENDE_LA_LLEGADA],
  });
}

/**
 * Atravesar territorio que no se conocía. **No vibra, no se felicita y no se dibuja
 * nada en vivo**: se registra en silencio y se cobra al echar el telón (fila 36).
 *
 * Se descartó un háptico de descubrimiento: le habría dado su momento al pilar de la
 * cartografía a cambio de meter un canal de aviso más en el único momento que se diseñó
 * callado. Existe como función por lo mismo que `noGirar` y `irsePorOtroLado`: para
 * poder afirmar la nada.
 */
export function atraviesaTerritorioNuevo() {
  return congelaHondo({
    vibra: false,
    felicita: false,
    dibujaEnVivo: false,
    seRegistraEnSilencio: true,
    seCobraAlEcharElTelon: true,
    textos: [],
  });
}

/**
 * Si una llegada vale. Depende del geofence y de la clasificación —el vehículo se
 * aparta, y en la duda se valida—, **nunca de haber ido por el trazado**.
 */
export function validaLlegada({ clasificacion, enGeofence }) {
  if (typeof enGeofence !== 'boolean') {
    throw new Error(`estar dentro del geofence es un dato de dos valores y llegó ${JSON.stringify(enGeofence) ?? String(enGeofence)}`);
  }
  return enGeofence && validaLlegadaPorGeofence(clasificacion);
}
