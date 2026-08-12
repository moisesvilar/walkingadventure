// La capa de llegadas de una salida, cableada: el geofence, la permanencia, la secuencia, el
// visor, la ficha, lo que allí se cuenta y el descarte del anclaje, todo colgando de la
// misma salida abierta.
//
// **Aquí no se decide nada del juego.** Quién valida una llegada, qué pasos tiene, cuál es
// el vigente y qué aflora en un núcleo viven en `packages/nucleo/partida/` desde SPEC-032,
// SPEC-033 y SPEC-035, y lo único que faltaba era esto: alguien que los llamara. Medido con
// grep antes de esta fila, `partida/llegadas.js` **no lo llamaba nadie desde `app/`**, y sus
// seis pantallas estaban en la lista de huérfanas.
//
// **El núcleo entra por la puerta** (SPEC-020, §6u): se enumera en `DEL_NUCLEO` y llega
// inyectado desde `app/nucleo/piezas.js`. Citar el paquete por su nombre aquí dejaría fuera
// del alcance de `node --test` sin instalación todo lo que de verdad se puede afirmar de
// esta fila.
//
// Y las piezas que hoy no tiene nadie **se declaran, no se suponen**: sin inventario de
// recursos ni lector de binarios no hay ilustración, así que la presentación cae a la ficha
// — que es una pantalla del juego y no un estado vacío—. Se declara con nombre y con dueño,
// como `SIN_CARAS` en el momento de consulta, porque un valor por defecto tragado haría que
// nadie los cableara nunca y nadie se enterara (§6h).

/** Lo que esto le pide al generador, enumerado. Ni una función más. */
export const DEL_NUCLEO = Object.freeze([
  'creaLlegadas',
  'creaVisor',
  'creaCapaDeDescartes',
  'creaMicroEncuentros',
  'loQueSeCuentaEn',
  'estadoDeMapa',
  'pisaSitio',
  'cierraLaEscena',
  'PRESENTACIONES',
  'TIPOS_DE_PASO',
  'MODOS',
]);

/**
 * El reparto de una salida **sin aventura aceptada**, declarado.
 *
 * `creaLlegadas` se niega a montarse sin reparto a propósito: sin saber qué beats hay hoy,
 * una secuencia sin beat sería indistinguible de una llegada a la que no se ha venido a
 * nada. Salir a andar sin más es un caso normal del juego, así que su reparto se escribe.
 */
export const REPARTO_SIN_AVENTURA = Object.freeze({ beats: [] });

/**
 * El reparto casteado de la aventura en curso, **recuperado del mundo congelado**.
 *
 * Es la costura 5 de SPEC-049 y la deuda §10g: hasta esta fila el reparto viajaba con la
 * salida que se echó a andar y al reabrir la app no estaba, así que la capa se montaba con
 * `REPARTO_SIN_AVENTURA` y el paso de beat de una secuencia guardada llegaba **con el beat
 * dentro en nulo**. La cadena **no se persiste** y no hace falta: el casting es determinista
 * sobre el documento congelado —`levantaCelda` lo recompone al leer la celda— y el estado ya
 * guarda de qué plantilla es la aventura en curso. Es la misma vía por la que
 * `partida/aventuras.js` vuelve a castear cuando hay descartes.
 *
 * Sin aventura en curso devuelve el reparto sin aventura, que es un caso normal del juego.
 * Con una aventura en curso que el mundo no puede volver a castear **falla nombrándola**: un
 * reparto vacío ahí dentro sería exactamente la degradación de §10g otra vez, solo que en
 * silencio.
 */
export function repartoDeLaAventuraEnCurso({ mundo, aventuras }) {
  const enCurso = aventuras?.enCurso ?? null;
  if (!enCurso) return REPARTO_SIN_AVENTURA;
  const casteada = casteadaDelMundo(mundo, enCurso.plantilla);
  if (!casteada) {
    throw new Error(
      `la aventura en curso es de la plantilla "${enCurso.plantilla}" y el casting del mundo congelado no la trae: ` +
      'sin su cadena de beats la escena no tendría nada que pintar, y montar la capa con el reparto vacío dejaría el paso de beat sin beat dentro',
    );
  }
  return { beats: casteada.beats };
}

/**
 * La aventura casteada de una plantilla dentro de un mundo congelado, o `null`.
 *
 * El casting va en `mundo.casting` y no en el documento de la celda: `levantaCelda` lo
 * recompone al leer, que es lo que hace que la cadena sea la misma antes y después de cerrar
 * la app sin guardar ni un texto de plantilla en la partida.
 */
export function casteadaDelMundo(mundo, plantilla) {
  return (mundo?.casting ?? []).find((c) => c.ok && c.plantilla === plantilla) ?? null;
}

/**
 * El inventario de recursos de un mundo del que no se ha conseguido ninguno, que es el
 * **modo sin cobertura** que `partida/visor.js` declara como respuesta legítima.
 *
 * Hoy es siempre este, y tiene dueño escrito: lo que consigue las ilustraciones es la
 * preparación de la salida (SPEC-025), y lo que las deja en disco para volver a leerlas no
 * lo cablea ninguna fila todavía. Mientras tanto toda llegada se resuelve como ficha, que es
 * una pantalla del juego y no un hueco.
 */
export const SIN_RECURSOS = Object.freeze({ ilustraciones: [], fotos: [], textos: [] });

/** El lector de binarios de un almacén sin ninguno. Va con `SIN_RECURSOS` y por lo mismo. */
export const LECTOR_SIN_RESIDENTES = Object.freeze({ tiene: () => false, lee: () => null });

function exigePieza(pieza, nombre, paraQue) {
  if (pieza == null) {
    throw new Error(
      `la capa de llegadas de la salida se monta con ${nombre} y no llegó: ${paraQue}. ` +
      'Montarla sin ello haría que «nadie lo cableó» y «hoy no hay» dieran la misma pantalla',
    );
  }
  return pieza;
}

/**
 * Monta la capa de llegadas de una salida abierta.
 *
 * @param {object} piezas
 *   `nucleo` el generador con lo que enumera `DEL_NUCLEO`; `mundo` el documento congelado del
 *   mapa activo; `cupos` los de su celda, de donde el descarte lee el suelo de parajes;
 *   `mapaId` el mapa; `salida` la salida en curso; `estado` el estado de la partida —de él se
 *   mutan las áreas de llegadas, de sitios pisados, de la cola y de anclajes—; `registro` el
 *   de hechos; `detector` el de transporte de la salida; `reparto` la aventura aceptada con
 *   sus beats, o `REPARTO_SIN_AVENTURA`; `recursos` y `lector` el inventario del mundo y el
 *   lector de binarios; `dia` el día del calendario de la partida, que entra inyectado
 *   porque el núcleo no lee el reloj; `trazado` la lista de sitios del lazo vigente, o `null`
 *   cuando se anda sin aventura y el lugar se resuelve por llegada real; `aventura` el motor
 *   de la aventura en curso (`app/marcha/aventura.js`), que es quien resuelve el beat y
 *   compone sus dos pantallas. **Con reparto de beats se exige**: sin él, cerrar el paso de
 *   un beat no movería el motor y la aventura no se podría terminar nunca, en silencio.
 *   Salir a andar sin aventura no lo necesita, y ahí `null` es una respuesta.
 */
export function creaLasLlegadas({
  nucleo,
  mundo,
  cupos,
  mapaId,
  salida,
  estado,
  registro = null,
  detector,
  reparto = REPARTO_SIN_AVENTURA,
  recursos = SIN_RECURSOS,
  lector = LECTOR_SIN_RESIDENTES,
  dia,
  trazado = null,
  aventura = null,
}) {
  exigePieza(nucleo, 'el núcleo inyectado', 'es quien decide qué valida una llegada y qué pasos tiene');
  const faltan = DEL_NUCLEO.filter((n) => nucleo[n] == null);
  if (faltan.length) {
    throw new Error(`al núcleo inyectado le faltan ${faltan.length} pieza(s) de la capa de llegadas: ${faltan.join(', ')}`);
  }
  exigePieza(mundo, 'el documento del mundo congelado', 'los geofences salen de sus sitios y no de ninguna otra parte');
  exigePieza(estado, 'el estado de la partida', 'la escena espera al otro lado de cerrar la app, así que vive en el estado y no en la memoria de la salida');
  exigePieza(detector, 'el detector de transporte de la salida', 'validar suponiendo que se andaba haría que pasar en coche por delante de un beat lo validara');
  if (!Number.isInteger(dia)) {
    throw new Error(`la capa de llegadas recibe el día del calendario de la partida y llegó ${JSON.stringify(dia) ?? String(dia)}: dentro del núcleo leer el reloj está prohibido`);
  }

  const pasoDelMundo = () => nucleo.estadoDeMapa(estado.pasos, mapaId).n;

  // El registro de sitios pisados es del área `sitios` del estado, y **se resuelve contra lo
  // anterior a la llegada**: anotar antes de resolver haría que la primera visita se
  // resolviera como segunda y el visor no se abriera nunca solo.
  const visitados = {
    yaVisitado: (sitio) => (estado.sitios?.mapas?.[mapaId] ?? []).includes(sitio),
    anota: (sitio) => nucleo.pisaSitio(estado.sitios, { mapaId, sitio }),
  };

  const visor = nucleo.creaVisor({ mundo, recursos, lector, visitados });
  const descartes = nucleo.creaCapaDeDescartes({ mundo, cupos, estado: estado.anclajes, mapaId, registro });
  const microEncuentros = nucleo.creaMicroEncuentros({ mundo, mapaId, estado: estado.entregas });

  const llegadas = nucleo.creaLlegadas({
    mundo,
    mapaId,
    salida,
    estado: estado.llegadas,
    detector,
    reparto,
    // El lugar de un micro-encuentro se resuelve **por llegada real** cuando no hay lazo
    // vigente, que es para lo que `atraviesa` declara `porLlegada`.
    cola: {
      microEncuentroEn: (sitio) => microEncuentros.atraviesa({
        sitio,
        salida,
        paso: pasoDelMundo(),
        trazado,
        porLlegada: trazado === null,
      }),
    },
    loQueSeCuenta: { versionesDe: (nucleoDelMundo) => nucleo.loQueSeCuentaEn(estado.nucleos, { mapaId, nucleo: nucleoDelMundo }) },
    // Que un sitio tenga ilustración es exactamente que su presentación no sea la ficha: es
    // la misma regla leída del mismo sitio, y no una segunda copia que se desincronice.
    ilustraciones: { hay: (sitio) => visor.presentacionDe(sitio).presentacion !== nucleo.PRESENTACIONES.FICHA },
    visitados,
    diario: estado.diario,
  });

  // Lo que aflora en un núcleo **escribe** —apunta en el diario y puede encender la escena de
  // la primera coincidencia—, así que se pide una sola vez por llegada y se guarda: pedirlo
  // en cada repintado anotaría el mismo día dos veces.
  const aflorado = new Map();
  const loQueAquiSeCuenta = (sitio) => {
    if (!aflorado.has(sitio)) {
      aflorado.set(sitio, llegadas.loQueAquiSeCuenta({ sitio, dia, paso: pasoDelMundo() }));
    }
    return aflorado.get(sitio);
  };

  // El motor de la aventura en curso. **Con beats en el reparto se exige**: cerrar el paso de
  // un beat sin él no movería el motor, la cadena no avanzaría nunca y la aventura acabaría
  // siempre a medias sin que nada protestara, que es §6h con otro disfraz. Sin beats no hace
  // falta ninguno, porque salir a andar sin aventura es un caso normal del juego.
  if ((reparto?.beats ?? []).length && !aventura) {
    throw new Error(
      'la capa de llegadas de la salida se monta con el motor de la aventura en curso cuando hay beats en el reparto, y no llegó ninguno: ' +
      'sin él cerrar el paso de un beat no resolvería nada y la aventura no se podría terminar jamás',
    );
  }

  return {
    mapaId,
    salida,

    /** Los geofences del mapa activo, que es lo mismo que la cadencia consulta. */
    geofence: llegadas.geofence,

    /** Comprueba una tanda de posiciones y valida lo que toque. No emite nada. */
    comprueba: (posiciones) => llegadas.comprueba({ posiciones }),

    /** La escena que espera, o `null`. Sigue esperando aunque nadie mire el móvil. */
    espera: () => llegadas.espera(),

    /**
     * Todo lo que hace falta para montar el paso vigente de la escena que espera, ya
     * compuesto: la llegada, su estado del momento, el visor si lo hay, la ficha si la hay y
     * lo que aquí se cuenta si el paso es el suyo.
     *
     * `null` cuando no hay nada esperando, que es una respuesta y no un error.
     *
     * @param {object} opciones  `tamanoDeTexto` el escalón vigente del ajuste de la escena,
     *   que vive lo que dura la sesión y por eso llega desde quien la pinta.
     */
    montaje({ tamanoDeTexto } = {}) {
      const llegada = llegadas.espera();
      if (!llegada) return null;
      const presentacion = visor.presentacionDe(llegada.sitio);
      const tipos = new Set(llegada.secuencia.map((p) => p.tipo));
      const conVisor = presentacion.presentacion !== nucleo.PRESENTACIONES.FICHA;
      const cuenta = tipos.has(nucleo.TIPOS_DE_PASO.LO_QUE_SE_CUENTA) ? loQueAquiSeCuenta(llegada.sitio) : null;
      const beat = tipos.has(nucleo.TIPOS_DE_PASO.BEAT) ? llegadas.beatDe(llegada.sitio) : null;
      // Las dos pantallas del beat se **componen** aquí, con las mismas dos funciones del
      // paquete que la batería ya ejercita: la app las pinta y no redacta ni una línea.
      //
      // Y la avería se recoge con su motivo literal en lugar de propagarse: un beat que llega
      // nulo o recortado tiene que **enseñarse** —§10g dejó ese caso vivo y la spec tiene
      // criterio para él— y el paso tiene que seguir cerrándose, porque una escena que revienta
      // sin acción deja la app encallada dentro de una salida abierta.
      let escena = null;
      let loQueTeLlevas = null;
      let motivoDeEscena = null;
      if (tipos.has(nucleo.TIPOS_DE_PASO.BEAT)) {
        try {
          if (!beat) {
            throw new Error(
              `la llegada a "${llegada.sitio}" trae paso de beat y el beat llega en nulo: la secuencia guardada conserva el paso ` +
              'y el reparto casteado tiene que volver a repartirlo, así que un nulo aquí es que la aventura en curso no se pudo recuperar',
            );
          }
          if (!aventura) {
            throw new Error(`la llegada a "${llegada.sitio}" trae un beat y no hay motor de aventura en curso montado que sepa componer su escena`);
          }
          const compuesto = aventura.escenaDe(beat, { tamanoDeTexto });
          escena = compuesto.escena;
          loQueTeLlevas = compuesto.loQueTeLlevas;
        } catch (e) {
          escena = null;
          loQueTeLlevas = null;
          motivoDeEscena = e?.message ?? String(e);
        }
      }
      return {
        llegada,
        estado: presentacion.estado,
        visor: conVisor ? visor.visorDe(llegada.sitio) : null,
        ficha: tipos.has(nucleo.TIPOS_DE_PASO.FICHA) ? visor.fichaDe(llegada.sitio) : null,
        loQueSeCuenta: cuenta ? cuenta.pantalla : null,
        beat,
        escena,
        loQueTeLlevas,
        motivoDeEscena,
        // La escena de la primera coincidencia, que ocurre una sola vez en toda la partida y
        // solo donde te cuentan la segunda versión. Quién decide cuándo se enciende ya lo
        // decidió `llegadas.js`; aquí solo se lleva a pantalla.
        triangulacion: cuenta && cuenta.triangulacion ? cuenta.escena : null,
      };
    },

    /**
     * Avanza al paso siguiente. **La única manera de moverse por la secuencia**.
     *
     * Y cuando el paso que se cierra es el del beat, **el beat se resuelve**: es el único
     * sitio de la app donde el motor de la aventura en curso avanza, y va aquí y no en la
     * pantalla porque cerrar el paso es lo que ocurre haya mirado alguien el móvil o no.
     */
    avanza() {
      const antes = llegadas.espera();
      const vigente = antes?.vigente ?? null;
      const suyo = vigente && vigente.tipo === nucleo.TIPOS_DE_PASO.BEAT ? llegadas.beatDe(antes.sitio) : null;
      const movido = llegadas.avanza();
      if (suyo && aventura) aventura.resuelve(suyo);
      return movido;
    },

    /** Cierra el marcador de la primera coincidencia. Lo cierra quien la enseña, no la capa. */
    cierraLaTriangulacion: () => nucleo.cierraLaEscena(estado.diario),

    /** La capa de A4P8 sobre un sitio: lo que se enseña antes del segundo toque. */
    capaDeDescarte: (anclaje) => descartes.capaDe(anclaje),

    /** El segundo y último toque del gesto. Marca el anclaje y **no resiembra nada**. */
    descarta: (anclaje, porque = null) => descartes.descarta({ anclaje, porque, dia, paso: pasoDelMundo() }),

    /** La lista de «Sitios que marcaste» de los ajustes. */
    sitiosMarcados: () => descartes.sitiosMarcados(),

    /** Deshacer, que vive en ajustes y no en el sitio. */
    deshaz: (anclaje) => descartes.deshaz({ anclaje, dia, paso: pasoDelMundo() }),

    /** La alarma de estirón tal como está ahora mismo. Es un dato y nunca una acción. */
    alarma: (alcanceEnTramos = null) => descartes.alarma(alcanceEnTramos),
  };
}
