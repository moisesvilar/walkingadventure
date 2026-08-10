// Guardar una copia y abrir una copia: las dos únicas acciones de esta fila que se ven,
// y ningún flujo. Todo lo demás que entrega —el almacén, el respaldo, la migración— no
// tiene pantalla y no debe tenerla.
//
// La hoja de compartir y el selector de ficheros **son del sistema y no se envuelven**:
// dentro del juego cualquier cosa que solo se pueda decir como aplicación es señal de
// rediseñar el momento, y aquí estamos en el único sitio donde se habla como aplicación,
// donde una aplicación resuelve guardar un fichero con la hoja del sistema. Un explorador
// propio sería inventarse una superficie que además habría que mantener. Los dos entran
// inyectados, y su ausencia es error de construcción y no un modo degradado.
//
// Y la decisión que gobierna la mitad de abajo: **importar sustituye la partida actual y
// no crea una segunda**. `alcance-del-mundo.md` §3 descarta el selector de mapas por ser
// incoherente con un juego que va de andar; un selector de partidas es lo mismo un nivel
// más arriba. La consecuencia se dice entera: importar el fichero de otra persona abre
// **su** partida, personaje incluido, que es lo que significa compartir mundo.

// Y una regla de cableado que no es de estilo (SPEC-020, repetida en SPEC-039): **el
// núcleo entra por la puerta**. Esto orquesta y no compone nada, así que recibe el
// generador igual que recibe el almacén o la hoja de compartir. Citando
// `@walkingadventure/nucleo` desde aquí, guardar y abrir una copia quedaban fuera del
// alcance de `node --test` sin instalación, y con ellos todo lo que de verdad se puede
// afirmar de esta fila. Quien monta la app sí lo cita por su nombre, en
// `app/nucleo/piezas.js`.

import { CAUSAS, creaEmpaquetador } from './empaquetador.js';

/** El vocabulario cerrado del estado de guardar. Lo consume `guardar-copia-estado`. */
export const ESTADOS_DE_GUARDAR = Object.freeze({
  INACTIVA: 'inactiva',
  EMPAQUETANDO: 'empaquetando',
  GUARDADA: 'guardada',
  NO_SE_PUDO: 'no-se-pudo',
});

/** El vocabulario cerrado del estado de abrir. Lo consume `abrir-copia-estado`. */
export const ESTADOS_DE_ABRIR = Object.freeze({
  INACTIVA: 'inactiva',
  VALIDANDO: 'validando',
  SUSTITUIR: 'sustituir',
  ABIERTA: 'abierta',
  NO_SE_PUDO: 'no-se-pudo',
});

/** Las cuatro causas de error al importar, y ninguna más. Lo consume `importar-error`. */
export const CAUSAS_DE_ERROR = Object.freeze({
  NO_ES_PARTIDA: 'no-es-partida',
  INCOMPLETO: 'incompleto',
  VERSION_MAYOR: 'version-mayor',
  FALTA_MIGRACION: 'falta-migracion',
});

/**
 * Las tres líneas de error, y ninguna más.
 *
 * Ninguna menciona rutas, códigos ni la red, y las tres dicen que la partida actual
 * sigue intacta, porque en los tres casos lo está.
 */
export const TEXTOS_DE_ERROR = Object.freeze({
  [CAUSAS_DE_ERROR.NO_ES_PARTIDA]: 'Este fichero no es una partida. Tu partida sigue como estaba.',
  [CAUSAS_DE_ERROR.INCOMPLETO]: 'Este fichero está incompleto. Tu partida sigue como estaba.',
  [CAUSAS_DE_ERROR.VERSION_MAYOR]: 'Esta copia es de una versión que este juego todavía no entiende. Tu partida sigue como estaba.',
  [CAUSAS_DE_ERROR.FALTA_MIGRACION]: 'Esta copia es de una versión que este juego todavía no entiende. Tu partida sigue como estaba.',
});

/**
 * Lo que esto le pide al generador, enumerado. Va escrito y no sobreentendido por lo
 * mismo que las piezas del sistema: un núcleo al que le falta media interfaz fallaría al
 * abrir un fichero de otra persona y no al construir.
 */
export const DEL_NUCLEO = Object.freeze([
  'VERSION_FORMATO', 'textoCanonico', 'CLASES_DE_PARTE', 'NOMBRE_DEL_MANIFIESTO', 'componeExportacion',
  'importaPartida', 'manifiestoDe', 'medidaPorClaseDeParte', 'nombreDeFichero', 'parteDeDocumento',
  'validaManifiesto', 'CADENA_DEL_FORMATO', 'migra',
]);

function exige(pieza, nombre) {
  if (typeof pieza !== 'function') {
    throw new Error(`guardar y abrir una copia necesitan ${nombre} inyectado: es del sistema y no lo envolvemos en una pantalla propia`);
  }
  return pieza;
}

/**
 * Guardar y abrir una copia, sobre un almacén y con las dos piezas del sistema.
 *
 * @param {object} piezas
 *   `almacen` el almacén duradero de la partida; `binarios` el almacén de recursos
 *   binarios residentes; `comparte` la hoja de compartir del sistema, que recibe el
 *   nombre y el contenido y decide dónde va; `elige` el selector de ficheros del
 *   sistema, que devuelve `{ cancelada }` o `{ nombre, contenido }`; `nucleo` el
 *   generador, con las trece funciones de `DEL_NUCLEO` y ni una menos.
 */
export function creaCopia({ almacen, binarios = null, comparte, elige, nucleo, cadena = null } = {}) {
  if (!almacen) throw new Error('guardar y abrir una copia necesitan el almacén de la partida inyectado');
  exige(comparte, 'la hoja de compartir del sistema');
  exige(elige, 'el selector de ficheros del sistema');
  if (!nucleo) throw new Error('guardar y abrir una copia necesitan el núcleo inyectado: es quien compone la exportación, valida el manifiesto y migra');
  const faltan = DEL_NUCLEO.filter((n) => nucleo[n] === undefined);
  if (faltan.length) {
    throw new Error(`al núcleo de guardar y abrir una copia le faltan ${faltan.length} pieza(s): ${faltan.join(', ')}`);
  }

  const {
    VERSION_FORMATO, textoCanonico, NOMBRE_DEL_MANIFIESTO,
    componeExportacion, importaPartida, manifiestoDe, medidaPorClaseDeParte,
    nombreDeFichero, parteDeDocumento, validaManifiesto,
  } = nucleo;
  const { empaqueta, desempaqueta, manifiestoDePartes } = creaEmpaquetador({ NOMBRE_DEL_MANIFIESTO });
  const cadenaVigente = cadena ?? nucleo.CADENA_DEL_FORMATO;

  /**
   * Empaqueta la partida y se la da a la hoja de compartir.
   *
   * **No toca la partida y no marca nada en ella**: guardar cuándo se hizo la última
   * copia exigiría el reloj real, que la partida no tiene, y una línea que diga «última
   * copia hace tres meses» es un reproche, que es justo el registro que este juego no usa.
   *
   * Si falla, no queda ningún fichero a medias donde nadie pueda encontrarlo: el
   * contenido no sale de aquí hasta que está entero.
   */
  async function guarda({ titulo = null } = {}) {
    const { manifiesto, partes } = await componeExportacion({ almacen, binarios });
    const contenido = empaqueta(partes);
    const nombre = nombreDeFichero(titulo ?? (await tituloDelMundoPrincipal()));
    const hoja = await comparte({ nombre, contenido });
    return {
      estado: ESTADOS_DE_GUARDAR.GUARDADA,
      // Si la hoja del sistema se descartó sin guardar. Viaja hasta aquí porque
      // **empezar de nuevo encadena el borrado a esta copia** (SPEC-040): quien cancela
      // la hoja no ha guardado nada, y borrar detrás sería la pérdida de datos más cara
      // del proyecto ocurriendo en silencio. Una hoja que no contesta se toma por
      // guardada, que es lo que era antes de que existiera este campo.
      compartida: hoja?.compartida !== false,
      nombre,
      bytes: contenido.length,
      manifiesto,
      medida: medidaPorClaseDeParte(partes),
    };
  }

  /** El título del mundo que da nombre al fichero. Sin fecha y sin nada de quien juega. */
  async function tituloDelMundoPrincipal() {
    const indices = (await almacen.lista('mapa/')).filter((c) => c.endsWith('/indice.json')).sort();
    if (!indices.length) return 'partida';
    try {
      return JSON.parse(await almacen.lee(indices[0])).titulo ?? 'partida';
    } catch {
      return 'partida';
    }
  }

  /** Si ya hay partida en el almacén, que es lo único que decide si el aviso aparece. */
  async function hayPartida() {
    return (await almacen.lista('mapa/')).length > 0 || (await almacen.lista('partida/')).length > 0;
  }

  /**
   * Lee un fichero y decide qué se puede hacer con él, **sin tocar nada**.
   *
   * Devuelve el aviso de sustitución si ya hay partida, y no lo devuelve si no la hay:
   * avisar cuando no hay nada que perder es la clase de fricción que hace que los avisos
   * dejen de leerse.
   */
  async function valida(contenido) {
    let partes;
    let manifiesto;
    try {
      partes = desempaqueta(contenido);
      manifiesto = manifiestoDePartes(partes);
    } catch (e) {
      return fallo(e.causa === CAUSAS.INCOMPLETO ? CAUSAS_DE_ERROR.INCOMPLETO : CAUSAS_DE_ERROR.NO_ES_PARTIDA, e);
    }
    // La versión antes que cualquier otro campo, con las dos versiones en el error: un
    // fichero de una versión futura no se abre ni un poco.
    if (Number.isInteger(manifiesto.version) && manifiesto.version > VERSION_FORMATO) {
      return fallo(
        CAUSAS_DE_ERROR.VERSION_MAYOR,
        new Error(`la copia está escrita en la versión de formato ${manifiesto.version} y este juego entiende la ${VERSION_FORMATO}`),
      );
    }
    try {
      validaManifiesto(manifiesto, 'la copia');
    } catch (e) {
      return fallo(CAUSAS_DE_ERROR.NO_ES_PARTIDA, e);
    }
    // Y la migración de las partes, si vienen de una versión anterior. Un salto sin paso
    // registrado **no se interpreta con las reglas nuevas**: se dice que falta.
    let migradas = partes;
    let vigente = manifiesto;
    let migradaDesde = null;
    try {
      const resultado = migraPartes(partes, cadenaVigente, nucleo);
      migradaDesde = resultado.desde;
      if (migradaDesde !== null) {
        // Migrar cambia el texto de los documentos y con él su longitud, así que el
        // manifiesto se rehace: comprobar la completitud contra el del fichero antiguo
        // diría que la copia está incompleta cuando lo que ha pasado es que se ha
        // migrado. Los recuentos son los mismos y vienen del manifiesto original.
        const sinManifiesto = resultado.partes.filter((p) => p.nombre !== NOMBRE_DEL_MANIFIESTO);
        vigente = manifiestoDe(sinManifiesto, manifiesto.recuentos);
        const parteDelManifiesto = parteDeDocumento(NOMBRE_DEL_MANIFIESTO, textoCanonico(vigente));
        migradas = [parteDelManifiesto, ...sinManifiesto];
      } else {
        migradas = resultado.partes;
      }
    } catch (e) {
      return fallo(CAUSAS_DE_ERROR.FALTA_MIGRACION, e);
    }
    const sustituye = await hayPartida();
    return {
      estado: sustituye ? ESTADOS_DE_ABRIR.SUSTITUIR : ESTADOS_DE_ABRIR.VALIDANDO,
      sustituye,
      manifiesto: vigente,
      partes: migradas,
      migradaDesde,
      error: null,
    };
  }

  /**
   * Abre el selector, valida y —si no hay nada que perder— sustituye.
   *
   * Con partida existente no se sustituye aquí: se devuelve el aviso y la decisión es de
   * quien juega, con guardar una copia primero ofrecido y lo destructivo sin ser el botón
   * principal (`partida-guardada.md` §4).
   */
  async function abre() {
    const elegido = await elige();
    if (!elegido || elegido.cancelada) return { estado: ESTADOS_DE_ABRIR.INACTIVA, cancelada: true, error: null };
    const validado = await valida(elegido.contenido);
    if (validado.error) return validado;
    if (validado.sustituye) return validado;
    return sustituye(validado);
  }

  /** Sustituye la partida por la de la copia ya validada. Es lo que confirma el aviso. */
  async function sustituye(validado) {
    await importaPartida({
      manifiesto: validado.manifiesto,
      partes: validado.partes,
      almacen,
      binarios,
      donde: 'la copia',
    });
    return { estado: ESTADOS_DE_ABRIR.ABIERTA, sustituye: false, manifiesto: validado.manifiesto, migradaDesde: validado.migradaDesde, error: null };
  }

  return { guarda, valida, abre, sustituye, hayPartida };
}

function fallo(causa, e) {
  return { estado: ESTADOS_DE_ABRIR.NO_SE_PUDO, error: { causa, texto: TEXTOS_DE_ERROR[causa], detalle: e?.message ?? String(e) } };
}

/**
 * Migra las partes de documento de una copia antigua.
 *
 * Las de recurso no se migran: son bytes y no tienen versión. La original **no se
 * toca**: lo que sale es otra lista, y la copia de origen sigue en su fichero.
 */
function migraPartes(partes, cadena, { CLASES_DE_PARTE, migra, textoCanonico }) {
  let desde = null;
  const salida = partes.map((parte) => {
    if (parte.clase === CLASES_DE_PARTE.RECURSO) return parte;
    const doc = JSON.parse(parte.contenido);
    const resultado = migra(doc, { cadena, donde: `la parte "${parte.nombre}"` });
    if (!resultado.migrado) return parte;
    desde = resultado.desde;
    return { ...parte, contenido: textoCanonico(resultado.doc) };
  });
  return { partes: salida, desde };
}
