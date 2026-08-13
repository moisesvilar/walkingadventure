// La vida de una salida: sus cuatro situaciones, las transiciones entre ellas, el
// punto de partida, el motivo de cierre y la marca de cierre en corto.
//
// Es el área del estado que sostiene tres cosas que hasta aquí no vivían en ninguna
// parte: que **el telón lo echa volver** —al punto de partida o a mano desde el
// rótulo—, que **el telón espera a que lo leas**, y que **la salida que espera** sigue
// viva cuando su rótulo ya no está. Las tres se sostienen entre sí y por eso van en
// una sola área: partirlas es cómo se desincronizan.
//
// Tres reglas de este módulo que no son de estilo:
//
// - **No hay reloj.** El tiempo entra como marca de cada posición y aquí solo se
//   comparan marcas. Es lo que permite afirmar un plazo de noventa minutos en
//   `node --test` sin esperar noventa minutos, y lo que hace que ninguna operación
//   pública reciba una fecha, una hora ni un número de días.
// - **La salida no se cierra sola nunca, por nada.** Lo único que se para solo es el
//   rótulo (`bucle-jugable.md` §9, exclusión 14 del PRD). Retirar el rótulo y cerrar
//   la salida son dos transiciones distintas y se ven distintas en el diff.
// - **Sin rótulo no se abre.** Abrir una salida sin él significaría o perder la
//   ubicación a los pocos minutos o pedir el permiso permanente, que es la exclusión
//   12. Es §6h aplicado: la pieza que al no estar no protesta es la forma de fallo que
//   este proyecto ya ha visto cinco veces.

import { congelaHondo } from '../core/congelar.js';
import {
  RADIO_DE_REGRESO_M,
  avanzaElRegreso,
  distanciaDeAlejamientoM,
  estadoDeRegreso,
  exigeCoordenada,
  levantaRegreso,
  metrosEntre,
} from './regreso.js';
import { componeRotulo, plazoAgotado, reiniciaElPlazo } from './rotulo.js';

/**
 * Las cuatro situaciones de una salida. **Exactamente cuatro**, y la lista es cerrada:
 * una quinta sería un estado del que ninguna transición sabría salir.
 */
export const SITUACIONES = congelaHondo([
  'abierta-con-rotulo',
  'abierta-sin-rotulo',
  'cerrada-sin-leer',
  'cerrada-leida',
]);

/** Las dos en las que la salida sigue viva. La tarjeta de a medias cuelga de esta lista. */
export const SITUACIONES_ABIERTAS = congelaHondo(['abierta-con-rotulo', 'abierta-sin-rotulo']);

/** Lo que se lee cuando no hay ninguna salida. No es un error y tiene palabra propia. */
export const SIN_SALIDA = 'sin-salida';

/** El vocabulario cerrado del estado del momento: las cuatro situaciones más la nada. */
export const ESTADOS_DE_SALIDA = congelaHondo([SIN_SALIDA, ...SITUACIONES]);

/**
 * Los tres motivos por los que una salida se cierra, y **los tres disparan lo mismo**.
 * `bucle-jugable.md` §8: cerrar a mano «no es una salida de emergencia sino la misma
 * puerta en otro sitio». El motivo se guarda porque el diario querrá contarlo.
 */
export const MOTIVOS_DE_CIERRE = Object.freeze({
  REGRESO: 'regreso',
  ROTULO: 'a-mano-desde-el-rotulo',
  PORTADA: 'dejarlo-aqui',
});

/** Los motivos de cierre declarados, en orden estable. */
export const IDS_DE_MOTIVO_DE_CIERRE = congelaHondo(Object.values(MOTIVOS_DE_CIERRE).slice().sort());

/**
 * Los tres motivos por los que el rótulo deja de estar puesto. **Se distinguen a
 * propósito**: el plazo del juego es una decisión nuestra, el cierre es una
 * consecuencia, y la retirada por el sistema es el riesgo 4 del PRD. Confundirlos deja
 * una salida creyéndose sostenida sin estarlo.
 */
export const MOTIVOS_DE_RETIRADA = Object.freeze({
  PLAZO: 'plazo',
  CIERRE: 'cierre',
  SISTEMA: 'sistema',
});

/** Los motivos de retirada declarados, en orden estable. */
export const IDS_DE_MOTIVO_DE_RETIRADA = congelaHondo(Object.values(MOTIVOS_DE_RETIRADA).slice().sort());

/** El estado real del rótulo, con su vocabulario cerrado. Es lo que expone `rotulo-estado`. */
export const ESTADOS_DEL_ROTULO = congelaHondo([
  'puesto',
  'retirado-por-plazo',
  'retirado-por-cierre',
  'retirado-por-el-sistema',
  'no-disponible',
]);

const ROTULO_POR_MOTIVO = Object.freeze({
  [MOTIVOS_DE_RETIRADA.PLAZO]: 'retirado-por-plazo',
  [MOTIVOS_DE_RETIRADA.CIERRE]: 'retirado-por-cierre',
  [MOTIVOS_DE_RETIRADA.SISTEMA]: 'retirado-por-el-sistema',
});

/** Lo que el estado ofrece al abrir la app. Tres respuestas y las decide la situación. */
export const QUE_OFRECE = Object.freeze({
  TELON: 'telon',
  A_MEDIAS: 'a-medias',
  PORTADA: 'portada',
});

// --- lo que hace falta para anclar el punto de partida -------------------------
//
// Los cuatro números de la apertura viven aquí, juntos y con su motivo, y la app los
// recibe inyectados en lugar de llevar su propia copia. Es el mismo trato que la
// cadencia de SPEC-044: dos números que significan lo mismo escritos en dos ficheros
// se desincronizan, y el que se queda viejo es siempre el que nadie mira.

/**
 * **La única cota de frescura** de un fijo que vaya a anclar el punto de partida,
 * venga por la puerta que venga. Una sola, y la asimetría por defecto queda prohibida:
 * lo que ancla el punto de partida es un fijo, no una puerta, y poner el rasero
 * estricto solo en el respaldo dejaba el camino principal tragándose caché rancia en
 * silencio — medido en `wa-pixel` el 13-ago-2026: la puntual resolvía en ~2,45 s
 * devolviendo fijos de 90,2 s, 279,6 s y 643,3 s sin decirlo, y con la posición movida
 * 100 m y el GPS apagado 150 s la salida se abría anclando en un fijo de 193,5 s.
 *
 * Noventa segundos, y el número **no** sale de la aritmética del peor caso: esa dice
 * 35,7 s a paso de paseo y 27,8 s a paso vivo antes de salirse de los 50 m del radio
 * del regreso. Lo que hace admisible la cota es que el peor caso no es el caso — un
 * fijo viejo solo llega a anclar al abrir una salida, y quien abre una salida está
 * parada en su portal— y que **el residuo lo paga el re-anclaje**, que corrige el ancla
 * con el primer fijo bueno antes de haber andado nada. Sin re-anclaje habría que bajar
 * a 25 s. Las dos piezas son una sola decisión.
 *
 * **Calibración pendiente, no constante medida**: en el emulador la cota no decide
 * nunca nada —su GPS es bajo demanda y su último conocido es de 25 h—, así que el
 * intervalo donde 90 s se distingue de 25 s no se puede visitar allí. La medida que la
 * afinaría es en un teléfono real, en un portal con mal cielo, anotando la antigüedad
 * del fijo con el que se ancla y cuánto corrige el re-anclaje.
 */
export const COTA_DE_FRESCURA_MS = 90 * 1000;

/**
 * Hasta cuándo se espera al fijo puntual antes de pasar a la última conocida.
 *
 * Diez segundos, y su porqué es el criterio del dueño: **mejor diez segundos honestos
 * de «buscando dónde estás» que treinta de espera para un no**, que es lo que había
 * medido hoy (30-32 s hasta un fallo, sin tope ninguno). Agotarlo **no es un error**:
 * es el paso siguiente, y el motivo honesto solo aparece si tampoco hay última
 * conocida dentro de la cota.
 *
 * **El coste real del one-shot con precisión alta no está medido**, y se dice en vez de
 * presentarlo como calibrado: lo medido es cuánto tarda el camino roto. Si la medida
 * dice que con el fused caliente la puntual entrega en uno o dos segundos, el tope baja
 * con ese número delante.
 */
export const TOPE_DE_ESPERA_MS = 10 * 1000;

/**
 * Dentro de cuánto tiempo desde el ancla puede el primer fijo bueno sustituirla.
 *
 * Veinticinco segundos, y aquí **sí manda el peor caso**: 25 s × 1,4 m/s = 35 m y
 * × 1,8 m/s = 45 m, los dos por debajo de los 50 m del radio del regreso. Es la
 * traducción con número de la condición del dueño —«desplazamiento acumulado desde la
 * apertura ≤ 50 m»— a una forma que **no necesita acumular nada**: acumular
 * desplazamiento sumando fijos consecutivos suma también el ruido del GPS, que con
 * alguien parado crece sin parar y cerraría la ventana sola.
 *
 * El plazo se mide restando la marca del fijo nuevo de la marca del ancla: **dos marcas
 * del sensor**, sin reloj y sin `Date.now`.
 */
export const PLAZO_DE_REANCLAJE_MS = 25 * 1000;

/**
 * El error declarado máximo que se le admite a un fijo para anclar o re-anclar el punto
 * de partida: **el radio del regreso**, leído y no copiado. Un fijo cuya incertidumbre
 * declarada es mayor que el radio dentro del cual se cuenta que se ha vuelto no puede
 * anclar ese radio, y dos números que significan lo mismo se desincronizan.
 *
 * **Se llama por lo que acota y no «precisión»**, y el nombre es la mitad del asunto:
 * `core/geo.js` declara `PRECISION_M`, que es la rejilla con la que se **guardan** los
 * metros del mundo, y la guarda de `test/nucleo/persistencia.test.mjs` prohíbe que haya
 * una segunda constante de precisión repartida por el paquete — porque dos precisiones
 * son cero precisiones: la que manda pasa a ser la del último sitio que tocó el número.
 * Esto no es una precisión de almacenamiento: es una cota de error de sensor, y llamarla
 * igual invitaba justo al error que esa guarda existe para cazar.
 */
export const ERROR_MAXIMO_PARA_ANCLAR_M = RADIO_DE_REGRESO_M;

/**
 * De qué puerta salió el punto de partida. **Vocabulario cerrado de dos palabras**, que
 * es lo que hace afirmable que la apertura cayó al respaldo sin tener que deducirlo de
 * que la salida se abrió.
 */
export const ORIGENES_DEL_PUNTO = congelaHondo(['puntual', 'ultima-conocida']);

/**
 * La línea que se lee mientras se busca la posición, en A2P1 y A2P5.
 *
 * **Sin barra, sin porcentaje, sin cuenta atrás y sin ninguna cifra**, que es lo que la
 * decisión fija: una cuenta atrás convierte el tope en una promesa que el sistema no
 * garantiza, y este proyecto ya ha pagado una vez por creerse una señal que Android no
 * da. Pedir con precisión alta enciende el GPS y eso cuesta tiempo, así que la elección
 * real no es entre rápido y lento sino entre **espera muda y espera dicha**.
 *
 * Vive en el paquete y no en la pantalla por lo mismo que el resto de los textos del
 * juego: así se puede afirmar que no lleva cifras sin encender ningún aparato.
 */
export const TEXTO_MIENTRAS_SE_BUSCA = 'Buscando dónde estás…';

/**
 * Un fijo bien formado para anclar: coordenada, marca entera y precisión declarada
 * dentro de la exigida. **Lo que no se puede fechar no se puede acotar**, y lo que no
 * declara su incertidumbre tampoco: los dos se descartan igual que si no existieran.
 *
 * @returns `{ sirve, motivo }`, nunca lanza: un fijo malo es una respuesta prevista del
 *   sensor y no una avería de nadie.
 */
export function fijoQuePuedeAnclar(fijo, { errorMaximoM = ERROR_MAXIMO_PARA_ANCLAR_M } = {}) {
  if (!fijo || typeof fijo !== 'object') return congelaHondo({ sirve: false, motivo: 'no llegó ningún fijo' });
  if (!Number.isFinite(fijo.lat) || !Number.isFinite(fijo.lon)) {
    return congelaHondo({ sirve: false, motivo: 'el fijo llega sin coordenada' });
  }
  if (!Number.isInteger(fijo.tMs)) {
    return congelaHondo({ sirve: false, motivo: 'el fijo llega sin marca de tiempo, y lo que no se puede fechar no se puede acotar' });
  }
  if (!Number.isFinite(fijo.precisionM)) {
    return congelaHondo({ sirve: false, motivo: 'el fijo llega sin precisión declarada, y lo que no declara su incertidumbre no puede anclar el radio del regreso' });
  }
  if (fijo.precisionM > errorMaximoM) {
    return congelaHondo({
      sirve: false,
      motivo: `el fijo declara ${fijo.precisionM} m de incertidumbre y el radio dentro del cual se cuenta el regreso es de ${errorMaximoM} m`,
    });
  }
  return congelaHondo({ sirve: true, motivo: null });
}

/**
 * Cuál de las dos puertas ancla el punto de partida, con **la misma cota y el mismo
 * error máximo para las dos**.
 *
 * Y quién decide la frescura, que es la parte que hay que leer entera y que cambió el
 * 13-ago-2026 con la medida delante. **Las dos puertas llegan aquí ya certificadas**:
 * `app/plataforma/posiciones.js` compara la marca de cada fijo con la hora del sistema
 * y devuelve nada cuando se sale de la cota —la última conocida se la pide al módulo
 * nativo con la edad máxima escrita, y la puntual, que no admite edad máxima y está
 * medido que devuelve caché de hasta 643,3 s sin decirlo, la certifica la propia capa
 * con el reloj que recibe inyectado—. Aquí no hay reloj y no lo va a haber: eso es la
 * regla dura del determinismo del paquete, y aplicarla también a la app fue el error
 * que este trozo pagó.
 *
 * Lo que quedaba escrito antes era: «sin última conocida certificada no hay nada dentro
 * de la cota, tampoco por la puerta de la puntual». El razonamiento —la última conocida
 * es al menos tan reciente como cualquier fijo que la puntual pueda devolver— es cierto
 * **del fijo** y falso **de lo que el módulo nativo responde**: `getLastKnownPositionAsync`
 * contesta `null` cuando el último conocido es viejo o impreciso, y con él se caía una
 * puntual fresca y perfecta. Es exactamente el estado de `wa-pixel`, cuyo último fijo
 * conocido es de **25 h 24 min**: con la guarda vieja la salida no se abría nunca aunque
 * el GPS entregara un fijo de 0,6 s.
 *
 * Así que ahora se elige **por la marca y no por la puerta**, que es el principio de una
 * sola cota escrito en forma:
 *
 * - de las dos que sirven, ancla la de marca más reciente;
 * - con las marcas empatadas ancla la puntual, porque es la que se acaba de pedir;
 * - si solo sirve una, ancla esa, venga de la puerta que venga;
 * - si no sirve ninguna, no se ancla y el motivo dice qué le pasaba a cada una.
 *
 * @param {object} puertas
 *   `puntual` y `ultimaConocida`, cada una ya certificada dentro de la cota por la capa
 *   de plataforma, o `null`.
 * @returns `{ ancla, origen, motivo }`. Sin nada que anclar, `ancla` y `origen` son
 *   `null` y el motivo lo dice.
 */
export function decideElPuntoDePartida({ puntual = null, ultimaConocida = null, errorMaximoM = ERROR_MAXIMO_PARA_ANCLAR_M } = {}) {
  const laPuntual = fijoQuePuedeAnclar(puntual, { errorMaximoM });
  const laUltima = fijoQuePuedeAnclar(ultimaConocida, { errorMaximoM });

  if (laPuntual.sirve && (!laUltima.sirve || puntual.tMs >= ultimaConocida.tMs)) {
    return congelaHondo({ ancla: unFijo(puntual), origen: 'puntual', motivo: null });
  }
  if (laUltima.sirve) {
    return congelaHondo({ ancla: unFijo(ultimaConocida), origen: 'ultima-conocida', motivo: null });
  }
  return congelaHondo({
    ancla: null,
    origen: null,
    motivo: `no hay ninguna posición dentro de la cota de frescura con la que anclar el punto de partida: ` +
      `el fijo puntual, ${laPuntual.motivo}; la última posición conocida, ${laUltima.motivo}`,
  });
}

function unFijo(fijo) {
  return { lat: fijo.lat, lon: fijo.lon, tMs: fijo.tMs, precisionM: fijo.precisionM };
}

/**
 * Si este fijo sustituye al ancla, **y las cuatro condiciones hacen falta**: error
 * declarado dentro del máximo, marca dentro del plazo desde la marca del ancla, la
 * salida sin haberse declarado alejada todavía, y **que el fijo repare algo**.
 *
 * Ocurre **como mucho una vez por salida** y no distingue por el origen del punto: un
 * fijo puntual rancio es tan malo como una última conocida vieja, así que el re-anclaje
 * repara las dos puertas. Después de alejarse el ancla es inmutable, porque «casa» es lo
 * que decide cuándo cae el telón y moverla a mitad de salida cambiaría el sitio al que
 * hay que volver bajo los pies de quien vuelve.
 *
 * **La cuarta condición es de la fila 53 y sale de una medida.** En las tres tomas de
 * `wa-pixel` del 13-ago-2026 el re-anclaje salía `reanclada = true` con
 * `desplazamientoDelAnclaM = 0` y `antiguedadAlReanclarMs = 0`: el primer fijo que
 * entrega la suscripción es **literalmente el mismo** que devolvió la puntual, así que el
 * único re-anclaje de la salida se gastaba en no mover nada y un fijo bueno que llegara
 * después, dentro del plazo, ya no podía entrar. No contradecía ningún criterio al pie de
 * la letra —«el primer fijo bueno dentro del plazo» es ese—, pero dejaba el mecanismo
 * inerte, que es lo que la fila venía a evitar.
 *
 * El criterio, con su porqué: **el ancla se mueve más que la incertidumbre que el propio
 * fijo declara**. Por debajo de eso «se ha movido» y «es ruido» no se distinguen — el
 * fijo está diciendo lo mismo que el ancla, con su mismo margen—, así que no hay nada que
 * reparar y no se gasta. Y **el umbral no es un número nuevo**: es `precisionM`, que ya
 * viaja dentro del fijo y que ya decide si puede anclar. Un cuarto número fijo aquí sería
 * uno más que calibrar sin medida; la incertidumbre declarada es exactamente la escala a
 * la que la pregunta tiene sentido. En el caso medido son 0 m contra los 8 m que el fijo
 * declaraba.
 *
 * `anclaMs` en nulo significa que la ventana ya no se puede medir —una salida abierta
 * por la versión anterior, o recuperada tras morir el proceso— y entonces **no se
 * re-ancla**: no es un caso especial, es el plazo aplicándose. `ancla` en nulo es otra
 * cosa: significa que quien pregunta no ha dicho dónde está el ancla, y entonces la
 * cuarta condición **no bloquea**, porque una condición que no se puede medir no es una
 * condición que se incumple. Quien recibe posiciones sí la pasa siempre.
 *
 * @returns `{ reancla, motivo }`, nunca lanza.
 */
export function decideElReanclaje({
  anclaMs = null,
  ancla = null,
  reanclada = false,
  seAlejo = false,
  fijo = null,
  plazoMs = PLAZO_DE_REANCLAJE_MS,
  errorMaximoM = ERROR_MAXIMO_PARA_ANCLAR_M,
} = {}) {
  if (reanclada === true) return congelaHondo({ reancla: false, motivo: 'el punto de partida ya se re-ancló, y el re-anclaje ocurre como mucho una vez por salida' });
  if (seAlejo === true) return congelaHondo({ reancla: false, motivo: 'la salida ya se declaró alejada, y desde ahí el punto de partida es inmutable' });
  if (!Number.isInteger(anclaMs)) return congelaHondo({ reancla: false, motivo: 'no se sabe con qué marca se ancló el punto de partida, así que su ventana no se puede medir' });
  const sirve = fijoQuePuedeAnclar(fijo, { errorMaximoM });
  if (!sirve.sirve) return congelaHondo({ reancla: false, motivo: sirve.motivo });
  const antiguedadMs = fijo.tMs - anclaMs;
  if (antiguedadMs < 0 || antiguedadMs > plazoMs) {
    return congelaHondo({ reancla: false, motivo: `el fijo llega ${antiguedadMs} ms después del ancla y el plazo de re-anclaje es de ${plazoMs} ms` });
  }
  if (ancla !== null) {
    const desplazamientoM = metrosEntre(exigeCoordenada(ancla, 'el punto de partida contra el que se mide el re-anclaje'), { lat: fijo.lat, lon: fijo.lon });
    if (desplazamientoM <= fijo.precisionM) {
      return congelaHondo({
        reancla: false,
        motivo: `el fijo mueve el ancla ${desplazamientoM.toFixed(1)} m y declara ${fijo.precisionM} m de incertidumbre, ` +
          'así que no repara nada: gastar en él el único re-anclaje de la salida dejaría fuera al fijo bueno que venga detrás',
      });
    }
  }
  return congelaHondo({ reancla: true, motivo: null });
}

// --- validaciones -------------------------------------------------------------

function exigeRegistro(estado) {
  if (!estado || typeof estado !== 'object' || !('salida' in estado)) {
    throw new Error('el área de salidas llega mal formada: se espera lo que devuelve estadoDeSalidas()');
  }
  return estado;
}

function exigeTexto(valor, quien) {
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${quien} se declara con su identificador y llegó ${JSON.stringify(valor) ?? String(valor)}`);
  }
  return valor;
}

function exigeMarca(tMs, quien) {
  if (!Number.isInteger(tMs)) {
    throw new Error(
      `${quien} llegó como ${JSON.stringify(tMs) ?? String(tMs)}: el tiempo entra como marca de cada posición y esta capa no lee ningún reloj`,
    );
  }
  return tMs;
}

/**
 * La transición que una situación no admite, dicha **nombrando las dos**. Es lo que
 * distingue «esto no se puede hacer ahora» de «esto no se puede hacer nunca».
 */
function noAdmite(situacion, transicion) {
  return new Error(
    `una salida en situación "${situacion}" no admite la transición "${transicion}": las situaciones son ${SITUACIONES.join(', ')}`,
  );
}

/**
 * El rótulo del sistema, inyectado, con el contrato entero.
 *
 * Cuatro operaciones y una consulta: poner, actualizar la línea, retirar con motivo y
 * **preguntar si está de verdad**. La última es la que permite comparar el estado con
 * el mundo en cualquier momento y no solo en las transiciones, que es lo que impide la
 * degradación silenciosa de Android al recuperar el proceso.
 */
export function exigeRotulo(rotulo, quien = 'el rótulo del sistema') {
  if (!rotulo || typeof rotulo !== 'object') {
    throw new Error(`${quien} no está cableado y la salida no se sostiene sin él: se monta con { montado, disponible, motivo, pone, actualiza, retira, presente }`);
  }
  for (const operacion of ['pone', 'actualiza', 'retira', 'presente']) {
    if (typeof rotulo[operacion] !== 'function') {
      throw new Error(`${quien} no expone "${operacion}()": sin las cuatro no se puede saber si lo que el estado cree coincide con lo que hay en la pantalla de bloqueo`);
    }
  }
  return rotulo;
}

/**
 * Si el rótulo se puede poner, y si no, **por qué**, distinguiendo «no montada» de
 * «no disponible»: son dos problemas distintos y se arreglan en sitios distintos.
 */
export function disponibilidadDelRotulo(rotulo) {
  exigeRotulo(rotulo);
  if (rotulo.montado !== true) {
    return congelaHondo({
      hay: false,
      motivo: `el rótulo del sistema no está montado en esta compilación${rotulo.motivo ? `: ${rotulo.motivo}` : ''}`,
    });
  }
  if (rotulo.disponible !== true) {
    return congelaHondo({
      hay: false,
      motivo: `el rótulo del sistema está montado y no disponible${rotulo.motivo ? `: ${rotulo.motivo}` : ''}`,
    });
  }
  return congelaHondo({ hay: true, motivo: null });
}

/**
 * La fuente de posiciones de la salida, inyectada.
 *
 * El núcleo no abre el GPS, no pide permisos y no tiene reloj: recibe posiciones
 * `{ lat, lon, tMs, precisionM }` y compara sus marcas. Sin ella la salida se abriría
 * para no recibir nunca una posición, que es una salida que no se entera de nada.
 */
export function exigeFuenteDePosiciones(fuente, quien = 'la fuente de posiciones de la salida') {
  if (!fuente || typeof fuente.posicion !== 'function') {
    throw new Error(
      `${quien} no está cableada y la salida no se abre sin ella: abrirla sería abrir una salida que nunca recibirá una posición y que por tanto ` +
      'nunca podría cerrarse por regreso. Se monta con { posicion() → { lat, lon, tMs, precisionM } }',
    );
  }
  return fuente;
}

/**
 * Una posición recibida, validada. **Falla nombrando la posición** cuando le falta la
 * marca o cuando su marca es anterior a la última recibida: una traza que va hacia
 * atrás mide cualquier cosa y hay que verla fallar, no promediarla.
 */
export function exigePosicion(posicion, { ultimaMarcaMs = null } = {}) {
  if (!posicion || typeof posicion !== 'object') {
    throw new Error(`la posición recibida llegó como ${JSON.stringify(posicion) ?? String(posicion)}: se espera { lat, lon, tMs, clasificacion }`);
  }
  const punto = exigeCoordenada(posicion, 'la posición recibida');
  if (!Number.isInteger(posicion.tMs)) {
    throw new Error(
      `la posición ${JSON.stringify({ lat: punto.lat, lon: punto.lon })} llega sin marca de tiempo (tMs=${JSON.stringify(posicion.tMs) ?? String(posicion.tMs)}): ` +
      'el tiempo del sensor viaja dentro de cada posición y sin él no hay plazo que medir',
    );
  }
  if (ultimaMarcaMs !== null && posicion.tMs < ultimaMarcaMs) {
    throw new Error(
      `la posición con marca ${posicion.tMs} ms es anterior a la última recibida (${ultimaMarcaMs} ms): tratarla como reciente reiniciaría el plazo hacia atrás`,
    );
  }
  return congelaHondo({
    lat: punto.lat,
    lon: punto.lon,
    tMs: posicion.tMs,
    clasificacion: posicion.clasificacion ?? null,
    precisionM: Number.isFinite(posicion.precisionM) ? posicion.precisionM : null,
  });
}

// --- el área ------------------------------------------------------------------

/** El área de una partida recién empezada: ninguna salida, y no es un error. */
export function estadoDeSalidas() {
  return { salida: null };
}

function vista(salida) {
  if (!salida) return null;
  return congelaHondo({
    salida: salida.salida,
    mapa: salida.mapa,
    aventura: salida.aventura,
    aventuraTerminada: salida.aventuraTerminada,
    destino: salida.destino,
    mundo: salida.mundo,
    situacion: salida.situacion,
    rotulo: salida.rotulo,
    partida: { lat: salida.partida.lat, lon: salida.partida.lon },
    // Los cuatro escalares de auditoría del anclaje. Ninguno es una coordenada y
    // ninguno es una marca de reloj: un vocabulario cerrado, un booleano, una distancia
    // y una duración. Con ellos un regreso raro se audita —de qué puerta salió el ancla,
    // si se movió, cuánto y con qué desfase— sin que la partida sepa por dónde anduviste.
    origenDelPunto: salida.origenDelPunto,
    reanclada: salida.reanclada === true,
    desplazamientoDelAnclaM: salida.desplazamientoDelAnclaM,
    antiguedadAlReanclarMs: salida.antiguedadAlReanclarMs,
    motivo: salida.motivo,
    cierreEnCorto: salida.cierreEnCorto,
    ultimoPropioMs: salida.ultimoPropioMs,
    ultimaMarcaMs: salida.ultimaMarcaMs,
  });
}

/** La situación del momento: una de las cuatro, o la nada. Nunca lanza. */
export function situacionDeSalida(estado) {
  const salida = exigeRegistro(estado).salida;
  return salida ? salida.situacion : SIN_SALIDA;
}

/**
 * La salida en curso, o `null`. Una cerrada —leída o no— no está en curso: lo que se
 * pregunta aquí es si hay algo andando, no si hay algo guardado.
 */
export function salidaEnCurso(estado) {
  const salida = exigeRegistro(estado).salida;
  return salida && SITUACIONES_ABIERTAS.includes(salida.situacion) ? vista(salida) : null;
}

/** Si hay una salida abierta, esté el rótulo puesto o retirado. */
export function haySalidaEnCurso(estado) {
  return salidaEnCurso(estado) !== null;
}

/** El telón que espera a que lo lean, o `null`. Sobrevive a días con la app cerrada. */
export function telonPendiente(estado) {
  const salida = exigeRegistro(estado).salida;
  return salida && salida.situacion === 'cerrada-sin-leer' ? vista(salida) : null;
}

/** Si hay un telón sin leer. Es lo que expone `telon-pendiente`. */
export function hayTelonPendiente(estado) {
  return telonPendiente(estado) !== null;
}

/**
 * Qué ofrece el estado al abrir la app. **Lo primero es el telón**, si lo hay; luego
 * la salida a medias, esté el rótulo donde esté; y si no, la portada.
 */
export function queOfreceAlAbrirLaApp(estado) {
  if (hayTelonPendiente(estado)) return QUE_OFRECE.TELON;
  if (haySalidaEnCurso(estado)) return QUE_OFRECE.A_MEDIAS;
  return QUE_OFRECE.PORTADA;
}

/**
 * El estado real del rótulo según esta capa. Con la capacidad ausente responde
 * `no-disponible` sin mirar lo guardado: lo que hay en la pantalla de bloqueo manda
 * sobre lo que el estado creía.
 */
export function estadoDelRotulo(estado, { rotulo = null } = {}) {
  if (rotulo && !disponibilidadDelRotulo(rotulo).hay) return 'no-disponible';
  const salida = exigeRegistro(estado).salida;
  if (!salida || !SITUACIONES_ABIERTAS.includes(salida.situacion)) {
    return salida ? salida.rotulo : 'no-disponible';
  }
  return salida.rotulo;
}

// --- las transiciones ---------------------------------------------------------

/**
 * Abre una salida.
 *
 * **Sin rótulo no se abre**, y eso no lanza: devuelve `{ abierta: false }` con el
 * motivo, porque no poder abrir es una respuesta que la portada tiene que enseñar. Lo
 * que sí lanza es lo que es avería —una salida ya abierta, un telón sin leer, la
 * fuente sin cablear, un punto de partida que no es una coordenada—, porque ninguna de
 * esas cuatro es una decisión de quien juega.
 *
 * @returns `{ abierta, salida, motivo, rotulo }`.
 */
export function abreSalida(estado, { salida, mapa, partida, tMs, origenDelPunto = null, aventura = null, destino = null, mundo = null, rotulo, fuente }) {
  const registro = exigeRegistro(estado);
  exigeTexto(salida, 'la salida que se abre');
  exigeTexto(mapa, 'el mapa de la salida que se abre');

  const anterior = registro.salida;
  if (anterior && SITUACIONES_ABIERTAS.includes(anterior.situacion)) {
    throw new Error(
      `no se puede abrir la salida "${salida}" con la salida "${anterior.salida}" todavía abierta (situación "${anterior.situacion}"): ` +
      'la anterior se cierra por volver, desde el rótulo o desde la portada antes de abrir otra',
    );
  }
  if (anterior && anterior.situacion === 'cerrada-sin-leer') {
    throw new Error(
      `no se puede abrir la salida "${salida}" con el telón de "${anterior.salida}" todavía sin leer: el telón espera a que lo leas, ` +
      'y dos telones pendientes obligarían a elegir cuál se enseña',
    );
  }

  exigeFuenteDePosiciones(fuente);
  const punto = exigeCoordenada(partida, 'el punto de partida de la salida que se abre');
  exigeMarca(tMs, 'la marca de la posición con la que se abre la salida');
  if (origenDelPunto !== null && !ORIGENES_DEL_PUNTO.includes(origenDelPunto)) {
    throw new Error(
      `el origen del punto de partida llega como ${JSON.stringify(origenDelPunto) ?? String(origenDelPunto)} y las dos puertas declaradas son ${ORIGENES_DEL_PUNTO.join(', ')}`,
    );
  }

  const disponible = disponibilidadDelRotulo(rotulo);
  if (!disponible.hay) {
    // No se abre, y se dice por qué. Abrirla igual significaría perder la ubicación a
    // los pocos minutos o pedir el permiso permanente, que es la exclusión 12.
    return congelaHondo({ abierta: false, salida: null, motivo: disponible.motivo, rotulo: 'no-disponible' });
  }

  const compuesto = componeRotulo({ destino, mundo });
  rotulo.pone(compuesto);

  registro.salida = {
    salida,
    mapa,
    aventura: aventura == null ? null : exigeTexto(aventura, 'la aventura aceptada de la salida'),
    aventuraTerminada: false,
    destino: destino == null ? null : destino,
    mundo: mundo == null ? null : mundo,
    situacion: 'abierta-con-rotulo',
    rotulo: 'puesto',
    partida: punto,
    // **La marca con la que se ancló, y vive solo en memoria**: es lo que mide el plazo
    // de re-anclaje, y no baja al documento porque el esquema declara exactamente dos
    // marcas del sensor y una tercera sería una promesa de privacidad rota por una
    // comodidad. La consecuencia está declarada y es la correcta: una salida que vuelve
    // de disco no se re-ancla, porque su ventana ya no se puede medir.
    anclaMs: tMs,
    origenDelPunto,
    reanclada: false,
    desplazamientoDelAnclaM: null,
    antiguedadAlReanclarMs: null,
    regreso: estadoDeRegreso(),
    ultimoPropioMs: tMs,
    ultimaMarcaMs: tMs,
    motivo: null,
    cierreEnCorto: false,
  };

  return congelaHondo({ abierta: true, salida: vista(registro.salida), motivo: null, rotulo: 'puesto' });
}

/** Anota la aventura aceptada en la salida abierta, y con qué destino se anda. */
export function anotaLaAventura(estado, { aventura = null, destino = null, mundo = null, rotulo = null } = {}) {
  const salida = enCursoOFalla(estado, 'anotar la aventura');
  if (aventura != null) salida.aventura = exigeTexto(aventura, 'la aventura aceptada de la salida');
  if (destino !== undefined) salida.destino = destino;
  if (mundo != null) salida.mundo = mundo;
  if (rotulo && salida.situacion === 'abierta-con-rotulo') {
    rotulo.actualiza(componeRotulo({ destino: salida.destino, mundo: salida.mundo }));
  }
  return vista(salida);
}

/**
 * El beat siguiente cambia de sitio: **la línea nombra el sitio nuevo y nada más
 * cambia**. Ni la acción, ni la situación, ni el plazo.
 */
export function cambiaElDestino(estado, { destino, mundo = null, rotulo = null }) {
  const salida = enCursoOFalla(estado, 'cambiar el destino del rótulo');
  salida.destino = destino ?? null;
  if (mundo != null) salida.mundo = mundo;
  const compuesto = componeRotulo({ destino: salida.destino, mundo: salida.mundo });
  if (rotulo && salida.situacion === 'abierta-con-rotulo') rotulo.actualiza(compuesto);
  return compuesto;
}

/** Da la aventura por terminada. Sin ella, cerrar no marca cierre en corto. */
export function terminaLaAventura(estado) {
  const salida = enCursoOFalla(estado, 'dar la aventura por terminada');
  if (!salida.aventura) {
    throw new Error(`la salida "${salida.salida}" no tiene ninguna aventura aceptada que dar por terminada`);
  }
  salida.aventuraTerminada = true;
  return vista(salida);
}

function enCursoOFalla(estado, transicion) {
  const registro = exigeRegistro(estado);
  const salida = registro.salida;
  if (!salida) throw new Error(`no hay ninguna salida sobre la que "${transicion}": la partida está en "${SIN_SALIDA}"`);
  if (!SITUACIONES_ABIERTAS.includes(salida.situacion)) throw noAdmite(salida.situacion, transicion);
  return salida;
}

/**
 * Retira el rótulo **sin cerrar la salida**. Es la mitad de `bucle-jugable.md` §9 que
 * más se confunde: no puede haber un cacharro nuestro en la pantalla de bloqueo
 * durante días, y la salida no muere con él.
 *
 * El cierre no pasa por aquí: tiene su propio motivo y ocurre en la misma transición
 * que el cierre, no en una posterior.
 */
export function retiraElRotulo(estado, { motivo, rotulo = null }) {
  const registro = exigeRegistro(estado);
  const salida = registro.salida;
  if (!salida) throw new Error(`no hay ninguna salida cuyo rótulo retirar: la partida está en "${SIN_SALIDA}"`);
  if (salida.situacion !== 'abierta-con-rotulo') throw noAdmite(salida.situacion, 'retirar el rótulo');
  if (motivo !== MOTIVOS_DE_RETIRADA.PLAZO && motivo !== MOTIVOS_DE_RETIRADA.SISTEMA) {
    throw new Error(
      `"${motivo}" no es un motivo por el que retirar el rótulo de una salida abierta: los declarados son ${IDS_DE_MOTIVO_DE_RETIRADA.join(', ')}, ` +
      `y "${MOTIVOS_DE_RETIRADA.CIERRE}" ocurre dentro del cierre y no aparte`,
    );
  }
  salida.situacion = 'abierta-sin-rotulo';
  salida.rotulo = ROTULO_POR_MOTIVO[motivo];
  // La retirada por el sistema ya ocurrió fuera: pedirla otra vez sería hablarle a un
  // rótulo que no está.
  if (rotulo && motivo === MOTIVOS_DE_RETIRADA.PLAZO) rotulo.retira(motivo);
  return vista(salida);
}

/**
 * Retoma la salida: «Seguir con la entrega». **Es una acción explícita y no una
 * detección**, porque retirado el rótulo no hay permiso «mientras se usa» que sostenga
 * enterarse de que alguien ha vuelto a andar (`seguridad-privacidad.md` §2).
 *
 * El plazo cuenta de nuevo desde la marca con la que se retoma.
 */
export function retomaLaSalida(estado, { tMs, rotulo }) {
  const registro = exigeRegistro(estado);
  const salida = registro.salida;
  if (!salida) throw new Error(`no hay ninguna salida que retomar: la partida está en "${SIN_SALIDA}"`);
  if (salida.situacion !== 'abierta-sin-rotulo') throw noAdmite(salida.situacion, 'retomar la salida');
  exigeMarca(tMs, 'la marca con la que se retoma la salida');

  const disponible = disponibilidadDelRotulo(rotulo);
  if (!disponible.hay) {
    return congelaHondo({ retomada: false, salida: vista(salida), motivo: disponible.motivo });
  }
  rotulo.pone(componeRotulo({ destino: salida.destino, mundo: salida.mundo }));
  salida.situacion = 'abierta-con-rotulo';
  salida.rotulo = 'puesto';
  salida.ultimoPropioMs = tMs;
  salida.ultimaMarcaMs = Math.max(salida.ultimaMarcaMs, tMs);
  return congelaHondo({ retomada: true, salida: vista(salida), motivo: null });
}

/**
 * Cierra la salida. **Las tres vías son la misma puerta**: lo único que cambia es el
 * motivo anotado.
 *
 * El cierre en corto va declarado y depende de si había aventura sin terminar, no de
 * la vía. Y **el rótulo queda retirado en esta misma transición**, no en una posterior:
 * una salida cerrada con el rótulo todavía puesto es un servicio corriendo sin salida.
 */
export function cierraLaSalida(estado, { motivo, rotulo = null }) {
  const registro = exigeRegistro(estado);
  const salida = registro.salida;
  if (!salida) throw new Error(`no hay ninguna salida que cerrar: la partida está en "${SIN_SALIDA}"`);
  if (!SITUACIONES_ABIERTAS.includes(salida.situacion)) throw noAdmite(salida.situacion, 'cerrar la salida');
  if (!IDS_DE_MOTIVO_DE_CIERRE.includes(motivo)) {
    throw new Error(`el motivo de cierre "${motivo}" no está declarado: los que hay son ${IDS_DE_MOTIVO_DE_CIERRE.join(', ')}`);
  }

  const teniaRotulo = salida.situacion === 'abierta-con-rotulo';
  salida.situacion = 'cerrada-sin-leer';
  salida.rotulo = ROTULO_POR_MOTIVO[MOTIVOS_DE_RETIRADA.CIERRE];
  salida.motivo = motivo;
  // Cierre en corto: había aventura y no se terminó. No depende de la vía, y por eso
  // «dejarlo aquí» no es una vía de emergencia distinta.
  salida.cierreEnCorto = !!salida.aventura && salida.aventuraTerminada !== true;
  if (rotulo && teniaRotulo) rotulo.retira(MOTIVOS_DE_RETIRADA.CIERRE);

  return congelaHondo({
    salida: vista(salida),
    // Lo que esta capa NO hace al cerrar, declarado para poder afirmarlo: el telón se
    // echa solo y sin avisar, y esperar es el comportamiento correcto.
    notifica: false,
    ponePrimerPlano: false,
    pideConfirmacion: false,
  });
}

/** «Dejarlo aquí» desde la portada. Dispara el cierre con su motivo, y el corto si toca. */
export function dejarloAqui(estado, { rotulo = null } = {}) {
  return cierraLaSalida(estado, { motivo: MOTIVOS_DE_CIERRE.PORTADA, rotulo });
}

/** «Dar la salida por terminada» desde el rótulo. La misma puerta, en otro sitio. */
export function terminaDesdeElRotulo(estado, { rotulo = null } = {}) {
  return cierraLaSalida(estado, { motivo: MOTIVOS_DE_CIERRE.ROTULO, rotulo });
}

/**
 * Marca el telón como leído. **Es una acción explícita de quien lo lee** y nunca el
 * paso de nada: ningún plazo, ninguna posición y ningún arranque de la app lo marcan.
 */
export function marcaElTelonComoLeido(estado) {
  const registro = exigeRegistro(estado);
  const salida = registro.salida;
  if (!salida) throw new Error(`no hay ningún telón que marcar como leído: la partida está en "${SIN_SALIDA}"`);
  if (salida.situacion !== 'cerrada-sin-leer') throw noAdmite(salida.situacion, 'marcar el telón como leído');
  salida.situacion = 'cerrada-leida';
  return vista(salida);
}

// --- lo que hace una posición -------------------------------------------------

/**
 * Recibe una posición y devuelve qué ha pasado con ella.
 *
 * Dos comprobaciones y en este orden: **primero el regreso** —que cierra— y solo si no
 * ha vuelto, **el plazo** —que retira el rótulo—. Al revés, volver a casa tras un rato
 * largo parado dejaría la salida abierta con el rótulo retirado en vez de cerrarla.
 *
 * La clasificación entra **solo** para el plazo. El regreso no la ve, y esa es la
 * mitad de esta función que hace cierto que volver en autobús echa el telón igual.
 *
 * @returns `{ situacion, rotulo, haVuelto, cierre, retirada, distanciaM }`.
 */
export function recibePosicion(estado, { posicion, tramo, rotulo = null }) {
  const registro = exigeRegistro(estado);
  const salida = registro.salida;
  if (!salida) throw new Error(`no hay ninguna salida que reciba posiciones: la partida está en "${SIN_SALIDA}"`);
  if (salida.situacion !== 'abierta-con-rotulo') {
    throw noAdmite(salida.situacion, 'recibir una posición');
  }

  const leida = exigePosicion(posicion, { ultimaMarcaMs: salida.ultimaMarcaMs });
  salida.ultimaMarcaMs = leida.tMs;

  // El plazo se mide sobre **metros propios** y no sobre quietud: con cualquier
  // movimiento valiendo, un trayecto en tren mantendría el servicio vivo indefinidamente.
  if (leida.clasificacion != null && reiniciaElPlazo(leida.clasificacion)) {
    salida.ultimoPropioMs = leida.tMs;
  }

  // El re-anclaje, **antes del regreso y no después**: si este fijo sustituye al ancla,
  // es contra el ancla nueva contra la que hay que medir dónde estás. Va aquí y no en
  // una operación aparte porque la ventana en la que ocurre —todavía no se ha andado
  // nada— es justo la de las primeras posiciones, y una transición propia sería una que
  // alguien tendría que acordarse de llamar.
  const reanclaje = decideElReanclaje({
    anclaMs: salida.anclaMs ?? null,
    // El ancla entra por la firma para que la cuarta condición se pueda medir: sin ella
    // el re-anclaje se gastaba en el primer fijo de la suscripción, que es el mismo que
    // devolvió la puntual, y no movía nada.
    ancla: salida.partida,
    reanclada: salida.reanclada === true,
    seAlejo: salida.regreso.seAlejo === true,
    fijo: leida,
  });
  if (reanclaje.reancla) {
    // Lo que se anota es una distancia y una duración; **el punto anterior se sustituye
    // y no se apila**, porque dos puntos separados por metros y segundos son el
    // principio de una traza (RF-PRIV-002).
    salida.desplazamientoDelAnclaM = Math.round(metrosEntre(salida.partida, { lat: leida.lat, lon: leida.lon }));
    salida.antiguedadAlReanclarMs = leida.tMs - salida.anclaMs;
    salida.partida = { lat: leida.lat, lon: leida.lon };
    salida.anclaMs = leida.tMs;
    salida.reanclada = true;
  }

  const paso = avanzaElRegreso(salida.regreso, {
    partida: salida.partida,
    alejamientoM: distanciaDeAlejamientoM(tramo),
    lat: leida.lat,
    lon: leida.lon,
    tMs: leida.tMs,
  });
  salida.regreso = { ...paso.vigilancia };

  if (paso.haVuelto) {
    const cierre = cierraLaSalida(registro, { motivo: MOTIVOS_DE_CIERRE.REGRESO, rotulo });
    return congelaHondo({
      situacion: salida.situacion,
      rotulo: salida.rotulo,
      haVuelto: true,
      cierre,
      retirada: MOTIVOS_DE_RETIRADA.CIERRE,
      distanciaM: paso.distanciaM,
    });
  }

  if (plazoAgotado({ ultimoPropioMs: salida.ultimoPropioMs, tMs: leida.tMs })) {
    retiraElRotulo(registro, { motivo: MOTIVOS_DE_RETIRADA.PLAZO, rotulo });
    return congelaHondo({
      situacion: salida.situacion,
      rotulo: salida.rotulo,
      haVuelto: false,
      cierre: null,
      retirada: MOTIVOS_DE_RETIRADA.PLAZO,
      distanciaM: paso.distanciaM,
    });
  }

  return congelaHondo({
    situacion: salida.situacion,
    rotulo: salida.rotulo,
    haVuelto: false,
    cierre: null,
    retirada: null,
    distanciaM: paso.distanciaM,
  });
}

/**
 * Compara lo que el estado cree con **la presencia real del rótulo**, y corrige.
 *
 * Es lo que hay que llamar al arrancar en Android después de que el sistema haya
 * matado el proceso, y se puede llamar en cualquier momento a propósito: una salida
 * que se cree sostenida y no lo está es el síntoma común de las dos diferencias de
 * plataforma del riesgo 4, y §6h dice que si el rótulo no está, algo tiene que
 * ponerse rojo.
 */
export function reconciliaConElRotulo(estado, { rotulo }) {
  const registro = exigeRegistro(estado);
  exigeRotulo(rotulo);
  const salida = registro.salida;
  const presente = rotulo.presente() === true;
  const creePuesto = !!salida && salida.situacion === 'abierta-con-rotulo';

  if (creePuesto && !presente) {
    retiraElRotulo(registro, { motivo: MOTIVOS_DE_RETIRADA.SISTEMA });
    return congelaHondo({
      coincidian: false,
      corregido: true,
      situacion: salida.situacion,
      rotulo: salida.rotulo,
      presente,
      motivo: MOTIVOS_DE_RETIRADA.SISTEMA,
    });
  }

  return congelaHondo({
    coincidian: creePuesto === presente,
    corregido: false,
    situacion: situacionDeSalida(registro),
    rotulo: estadoDelRotulo(registro),
    presente,
    motivo: null,
  });
}

// --- ida y vuelta -------------------------------------------------------------

/** El área en documento. Sin salida escribe `null`, que es su estado normal. */
export function congelaSalidas(estado) {
  const salida = exigeRegistro(estado).salida;
  if (!salida) return { salida: null };
  return {
    salida: {
      salida: salida.salida,
      mapa: salida.mapa,
      aventura: salida.aventura ?? null,
      aventuraTerminada: salida.aventuraTerminada === true,
      destino: salida.destino ?? null,
      mundo: salida.mundo ?? null,
      situacion: salida.situacion,
      rotulo: salida.rotulo,
      // El punto de partida es la única posición que la partida guarda, y guardarlo es
      // lo que hace que volver a casa cierre la salida también después de que el
      // sistema haya matado el proceso. Va declarado en `formato.js`.
      partida: { lat: salida.partida.lat, lon: salida.partida.lon },
      // Los cuatro escalares del anclaje. **`anclaMs` no está y es a propósito**: es una
      // marca del sensor y el esquema declara exactamente dos.
      origenDelPunto: salida.origenDelPunto ?? null,
      reanclada: salida.reanclada === true,
      desplazamientoDelAnclaM: salida.desplazamientoDelAnclaM ?? null,
      antiguedadAlReanclarMs: salida.antiguedadAlReanclarMs ?? null,
      regreso: { seAlejo: salida.regreso.seAlejo === true, dentroDesdeMs: salida.regreso.dentroDesdeMs ?? null },
      ultimoPropioMs: salida.ultimoPropioMs,
      ultimaMarcaMs: salida.ultimaMarcaMs,
      motivo: salida.motivo ?? null,
      cierreEnCorto: salida.cierreEnCorto === true,
    },
  };
}

/** El área de vuelta de su documento, con la situación y el rótulo validados. */
export function levantaSalidas(doc) {
  const guardada = doc?.salida ?? null;
  if (!guardada) return estadoDeSalidas();
  if (!SITUACIONES.includes(guardada.situacion)) {
    throw new Error(`la salida guardada vuelve en la situación "${guardada.situacion}", que no es ninguna de las cuatro: ${SITUACIONES.join(', ')}`);
  }
  if (!ESTADOS_DEL_ROTULO.includes(guardada.rotulo)) {
    throw new Error(`la salida guardada vuelve con el rótulo en "${guardada.rotulo}", que no está declarado: ${ESTADOS_DEL_ROTULO.join(', ')}`);
  }
  return {
    salida: {
      salida: exigeTexto(guardada.salida, 'la salida guardada'),
      mapa: exigeTexto(guardada.mapa, 'el mapa de la salida guardada'),
      aventura: guardada.aventura ?? null,
      aventuraTerminada: guardada.aventuraTerminada === true,
      destino: guardada.destino ?? null,
      mundo: guardada.mundo ?? null,
      situacion: guardada.situacion,
      rotulo: guardada.rotulo,
      partida: exigeCoordenada(guardada.partida, 'el punto de partida de la salida guardada'),
      // **Retrocompatibilidad sin migración**: una partida guardada antes de esta
      // entrega llega sin los cuatro, y se leen con su valor por defecto —origen sin
      // declarar, sin re-anclar, los dos números en nada— y la salida abierta sigue
      // funcionando. Y `anclaMs` vuelve en nulo siempre: la ventana de re-anclaje de una
      // salida que ha pasado por disco ya no se puede medir, y con `anclaMs` en nulo no
      // se re-ancla, que es la regla del plazo aplicándose y no un caso especial.
      anclaMs: null,
      origenDelPunto: ORIGENES_DEL_PUNTO.includes(guardada.origenDelPunto) ? guardada.origenDelPunto : null,
      reanclada: guardada.reanclada === true,
      desplazamientoDelAnclaM: Number.isInteger(guardada.desplazamientoDelAnclaM) ? guardada.desplazamientoDelAnclaM : null,
      antiguedadAlReanclarMs: Number.isInteger(guardada.antiguedadAlReanclarMs) ? guardada.antiguedadAlReanclarMs : null,
      regreso: levantaRegreso(guardada.regreso),
      ultimoPropioMs: exigeMarca(guardada.ultimoPropioMs, 'la marca del último metro propio guardada'),
      ultimaMarcaMs: exigeMarca(guardada.ultimaMarcaMs, 'la última marca recibida guardada'),
      motivo: guardada.motivo ?? null,
      cierreEnCorto: guardada.cierreEnCorto === true,
    },
  };
}
