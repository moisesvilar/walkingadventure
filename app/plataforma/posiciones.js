// La fuente de posiciones de la salida: lo que entrega `{ lat, lon, tMs, precisionM }`
// mientras el rótulo del sistema sostiene el permiso «mientras se usa».
//
// **La marca de tiempo viaja dentro de cada posición**, y eso no es un detalle de
// formato: es lo que hace que el núcleo no tenga reloj. El plazo de noventa minutos y
// el minuto de permanencia del regreso se miden comparando marcas recibidas, así que se
// pueden afirmar en `node --test` sin esperar noventa minutos.
//
// Y una ausencia que es de privacidad y no de comodidad (RF-PRIV-002): **no hay traza**.
// Lo que sale de aquí es la última posición y nada más; no se guarda un histórico, no
// hay lista que crezca y lo único que la partida llega a escribir es el punto de partida
// de la salida en curso, que es un punto y no un rastro.
//
// Sin rótulo no hay fuente: retirado el rótulo se acabó el permiso, y por eso reanudar es
// una acción explícita y nunca una detección.

/**
 * Envuelve el módulo nativo en el contrato que la salida espera.
 *
 * @param {object} piezas
 * @param {() => ({lat:number, lon:number, tMs:number, precisionM?:number, clasificacion?:string}|null)} piezas.lee
 *   la última posición con su marca del sensor. Devolver `null` es una respuesta
 *   prevista —el sensor que todavía no ha entregado nada— y no un error.
 */
export function creaFuenteDePosiciones({ lee }) {
  if (typeof lee !== 'function') {
    throw new Error(
      'la fuente de posiciones se monta con lee() y no llegó ninguna: sin ella la salida se abriría para no recibir jamás una posición, ' +
      'y por tanto para no poder cerrarse nunca por regreso',
    );
  }
  return {
    montado: true,
    motivo: null,

    /** La última posición, o `null`. Nunca se guarda: se lee y se entrega. */
    posicion() {
      const leida = lee();
      if (leida == null) return null;
      if (!Number.isFinite(leida.lat) || !Number.isFinite(leida.lon)) {
        throw new Error(`la fuente ha entregado una posición sin coordenada: llegó ${JSON.stringify(leida) ?? String(leida)}`);
      }
      if (!Number.isInteger(leida.tMs)) {
        throw new Error(
          `la fuente ha entregado una posición sin marca de tiempo (tMs=${JSON.stringify(leida.tMs) ?? String(leida.tMs)}): ` +
          'el tiempo del sensor viaja dentro de cada posición porque el núcleo no lee ningún reloj',
        );
      }
      // Se copian los campos que hacen falta y se tira lo demás aquí, no más adelante:
      // lo que no entra no se puede guardar por descuido. Rumbo, altitud y velocidad se
      // quedan fuera.
      return {
        lat: leida.lat,
        lon: leida.lon,
        tMs: leida.tMs,
        precisionM: Number.isFinite(leida.precisionM) ? leida.precisionM : null,
        clasificacion: leida.clasificacion ?? null,
      };
    },
  };
}

/**
 * Una fuente que **no está montada** y lo dice al usarla.
 *
 * Existe porque esta entrega no trae módulo nativo de ubicación en marcha —SPEC-030 no
 * nombra ninguna dependencia que lo diera— y la alternativa era peor: una fuente que
 * devolviera siempre la misma posición dejaría la salida sin cerrarse jamás por regreso
 * sin que nada protestara.
 */
/**
 * Cablea la fuente con el detector de `partida/transporte.js`: se lee una posición, se le
 * entrega al detector, y quien quiera la traza de la salida la pide aquí.
 *
 * Es todo lo que la plataforma hace con la clasificación: **no decide nada**. El detector
 * vive en el núcleo porque clasificar decide si el mundo avanza, y aquí solo se junta lo
 * que ya existe.
 *
 * Las dos ausencias se dicen en lugar de degradar: sin fuente montada no hay traza que
 * dar —una traza vacía sería indistinguible de una salida sin andar—, y sin detector
 * tampoco —una traza con todo por andando movería el mundo desde un tren—.
 */
export function creaTrazaDeSalida({ fuente, detector }) {
  if (!fuente || typeof fuente.posicion !== 'function') {
    throw new Error(`la traza de la salida se monta con la fuente de posiciones y llegó ${JSON.stringify(fuente) ?? String(fuente)}`);
  }
  if (!detector || typeof detector.agrega !== 'function' || typeof detector.traza !== 'function') {
    throw new Error(
      `la traza de la salida se monta con el detector de transporte y llegó ${JSON.stringify(detector) ?? String(detector)}: ` +
      'sin él las posiciones llegarían sin clasificar y el mundo avanzaría con los kilómetros de un tren',
    );
  }
  const exigeMontados = (quien) => {
    if (fuente.montado === false) {
      throw new Error(`${quien}: la fuente de posiciones no está montada — ${fuente.motivo ?? 'sin motivo declarado'}`);
    }
    if (detector.montado === false) {
      throw new Error(`${quien}: el detector de transporte no está montado — ${detector.motivo ?? 'sin motivo declarado'}`);
    }
  };

  return {
    /**
     * Lee una posición y se la entrega al detector. Devuelve la posición leída, o `null`
     * si el sensor todavía no ha dado ninguna, que es una respuesta prevista.
     */
    muestrea() {
      exigeMontados('no se puede muestrear la posición de la salida');
      const p = fuente.posicion();
      if (p == null) return null;
      detector.agrega([p]);
      return p;
    },

    /** La traza clasificada de lo muestreado hasta ahora. */
    traza() {
      exigeMontados('no se puede dar la traza de la salida');
      return detector.traza();
    },
  };
}

/**
 * El nombre de la única tarea que la app define. Coincide con el `id` que
 * `plataforma/permisos.js` declara, y no por casualidad: el registro pasa por
 * `exigeTareaDeclarada`, así que una tarea con otro nombre no se llega a registrar.
 *
 * En Android el canal de la notificación del servicio lo compone `expo-location` como
 * `«appId»:«tarea»`, de modo que este nombre es también el final del canal.
 */
export const NOMBRE_DE_LA_TAREA = 'salida-abierta';

/**
 * Cada cuántos metros pide una posición nueva el servicio en primer plano.
 *
 * **Por distancia y no por tiempo**, que es la decisión: lo que el juego mide son metros
 * propios, y una cadencia por tiempo gastaría batería mandando fijos iguales a quien está
 * parado y fijos redundantes a quien anda en línea recta. Diez metros es el orden de la
 * precisión de un GPS urbano —por debajo, la mitad de los fijos serían error— y a paso de
 * andar da una posición cada seis o siete segundos, muy por debajo del hueco máximo de
 * `partida/transporte.js`, que es lo que hace que la traza no se corte andando.
 */
export const CADENCIA_M = 10;

/** El nombre que encabeza la notificación del rótulo en Android. Ver `opciones()`. */
export const NOMBRE_DE_LA_APP = 'Walking Adventure';

/**
 * La única suscripción al sensor de una salida abierta.
 *
 * **Una y no dos**, y es la decisión de más consecuencias del módulo: con una para la
 * fuente y otra para el seguidor saldrían dos series de posiciones con marcas distintas
 * para el mismo instante, y la traza clasificada dejaría de cuadrar con el plazo del
 * rótulo sin que nada se pusiera rojo. De esta cuelgan las dos.
 *
 * Y es **la misma cosa que el rótulo**: en Android el servicio en primer plano con su
 * notificación persistente no es un añadido a la suscripción, es cómo se pide. Por eso
 * `arranca` recibe el rótulo ya compuesto por `partida/rotulo.js` y esta capa no escribe
 * ni una palabra de lo que se lee en la pantalla de bloqueo.
 *
 * Lo que sobrevive de todas las posiciones que pasan por aquí es **una**: la última, en
 * memoria, sobrescrita por la siguiente. No hay lista, no hay `push` y no hay nada que
 * serializar.
 *
 * @param {object} piezas
 *   `Location` y `TaskManager` los dos módulos nativos, **inyectados** para que este
 *   fichero siga cargando en `node --test` sin `node_modules`; `declaraTarea` la guarda de
 *   `plataforma/permisos.js`, que es por donde pasa el registro; `alRecibir` a quién se
 *   avisa cuando llega una posición —es el empujón que sustituye a un sondeo por reloj—;
 *   `tarea` y `cadenciaM` los dos números declarados arriba.
 */
export function creaSuscripcionDeUbicacion({
  Location,
  TaskManager,
  declaraTarea,
  alRecibir = null,
  tarea = NOMBRE_DE_LA_TAREA,
  cadenciaM = CADENCIA_M,
}) {
  if (typeof Location?.startLocationUpdatesAsync !== 'function' || typeof TaskManager?.defineTask !== 'function') {
    return null;
  }
  if (typeof declaraTarea !== 'function') {
    throw new Error(
      'la suscripción al sensor se monta con la guarda de tareas declaradas y no llegó ninguna: registrar una tarea sin declararla ' +
      'es trabajo de fondo que nadie ha decidido, y esa puerta se cierra aquí',
    );
  }
  declaraTarea(tarea, 'la suscripción al sensor de la salida');

  // La última posición, y nada más. Se sobrescribe: lo que no se guarda no se puede
  // filtrar por descuido, y este es el momento del juego por el que más posiciones pasan.
  let ultima = null;
  // Lo que esta capa cree del servicio. `presente()` del rótulo tiene que responder sin
  // esperar una promesa, así que la verdad se refresca con `sondeaPresencia()` y aquí solo
  // se guarda la última respuesta: creer sin comprobar es lo que el riesgo 4 castiga.
  let corriendo = false;

  TaskManager.defineTask(tarea, ({ data, error }) => {
    if (error || !data) return;
    const fijos = data.locations ?? [];
    const fijo = fijos[fijos.length - 1];
    if (!fijo?.coords) return;
    // Se copian los cuatro campos que hacen falta **aquí**, en el punto de entrada, y no
    // más adelante: rumbo, altitud y velocidad no llegan a entrar en la app.
    ultima = {
      lat: fijo.coords.latitude,
      lon: fijo.coords.longitude,
      tMs: Math.round(fijo.timestamp),
      precisionM: Number.isFinite(fijo.coords.accuracy) ? fijo.coords.accuracy : null,
    };
    if (alRecibir) alRecibir();
  });

  const opciones = (compuesto) => ({
    // **Precisión alta y no equilibrada**, y no por gusto: `partida/transporte.js` no funda
    // un vehículo con un error mayor de treinta metros, y la equilibrada entrega cien. Con
    // ella ningún segmento podría salir nunca `vehiculo` —caerían todos en `ambiguo`— y la
    // detección de transporte quedaría escrita y muerta. Medido en el emulador el
    // 11-ago-2026: con la equilibrada el sistema ni siquiera enciende el GPS.
    accuracy: Location.Accuracy?.High,
    // Por distancia, nunca por tiempo. Ver `CADENCIA_M`.
    distanceInterval: cadenciaM,
    // El servicio en primer plano **es** el rótulo: su título y su línea llegan compuestos
    // por el núcleo, que es lo que impide que iOS y Android digan cosas distintas.
    foregroundService: {
      // El título es el nombre de la aplicación y lo pone esta capa a propósito:
      // `partida/rotulo.js` compone la línea y **no** el nombre, porque en iOS lo pone el
      // sistema. Aquí Android lo exige escrito, y componerlo en el núcleo obligaría a que
      // el núcleo supiera cómo se llama la app.
      notificationTitle: NOMBRE_DE_LA_APP,
      notificationBody: compuesto?.linea ?? '',
      // Que el sistema mate el servicio al cerrar la app es lo que hay que poder
      // reconciliar, no lo que hay que provocar: la salida sigue viva con la app cerrada.
      killServiceOnDestroy: false,
    },
  });

  return {
    montado: true,
    motivo: null,
    tarea,
    cadenciaM,

    /** Arranca el servicio con su notificación. Es lo que pone el rótulo y abre el sensor. */
    async arranca(compuesto) {
      await Location.startLocationUpdatesAsync(tarea, opciones(compuesto));
      corriendo = true;
    },

    /**
     * Cambia la línea del rótulo. Se vuelve a pedir la suscripción con las opciones
     * nuevas y **no se para en medio**: parar y arrancar dejaría un hueco en el que el
     * servicio no está, que es exactamente lo que la promesa del permiso no admite.
     */
    async actualiza(compuesto) {
      await Location.startLocationUpdatesAsync(tarea, opciones(compuesto));
      corriendo = true;
    },

    /** Para el servicio. Retirado el rótulo se acabó la suscripción: no queda nadie leyendo. */
    async para() {
      corriendo = false;
      if (typeof Location.hasStartedLocationUpdatesAsync === 'function') {
        const habia = await Location.hasStartedLocationUpdatesAsync(tarea);
        if (!habia) return;
      }
      await Location.stopLocationUpdatesAsync(tarea);
    },

    /** Lo que se creía del servicio la última vez que se preguntó de verdad. */
    corriendo: () => corriendo === true,

    /**
     * Si la tarea **sigue registrada** en el sistema. Y solo eso, que es lo único que se
     * puede preguntar: medido el 11-ago-2026, `hasStartedLocationUpdatesAsync` devuelve
     * `true` con el servicio muerto tras reiniciar el móvil, porque lo que sobrevive es el
     * registro y no el servicio. Por eso **no toca `corriendo`**: quien reconcilia junta las
     * dos respuestas —registrada y arrancada por este proceso— y vuelve a arrancar si hace
     * falta, en vez de creerse una sola.
     */
    async sondeaPresencia() {
      if (typeof Location.hasStartedLocationUpdatesAsync !== 'function') return corriendo;
      return (await Location.hasStartedLocationUpdatesAsync(tarea)) === true;
    },

    /** La última posición recibida, o `null` mientras el sensor no haya entregado ninguna. */
    lee: () => (ultima ? { ...ultima } : null),

    /**
     * Una posición **puntual**, para el punto de partida de una salida que todavía no se
     * ha abierto. No es una suscripción y no deja nada abierto: es un fijo y se acabó, y
     * hace falta porque `abreSalida` exige el punto de partida antes de que haya rótulo
     * que sostenga la lectura.
     */
    async posicionPuntual() {
      const leida = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Balanced });
      if (!leida?.coords) return null;
      return {
        lat: leida.coords.latitude,
        lon: leida.coords.longitude,
        tMs: Math.round(leida.timestamp),
        precisionM: Number.isFinite(leida.coords.accuracy) ? leida.coords.accuracy : null,
      };
    },
  };
}

export function fuenteSinMontar(motivo = 'no montada todavía: la app no trae módulo de ubicación en marcha, y ninguna spec ha nombrado la dependencia que lo daría') {
  return {
    montado: false,
    motivo,
    posicion() {
      throw new Error(`no se pueden leer posiciones de la salida: ${motivo}`);
    },
  };
}
