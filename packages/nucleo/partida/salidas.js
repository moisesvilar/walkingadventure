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
  avanzaElRegreso,
  distanciaDeAlejamientoM,
  estadoDeRegreso,
  exigeCoordenada,
  levantaRegreso,
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
export function abreSalida(estado, { salida, mapa, partida, tMs, aventura = null, destino = null, mundo = null, rotulo, fuente }) {
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
      regreso: levantaRegreso(guardada.regreso),
      ultimoPropioMs: exigeMarca(guardada.ultimoPropioMs, 'la marca del último metro propio guardada'),
      ultimaMarcaMs: exigeMarca(guardada.ultimaMarcaMs, 'la última marca recibida guardada'),
      motivo: guardada.motivo ?? null,
      cierreEnCorto: guardada.cierreEnCorto === true,
    },
  };
}
