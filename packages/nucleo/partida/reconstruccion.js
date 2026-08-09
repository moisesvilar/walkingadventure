// Lo que cruza el estado y el registro: reproducir los hechos sobre el estado
// inicial, compararlo con el estado guardado, y el orden en que se escriben los dos.
//
// «Se guarda dos veces» tiene un fallo obvio —si el apagón cae entre las dos
// escrituras, alguien queda por detrás—, y la regla que lo cierra decide el orden:
//
//   1 · **el registro se anexa primero**, entero o nada;
//   2 · **el estado se escribe después** y declara hasta qué hecho está aplicado;
//   3 · **al cargar**, los hechos posteriores a esa marca se aplican hacia delante, y
//       los anteriores o iguales, jamás.
//
// Así «manda el estado» queda preciso en lugar de aproximado: **el estado manda
// sobre lo que ya declara haber aplicado**, y terminar la cola pendiente no es
// reconstruir, es terminar una escritura interrumpida. Con el orden al revés, un
// apagón perdería hechos sin que nada se pusiera rojo, que es la forma de fallo que
// este repo ya ha pagado cinco veces (`pipeline/decisiones-orquestador.md` §6h).
//
// Y reproducir **solo se ejecuta cuando alguien lo pide**: cargar una partida no
// reconstruye nunca. Si el estado no se lee, la carga falla diciéndolo y diciendo
// cuántos hechos hay disponibles, y la decisión de aceptar un estado que puede
// diferir se toma fuera del núcleo. Reconstruir por iniciativa propia sería disimular
// el fallo, que es justo lo que `partida-guardada.md` §2 prohíbe.

import { congelaHondo } from '../core/congelar.js';
import { apunta as apuntaEnDiario, entradaDeHecho } from './diario.js';
import { AREAS_QUE_NO_REPRODUCEN, congelaEstado, estadoInicial, levantaEstado, pisaSitio } from './estado.js';
import { VERSION_GENERADOR, lee, texto as textoCanonico } from './formato.js';
import { areaDeTipo, congelaRegistro, cuantosHechos, hechosDesde, levantaRegistro } from './hechos.js';
import { exigeAlmacen } from './mapa.js';
import { npcsDeMapa } from './npcs.js';
import { sedimenta, versionQueLlego } from './nucleos.js';
import { guarda as guardaObjeto } from './objetos.js';
import { estadoDeMapa } from './pasos.js';
import { claveDeCara } from './puestos.js';

/** Dónde viven los dos documentos de la partida dentro del almacén. */
export const CLAVES_DE_PARTIDA = Object.freeze({
  estado: 'partida/estado.json',
  registro: 'partida/registro.json',
});

// --- Reproducir un hecho ------------------------------------------------------
//
// El reparto de trabajo de un hecho es este: lo que es **dato** —qué se oyó, dónde,
// cuándo— viaja en su carga inerte y se recupera verbatim; lo que es **regla** —qué
// rango sale de lo que llegó, qué desbloquea un objeto— se recalcula al reproducir.
// Esa frontera es exactamente la que explica por qué una reconstrucción puede
// diferir: los datos no cambian entre versiones y las reglas sí.

const APLICADORES = {
  'paso-ejecutado'(vivo, h) {
    const registro = estadoDeMapa(vivo.pasos, h.mapa);
    // El contador va al máximo visto y no se suma: dos hechos del mismo paso
    // reproducidos dos veces no pueden adelantar el reloj del mundo.
    registro.n = Math.max(registro.n, h.carga.n);
    registro.restoM = h.carga.restoM;
    registro.restoFondoM = h.carga.restoFondoM;
  },
  'sitio-pisado'(vivo, h) {
    pisaSitio(vivo.sitios, { mapaId: h.mapa, sitio: h.carga.sitio });
  },
  'cara-conocida'(vivo, h) {
    const registro = npcsDeMapa(vivo.npcs, h.mapa);
    const clave = claveDeCara({ sitio: h.carga.sitio, puesto: h.carga.puesto });
    if (!registro.conocidas.includes(clave)) registro.conocidas.push(clave);
  },
  'objeto-obtenido'(vivo, h) {
    guardaObjeto(vivo.objetos, { id: h.carga.id, clase: h.carga.clase, procedencia: h.carga.procedencia, dia: h.carga.diaDeRepisa });
  },
  'version-oida'(vivo, h) {
    const entrada = entradaDeHecho(h);
    apuntaEnDiario(vivo.diario, entrada);
    // Lo que sedimentó en el pueblo se recupera del mismo hecho, que es lo que hace
    // que los rangos vuelvan sin reproducir la propagación: reproducirla ataría la
    // reconstrucción a que las reglas de deformación no hubieran cambiado, y es
    // justo lo que una reconstrucción no puede prometer.
    if (entrada.fuente.tipo !== 'nucleo') return;
    sedimenta(vivo.nucleos, {
      mapaId: h.mapa,
      nucleo: entrada.fuente.sitio,
      loQueLlego: versionQueLlego({
        rumor: entrada.suceso,
        plantilla: entrada.plantilla,
        origen: entrada.origen,
        nivel: entrada.nivel,
        signo: entrada.signo,
        hechos: entrada.hechos,
        ejes: [],
        texto: entrada.texto,
        oidoEn: entrada.paso,
      }),
    });
  },
};

/**
 * Aplica un hecho sobre un estado vivo.
 *
 * Un tipo que ninguna área declara **hace fallar la reproducción nombrándolo** en
 * lugar de saltárselo: saltarse hechos produciría un estado reconstruido incompleto
 * que además se declara correcto, que es peor que no abrir. Un tipo declarado por un
 * área que no se reproduce —porque todavía no tiene estado, o porque su hecho no
 * lleva dentro con qué reconstruirla— se reconoce, no altera nada y **se declara** en
 * el resultado, que es lo contrario de perderlo en silencio.
 */
export function aplicaHecho(vivo, h) {
  const area = areaDeTipo(h.tipo);
  const aplicador = APLICADORES[h.tipo];
  if (!aplicador) {
    if (AREAS_QUE_NO_REPRODUCEN.includes(area)) return { area, aplicado: false };
    throw new Error(`el hecho "${h.tipo}" es del área "${area}", que no dice cómo se reproduce: sin eso el estado reconstruido saldría incompleto y se declararía correcto`);
  }
  aplicador(vivo, h);
  return { area, aplicado: true };
}

/**
 * Aplica una lista de hechos sobre un estado vivo, en el orden en que están
 * anexados, y devuelve qué áreas se reprodujeron y cuáles se reconocieron sin
 * estado.
 */
export function aplicaHechos(vivo, hechos) {
  const reproducidas = [];
  const sinEstadoTodavia = [];
  hechos.forEach((h, i) => {
    let resultado;
    try {
      resultado = aplicaHecho(vivo, h);
    } catch (e) {
      throw new Error(`el hecho ${i + 1} de ${hechos.length} no se puede reproducir: ${e.message}`);
    }
    const donde = resultado.aplicado ? reproducidas : sinEstadoTodavia;
    if (!donde.includes(resultado.area)) donde.push(resultado.area);
  });
  return { reproducidas: reproducidas.slice().sort(), sinEstadoTodavia: sinEstadoTodavia.slice().sort() };
}

// --- Reconstruir --------------------------------------------------------------

/**
 * Reproduce el registro entero sobre el estado inicial de una partida.
 *
 * **Avisa siempre** de que el resultado puede diferir: es una reproducción de reglas
 * sobre hechos, y las reglas son código que cambia. Cuando además la versión de
 * reglas grabada en el registro no es la actual, el aviso declara las dos — ese campo
 * nace en SPEC-009 precisamente para esto y aquí se le da su primer uso.
 *
 * **El texto que se le enseña a la jugadora no se escribe aquí.** Es el pendiente 3
 * de `partida-guardada.md` —«qué se le dice al jugador si la reconstrucción de
 * emergencia da otro estado»— y sigue abierto: lo que esta capa entrega es el
 * resultado declarado, y la redacción es de quien decida el registro de voz.
 *
 * Un registro vacío da el estado inicial de una partida y no un error: no haber
 * hecho nada todavía es un estado, no una avería. Un hecho corrupto a la mitad falla
 * nombrándolo y no devuelve ningún estado a medias.
 */
export function reconstruye({ registro, semilla }) {
  const vivo = estadoInicial({ semilla });
  const hechos = hechosDesde(registro, -1);
  const areas = aplicaHechos(vivo, hechos);
  const reglasDelRegistro = registro?.reglas ?? VERSION_GENERADOR;
  vivo.aplicadoHasta = hechos.length - 1;
  vivo.reconstruido = { reglasDelRegistro, reglasDeLaReproduccion: VERSION_GENERADOR, hechos: hechos.length };
  return congelaHondo({
    estado: vivo,
    hechos: hechos.length,
    areas,
    aviso: {
      // Sin condicionar a ninguna versión: el escenario «El registro basta para
      // reconstruir» pide el aviso a secas, y una reproducción de reglas sobre
      // hechos puede diferir aunque el número no se haya movido.
      puedeDiferir: true,
      reglasDelRegistro,
      reglasDeLaReproduccion: VERSION_GENERADOR,
      reglasCambiaron: reglasDelRegistro !== VERSION_GENERADOR,
    },
  });
}

// --- Discrepar ----------------------------------------------------------------

function recorre(guardado, candidato, ruta, salida) {
  if (guardado === candidato) return;
  const objetos = guardado !== null && candidato !== null && typeof guardado === 'object' && typeof candidato === 'object'
    && Array.isArray(guardado) === Array.isArray(candidato);
  if (!objetos) {
    // Los dos lados siempre, y `null` donde falta uno: una diferencia que no dice
    // qué había en el lado que no la tiene no se puede auditar.
    salida.push({ campo: ruta, guardado: guardado ?? null, registro: candidato ?? null });
    return;
  }
  if (Array.isArray(guardado)) {
    if (guardado.length !== candidato.length) {
      salida.push({ campo: `${ruta}.length`, guardado: guardado.length, registro: candidato.length });
      return;
    }
    guardado.forEach((v, i) => recorre(v, candidato[i], `${ruta}[${i}]`, salida));
    return;
  }
  // Las claves de los dos lados, en orden declarado: una diferencia no puede salir
  // en distinto sitio según en qué orden se construyeran los dos objetos.
  const claves = [...new Set([...Object.keys(guardado), ...Object.keys(candidato)])].sort();
  for (const clave of claves) recorre(guardado[clave], candidato[clave], `${ruta}.${clave}`, salida);
}

/**
 * El diagnóstico de la discrepancia entre el estado guardado y el que sale de
 * reproducir el registro: **qué campo difiere y con qué valor a cada lado**.
 *
 * Gana el guardado, sin excepción y sin negociación, y consultarlo **no cambia
 * nada**: ni el estado ni el registro se tocan aquí. Es lo que `partida-guardada.md`
 * §2 llama «poder auditar por qué pasó algo», y es también la única manera de que un
 * fallo de esta capa se vea en lugar de convertirse en una partida ligeramente
 * torcida.
 */
export function diagnosticoDeDiscrepancia({ estado, registro }) {
  const guardado = congelaEstado(estado);
  const reproducido = reconstruye({ registro, semilla: estado.semilla });
  const candidato = congelaEstado(reproducido.estado);
  const diferencias = [];
  recorre(guardado.areas, candidato.areas, 'areas', diferencias);
  return congelaHondo({
    // Que gane el guardado no es una opción de esta función: es lo que devuelve.
    manda: 'estado',
    hayDiscrepancia: diferencias.length > 0,
    diferencias,
    hechos: reproducido.hechos,
    aviso: reproducido.aviso,
  });
}

// --- Guardar y cargar ---------------------------------------------------------

/**
 * Escribe la partida: **el registro primero, el estado después**.
 *
 * El estado sale declarando hasta qué hecho está aplicado, y esa marca es lo que
 * convierte un apagón entre las dos escrituras en una cola pendiente que se termina
 * al cargar, en vez de en hechos perdidos en silencio.
 *
 * Si el almacén falla al escribir, el error se propaga y **el estado y el registro
 * anteriores siguen intactos**: aquí no se borra nada antes de escribir, y sustituir
 * en un solo paso es cosa del almacén.
 */
export async function guardaPartida({ estado, registro, almacen }) {
  exigeAlmacen(almacen, 'guardaPartida');
  // El texto sale del escritor del formato y nunca de `JSON.stringify`: es lo que
  // hace afirmable el «byte a byte» y lo que valida el esquema cerrado al escribir.
  const docRegistro = congelaRegistro(registro);
  await almacen.escribe(CLAVES_DE_PARTIDA.registro, textoCanonico(docRegistro));
  const alDia = { ...estado, aplicadoHasta: cuantosHechos(registro) - 1 };
  const docEstado = congelaEstado(alDia);
  await almacen.escribe(CLAVES_DE_PARTIDA.estado, textoCanonico(docEstado));
  estado.aplicadoHasta = alDia.aplicadoHasta;
  return congelaHondo({ estado: docEstado, registro: docRegistro });
}

/**
 * Abre la partida.
 *
 * Cuatro respuestas cerradas y ninguna más:
 *
 *   · **estado legible** → se usa, y el registro **no se reproduce**. Si además hay
 *     hechos posteriores a su marca, se aplican hacia delante y el estado queda al
 *     día; los anteriores o iguales, jamás.
 *   · **estado legible y registro ilegible** → la partida se abre igual y el fallo
 *     del registro se declara sin impedir jugar: lo que se pierde es la red de
 *     seguridad, no la partida.
 *   · **estado ilegible** → falla declarando que no se puede leer y cuántos hechos
 *     tiene el registro, y **no reconstruye por su cuenta**.
 *   · **los dos ilegibles** → falla declarando las dos cosas, y no se ofrece ninguna
 *     partida a medias.
 */
export async function cargaPartida({ almacen, semilla }) {
  exigeAlmacen(almacen, 'cargaPartida');

  let registro = null;
  let falloDelRegistro = null;
  try {
    const crudo = await almacen.lee(CLAVES_DE_PARTIDA.registro);
    if (crudo == null) throw new Error('el almacén no lo tiene');
    registro = levantaRegistro(lee(crudo, 'el registro de hechos'));
  } catch (e) {
    falloDelRegistro = e.message;
  }

  let estado = null;
  let falloDelEstado = null;
  try {
    const crudo = await almacen.lee(CLAVES_DE_PARTIDA.estado);
    if (crudo == null) throw new Error('el almacén no lo tiene');
    estado = levantaEstado(lee(crudo, 'el estado de la partida'));
  } catch (e) {
    falloDelEstado = e.message;
  }

  if (falloDelEstado !== null) {
    const cuantos = registro ? cuantosHechos(registro) : null;
    const conRegistro = registro
      ? `el registro tiene ${cuantos} hechos y se puede reconstruir desde él, pero eso se pide aparte y avisa de que el resultado puede diferir`
      : `y el registro tampoco se puede leer (${falloDelRegistro}): no hay ninguna partida que ofrecer`;
    throw new Error(`el estado de la partida no se puede leer (${falloDelEstado}); ${conRegistro}`);
  }

  if (semilla !== undefined && semilla !== null && estado.semilla !== semilla) {
    throw new Error(`el estado guardado es de la partida "${estado.semilla}" y se ha pedido abrir la "${semilla}"`);
  }

  let cola = [];
  let areas = { reproducidas: [], sinEstadoTodavia: [] };
  if (registro) {
    cola = hechosDesde(registro, estado.aplicadoHasta);
    areas = aplicaHechos(estado, cola);
    estado.aplicadoHasta = cuantosHechos(registro) - 1;
  }

  return congelaHondo({
    estado,
    registro,
    // Terminar la cola **no es reconstruir**: son hechos que el registro ya tenía y
    // el estado todavía no declaraba aplicados, y aplicarlos es terminar la escritura
    // que un apagón dejó a medias.
    colaAplicada: cola.length,
    areas,
    falloDelRegistro,
  });
}
