// La partida en disco: **congelarla** en los cortes del juego y cuando el sistema se lleva
// la app, y **levantarla al abrir**, migrando una partida vieja y dando la cara cuando el
// documento no se puede leer.
//
// Existe porque el mecanismo llevaba desde SPEC-016 escrito y probado sin que lo llamara
// nadie: `congelaEstado` y `levantaEstado` vivían en el paquete, `App.js` construía
// `estadoInicial({ semilla })` en cada arranque y ese estado se moría en la memoria de
// React. De los cuatro prefijos de `PREFIJOS_DE_LA_PARTIDA` la app escribía tres, y el
// cuarto —`partida/`, donde vive lo jugado— no lo escribía nadie, de modo que una copia
// exportada salía sin documento de partida: el respaldo de la fila 39 funcionaba y no
// respaldaba nada de lo jugado. Es la forma de fallo de `decisiones-orquestador.md` §6h en
// su versión más silenciosa, la máquina entera construida y sin conectar.
//
// Tres decisiones que no son de estilo:
//
// - **Congelar es idempotente, y por eso puede ocurrir en muchos sitios.** El texto
//   canónico del estado es el sello: si no ha cambiado desde la última congelación no se
//   reescribe nada. Es lo que permite congelar en cada corte del juego *y* al irse la app
//   al fondo sin escribir en disco a cada paso.
// - **Un documento que no se puede leer da la cara y no se degrada.** Aquí no se cae nunca
//   a `estadoInicial`: una partida que se pierde y se parece a una que empieza es la
//   degradación silenciosa más cara que este proyecto puede tener, y es la regla que
//   SPEC-040 ya aplicó al borrado a medias. Tampoco se reconstruye desde el registro por
//   iniciativa propia, que es lo que `reconstruccion.js` prohíbe por escrito.
// - **Migrar ocurre al abrir, una sola vez, y se levanta antes de escribirse.** Un
//   documento migrado que no se puede levantar se descarta: sustituir el bueno por uno
//   roto es peor que no migrar. Y los dos documentos se escriben juntos o ninguno, porque
//   un estado migrado junto a un registro que no lo está son dos versiones a la vez.
//
// Lo que **no** hace, y queda fichado: decirle a quien juega que una congelación ha
// fallado. El error se propaga nombrando la clave y el sello no se actualiza, así que el
// siguiente corte vuelve a intentarlo; enseñarlo pide una superficie que el diseño no
// tiene todavía (pendiente 3 de `game-design/partida-guardada.md`).
//
// Y la regla de cableado de SPEC-020, repetida en SPEC-039 y SPEC-040: **el núcleo entra
// por la puerta**. Esto orquesta y no compone nada, así que recibe el generador igual que
// recibe el almacén. Citándolo aquí por su nombre de paquete, todo lo que de verdad se
// puede afirmar de esta fila quedaría fuera del alcance de `node --test` sin instalación.

import { exigeAlmacenDuradero } from './almacen-duradero.js';

/**
 * El prefijo de clave bajo el que vive lo jugado, y del que **todo** lo que esta
 * orquestación escriba tiene que colgar.
 *
 * Es uno de los cuatro de `PREFIJOS_DE_LA_PARTIDA`, que es la lista que la exportación
 * recorre y la que cubre la copia del sistema. Se declara aquí y se exige en cada
 * escritura por la misma razón que existe esta fila un nivel más arriba: una clave de la
 * partida escrita fuera de él no entraría ni en el fichero exportado ni en el respaldo, y
 * **nadie protestaría** —la exportación recorre lo que hay y lo que hay es correcto—. Es la
 * forma de fallo de `decisiones-orquestador.md` §6h, y se cierra por contrato.
 */
export const PREFIJO_DE_LO_JUGADO = 'partida/';

/** Las cuatro respuestas de abrir la partida, y ninguna más. */
export const APERTURAS = Object.freeze({
  ABRIENDO: 'abriendo',
  SIN_PARTIDA: 'sin-partida',
  ABIERTA: 'abierta',
  NO_SE_PUDO: 'no-se-pudo',
});

/**
 * Lo que esto le pide al generador, enumerado.
 *
 * Va escrito y no sobreentendido por la misma razón que en `copia.js`: un núcleo al que le
 * falta media interfaz fallaría al abrir la partida de alguien y no al construir.
 */
export const DEL_NUCLEO = Object.freeze([
  'CLAVES_DE_PARTIDA', 'CLAVE_DE_PROCEDENCIA', 'PROCEDENCIAS', 'CADENA_DEL_FORMATO', 'VERSION_FORMATO',
  'congelaEstado', 'levantaEstado', 'levantaRegistro', 'registroInicial', 'estadoInicial',
  'guardaPartida', 'cargaPartida', 'cuantosHechos', 'migra', 'documentoDeProcedencia',
  'exigeSinImportacionAMedias', 'lee', 'textoCanonico',
]);

/**
 * La partida guardada, sobre el almacén duradero y con el generador inyectado.
 *
 * @param {object} piezas
 *   `almacen` el almacén duradero de la partida —el de memoria no vale y se corta por
 *   construcción—; `nucleo` el generador con las piezas de `DEL_NUCLEO` y ni una menos;
 *   `cadena` la cadena de migraciones y `versionDeDestino` la versión a la que se migra,
 *   las dos inyectadas con las de verdad por defecto.
 *
 * Que la cadena y el destino entren por la firma es la mitad del diseño de la migración
 * (`decisiones-orquestador.md` §6o): **el mecanismo tiene que poder ponerse rojo hoy**, con
 * la versión de formato todavía en 1 y sin ninguna migración real que hacer. Un criterio
 * que se cumple siempre porque no hay nada que migrar no mide nada.
 */
export function creaPartidaGuardada({ almacen, nucleo, cadena = null, versionDeDestino = null } = {}) {
  exigeAlmacenDuradero(almacen, 'la partida guardada');
  if (!nucleo) throw new Error('la partida guardada necesita el núcleo inyectado: es quien congela, levanta y migra');
  const faltan = DEL_NUCLEO.filter((n) => nucleo[n] === undefined);
  if (faltan.length) {
    throw new Error(`al núcleo de la partida guardada le faltan ${faltan.length} pieza(s): ${faltan.join(', ')}`);
  }

  const {
    CLAVES_DE_PARTIDA, CLAVE_DE_PROCEDENCIA, PROCEDENCIAS,
    congelaEstado, levantaEstado, levantaRegistro, registroInicial, estadoInicial,
    guardaPartida, cargaPartida, cuantosHechos, migra, documentoDeProcedencia,
    exigeSinImportacionAMedias, lee, textoCanonico,
  } = nucleo;
  const cadenaVigente = cadena ?? nucleo.CADENA_DEL_FORMATO;
  const destino = versionDeDestino ?? nucleo.VERSION_FORMATO;

  // El texto canónico de la última congelación conocida. Nulo mientras no se sepa qué hay
  // en disco, que es lo que hace que la primera congelación de una sesión escriba siempre.
  let sello = null;

  /**
   * El almacén tal y como lo ve todo lo que escribe la partida, **con la exigencia del
   * prefijo puesta**.
   *
   * Va envuelto y no comprobado a mano en cada llamada porque la mayor parte de las
   * escrituras no las hace este módulo sino `guardaPartida`, y una exigencia que solo cubre
   * las líneas que uno se acuerda de comprobar no es una exigencia.
   */
  const soloLoJugado = {
    ...almacen,
    async escribe(clave, texto) {
      if (!String(clave).startsWith(PREFIJO_DE_LO_JUGADO)) {
        throw new Error(`la partida guardada escribe bajo "partida/" y ha llegado la clave "${clave}", que no cuelga de ese prefijo: lo que se escriba fuera no entra ni en la copia exportada ni en el respaldo del sistema, y nadie lo echaría de menos`);
      }
      return almacen.escribe(clave, texto);
    },
  };

  /**
   * La única escritura que sale de `partida/`: **volver a dejar un documento migrado en su
   * propia clave**.
   *
   * La exigencia del prefijo de arriba protege de que este módulo invente claves fuera de lo
   * jugado —lo que se escriba fuera no entra en la copia ni en el respaldo, y nadie lo echaría
   * de menos—, y ese motivo **no alcanza a un documento del mapa**: `mapa/` está en
   * `PREFIJOS_DE_LA_PARTIDA`, así que sí se exporta y sí se respalda. Lo que aquí ocurre no es
   * escribir algo nuevo, es reescribir en su sitio algo que ya estaba y que se acaba de leer.
   *
   * Por eso la puerta es estrecha y se comprueba: solo admite claves que esta misma migración
   * haya leído. Sin la comprobación sería una segunda puerta sin criterio, que es la forma de
   * fallo que llevamos dos costuras persiguiendo.
   */
  function reescribeMigrado(leidas, clave, texto) {
    if (!leidas.has(clave)) {
      throw new Error(
        `la migración solo reescribe documentos que acaba de leer, y "${clave}" no es uno de ellos: ` +
        'escribir una clave que no estaba sería inventarse un documento en vez de migrarlo',
      );
    }
    return almacen.escribe(clave, texto);
  }

  /** El documento que se escribiría, ya en texto canónico. Es también el sello. */
  function textoDelEstado(estado, registro) {
    // La marca de aplicación la fija `guardaPartida` al escribir, así que el sello se
    // calcula con ella puesta: si no, comparar diría que hay cambios en cuanto se anexara
    // un hecho aunque el estado fuera idéntico.
    const alDia = { ...estado, aplicadoHasta: cuantosHechos(registro) - 1 };
    return textoCanonico(congelaEstado(alDia));
  }

  /**
   * Congela la partida, **si hace falta**.
   *
   * Devuelve si escribió y cuántos bytes. El orden de escritura —registro primero, estado
   * después— es de `guardaPartida` y aquí no se reimplementa: es lo que convierte un
   * apagón entre las dos escrituras en una cola pendiente que se termina al abrir, en vez
   * de en hechos perdidos en silencio.
   */
  async function congela({ estado, registro }) {
    if (!estado) throw new Error('congelar la partida necesita su estado: sin él no hay nada que escribir');
    if (!registro) throw new Error('congelar la partida necesita su registro de hechos, aunque esté vacío');
    const texto = textoDelEstado(estado, registro);
    if (sello !== null && texto === sello) return { escrito: false, bytes: texto.length };
    await guardaPartida({ estado, registro, almacen: soloLoJugado });
    // El sello se mueve **después** de escribir: si la escritura falla, el error sale
    // nombrando la clave y el siguiente corte del juego vuelve a intentarlo entero.
    sello = texto;
    return { escrito: true, bytes: texto.length };
  }

  /** Si hay documento de estado en el almacén. Que no lo haya es el día uno, no una avería. */
  async function hayPartida() {
    return (await almacen.lee(CLAVES_DE_PARTIDA.estado)) != null;
  }

  /**
   * El prefijo bajo el que viven los documentos del mapa: su índice y sus celdas.
   *
   * Está escrito aquí y no inyectado, y es la única duplicación de esta corrección: lo
   * declaran `CLAVES.prefijoDeMapa` en `partida/mapa.js` y `PREFIJOS_DE_LA_PARTIDA` en
   * `partida/exportacion.js`, y traerlo por el núcleo inyectado obligaría a añadirlo a
   * `DEL_NUCLEO`, que está espejado a mano en la batería y se pondría rojo entero.
   *
   * **Y la raíz, dicha donde muerde**, porque esta forma de fallo va a volver: la versión de
   * formato es **una sola para las ocho clases de documento**, así que cualquier fila que
   * haga evolucionar una clase invalida todas las demás y obliga a acordarse de migrarlas
   * aquí. Lo que hoy sostiene que no falte ninguna es una lista escrita a mano, no el
   * mecanismo. Lo que queda por decidir —una versión por clase, o una guarda que exija que
   * subir la versión venga con migración para todas las que la comparten— no es de esta fila.
   *
   * Lo demás que hay en disco no entra, y **no por olvido**: `camara/` lleva su propia
   * versión y su lector es tolerante; la marca de borrado y la de importación se parsean sin
   * esquema o solo se comprueba que estén; y `arranque/en-curso` se lee con un `JSON.parse`
   * dentro de un `catch` y solo el primer día. El único que se lee con el lector estricto y
   * no se migra es `partida/procedencia.json`, y hoy no lo lee nadie: queda dicho.
   */
  const PREFIJO_DE_MAPAS = 'mapa/';

  /**
   * El documento **tal cual está escrito**, para dárselo a la migración.
   *
   * Aquí no se usa el lector estricto, y esa es toda la corrección: `lee()` comprueba la
   * versión antes que nada y **rechaza cualquier documento más viejo que el actual** —«hay
   * que migrarlo antes de abrirlo»—, que es justo la pregunta que la migración existe para
   * contestar. Usarlo aquí hacía que ningún documento viejo pudiera llegar nunca a migrarse:
   * medido en `wa-pixel` el 12-ago-2026 con una partida real, abrir daba la avería con ese
   * mismo texto y el fichero se quedaba en la versión 1. No se había disparado nunca porque
   * con `VERSION_FORMATO` en 1 ningún documento podía ser más viejo, y SPEC-049 es la
   * primera fila que sube la versión.
   *
   * **`lee()` no se ablanda**: sigue protegiendo el camino normal —`cargaPartida` lo usa
   * después, y un documento que ya está en la versión actual pasa por él entero—. Lo que se
   * quita es solo de aquí, y lo que queda comprobado no lo comprueba esta capa sino `migra`,
   * que ya lo hacía: un documento que no es un documento, uno sin `version`, uno con una
   * versión que no es entera, uno de una versión **superior** —que sigue sin abrirse— y uno
   * de una clase desconocida, que falla al validar el resultado contra el esquema de su
   * clase. Lo único que deja de ser un error es «más viejo», que pasa a ser trabajo.
   *
   * Es además lo que ya hacía la otra puerta: `copia.js` migra las partes de una copia
   * antigua parseando y nada más, y por eso las copias sí se migraban. Dos puertas a la
   * misma cadena con dos exigencias distintas es cómo se coló esto.
   */
  function paraMigrar(crudo, donde) {
    try {
      return JSON.parse(crudo);
    } catch (e) {
      throw new Error(`${donde} no se puede leer: está roto o truncado (${e.message})`);
    }
  }

  /**
   * Migra los dos documentos de la partida si vienen de una versión anterior.
   *
   * Devuelve de qué versión venían, o `null` si no había nada que migrar. Un salto sin
   * paso registrado **no se interpreta con las reglas nuevas**: `migra` falla nombrándolo
   * y el error sube hasta la avería.
   *
   * Con una excepción medida: **un registro que ni siquiera se puede leer no impide abrir
   * la partida.** `cargaPartida` lo tolera por diseño —lo que se pierde es la red de
   * seguridad, no la partida— y migrar antes que él no puede ser más estricto que él, o
   * una partida perfectamente jugable dejaría de abrirse por culpa de su auditoría.
   *
   * Ese perdón **se ha vuelto a mirar con la migración de verdad delante**, y sigue en pie
   * con el alcance más estrecho: ahora solo puede saltar por un registro roto o truncado,
   * sin `version`, con una versión no entera, de una versión superior a la de este juego o
   * de una clase desconocida — los cinco casos en los que `cargaPartida` tampoco lo va a
   * poder leer, así que no esconde nada que no estuviera ya perdonado más adelante. Lo que
   * **antes** sí escondía era un registro simplemente viejo: se lo tragaba y no se migraba
   * nunca, y la partida se quedaba con dos versiones de formato dentro. Eso ya no pasa.
   */
  async function migraDocumentos() {
    const migrados = [];
    let migradaDesde = null;
    let reglas = null;
    // **Los del mapa también.** `VERSION_FORMATO` es una sola para las ocho clases de
    // documento, así que subirla por la partida invalida de paso el índice y las celdas, y
    // hasta aquí solo se miraban `partida/estado.json` y `partida/registro.json`. Medido en
    // `wa-pixel` el 12-ago-2026: con la partida ya migrada, abrir seguía dando la avería —«el
    // índice del mapa 42.40,-8.74 está escrito en la versión de formato 1»— y **una partida
    // existente no se abría después de actualizar**, que es lo que la fila 47 juró que no
    // pasaría. Van por la misma puerta y con las mismas exigencias que los otros dos: una
    // segunda puerta con otro criterio es exactamente lo que dejó pasar la décima.
    const delMapa = (await almacen.lista(PREFIJO_DE_MAPAS)) ?? [];
    const leidas = new Set();
    for (const clave of [CLAVES_DE_PARTIDA.estado, CLAVES_DE_PARTIDA.registro, ...delMapa]) {
      const crudo = await almacen.lee(clave);
      if (crudo == null) continue;
      leidas.add(clave);
      // El perdón del registro cubre **leerlo y migrarlo**, que es exactamente lo que cubría
      // cuando el lector estricto hacía las dos comprobaciones de una vez. Dejarlo solo
      // alrededor del parseo habría estrechado la tolerancia sin decirlo: un registro de una
      // clase desconocida o de una versión superior habría pasado a tumbar la partida entera,
      // que es lo contrario de lo que SPEC-047 decidió.
      let resultado;
      try {
        resultado = migra(paraMigrar(crudo, `el documento ${clave}`), {
          cadena: cadenaVigente,
          donde: `el documento ${clave}`,
          hasta: destino,
        });
      } catch (e) {
        if (clave === CLAVES_DE_PARTIDA.registro) continue;
        throw e;
      }
      if (!resultado.migrado) continue;
      // Se levanta antes de escribirlo, y por eso `levantaEstado` y `levantaRegistro` se
      // llaman aquí y no solo dentro de `cargaPartida`: un documento migrado que no se
      // puede levantar se descarta entero, en vez de sustituir al bueno y fallar más tarde
      // sin que nadie sepa de dónde vino.
      //
      // Solo cuando el destino es la versión de verdad, por lo mismo que `migra` solo
      // valida el esquema entonces: una migración de prueba llega a una versión que ningún
      // esquema describe, y ese es justo el punto de que se pueda ejercitar hoy.
      // **Solo los dos de la partida se levantan aquí**, que son los que tienen su función
      // inyectada. Un documento del mapa migrado se queda con la comprobación que `migra` ya
      // le hizo —validarlo contra el esquema cerrado de su clase, que es lo que descarta un
      // resultado mal formado antes de escribirlo— y lo levanta `cargaMapa`/`cargaCelda` unos
      // milisegundos después, con el mapa nombrado si algo falla. Mandarlo a `levantaRegistro`,
      // que es lo que hacía este `else` en cuanto la lista dejó de ser de dos, habría reventado
      // toda migración de mapa nombrando el registro.
      if (destino === nucleo.VERSION_FORMATO) {
        if (clave === CLAVES_DE_PARTIDA.estado) levantaEstado(resultado.doc, 'el estado de la partida migrado');
        else if (clave === CLAVES_DE_PARTIDA.registro) levantaRegistro(resultado.doc);
      }
      migrados.push({ clave, texto: textoCanonico(resultado.doc) });
      migradaDesde = migradaDesde === null ? resultado.desde : Math.min(migradaDesde, resultado.desde);
      reglas = resultado.reglas;
    }
    if (!migrados.length) return null;
    // **Todos juntos o ninguno**: un estado migrado junto a un registro que no lo está, o un
    // índice de mapa migrado junto a celdas que no lo están, son dos versiones de formato a la
    // vez dentro de la misma partida. Nada se escribe hasta que todo se ha podido migrar.
    for (const { clave, texto } of migrados) await reescribeMigrado(leidas, clave, texto);
    await soloLoJugado.escribe(
      CLAVE_DE_PROCEDENCIA,
      textoCanonico(documentoDeProcedencia({ de: PROCEDENCIAS.MIGRADA, migradaDesde, reglas })),
    );
    return migradaDesde;
  }

  /**
   * La partida que sale de disco, **viva y no congelada**.
   *
   * `cargaPartida` devuelve lo suyo con `congelaHondo`, y ese congelado es deliberado: la
   * reconstrucción no se toquetea. Lo que no puede pasar es que **la partida que la app
   * lleva en memoria y muta mientras se juega sea esa misma referencia**, porque entonces
   * abrir sale con dos clases de cosa según por dónde entrara: `nace()` entrega un estado
   * mutable y `abre()` entregaba uno congelado.
   *
   * La asimetría costó un defecto entero de la fila 48: `abreSalida` muta su área en sitio,
   * así que en **cualquier sesión que no fuera la del nacimiento** salir a andar moría con
   * un `TypeError` del intérprete —«Cannot assign to read-only property 'salida'»— que
   * además se enseñaba tal cual bajo «Salir a andar». O sea que el momento en marcha solo
   * funcionaba el primer día. Medido en `wa-pixel` el 11-ago-2026.
   *
   * El deshielo es el **viaje de ida y vuelta del propio núcleo** y no una copia a mano:
   * `congelaEstado` valida contra el esquema al escribir y `levantaEstado` al leer, así que
   * lo que sale es exactamente lo que entró o falla nombrando el campo. Es la misma
   * operación que la app hace en cada congelación, y por eso no añade ningún riesgo nuevo.
   */
  function viva({ estado, registro }) {
    return {
      estado: levantaEstado(congelaEstado(estado), 'el estado de la partida recién abierta'),
      // El registro por la misma puerta: sus hechos son una lista que crece, y una lista
      // congelada no crece. `levantaRegistro` revalida cada hecho al levantarlo.
      registro: levantaRegistro({ generador: registro.reglas, hechos: registro.hechos }),
    };
  }

  /**
   * Abre la partida guardada, con las tres salidas cerradas de la spec.
   *
   * Nunca lanza: un fallo sale como `no-se-pudo` con su motivo literal, que es lo que la
   * avería enseña. Lo que sí hace es no ofrecer nunca una partida a medias.
   */
  async function abre() {
    try {
      // Antes de leer nada: una importación a medio escribir es una mezcla de dos
      // partidas, y eso no se abre ni un poco.
      await exigeSinImportacionAMedias({ almacen });
      if (!(await hayPartida())) return { estado: APERTURAS.SIN_PARTIDA, motivo: null };
      const migradaDesde = await migraDocumentos();
      // También por el envoltorio: `cargaPartida` escribe cuando encuentra una compactación
      // a medias, y esa escritura es de la partida como cualquier otra.
      const cargada = await cargaPartida({ almacen: soloLoJugado });
      // Lo que se entrega es la partida viva, de la misma clase que la que devuelve
      // `nace()`: ver `viva()`. El sello se pone sobre ella y no sobre lo congelado, para
      // que las dos vías produzcan el mismo texto canónico.
      const partida = viva({ estado: cargada.estado, registro: cargada.registro ?? registroInicial() });
      // El sello se pone con lo que acaba de salir del disco: una congelación inmediata
      // después de abrir no reescribe nada, que es lo que hace barato congelar al volver de
      // cada pantalla de consulta.
      sello = textoDelEstado(partida.estado, partida.registro);
      return {
        estado: APERTURAS.ABIERTA,
        motivo: null,
        partida,
        migradaDesde,
        // Terminar la cola no es reconstruir: son hechos que el registro ya tenía y el
        // estado todavía no declaraba aplicados.
        colaAplicada: cargada.colaAplicada,
        // Un registro ilegible no impide jugar: lo que se pierde es la red de seguridad.
        falloDelRegistro: cargada.falloDelRegistro,
        compactacion: cargada.compactacion,
      };
    } catch (e) {
      return { estado: APERTURAS.NO_SE_PUDO, motivo: e?.message ?? String(e) };
    }
  }

  /**
   * La partida que nace al cerrarse el arranque: estado inicial con su semilla y registro
   * vacío, escritos ya en disco.
   *
   * El registro se escribe **aunque esté vacío** y desde el primer día: `cargaPartida`
   * distingue «el registro no se puede leer» de «no está», y un registro ausente en la
   * primera sesión y presente en la segunda haría que ese diagnóstico dijera cosas
   * distintas por la edad de la partida y no por lo que le pasa.
   */
  async function nace({ semilla, personaje = null }) {
    const estado = estadoInicial({ semilla });
    // El personaje que cerró el arranque **es** el del área de la partida, y no una copia
    // suya al lado: el área es lo que se congela y lo que se exporta.
    if (personaje) estado.personaje = { ...estado.personaje, ...personaje };
    const registro = registroInicial();
    sello = null;
    await congela({ estado, registro });
    return { estado, registro };
  }

  /** Que la siguiente congelación escriba pase lo que pase. Lo usa quien sustituye la partida. */
  function olvidaElSello() {
    sello = null;
  }

  return { abre, congela, nace, hayPartida, olvidaElSello, sello: () => sello };
}
