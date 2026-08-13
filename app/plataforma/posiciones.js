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
 *
 * Desde SPEC-044 esta es **la cadencia de fuera de un geofence** y no la única: con un sitio
 * debajo se pide por tiempo, porque `distanceInterval` es un filtro duro del sensor y parado
 * no entrega ninguna posición. Quién decide cuál toca es el paquete —`cadenciaDeMuestreo` de
 * `partida/llegadas.js`—; esta capa solo la aplica, y este número sigue siendo el de SPEC-048.
 */
export const CADENCIA_M = 10;

/**
 * La cadencia de arranque: la de distancia de SPEC-048. **Se declara en lugar de suponerse**
 * porque una suscripción sin cadencia no existe, y dejar el campo vacío haría indistinguible
 * «nadie la decidió» de «se decidió que fuera por distancia».
 */
export function cadenciaPorDistancia(metros = CADENCIA_M) {
  return Object.freeze({ modo: 'por-distancia', metros, segundos: null });
}

/**
 * Una cadencia bien formada: o metros o segundos, nunca las dos y nunca ninguna. Falla
 * nombrando lo que llegó, aquí y no dentro de las opciones del módulo nativo, que es donde
 * un campo de más se traga sin decir nada.
 */
export function exigeCadencia(cadencia, quien = 'la cadencia de la suscripción') {
  const porTiempo = Number.isFinite(cadencia?.segundos) && cadencia.segundos > 0;
  const porDistancia = Number.isFinite(cadencia?.metros) && cadencia.metros > 0;
  if (porTiempo === porDistancia) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(cadencia) ?? String(cadencia)}: se pide o cada tantos metros o cada tantos segundos, ` +
      'y una con las dos puestas o con ninguna no describe ningún muestreo',
    );
  }
  return cadencia;
}

/** El nombre que encabeza la notificación del rótulo en Android. Ver `opciones()`. */
export const NOMBRE_DE_LA_APP = 'Walking Adventure';

/**
 * **La precisión con la que esta app le pide posición al sistema, y sale de un solo
 * sitio.** La usan la suscripción y el fijo puntual, y esa es toda la defensa que esta
 * fila deja puesta.
 *
 * Alta y no equilibrada, por dos motivos medidos en el emulador y con fecha. El primero,
 * del 11-ago-2026: `partida/transporte.js` no funda un vehículo con un error mayor de
 * treinta metros y la equilibrada entrega cien, así que con ella ningún segmento podría
 * salir nunca `vehiculo` y la detección de transporte quedaría escrita y muerta. El
 * segundo, del 13-ago-2026, y es el que costó dos cotejos: **con la equilibrada el
 * sistema ni siquiera enciende el GPS** — durante los 30-32 s que tardaba en fallar el
 * fijo puntual, el Event Log de `dumpsys location` no registró **ni una petición**,
 * mientras que la suscripción, que ya pedía alta, registraba
 * `ProviderRequest[@+2s0ms, HIGH_ACCURACY]` en cuanto la salida se abría.
 *
 * La lección va aquí porque vale más que el arreglo: la causa llevaba **dos días escrita
 * veinte líneas por encima del defecto**, y aun así dos cotejos independientes
 * atribuyeron el rojo a que «el proveedor está frío». No faltaba la medida: la medida no
 * llegó al sitio. Por eso la defensa es **de forma y no de disciplina** — las dos
 * peticiones leen esta función, así que no se pueden volver a separar sin escribirlo
 * aposta.
 */
export function precisionQueSePide(Location) {
  return Location?.Accuracy?.High;
}

/**
 * Lo que se le pide al proveedor y cuánto se espera, todo por parámetro y **sin ninguna
 * copia de los números en esta capa**: la cota de frescura, el tope de espera y la
 * precisión exigida los declara `packages/nucleo/partida/salidas.js` con su motivo, y
 * llegan hasta aquí desde la orquestación de la salida. Falla nombrando el que falta, que
 * es mejor que un valor por omisión que nadie decidió.
 */
function exigeNumero(valor, quien) {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(
      `${quien} llega como ${JSON.stringify(valor) ?? String(valor)}: lo declara el paquete con su motivo y entra por la firma, ` +
      'porque una copia en esta capa es el número que se queda viejo sin que nadie lo mire',
    );
  }
  return valor;
}

/**
 * Si un fijo está dentro de la cota de frescura, **medido contra el reloj del sistema**.
 *
 * Aquí sí hay reloj, y ese es el reparto que la fila 53 fijó con la medida delante: sin
 * saber qué hora es no se puede decir si un fijo es fresco, y `packages/nucleo/` no puede
 * saberlo —`Date.now` dentro del paquete rompe el determinismo, que es la regla más dura
 * del repo—. La regla se había aplicado de más a toda la app, y la consecuencia fue usar
 * la marca de la última posición conocida como patrón de la puntual: con el último
 * conocido viejo o impreciso el módulo nativo devuelve nada, y con él se caía una puntual
 * fresca y perfecta. Es el estado de `wa-pixel`, cuyo último fijo es de 25 h 24 min.
 *
 * **Sigue habiendo una sola cota** para cualquier fijo que ancle el punto de partida: la
 * declara el paquete, llega por la firma y se aplica igual a las dos puertas. Lo que
 * cambia es **quién** decide la frescura, no que haya dos raseros — a la última conocida
 * se la certifica el módulo nativo con `maxAge`, y a la puntual, que no admite edad
 * máxima, se la certifica aquí con el mismo número.
 *
 * El reloj entra **inyectado y no importado** para que se pueda doblar, igual que el de
 * `plataforma/lector-de-salud.js`.
 */
function dentroDeLaCota(fijo, { cotaMs, ahora }) {
  if (!fijo) return null;
  const instante = ahora();
  if (!Number.isFinite(instante)) {
    throw new Error(
      `el reloj de la capa de plataforma ha devuelto ${JSON.stringify(instante) ?? String(instante)}: sin él no se puede decir si un fijo ` +
      'es fresco, y anclar el punto de partida con uno que no se puede fechar es lo que esta cota existe para impedir',
    );
  }
  // La antigüedad negativa —un fijo con la marca por delante del reloj— se trata como
  // fresca y no como avería: el desfase entre el reloj del sensor y el del sistema es de
  // milisegundos, y descartar por él dejaría la salida sin abrir por un detalle que nadie
  // puede arreglar desde la app.
  return instante - fijo.tMs <= cotaMs ? fijo : null;
}

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
  // El reloj real de la app, **inyectado y no importado**: es lo único con lo que se puede
  // certificar la frescura de un fijo, y el paquete no lo puede tener. Ver `dentroDeLaCota`.
  ahora = () => Date.now(),
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
  // La cadencia puesta ahora mismo y el rótulo con el que se pidió. Se guardan porque
  // **cambiar de cadencia es volver a pedir la misma suscripción con otras opciones**, y
  // quien la cambia no tiene por qué saber qué se lee en la pantalla de bloqueo — ni al
  // revés: quien cambia la línea del rótulo no puede llevarse por delante la cadencia.
  let cadencia = cadenciaPorDistancia(cadenciaM);
  let ultimoRotulo = null;

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

  // Con cadencia por tiempo el filtro de distancia se pone a cero **explícitamente**: si se
  // dejara puesto, los dos filtros se aplicarían a la vez —el sistema entrega cuando se
  // cumplen los dos— y parado seguiría sin llegar ninguna posición, que es exactamente el
  // fallo que esta fila arregla.
  const porCadencia = () => (Number.isFinite(cadencia.segundos)
    ? { timeInterval: cadencia.segundos * 1000, distanceInterval: 0 }
    : { distanceInterval: cadencia.metros });

  const opciones = (compuesto) => ({
    // La precisión sale de `precisionQueSePide` y no de aquí: es el mismo sitio del que
    // la lee el fijo puntual, que es lo que impide que las dos se desincronicen otra vez.
    accuracy: precisionQueSePide(Location),
    // Por distancia fuera de un geofence y por tiempo dentro. Ver `CADENCIA_M` y
    // `cadenciaDeMuestreo` de `partida/llegadas.js`, que es quien lo decide.
    ...porCadencia(),
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

    /**
     * Arranca el servicio con su notificación. Es lo que pone el rótulo y abre el sensor.
     *
     * La cadencia entra aquí y no se descubre después: una salida que se abre con quien
     * juega ya parada dentro de un geofence tiene que arrancar ya por tiempo, porque el
     * fijo que la cambiaría es justo el que no va a llegar.
     */
    async arranca(compuesto, nueva = null) {
      if (nueva) cadencia = exigeCadencia(nueva, 'la cadencia con la que arranca la suscripción');
      ultimoRotulo = compuesto ?? ultimoRotulo;
      await Location.startLocationUpdatesAsync(tarea, opciones(ultimoRotulo));
      corriendo = true;
    },

    /**
     * Cambia la línea del rótulo. Se vuelve a pedir la suscripción con las opciones
     * nuevas y **no se para en medio**: parar y arrancar dejaría un hueco en el que el
     * servicio no está, que es exactamente lo que la promesa del permiso no admite.
     *
     * Y **no toca la cadencia**: cambiar la línea del rótulo no puede devolver el sensor a
     * la cadencia de fuera estando dentro de un geofence, que sería perder la llegada por
     * haber repintado un texto.
     */
    async actualiza(compuesto) {
      ultimoRotulo = compuesto ?? ultimoRotulo;
      await Location.startLocationUpdatesAsync(tarea, opciones(ultimoRotulo));
      corriendo = true;
    },

    /**
     * Aplica una cadencia nueva **sin parar el servicio**, con el mismo rótulo que ya
     * estaba puesto: acercarse a un sitio no cambia ni una palabra de lo que se lee en la
     * pantalla de bloqueo. Devuelve si hubo cambio, que es lo que evita volver a pedir la
     * suscripción en cada muestra.
     */
    async aplicaCadencia(nueva) {
      const pedida = exigeCadencia(nueva, 'la cadencia que se aplica a la suscripción');
      if (pedida.modo === cadencia.modo) return false;
      cadencia = pedida;
      await Location.startLocationUpdatesAsync(tarea, opciones(ultimoRotulo));
      corriendo = true;
      return true;
    },

    /** La cadencia puesta ahora mismo. Es lo que la marca observable del momento enseña. */
    cadencia: () => cadencia.modo,

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
     *
     * **Con precisión alta**, que es la raíz del rojo que esta fila cierra: ver
     * `precisionQueSePide`, de donde sale, con la medida y su fecha. Y **con tope de
     * espera**, porque pedirla así enciende el GPS y eso cuesta tiempo: agotarlo no es un
     * error, es el paso siguiente —se prueba la última conocida—, y la apertura no puede
     * tardar más que el tope. El módulo nativo no acepta ninguno, así que el tope es una
     * carrera contra un temporizador y el fijo que llegue tarde se descarta solo.
     *
     * Y **ya certificada dentro de la cota**, que es lo que cambió la fila 53: está medido
     * que esta llamada devuelve caché de 90,2 s, 279,6 s y 643,3 s sin decirlo, así que el
     * fijo se compara con el reloj del sistema aquí mismo y se devuelve nada si es viejo.
     * Devolver nada es exactamente lo que hace `getLastKnownPositionAsync` con su `maxAge`:
     * **la misma cota y la misma respuesta para las dos puertas**, que es el principio
     * escrito en forma. Antes esto lo decidía el paquete comparando la marca de la puntual
     * con la del último conocido, y sin último conocido se caía la puntual con él.
     */
    async posicionPuntual({ topeMs, cotaMs } = {}) {
      exigeNumero(topeMs, 'el tope de espera del fijo puntual');
      exigeNumero(cotaMs, 'la cota de frescura del fijo puntual');
      let corta;
      const espera = new Promise((resuelve) => { corta = setTimeout(() => resuelve(null), topeMs); });
      try {
        const leida = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: precisionQueSePide(Location) }),
          espera,
        ]);
        return dentroDeLaCota(unFijoDeExpo(leida), { cotaMs, ahora });
      } finally {
        clearTimeout(corta);
      }
    },

    /**
     * La última posición conocida del sistema, **si cumple la cota de frescura y la
     * precisión exigida**. Es la segunda puerta del punto de partida.
     *
     * Los dos parámetros van **explícitos y ninguno por omisión**: `getLastKnownPositionAsync`
     * devuelve `null` cuando el fijo es más viejo que `maxAge` o más impreciso que
     * `requiredAccuracy`, así que por esta puerta la frescura la certifica el módulo nativo
     * —con el mismo número que `posicionPuntual` le aplica a la suya con el reloj de la app—.
     * Un `null` es una respuesta prevista —el emulador `wa-pixel` tiene su último conocido en
     * 25 h 24 min, y no hay cota razonable que le diga que sí— y no una avería.
     */
    async ultimaConocida({ cotaMs, precisionM } = {}) {
      exigeNumero(cotaMs, 'la cota de frescura de la última posición conocida');
      exigeNumero(precisionM, 'la precisión exigida a la última posición conocida');
      if (typeof Location.getLastKnownPositionAsync !== 'function') return null;
      const leida = await Location.getLastKnownPositionAsync({ maxAge: cotaMs, requiredAccuracy: precisionM });
      return unFijoDeExpo(leida);
    },

    /**
     * En qué estado está el permiso de ubicación **mientras se usa**, con vocabulario
     * cerrado. Existe para que el motivo por el que una salida no se abre se decida
     * consultando **dato** y no interpretando el texto de una excepción: ese texto lo
     * escribe el módulo nativo y cambia con su versión, y hasta esta fila cualquier
     * excepción de la posición se archivaba como `permiso-denegado` con el permiso
     * concedido, mandando a quien juega a los ajustes del sistema a arreglar algo que no
     * estaba roto.
     *
     * Responde `no-se-sabe` cuando no se puede preguntar, que es distinto de denegado y no
     * se hace pasar por él.
     */
    async estadoDelPermiso() {
      if (typeof Location.getForegroundPermissionsAsync !== 'function') return 'no-se-sabe';
      try {
        const respuesta = await Location.getForegroundPermissionsAsync();
        if (respuesta?.granted === true) return 'concedido';
        if (respuesta?.canAskAgain === false) return 'no-preguntable';
        return 'denegado';
      } catch {
        return 'no-se-sabe';
      }
    },
  };
}

/**
 * Un fijo de `expo-location` en los cuatro números que la app usa, o `null`.
 *
 * Los campos se copian **aquí, en el punto de entrada**, igual que en la suscripción:
 * rumbo, altitud y velocidad no llegan a entrar en la app, y lo que no entra no se puede
 * guardar por descuido.
 */
function unFijoDeExpo(leida) {
  if (!leida?.coords || !Number.isFinite(leida.timestamp)) return null;
  return {
    lat: leida.coords.latitude,
    lon: leida.coords.longitude,
    tMs: Math.round(leida.timestamp),
    precisionM: Number.isFinite(leida.coords.accuracy) ? leida.coords.accuracy : null,
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
