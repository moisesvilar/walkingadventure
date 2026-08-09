// El diario que se consulta: un capítulo por mapa, los días de un capítulo, sus
// historias y el cierre del hilo como dato. Todo lectura pura sobre el estado ya
// cargado, sin caché y sin escribir nada.
//
// Vive aparte de `diario.js` y no dentro porque allí está lo que **escribe** el
// diario —la entrada, su clave, la regla de no sobrescribir y la proyección— y aquí
// solo lo que lo **lee**. Ninguna de estas consultas toca una entrada.
//
// Dos propiedades que este módulo sostiene con el dato y no con la pantalla, que es
// la única manera de que sigan siendo ciertas cuando alguien dibuje otra:
//
// - **Un capítulo que no es el del mapa activo no trae ninguna acción.** Los mapas
//   antiguos se leen, no se juegan desde el sofá (`alcance-del-mundo.md` §3): que no
//   se pueda no depende de que ninguna pantalla pinte un botón, sino de que el dato
//   no traiga con qué dibujarlo.
// - **El orden nunca insinúa fidelidad.** Los cuatro órdenes que hay están declarados
//   arriba, se leen desde fuera y ninguno mira el nivel — que además no llega hasta
//   aquí, porque lo que se recorre es la proyección de SPEC-016.

import { congelaHondo } from '../core/congelar.js';
import { CLASES_DE_ENTRADA, entradasDe, proyeccion } from './diario.js';
import { cargaCelda, cargaMapa, mundoDeCelda } from './mapa.js';
import { exigeMapaId } from './pasos.js';
import { hayVistaPorHistorias } from './triangulacion.js';
import { sitiosDelMundo } from './visor.js';

/** Las dos maneras de leer el diario. La segunda no está desde el principio: se gana. */
export const VISTAS = Object.freeze({ DIAS: 'dias', HISTORIAS: 'historias' });

/** Los identificadores de vista, en el orden en que se ganan. */
export const IDS_DE_VISTA = congelaHondo([VISTAS.DIAS, VISTAS.HISTORIAS]);

/**
 * El vocabulario cerrado del subtítulo de un capítulo: **dos valores y ninguna fecha**.
 *
 * Una fecha del calendario real obligaría a guardar en la partida un dato sobre la
 * vida de quien juega que el juego no necesita, y el estado no guarda ninguna marca
 * del reloj (RF-PRIV-002). El texto de la maqueta —«el verano pasado»— es maqueta.
 */
export const SUBTITULOS = Object.freeze({ DONDE_VIVES: 'donde-vives', DONDE_ESTUVISTE: 'donde-estuviste' });

/** Los dos subtítulos, en orden declarado. */
export const IDS_DE_SUBTITULO = congelaHondo([SUBTITULOS.DONDE_VIVES, SUBTITULOS.DONDE_ESTUVISTE]);

/**
 * Las acciones de juego que **ningún** capítulo del diario trae, enumeradas.
 *
 * La lista es la otra mitad del criterio: una ausencia solo se puede afirmar contra
 * una enumeración de lo que sí habría (`pipeline/decisiones-orquestador.md` §6o, y el
 * mismo mecanismo que `portada.js` usa con los bloques que la portada no tiene).
 * Añadir una acción a un capítulo obligaría a tocar esta lista, que es donde se quiere
 * que salte.
 */
export const ACCIONES_DE_JUEGO_QUE_UN_CAPITULO_NO_TRAE = congelaHondo([
  'empezar-salida',
  'aceptar-aventura',
  'cambiar-mapa-activo',
]);

/**
 * Lo que ninguna de las tres vistas enseña, por su nombre.
 *
 * Ni el nivel ni nada derivado de él, ni una cifra de esfuerzo: las únicas cifras del
 * diario son cuentas de cuánto hay dentro —los días de un capítulo, las fuentes de una
 * historia— y esas dicen cuánto has vivido, no cuánto has andado.
 */
export const LO_QUE_EL_DIARIO_NO_ENSENA = congelaHondo([
  'nivel', 'porcentaje', 'etiqueta-de-fiabilidad', 'cual-es-la-buena', 'orden-por-fidelidad',
  'barra-de-reputacion', 'escalones', 'distancia', 'tiempo', 'ritmo', 'pasos', 'progreso',
]);

/**
 * Los textos fijos de las dos pantallas de consulta. **Ninguno lleva una cifra escrita
 * a mano**: el subtítulo de un capítulo se compone al pintar, con los días que tenga.
 *
 * El subtítulo sale del vocabulario cerrado y **nunca de una fecha del calendario
 * real**, y por eso la hoja de un día se rotula con el día de diario y sin nombre de
 * día de la semana: el estado no guarda ninguna marca del reloj, así que no hay de
 * dónde sacarlo sin inventarlo. El «Jueves» de la maqueta se declara maqueta.
 */
export const TEXTOS = congelaHondo({
  volver: '‹ Volver',
  titulo: 'Tu diario',
  losUltimosDias: 'Los últimos días',
  verPorHistorias: 'Ver por historias',
  verPorDias: 'Ver por días',
  volverAlDiario: '‹ Tu diario',
  tituloDeHistorias: 'Lo que se cuenta',
  subtitulo: (cuantosDias, subtitulo) => (
    `${cuantosDias} ${cuantosDias === 1 ? 'día' : 'días'} · ${subtitulo === SUBTITULOS.DONDE_VIVES ? 'donde vives' : 'donde estuviste'}`
  ),
  hojaDeDia: (dia) => `Día ${dia}`,
  // El capítulo sin nada apuntado se lee entero igual, con su título, y una sola línea
  // en voz de mundo. Ni «vacío», ni una invitación a hacer algo para llenarlo.
  capituloSinDias: 'De aquellos días no quedó nada apuntado.',
  // Y el capítulo que no se puede abrir lo dice sin nombrar el almacén ni el fichero,
  // que es de lo que quien juega no tiene ni por qué enterarse.
  capituloQueNoSeAbre: 'De aquel sitio no se puede abrir el cuaderno.',
});

/** Los cuatro órdenes, declarados y legibles desde fuera. Ninguno mira el nivel. */
export const ORDEN_DE_CAPITULOS = 'el-del-mapa-activo-primero-y-los-demas-por-identificador';
export const ORDEN_DE_DIAS = 'del-dia-mas-reciente-al-mas-antiguo';
export const ORDEN_DE_VERSIONES = 'por-cuando-se-oyeron';
export const ORDEN_DE_HISTORIAS = 'por-la-version-mas-reciente-de-cada-suceso';

// --- Los capítulos: uno por mapa ---------------------------------------------

function exigeMapas(mapas) {
  if (!Array.isArray(mapas) || mapas.length === 0) {
    throw new Error(`el diario se lee sobre la lista de mapas de la partida y llegó ${JSON.stringify(mapas) ?? String(mapas)}: una partida siempre tiene al menos el mapa donde vive`);
  }
  return mapas.map((m, i) => {
    const id = exigeMapaId(m?.id, `el mapa ${i} de la lista con la que se abre el diario`);
    if (typeof m.titulo !== 'string' || !m.titulo) {
      throw new Error(`el mapa ${id} llega sin el título de su mundo (${JSON.stringify(m?.titulo) ?? String(m?.titulo)}): el capítulo se llama como se llama el mundo en su índice`);
    }
    return { id, titulo: m.titulo };
  });
}

/** Cuántos días de diario tiene un mapa. Un capítulo sin ninguno cuenta cero y no falla. */
function cuantosDiasDe(diario, mapaId) {
  const dias = new Set();
  for (const e of entradasDe(diario, { mapaId })) dias.add(e.dia);
  return dias.size;
}

/**
 * Los capítulos del diario: **uno por mapa de la partida y ninguno más**.
 *
 * El del mapa activo va primero y viene abierto sin que nadie lo elija —el mapa activo
 * ya lo decide dónde estás, y elegir capítulo por defecto sería la primera forma de
 * selector—; los demás salen por su identificador, que es un criterio estable y no el
 * orden en que se abrieron sus documentos.
 */
export function capitulos({ diario, mapas, mapaActivo }) {
  const suyos = exigeMapas(mapas);
  const activo = exigeMapaId(mapaActivo, 'abrir el diario');
  if (!suyos.some((m) => m.id === activo)) {
    throw new Error(`el mapa activo ${activo} no está en la lista de mapas de la partida (${suyos.map((m) => m.id).join(', ')})`);
  }
  const orden = [
    ...suyos.filter((m) => m.id === activo),
    ...suyos.filter((m) => m.id !== activo).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  ];
  return congelaHondo(orden.map((m) => ({
    mapa: m.id,
    titulo: m.titulo,
    cuantosDias: cuantosDiasDe(diario, m.id),
    subtitulo: m.id === activo ? SUBTITULOS.DONDE_VIVES : SUBTITULOS.DONDE_ESTUVISTE,
    activo: m.id === activo,
    // Vacía siempre, y en el capítulo que no es el activo lo es por construcción: no
    // hay ninguna rama de este módulo que la llene.
    acciones: [],
  })));
}

/** El capítulo de un mapa, o un error que nombra el identificador que la partida no tiene. */
export function capituloDe({ diario, mapas, mapaActivo, mapaId }) {
  const id = exigeMapaId(mapaId, 'pedir el capítulo de un mapa');
  const capitulo = capitulos({ diario, mapas, mapaActivo }).find((c) => c.mapa === id);
  if (!capitulo) {
    throw new Error(`la partida no tiene ningún mapa ${id}, así que no hay capítulo suyo que abrir`);
  }
  return capitulo;
}

/**
 * Abrir el diario: la tira de capítulos, el que viene abierto y las vistas que hay.
 *
 * **La tira no es un selector de mapas**: abrir el capítulo de otro mapa cambia lo que
 * se lee y nunca el mapa activo. Y la segunda manera de leerlo no se ofrece
 * desactivada: mientras no se ha triangulado, no está en la lista.
 */
export function abreElDiario({ diario, mapas, mapaActivo }) {
  const tira = capitulos({ diario, mapas, mapaActivo });
  return congelaHondo({
    vista: VISTAS.DIAS,
    vistas: hayVistaPorHistorias(diario) ? [...IDS_DE_VISTA] : [VISTAS.DIAS],
    capitulos: tira,
    abierto: tira[0].mapa,
    // Ni con un solo mapa ni con diez: la tira es un tomo con capítulos, no una lista
    // de opciones ni un cajón de láminas.
    esUnaEleccion: false,
    esUnSelectorDeMapas: false,
    orden: ORDEN_DE_CAPITULOS,
  });
}

// --- El diario por días ------------------------------------------------------

/** El índice de sitios contra el que se comprueba un lugar, sea lista, Set o Map. */
function indiceDeSitios(sitios) {
  if (sitios == null) return null;
  if (sitios instanceof Map) return new Set(sitios.keys());
  if (sitios instanceof Set) return sitios;
  if (Array.isArray(sitios)) return new Set(sitios.map((s) => (typeof s === 'string' ? s : s?.nombre)));
  throw new Error(`los sitios del mundo congelado llegan como ${JSON.stringify(sitios) ?? String(sitios)}: se espera una lista de nombres, un Set o el índice de sitiosDelMundo`);
}

/**
 * Los días de un capítulo, **del más reciente al más antiguo**, con lo propio y lo
 * oído separados y declarados.
 *
 * Las dos clases llegan aparte porque tienen distinta autoridad: lo propio lo sabes y
 * lo oído te lo contaron (RF-DIARIO-005). Mezclarlas en una sola lista las igualaría.
 *
 * `sitios` es el índice de sitios del mundo congelado del mapa, y con él una entrada
 * que apunte a un sitio que ese mundo no contiene falla nombrándolo, en vez de pintar
 * una entrada sin lugar. Quien abre un capítulo lo pasa siempre —`abreCapitulo` lo
 * saca de la lámina—; se admite ausente para poder leer los días sin mundo cargado.
 */
export function diasDelCapitulo(diario, { mapaId, sitios = null } = {}) {
  const id = exigeMapaId(mapaId, 'pedir los días de un capítulo');
  const indice = indiceDeSitios(sitios);
  const entradas = entradasDe(diario, { mapaId: id });
  if (indice) {
    for (const e of entradas) {
      if (!indice.has(e.lugar)) {
        throw new Error(`la entrada del suceso "${e.suceso}" dice que se oyó en "${e.lugar}", y el mundo congelado del mapa ${id} no tiene ningún sitio con ese nombre`);
      }
    }
  }
  const porDia = new Map();
  for (const proyectada of proyeccion(entradas)) {
    if (!porDia.has(proyectada.dia)) porDia.set(proyectada.dia, { dia: proyectada.dia, propio: [], oido: [] });
    const hoja = porDia.get(proyectada.dia);
    (proyectada.clase === CLASES_DE_ENTRADA.PROPIO ? hoja.propio : hoja.oido).push(proyectada);
  }
  return congelaHondo([...porDia.values()].sort((a, b) => b.dia - a.dia));
}

// --- El diario por historias, que se gana ------------------------------------

/**
 * Las versiones de un suceso, agrupadas por su identidad y **en el orden en que se
 * oyeron**.
 *
 * Sin comparar ni un texto: la identidad de suceso viaja en la entrada desde SPEC-016
 * para que agrupar sea una consulta sobre datos. Y sin ningún otro orden posible: no
 * hay orden por fidelidad, por nivel ni por fuente, porque solo existe este.
 */
export function versionesDeHistoria(diario, { mapaId, suceso }) {
  const id = exigeMapaId(mapaId, 'pedir las versiones de una historia');
  if (typeof suceso !== 'string' || !suceso) {
    throw new Error(`una historia del diario se pide por la identidad de su suceso y llegó ${JSON.stringify(suceso) ?? String(suceso)}`);
  }
  const suyas = entradasDe(diario, { mapaId: id }).filter((e) => e.suceso === suceso);
  if (suyas.length === 0) {
    throw new Error(`el diario no tiene ninguna versión del suceso "${suceso}" en el mapa ${id}`);
  }
  return proyeccion(suyas);
}

/**
 * El cierre de un hilo, **como dato y no como frase**: de cuántas fuentes distintas
 * salió la historia.
 *
 * La frase de la maqueta —«Tres sitios, tres campanas distintas»— no se copia: depende
 * de un número que solo existe en la maqueta y `lenguaje.md` lo prohíbe. Aquí va el
 * número; la plantilla parametrizada que lo dice es de la fila 17.
 */
export function cierreDelHilo(versiones) {
  const fuentes = new Set((versiones ?? []).map((v) => JSON.stringify([v.fuente.tipo, v.fuente.sitio, v.fuente.puesto ?? null])));
  const sitios = new Set((versiones ?? []).map((v) => v.lugar));
  return congelaHondo({ fuentes: fuentes.size, sitios: sitios.size, versiones: (versiones ?? []).length });
}

/**
 * Las historias de un capítulo: cada suceso con sus versiones y su cierre de hilo.
 *
 * Un suceso con una sola versión **aparece igual**: esconderlo convertiría la vista en
 * una lista de lo que ya has triangulado, que es un marcador de progreso, y la pantalla
 * se titula «Lo que se cuenta», no «lo que has cazado». Y lo que se cuenta de la propia
 * jugadora sale con el mismo formato y sin sección aparte.
 *
 * La lista se ordena por el momento de la versión más reciente de cada suceso, que es
 * lo mismo que hace la vista por días un nivel más arriba: ordenar por número de
 * versiones premiaría triangular y convertiría el diario en un marcador.
 */
export function historiasDelCapitulo(diario, { mapaId } = {}) {
  const id = exigeMapaId(mapaId, 'pedir las historias de un capítulo');
  const porSuceso = new Map();
  for (const proyectada of proyeccion(entradasDe(diario, { mapaId: id }))) {
    if (!porSuceso.has(proyectada.suceso)) porSuceso.set(proyectada.suceso, []);
    porSuceso.get(proyectada.suceso).push(proyectada);
  }
  const historias = [...porSuceso.entries()].map(([suceso, versiones]) => ({
    suceso,
    versiones,
    cierre: cierreDelHilo(versiones),
    // La última de la lista es la más reciente, porque las versiones vienen en el
    // orden en que se oyeron y ese orden no se toca.
    reciente: versiones[versiones.length - 1],
  }));
  historias.sort((a, b) => (
    b.reciente.dia !== a.reciente.dia ? b.reciente.dia - a.reciente.dia
      : b.reciente.paso !== a.reciente.paso ? b.reciente.paso - a.reciente.paso
        : a.suceso < b.suceso ? -1 : a.suceso > b.suceso ? 1 : 0
  ));
  return congelaHondo(historias.map(({ suceso, versiones, cierre }) => ({ suceso, versiones, cierre, orden: ORDEN_DE_VERSIONES })));
}

// --- La lámina de un capítulo ------------------------------------------------

/**
 * La lámina del mapa de un capítulo: sus celdas con su mundo congelado dentro.
 *
 * Se lee del almacén y **no se genera nada**: un mapa antiguo se ve como se quedó. Si
 * al almacén le falta el documento de una celda, falla nombrándola —lo hace ya
 * `cargaMapa`— en lugar de enseñar un capítulo a medias.
 */
export async function laminaDelCapitulo({ almacen, mapaId, semilla = null }) {
  const id = exigeMapaId(mapaId, 'pintar la lámina de un capítulo');
  const mapa = await cargaMapa({ almacen, id, semilla });
  const celdas = [];
  // Sobre una copia de la lista: cargar una celda sustituye su ficha por el registro
  // entero dentro del mapa, y recorrer lo que se está reescribiendo es pedirlo.
  for (const ficha of mapa.celdas.slice()) {
    const registro = await cargaCelda(mapa, ficha.celda, { almacen });
    celdas.push({ clave: registro.clave, documento: mundoDeCelda(mapa, ficha.celda) });
  }
  return { mapa: id, titulo: mapa.titulo, celdas };
}

/** Los nombres de todos los sitios de una lámina, para comprobar los lugares del diario. */
export function sitiosDeLaLamina(lamina) {
  const nombres = new Set();
  for (const celda of lamina?.celdas ?? []) {
    for (const nombre of sitiosDelMundo(celda.documento).keys()) nombres.add(nombre);
  }
  return nombres;
}

/**
 * Un capítulo abierto entero: sus días, sus caras conocidas y su lámina, **y nada más**.
 *
 * Ninguna acción de juego, ni en el capítulo del mapa activo ni en los demás: el diario
 * es donde se lee lo vivido. Con la lámina delante se comprueban además los lugares de
 * sus entradas contra el mundo congelado de ese mapa.
 */
export function abreCapitulo({ diario, mapas, mapaActivo, mapaId, lamina = null, caras = [] }) {
  const capitulo = capituloDe({ diario, mapas, mapaActivo, mapaId });
  const sitios = lamina ? sitiosDeLaLamina(lamina) : null;
  const dias = diasDelCapitulo(diario, { mapaId: capitulo.mapa, sitios });
  return congelaHondo({
    ...capitulo,
    dias,
    caras: caras.slice(),
    lamina,
    // La segunda manera de leer se gana, y el capítulo que no es el activo la tiene
    // igual: enseña las historias de su mapa y ninguna de otro.
    vistas: hayVistaPorHistorias(diario) ? [...IDS_DE_VISTA] : [VISTAS.DIAS],
    historias: hayVistaPorHistorias(diario) ? historiasDelCapitulo(diario, { mapaId: capitulo.mapa }) : null,
    orden: ORDEN_DE_DIAS,
  });
}
