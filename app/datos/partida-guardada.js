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
   */
  async function migraDocumentos() {
    const migrados = [];
    let migradaDesde = null;
    let reglas = null;
    for (const clave of [CLAVES_DE_PARTIDA.estado, CLAVES_DE_PARTIDA.registro]) {
      const crudo = await almacen.lee(clave);
      if (crudo == null) continue;
      let doc;
      try {
        doc = lee(crudo, `el documento ${clave}`);
      } catch (e) {
        if (clave === CLAVES_DE_PARTIDA.registro) continue;
        throw e;
      }
      const resultado = migra(doc, {
        cadena: cadenaVigente,
        donde: `el documento ${clave}`,
        hasta: destino,
      });
      if (!resultado.migrado) continue;
      // Se levanta antes de escribirlo, y por eso `levantaEstado` y `levantaRegistro` se
      // llaman aquí y no solo dentro de `cargaPartida`: un documento migrado que no se
      // puede levantar se descarta entero, en vez de sustituir al bueno y fallar más tarde
      // sin que nadie sepa de dónde vino.
      //
      // Solo cuando el destino es la versión de verdad, por lo mismo que `migra` solo
      // valida el esquema entonces: una migración de prueba llega a una versión que ningún
      // esquema describe, y ese es justo el punto de que se pueda ejercitar hoy.
      if (destino === nucleo.VERSION_FORMATO) {
        if (clave === CLAVES_DE_PARTIDA.estado) levantaEstado(resultado.doc, 'el estado de la partida migrado');
        else levantaRegistro(resultado.doc);
      }
      migrados.push({ clave, texto: textoCanonico(resultado.doc) });
      migradaDesde = migradaDesde === null ? resultado.desde : Math.min(migradaDesde, resultado.desde);
      reglas = resultado.reglas;
    }
    if (!migrados.length) return null;
    // Los dos juntos o ninguno: un estado migrado junto a un registro que no lo está son
    // dos versiones de formato a la vez dentro de la misma partida.
    for (const { clave, texto } of migrados) await soloLoJugado.escribe(clave, texto);
    await soloLoJugado.escribe(
      CLAVE_DE_PROCEDENCIA,
      textoCanonico(documentoDeProcedencia({ de: PROCEDENCIAS.MIGRADA, migradaDesde, reglas })),
    );
    return migradaDesde;
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
      // El sello se pone con lo que acaba de salir del disco: una congelación inmediata
      // después de abrir no reescribe nada, que es lo que hace barato congelar al volver de
      // cada pantalla de consulta.
      sello = textoDelEstado(cargada.estado, cargada.registro ?? registroInicial());
      return {
        estado: APERTURAS.ABIERTA,
        motivo: null,
        partida: { estado: cargada.estado, registro: cargada.registro ?? registroInicial() },
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
