// Exportar e importar la partida: el manifiesto canónico, la lista de partes que
// componen un fichero, la validación del manifiesto que llega y la comprobación de que
// el contenedor trae exactamente lo declarado.
//
// **El núcleo no escribe el fichero.** Entrega la lista de partes en orden canónico y
// el manifiesto, y valida lo que le devuelvan; el contenedor lo arma la app, porque el
// paquete no tiene dependencias (`arquitectura.md`) y porque así «un fichero es una
// partida» sigue siendo una validación de datos, comprobable sin fichero.
//
// Dos propiedades del contenedor que sí se sostienen desde aquí, porque son de los
// datos y no del sobre: **no lleva ninguna marca del reloj real** —una fecha rompería
// que exportar dos veces dé el mismo fichero y metería dentro un dato sobre la vida de
// quien juega— y **no comprime**, por lo mismo que SPEC-009 no comprimía: comprimir
// haría que «byte a byte» dependiera de la versión del compresor.
//
// Y lo que va dentro va entero, incluidos **los textos del narrador cacheados**: es el
// pendiente 4 de `partida-guardada.md`, cerrado en sí, porque el fichero es también la
// vía de compartir mundo y un mundo compartido sin sus textos no es el mismo mundo.

import { congelaHondo } from '../core/congelar.js';
import {
  CLASES,
  VERSION_FORMATO,
  VERSION_GENERADOR,
  aBase64,
  campos,
  compruebaVersion,
  declaraEsquema,
  deBase64,
  escribe,
  lee,
  lista,
  sinRastroDeUbicacion,
  texto as textoCanonico,
} from './formato.js';
import { exigeAlmacen } from './mapa.js';
import { CLAVES_DE_COMPACTACION, CLAVES_DE_PARTIDA } from './reconstruccion.js';

/** La extensión del fichero de partida. Declarada, para que se reconozca sin abrirlo. */
export const EXTENSION_DE_PARTIDA = '.partida';

/** El nombre de la primera parte de todo fichero: el manifiesto. */
export const NOMBRE_DEL_MANIFIESTO = 'manifiesto.json';

/** Las tres clases de parte, y ninguna más. */
export const CLASES_DE_PARTE = Object.freeze({ MANIFIESTO: 'manifiesto', DOCUMENTO: 'documento', RECURSO: 'recurso' });

/** Cómo viaja el contenido de una parte dentro del contenedor, que es texto. */
export const CODIFICACIONES = Object.freeze({ TEXTO: 'texto', BASE64: 'base64' });

/** Dónde vive la declaración de de dónde salió la partida que hay abierta. */
export const CLAVE_DE_PROCEDENCIA = 'partida/procedencia.json';

/** La marca de que hay una importación a medio escribir. Se pone antes y se quita después. */
export const CLAVE_DE_IMPORTACION_EN_CURSO = 'partida/importando.json';

/**
 * El manifiesto.
 *
 * Lleva las tres cosas que hacen falta para decidir si un fichero es una partida y si
 * está entero: **la versión de formato de la constante única de SPEC-009**, la versión
 * de las reglas con que se escribió, y la lista completa de sus partes. Los recuentos
 * no son decoración: son lo que hace que «el manifiesto declara que los textos van» y
 * «declara cero recursos» sean criterios y no inspecciones a ojo.
 */
export const ESQUEMA_MANIFIESTO = campos({
  version: 'entero',
  generador: 'texto',
  clase: 'texto',
  extension: 'texto',
  partes: lista(campos({ nombre: 'texto', clase: 'texto', codificacion: 'texto', longitud: 'entero' })),
  recuentos: campos({ documentos: 'entero', recursos: 'entero', textosDelNarrador: 'entero', mapas: 'entero' }),
});

declaraEsquema(CLASES.MANIFIESTO, ESQUEMA_MANIFIESTO);

/** De dónde salió la partida abierta: propia, importada o migrada, y desde qué versión. */
export const ESQUEMA_PROCEDENCIA = campos({
  version: 'entero',
  generador: 'texto',
  clase: 'texto',
  de: 'texto',
  migradaDesde: 'entero?',
  reglas: 'texto?',
});

declaraEsquema(CLASES.PROCEDENCIA, ESQUEMA_PROCEDENCIA);

/** Las tres procedencias posibles de una partida. Vocabulario cerrado. */
export const PROCEDENCIAS = Object.freeze({ PROPIA: 'propia', IMPORTADA: 'importacion', MIGRADA: 'migracion' });

/**
 * Los prefijos de clave que componen una partida, en orden canónico.
 *
 * Es la lista que contesta a la vez a dos preguntas: qué entra en el fichero exportado
 * y qué tiene que cubrir la copia del sistema. Que sea una sola lista es el punto:
 * mientras sean dos, una clave nueva entra en una y se queda fuera de la otra.
 */
export const PREFIJOS_DE_LA_PARTIDA = congelaHondo(['arranque/', 'camara/', 'mapa/', 'partida/']);

/**
 * Las claves de trabajo, que **no se exportan**: son de una operación a medias y no
 * partida. Están en la copia del sistema igual —cuelgan del directorio de la partida—,
 * y en el fichero exportado no, porque un fichero es una partida terminada.
 */
export const CLAVES_DE_TRABAJO = congelaHondo([
  CLAVE_DE_IMPORTACION_EN_CURSO,
  CLAVES_DE_COMPACTACION.sello,
  CLAVES_DE_COMPACTACION.registroAnterior,
]);

function nombreValido(nombre) {
  return typeof nombre === 'string' && nombre.length > 0 && !/[\t\n\r]/.test(nombre);
}

/** Una parte de documento: su nombre lógico —la clave del almacén— y su texto tal cual. */
export function parteDeDocumento(nombre, texto) {
  if (!nombreValido(nombre)) throw new Error(`el nombre de parte ${JSON.stringify(nombre)} no vale: una parte se nombra con un texto sin saltos ni tabuladores`);
  if (typeof texto !== 'string') throw new Error(`la parte "${nombre}" es un documento y su contenido tiene que ser su texto`);
  return { nombre, clase: CLASES_DE_PARTE.DOCUMENTO, codificacion: CODIFICACIONES.TEXTO, contenido: texto };
}

/** Una parte de recurso binario: viaja en base64 para que el contenedor siga siendo texto. */
export function parteDeRecurso(nombre, bytes) {
  if (!nombreValido(nombre)) throw new Error(`el nombre de parte ${JSON.stringify(nombre)} no vale: una parte se nombra con un texto sin saltos ni tabuladores`);
  const crudo = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  return { nombre, clase: CLASES_DE_PARTE.RECURSO, codificacion: CODIFICACIONES.BASE64, contenido: aBase64(crudo) };
}

/** Los bytes de una parte de recurso. */
export function bytesDeParte(parte) {
  if (parte.codificacion !== CODIFICACIONES.BASE64) throw new Error(`la parte "${parte.nombre}" no viaja en base64: no tiene bytes que devolver`);
  return deBase64(parte.contenido);
}

/** El orden canónico de las partes: por su nombre, y el manifiesto siempre el primero. */
export function ordenDePartes(a, b) {
  if (a.nombre === b.nombre) return 0;
  if (a.nombre === NOMBRE_DEL_MANIFIESTO) return -1;
  if (b.nombre === NOMBRE_DEL_MANIFIESTO) return 1;
  return a.nombre < b.nombre ? -1 : 1;
}

// --- La lista de partes de una partida ---------------------------------------

function cuentaTextosDelNarrador(texto) {
  // Se cuenta leyendo el documento y no adivinando por el texto: un recuento que
  // dependiera de una expresión regular diría cualquier cosa el día que el esquema
  // cambie, y este recuento es lo que sostiene el criterio de tamaño.
  let doc;
  try {
    doc = JSON.parse(texto);
  } catch {
    return 0;
  }
  const recursos = doc?.recursos;
  return Array.isArray(recursos?.textos) ? recursos.textos.length : 0;
}

/**
 * Las partes de la partida que hay en el almacén, en orden canónico y **sin el
 * manifiesto**, que lo pone `manifiestoDe`.
 *
 * Los recursos binarios residentes no viven en el almacén de documentos sino en el de
 * binarios, y por eso entra inyectado: sin él el fichero saldría con los huecos de las
 * ilustraciones declarados y sin ilustración dentro, que es medio mundo.
 */
export async function partesDeLaPartida({ almacen, binarios = null } = {}) {
  exigeAlmacen(almacen, 'partesDeLaPartida');
  const partes = [];
  let textosDelNarrador = 0;
  const mapas = new Set();
  for (const prefijo of PREFIJOS_DE_LA_PARTIDA) {
    for (const clave of (await almacen.lista(prefijo)) ?? []) {
      if (CLAVES_DE_TRABAJO.includes(clave)) continue;
      const texto = await almacen.lee(clave);
      if (texto == null) continue;
      partes.push(parteDeDocumento(clave, texto));
      textosDelNarrador += cuentaTextosDelNarrador(texto);
      const m = /^mapa\/([^/]+)\//.exec(clave);
      if (m) mapas.add(m[1]);
    }
  }
  const referencias = binarios ? binarios.guardados() : [];
  for (const referencia of referencias) {
    partes.push(parteDeRecurso(referencia, binarios.lee(referencia)));
  }
  partes.sort(ordenDePartes);
  return {
    partes,
    recuentos: {
      documentos: partes.filter((p) => p.clase === CLASES_DE_PARTE.DOCUMENTO).length,
      recursos: referencias.length,
      textosDelNarrador,
      mapas: mapas.size,
    },
  };
}

/**
 * El manifiesto de una lista de partes.
 *
 * `longitud` es la del contenido **ya codificado**, que es lo que el contenedor tiene
 * que encontrar: medir el original obligaría a quien lee a saber decodificar antes de
 * poder comprobar si el fichero está entero.
 */
export function manifiestoDe(partes, recuentos) {
  const ordenadas = partes.slice().sort(ordenDePartes);
  const doc = {
    version: VERSION_FORMATO,
    generador: VERSION_GENERADOR,
    clase: CLASES.MANIFIESTO,
    extension: EXTENSION_DE_PARTIDA,
    partes: ordenadas.map((p) => ({
      nombre: p.nombre,
      clase: p.clase,
      codificacion: p.codificacion,
      longitud: p.contenido.length,
    })),
    recuentos: {
      documentos: recuentos?.documentos ?? 0,
      recursos: recuentos?.recursos ?? 0,
      textosDelNarrador: recuentos?.textosDelNarrador ?? 0,
      mapas: recuentos?.mapas ?? 0,
    },
  };
  escribe(doc, ESQUEMA_MANIFIESTO, 'documento manifiesto-de-partida');
  return congelaHondo(doc);
}

/**
 * La partida entera lista para empaquetar: el manifiesto de primera parte y las demás
 * detrás, en orden canónico.
 *
 * Exportar **no toca nada**: aquí solo se lee. Una partida recién creada sin ningún
 * mapa produce su fichero igual, con manifiesto y sin celdas, y eso no es un error.
 */
export async function componeExportacion({ almacen, binarios = null } = {}) {
  const { partes, recuentos } = await partesDeLaPartida({ almacen, binarios });
  const manifiesto = manifiestoDe(partes, recuentos);
  const parteManifiesto = parteDeDocumento(NOMBRE_DEL_MANIFIESTO, textoCanonico(manifiesto));
  parteManifiesto.clase = CLASES_DE_PARTE.MANIFIESTO;
  return congelaHondo({ manifiesto, partes: [parteManifiesto, ...partes] });
}

/** Cuánto pesa cada clase de parte, que es el instrumento con el que se decide la poda. */
export function medidaPorClaseDeParte(partes) {
  const medida = { manifiesto: 0, documento: 0, recurso: 0, total: 0 };
  for (const p of partes) {
    medida[p.clase] = (medida[p.clase] ?? 0) + p.contenido.length;
    medida.total += p.contenido.length;
  }
  return congelaHondo(medida);
}

// --- Lo que llega -------------------------------------------------------------

/**
 * El manifiesto que llega, o un error que dice **qué le pasa**: que no es una partida,
 * que no declara versión, o que declara una versión mayor que la que este juego
 * entiende, con las dos versiones dentro del mensaje.
 */
export function validaManifiesto(doc, donde = 'el fichero') {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error(`${donde} no es una partida: su manifiesto no es un documento`);
  }
  if (doc.clase !== CLASES.MANIFIESTO) {
    throw new Error(`${donde} no es una partida: su primera parte se declara "${doc.clase ?? 'sin clase'}" y una partida empieza por su manifiesto`);
  }
  compruebaVersion(doc, `${donde}: el manifiesto`);
  escribe(doc, ESQUEMA_MANIFIESTO, `${donde}: el manifiesto`);
  return doc;
}

/**
 * Que el contenedor traiga **exactamente** lo que el manifiesto declara: ni una parte
 * de menos, ni una de más.
 *
 * Falla nombrando la parte. Un fichero al que le falta una parte declarada no abre una
 * partida a medias, porque lo que falta ya no se puede regenerar.
 */
export function compruebaCompletitud(manifiesto, partes, donde = 'el fichero') {
  const presentes = new Map(partes.map((p) => [p.nombre, p]));
  for (const declarada of manifiesto.partes) {
    const parte = presentes.get(declarada.nombre);
    if (!parte) throw new Error(`${donde} está incompleto: el manifiesto declara la parte "${declarada.nombre}" y el fichero no la trae`);
    if (parte.contenido.length !== declarada.longitud) {
      throw new Error(`${donde} está incompleto: la parte "${declarada.nombre}" mide ${parte.contenido.length} y el manifiesto declara ${declarada.longitud}`);
    }
  }
  const declaradas = new Set(manifiesto.partes.map((p) => p.nombre));
  for (const parte of partes) {
    if (parte.nombre === NOMBRE_DEL_MANIFIESTO) continue;
    if (!declaradas.has(parte.nombre)) throw new Error(`${donde} trae la parte "${parte.nombre}", que su manifiesto no declara`);
  }
  return manifiesto;
}

/**
 * Valida los documentos de un fichero **antes de sustituir nada**.
 *
 * Cada documento pasa por el esquema cerrado, y el estado y el registro pasan además
 * por la guarda de privacidad: un fichero al que alguien le ha añadido a mano un campo
 * con una posición de quien juega se rechaza **nombrando el campo**, en lugar de
 * entrar y quedarse dentro para siempre.
 */
export function validaPartes(manifiesto, partes, donde = 'el fichero') {
  compruebaCompletitud(manifiesto, partes, donde);
  const documentos = [];
  for (const parte of partes) {
    if (parte.nombre === NOMBRE_DEL_MANIFIESTO) continue;
    if (parte.clase === CLASES_DE_PARTE.RECURSO) continue;
    const doc = lee(parte.contenido, `${donde}: la parte "${parte.nombre}"`);
    if (doc.clase === CLASES.ESTADO || doc.clase === CLASES.REGISTRO) {
      sinRastroDeUbicacion(doc, `${donde}: la parte "${parte.nombre}"`);
    }
    documentos.push({ clave: parte.nombre, doc, texto: parte.contenido });
  }
  return documentos;
}

/** La declaración de de dónde vino la partida abierta. */
export function documentoDeProcedencia({ de, migradaDesde = null, reglas = null }) {
  const doc = {
    version: VERSION_FORMATO,
    generador: VERSION_GENERADOR,
    clase: CLASES.PROCEDENCIA,
    de,
    migradaDesde,
    reglas,
  };
  escribe(doc, ESQUEMA_PROCEDENCIA, 'documento procedencia-de-partida');
  return congelaHondo(doc);
}

/** La procedencia guardada, o la de una partida propia si nadie la ha escrito. */
export async function procedenciaDe({ almacen } = {}) {
  exigeAlmacen(almacen, 'procedenciaDe');
  const crudo = await almacen.lee(CLAVE_DE_PROCEDENCIA);
  if (crudo == null) return documentoDeProcedencia({ de: PROCEDENCIAS.PROPIA });
  return lee(crudo, 'la procedencia de la partida');
}

/**
 * Sustituye la partida del almacén por la del fichero.
 *
 * **Importar sustituye y no coexiste**: no hay dos partidas ni ninguna manera de elegir
 * entre ellas (`alcance-del-mundo.md` §3). El orden es el que hace que una importación
 * interrumpida no deje una partida a medias sin que nadie lo note: primero se valida
 * todo —y si algo falla no se ha escrito ni un byte y la partida anterior sigue
 * entera—, después se marca que hay una importación en curso, y solo entonces se borra
 * lo viejo y se escribe lo nuevo. Si el proceso muere en medio, la marca sigue puesta y
 * abrir la partida **falla nombrándola** en vez de ofrecer una mezcla.
 */
export async function importaPartida({ manifiesto, partes, almacen, binarios = null, donde = 'el fichero' } = {}) {
  exigeAlmacen(almacen, 'importaPartida');
  validaManifiesto(manifiesto, donde);
  const documentos = validaPartes(manifiesto, partes, donde);
  const recursos = partes.filter((p) => p.clase === CLASES_DE_PARTE.RECURSO);
  if (recursos.length && typeof binarios?.restaura !== 'function') {
    throw new Error(`${donde} trae ${recursos.length} recursos binarios y no hay dónde guardarlos: falta el almacén de binarios inyectado con su operación "restaura"`);
  }

  await almacen.escribe(CLAVE_DE_IMPORTACION_EN_CURSO, textoCanonico(documentoDeProcedencia({ de: PROCEDENCIAS.IMPORTADA })));

  for (const prefijo of PREFIJOS_DE_LA_PARTIDA) {
    for (const clave of (await almacen.lista(prefijo)) ?? []) {
      if (clave === CLAVE_DE_IMPORTACION_EN_CURSO) continue;
      await almacen.borra(clave);
    }
  }
  for (const { clave, texto } of documentos) await almacen.escribe(clave, texto);
  // Por referencia entera y no por clave: la referencia ya viaja escrita dentro del
  // documento del mundo, y volver a prefijarla la dejaría apuntando a otro sitio.
  for (const parte of recursos) binarios.restaura(parte.nombre, bytesDeParte(parte));
  await almacen.escribe(CLAVE_DE_PROCEDENCIA, textoCanonico(documentoDeProcedencia({ de: PROCEDENCIAS.IMPORTADA })));
  await almacen.borra(CLAVE_DE_IMPORTACION_EN_CURSO);

  return congelaHondo({
    documentos: documentos.length,
    recursos: recursos.length,
    mapas: manifiesto.recuentos.mapas,
    estado: documentos.some((d) => d.clave === CLAVES_DE_PARTIDA.estado),
    registro: documentos.some((d) => d.clave === CLAVES_DE_PARTIDA.registro),
  });
}

/**
 * Que no haya ninguna importación a medio escribir, o un error que la nombra.
 *
 * Se llama antes de abrir la partida: una mezcla de dos partidas es exactamente la
 * degradación silenciosa que este repositorio ya ha pagado siete veces.
 */
export async function exigeSinImportacionAMedias({ almacen } = {}) {
  exigeAlmacen(almacen, 'exigeSinImportacionAMedias');
  const marca = await almacen.lee(CLAVE_DE_IMPORTACION_EN_CURSO);
  if (marca != null) {
    throw new Error(`hay una importación a medio escribir (${CLAVE_DE_IMPORTACION_EN_CURSO}): la partida no se abre hasta que se vuelva a importar el fichero entero`);
  }
  return true;
}

/**
 * El nombre con el que se ofrece el fichero.
 *
 * Del título del mundo y nada más: **ninguna fecha y ningún dato de quien juega**. Una
 * fecha en el nombre es un dato sobre la vida de la jugadora en un fichero que se
 * comparte por mensajería, y el nombre se ve antes de abrir nada.
 */
export function nombreDeFichero(titulo) {
  const limpio = String(titulo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${limpio || 'partida'}${EXTENSION_DE_PARTIDA}`;
}
